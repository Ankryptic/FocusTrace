import { cleanupExpiredActivities } from "@/lib/retention";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const cronSecret =
      process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error(
        "CRON_SECRET is not configured",
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Cleanup service is not configured",
        },
        { status: 500 },
      );
    }

    const authorization =
      request.headers.get("authorization");

    if (
      authorization !==
      `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const result =
      await cleanupExpiredActivities();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Retention cleanup error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to clean up old activity data",
      },
      { status: 500 },
    );
  }
}