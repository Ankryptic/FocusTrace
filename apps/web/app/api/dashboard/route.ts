import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

const TEST_USER_ID = "6d816c76-a738-46a7-8b14-81ce98387b5e";

export async function GET() {
  try {
    // Today's UTC boundaries
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
        userId: TEST_USER_ID,
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

    // Total tracked time
    const totalTrackedSeconds = activities.reduce(
      (total, activity) => total + activity.duration,
      0,
    );

    // Category breakdown
    const categoryTotals: Record<string, number> = {};

    for (const activity of activities) {
      const category = activity.classification?.category ?? "OTHER";

      categoryTotals[category] =
        (categoryTotals[category] ?? 0) + activity.duration;
    }

    // Today's timesheet
    const timesheet = await db.timesheet.findFirst({
      where: {
        userId: TEST_USER_ID,
        date: startOfDay,
      },
      include: {
        entries: true,
      },
    });

    const pendingEntries =
      timesheet?.entries.filter((entry) => !entry.approved).length ?? 0;

    // Number of projects
    const projectCount = await db.project.count({
      where: {
        userId: TEST_USER_ID,
      },
    });

    // Format recent activities for the dashboard
    const recentActivities = activities.slice(0, 10).map((activity) => ({
      id: activity.id,
      application: activity.application,
      windowTitle: activity.windowTitle,
      startedAt: activity.startedAt,
      endedAt: activity.endedAt,
      duration: activity.duration,
      project: activity.project
        ? {
            id: activity.project.id,
            name: activity.project.name,
          }
        : null,
      classification: activity.classification
        ? {
            category: activity.classification.category,
            confidence: activity.classification.confidence,
            reason: activity.classification.reason,
          }
        : null,
    }));

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

      recentActivities,
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