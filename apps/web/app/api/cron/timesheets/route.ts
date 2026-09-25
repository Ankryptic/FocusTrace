import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { generateDailyTimesheet } from "@/lib/timesheet";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const cronSecret = process.env.CRON_SECRET;

    const authorization =
        request.headers.get("authorization");

    if (
        !cronSecret ||
        authorization !== `Bearer ${cronSecret}`
    ) {
        return NextResponse.json(
            {
                success: false,
                error: "Unauthorized",
            },
            { status: 401 },
        );
    }

    try {
        const employees = await db.user.findMany({
            where: {
                role: "EMPLOYEE",
            },
            select: {
                id: true,
                privacySettings: {
                    select: {
                        inactivityTimeoutMinutes: true,
                    },
                },
            },
        });

        const results = [];

        for (const employee of employees) {
            try {
                const timezone = "Asia/Kolkata";

                const today = new Date();

                const yesterday = new Date(
                    today.getTime() - 24 * 60 * 60 * 1000,
                );

                const dateString = formatInTimeZone(
                    yesterday,
                    timezone,
                    "yyyy-MM-dd",
                );

                const timesheet =
                    await generateDailyTimesheet({
                        userId: employee.id,
                        date: dateString,
                        timezone,
                        inactivityTimeoutMinutes:
                            employee
                                .privacySettings
                                ?.inactivityTimeoutMinutes ??
                            30,
                    });

                results.push({
                    userId: employee.id,
                    timezone,
                    date: formatInTimeZone(
                        yesterday,
                        timezone,
                        "yyyy-MM-dd",
                    ),
                    generated: Boolean(timesheet),
                    entries:
                        timesheet?.entries.length ??
                        0,
                });
            } catch (error) {
                console.error(
                    `Timesheet generation failed for employee ${employee.id}:`,
                    error,
                );

                results.push({
                    userId: employee.id,
                    generated: false,
                    entries: 0,
                    error: "Generation failed",
                });
            }
        }

        return NextResponse.json({
            success: true,
            employees: results,
        });
    } catch (error) {
        console.error(
            "Timesheet cron failed:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                error: "Failed to generate timesheets",
            },
            { status: 500 },
        );
    }
}