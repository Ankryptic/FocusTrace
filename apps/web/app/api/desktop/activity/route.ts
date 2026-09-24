import { NextResponse } from "next/server";
import { db } from "@focus-trace/db";
import { getDesktopUserId } from "@/lib/desktop-auth";

type ActivityInput = {
  type: "MOUSE" | "KEYBOARD" | "ACTIVE_WINDOW";
  timestamp?: string;
  mouseDistance?: number;
  mouseClicks?: number;
  keyPresses?: number;
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const userId = await getDesktopUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Server-side tracking enforcement.
    // HR can disable tracking, and the server will reject new activity.
    const privacySettings = await db.privacySettings.findUnique({
      where: {
        userId,
      },
      select: {
        trackingEnabled: true,
      },
    });

    if (!privacySettings?.trackingEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Tracking is disabled by HR",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!Array.isArray(body.events)) {
      return NextResponse.json(
        { success: false, error: "events must be an array" },
        { status: 400 }
      );
    }

    const events = body.events as ActivityInput[];

    if (events.length === 0) {
      return NextResponse.json({ success: true, saved: 0 });
    }

    if (events.length > 100) {
      return NextResponse.json(
        { success: false, error: "Too many events in one request" },
        { status: 400 }
      );
    }

    const validTypes = new Set([
      "MOUSE",
      "KEYBOARD",
      "ACTIVE_WINDOW",
    ]);

    for (const event of events) {
      if (!validTypes.has(event.type)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid activity type: ${event.type}`,
          },
          { status: 400 }
        );
      }

      if (
        event.timestamp &&
        Number.isNaN(Date.parse(event.timestamp))
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid event timestamp",
          },
          { status: 400 }
        );
      }
    }

    await db.activityEvent.createMany({
      data: events.map((event) => ({
        userId,
        deviceId: null,
        type: event.type,
        timestamp: event.timestamp
          ? new Date(event.timestamp)
          : new Date(),
        mouseDistance: event.mouseDistance ?? null,
        mouseClicks: event.mouseClicks ?? null,
        keyPresses: event.keyPresses ?? null,
        metadata: event.metadata
          ? JSON.parse(JSON.stringify(event.metadata))
          : undefined,
      })),
    });

    return NextResponse.json({
      success: true,
      saved: events.length,
    });
  } catch (error) {
    console.error("Desktop activity ingestion error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not save activity",
      },
      { status: 500 }
    );
  }
}
