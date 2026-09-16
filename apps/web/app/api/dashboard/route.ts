import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";

export async function GET() {
    try {
        // Get the currently logged-in user
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

        // Get today's date in UTC
        const now = new Date();

        const startOfDay = new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
            ),
        );

        const endOfDay = new Date(
            startOfDay.getTime() + 24 * 60 * 60 * 1000,
        );

        // Get today's activities
        const activities = await db.activity.findMany({
            where: {
                userId,
                startedAt: {
                    gte: startOfDay,
                    lt: endOfDay,
                },
            },
            include: {
                project: true,
                classification: true,
            },
            orderBy: {
                startedAt: "desc",
            },
        });

        // Calculate total tracked time
        const totalTrackedSeconds = activities.reduce(
            (total, activity) => total + activity.duration,
            0,
        );

        // Get today's timesheet
        const timesheet = await db.timesheet.findFirst({
            where: {
                userId,
                date: startOfDay,
            },
            include: {
                entries: true,
            },
        });

        // Number of entries waiting for approval
        const pendingEntries =
            timesheet?.entries.filter(
                (entry) => !entry.approved,
            ).length ?? 0;

        // Get user's projects
        const projectCount = await db.project.count({
            where: {
                userId,
            },
        });

        // Calculate category totals
        const categoryTotals: Record<string, number> = {};

        for (const activity of activities) {
            const category =
                activity.classification?.category ?? "OTHER";

            categoryTotals[category] =
                (categoryTotals[category] ?? 0) +
                activity.duration;
        }

        return NextResponse.json({
            success: true,

            date: startOfDay.toISOString(),

            stats: {
                totalTrackedSeconds,
                activityCount: activities.length,
                pendingEntries,
                projectCount,
            },

            categoryTotals,

            recentActivities: activities.slice(0, 10),
        });
    } catch (error) {
        console.error("Dashboard API error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to load dashboard data",
            },
            { status: 500 },
        );
    }
}