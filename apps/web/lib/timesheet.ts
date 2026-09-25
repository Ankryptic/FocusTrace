import { db } from "@focus-trace/db";
import { fromZonedTime } from "date-fns-tz";

const DEFAULT_TIMEOUT_MINUTES = 30;

type GenerateTimesheetOptions = {
    userId: string;
    date: string;
    timezone: string;
    inactivityTimeoutMinutes?: number;
};

type WindowInfo = {
    application: string;
    windowTitle: string;
    website: string;
};

function getLocalDayRange(date: string, timezone: string) {
    const dayStart = fromZonedTime(
        `${date}T00:00:00`,
        timezone,
    );

    const dayEnd = fromZonedTime(
        `${date}T23:59:59.999`,
        timezone,
    );

    return {
        dayStart,
        dayEnd,
    };
}

export async function generateDailyTimesheet({
    userId,
    date,
    timezone,
    inactivityTimeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
}: GenerateTimesheetOptions) {
    const { dayStart, dayEnd } = getLocalDayRange(
        date,
        timezone,
    );

    /*
     * Fetch both activity and active-window events.
     */
    const events = await db.activityEvent.findMany({
        where: {
            userId,
            timestamp: {
                gte: dayStart,
                lte: dayEnd,
            },
            type: {
                in: [
                    "MOUSE",
                    "KEYBOARD",
                    "ACTIVE_WINDOW",
                ],
            },
        },
        orderBy: {
            timestamp: "asc",
        },
    });

    if (events.length === 0) {
        return null;
    }

    const timeoutMs =
        inactivityTimeoutMinutes * 60 * 1000;

    const periods: Array<{
        startTime: Date;
        endTime: Date;
        application: string;
        windowTitle: string;
        website: string;
    }> = [];

    let currentWindow: WindowInfo = {
        application: "Unknown",
        windowTitle: "",
        website: "",
    };

    let periodStart: Date | null = null;
    let previousActivityTime: Date | null = null;

    /*
     * Create an activity period.
     *
     * This keeps the window that was active when the
     * actual mouse/keyboard activity happened.
     */
    const closePeriod = (endTime: Date) => {
        if (!periodStart || !previousActivityTime) {
            return;
        }

        periods.push({
            startTime: periodStart,
            endTime,
            application: currentWindow.application,
            windowTitle: currentWindow.windowTitle,
            website: currentWindow.website,
        });

        periodStart = null;
        previousActivityTime = null;
    };

    for (const event of events) {
        /*
         * ACTIVE_WINDOW events tell us that the employee
         * changed application/window/website.
         */
        if (event.type === "ACTIVE_WINDOW") {
            const metadata = event.metadata as
                | {
                    application?: string;
                    windowTitle?: string;
                    website?: string;
                }
                | null;

            const newWindow: WindowInfo = {
                application:
                    metadata?.application ||
                    "Unknown",

                windowTitle:
                    metadata?.windowTitle ||
                    "",

                website:
                    metadata?.website ||
                    "",
            };

            /*
             * If the employee was already active and the
             * application changed, close the previous period.
             */
            if (
                periodStart &&
                (
                    currentWindow.application !==
                    newWindow.application ||
                    currentWindow.windowTitle !==
                    newWindow.windowTitle ||
                    currentWindow.website !==
                    newWindow.website
                )
            ) {
                closePeriod(event.timestamp);
            }

            currentWindow = newWindow;

            continue;
        }

        /*
         * Only mouse and keyboard events represent
         * actual activity.
         */
        if (
            event.type !== "MOUSE" &&
            event.type !== "KEYBOARD"
        ) {
            continue;
        }

        /*
         * First activity event.
         */
        if (!periodStart) {
            periodStart = event.timestamp;
            previousActivityTime = event.timestamp;
            continue;
        }

        /*
         * Calculate inactivity gap.
         */
        const gap =
            event.timestamp.getTime() -
            previousActivityTime!.getTime();

        /*
         * If inactivity exceeds the configured timeout,
         * close the previous period and start a new one.
         */
        if (gap > timeoutMs) {
            closePeriod(previousActivityTime!);

            periodStart = event.timestamp;
            previousActivityTime = event.timestamp;

            continue;
        }

        previousActivityTime = event.timestamp;
    }

    /*
     * Close final period.
     */
    if (periodStart && previousActivityTime) {
        periods.push({
            startTime: periodStart,
            endTime: previousActivityTime,
            application: currentWindow.application,
            windowTitle: currentWindow.windowTitle,
            website: currentWindow.website,
        });
    }

    if (periods.length === 0) {
        return null;
    }

    /*
     * Create/find the daily timesheet.
     */
    const timesheet = await db.timesheet.upsert({
        where: {
            userId_date: {
                userId,
                date: dayStart,
            },
        },
        create: {
            userId,
            date: dayStart,
        },
        update: {},
    });

    /*
     * Rebuild generated entries.
     */
    await db.timesheetEntry.deleteMany({
        where: {
            timesheetId: timesheet.id,
        },
    });

    const entries = periods.map((period) => {
        let description = period.application;

        /*
         * Add website when available.
         */
        if (
            period.website &&
            period.website !== "N/A"
        ) {
            description =
                `${period.application} — ${period.website}`;
        }

        /*
         * Otherwise include the window title.
         */
        else if (period.windowTitle) {
            description =
                `${period.application} — ${period.windowTitle}`;
        }

        return {
            timesheetId: timesheet.id,
            startTime: period.startTime,
            endTime: period.endTime,
            description,
            category: "OTHER" as const,
            confidence: 1,
            approved: false,
        };
    });

    await db.timesheetEntry.createMany({
        data: entries,
    });

    return db.timesheet.findUnique({
        where: {
            id: timesheet.id,
        },
        include: {
            entries: {
                orderBy: {
                    startTime: "asc",
                },
            },
        },
    });
}