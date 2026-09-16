import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

const TEST_USER_ID =
  "6d816c76-a738-46a7-8b14-81ce98387b5e";

export async function GET() {
  try {
    const activities = await db.activity.findMany({
      where: {
        userId: TEST_USER_ID,
      },
      include: {
        project: true,
        classification: true,
      },
      orderBy: {
        startedAt: "asc",
      },
    });

    /*
     * --------------------------------
     * Total tracked time
     * --------------------------------
     */

    const totalTrackedSeconds =
      activities.reduce(
        (total, activity) =>
          total + activity.duration,
        0,
      );

    /*
     * --------------------------------
     * Category breakdown
     * --------------------------------
     */

    const categoryTotals: Record<
      string,
      number
    > = {};

    for (const activity of activities) {
      const category =
        activity.classification?.category ??
        "OTHER";

      categoryTotals[category] =
        (categoryTotals[category] ?? 0) +
        activity.duration;
    }

    /*
     * --------------------------------
     * Project breakdown
     * --------------------------------
     */

    const projectTotals: Record<
      string,
      {
        projectId: string | null;
        projectName: string;
        seconds: number;
      }
    > = {};

    for (const activity of activities) {
      const projectId =
        activity.project?.id ?? "unassigned";

      const projectName =
        activity.project?.name ??
        "Unassigned";

      if (!projectTotals[projectId]) {
        projectTotals[projectId] = {
          projectId:
            activity.project?.id ?? null,
          projectName,
          seconds: 0,
        };
      }

      projectTotals[projectId].seconds +=
        activity.duration;
    }

    /*
     * --------------------------------
     * Application breakdown
     * --------------------------------
     */

    const applicationTotals: Record<
      string,
      number
    > = {};

    for (const activity of activities) {
      const application =
        activity.application;

      applicationTotals[application] =
        (applicationTotals[application] ?? 0) +
        activity.duration;
    }

    /*
     * --------------------------------
     * Daily breakdown
     * --------------------------------
     */

    const dailyTotals: Record<
      string,
      number
    > = {};

    for (const activity of activities) {
      const date =
        activity.startedAt
          .toISOString()
          .slice(0, 10);

      dailyTotals[date] =
        (dailyTotals[date] ?? 0) +
        activity.duration;
    }

    /*
     * --------------------------------
     * Classification confidence
     * --------------------------------
     */

    const classifiedActivities =
      activities.filter(
        (activity) =>
          activity.classification !== null,
      );

    const averageConfidence =
      classifiedActivities.length > 0
        ? classifiedActivities.reduce(
            (total, activity) =>
              total +
              (activity.classification
                ?.confidence ?? 0),
            0,
          ) / classifiedActivities.length
        : 0;

    /*
     * --------------------------------
     * Response
     * --------------------------------
     */

    return NextResponse.json({
      success: true,

      summary: {
        totalTrackedSeconds,
        activityCount: activities.length,
        classifiedActivityCount:
          classifiedActivities.length,
        averageConfidence,
      },

      categoryTotals,

      projectTotals:
        Object.values(projectTotals),

      applicationTotals,

      dailyTotals,
    });
  } catch (error) {
    console.error(
      "Analytics API error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load analytics",
      },
      {
        status: 500,
      },
    );
  }
}