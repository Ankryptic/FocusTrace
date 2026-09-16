import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get("date");

        if (!dateParam) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Date is required. Use YYYY-MM-DD.",
                },
                { status: 400 },
            );
        }

        // Validate YYYY-MM-DD
        const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(dateParam);

        if (!dateMatch) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid date format. Use YYYY-MM-DD.",
                },
                { status: 400 },
            );
        }

        const startOfDay = new Date(`${dateParam}T00:00:00.000Z`);
        const endOfDay = new Date(`${dateParam}T23:59:59.999Z`);

        if (
            Number.isNaN(startOfDay.getTime()) ||
            Number.isNaN(endOfDay.getTime())
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid Date",
                },
                { status: 400 },
            );
        }

        const timesheet = await db.timesheet.findFirst({
            where: {
                userId,
                date: startOfDay,
            },
            include: {
                entries: {
                    include: {
                        project: true,
                    },
                    orderBy: {
                        startTime: "asc",
                    },
                },
            },
        });

        if (!timesheet) {
            return NextResponse.json({
                success: true,
                timesheet: null,
                entries: [],
            });
        }

        return NextResponse.json({
            success: true,
            timesheet,
            entries: timesheet.entries,
        });
    } catch (error) {
        console.error("Get timesheet error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not fetch timesheet.",
            },
            { status: 500 },
        );
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        const body = await req.json();

        const dateParam = body.date;

        if (!dateParam) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Date is required. Use YYYY-MM-DD.",
                },
                { status: 400 },
            );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid date format. Use YYYY-MM-DD.",
                },
                { status: 400 },
            );
        }

        const startOfDay = new Date(`${dateParam}T00:00:00.000Z`);
        const endOfDay = new Date(`${dateParam}T23:59:59.999Z`);

        if (
            Number.isNaN(startOfDay.getTime()) ||
            Number.isNaN(endOfDay.getTime())
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid Date",
                },
                { status: 400 },
            );
        }

        // Get classified activities belonging to the logged-in user
        const activities = await db.activity.findMany({
            where: {
                userId,
                startedAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                classification: {
                    isNot: null,
                },
            },
            include: {
                classification: true,
                project: true,
            },
            orderBy: {
                startedAt: "asc",
            },
        });

        if (activities.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No classified activities found for this date.",
                timesheet: null,
                entries: [],
            });
        }

        // Find or create timesheet for this user
        let timesheet = await db.timesheet.findFirst({
            where: {
                userId,
                date: startOfDay,
            },
        });

        if (!timesheet) {
            timesheet = await db.timesheet.create({
                data: {
                    userId,
                    date: startOfDay,
                },
            });
        }

        // Remove previous unapproved suggestions
        await db.timesheetEntry.deleteMany({
            where: {
                timesheetId: timesheet.id,
                approved: false,
            },
        });

        // --------------------------------------------------
        // AGGREGATE ACTIVITIES
        // --------------------------------------------------

        type GroupedActivity = {
            startTime: Date;
            endTime: Date;
            category:
                | "DESIGN"
                | "RESEARCH"
                | "COMMUNICATION"
                | "DOCUMENTATION"
                | "DEVELOPMENT"
                | "OTHER";
            confidence: number;
            reason: string;
            projectId: string | null;
        };

        const groupedActivities: GroupedActivity[] = [];

        for (const activity of activities) {
            if (!activity.classification) {
                continue;
            }

            const category = activity.classification.category;
            const projectId = activity.projectId;

            const previous =
                groupedActivities[groupedActivities.length - 1];

            const isSameGroup =
                previous &&
                previous.category === category &&
                previous.projectId === projectId &&
                activity.startedAt <= previous.endTime;

            if (isSameGroup) {
                previous.endTime = activity.endedAt;

                // Keep the lower confidence value
                previous.confidence = Math.min(
                    previous.confidence,
                    activity.classification.confidence,
                );

                continue;
            }

            groupedActivities.push({
                startTime: activity.startedAt,
                endTime: activity.endedAt,
                category,
                confidence: activity.classification.confidence,
                reason:
                    activity.classification.reason ??
                    `${category} activity`,
                projectId,
            });
        }

        // --------------------------------------------------
        // CREATE TIMESHEET ENTRIES
        // --------------------------------------------------

        const entries = [];

        for (const group of groupedActivities) {
            const entry = await db.timesheetEntry.create({
                data: {
                    startTime: group.startTime,
                    endTime: group.endTime,
                    description: group.reason,
                    category: group.category,
                    confidence: group.confidence,
                    approved: false,
                    timesheetId: timesheet.id,
                    projectId: group.projectId,
                },
                include: {
                    project: true,
                },
            });

            entries.push(entry);
        }

        return NextResponse.json({
            success: true,
            message: "Timesheet suggestions generated",
            timesheet,
            entries,
        });
    } catch (error) {
        console.error("Generate timesheet error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not generate timesheet.",
            },
            { status: 500 },
        );
    }
}