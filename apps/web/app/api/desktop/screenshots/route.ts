import { NextResponse } from "next/server";
import { db } from "@focus-trace/db";
import { getDesktopUserId } from "@/lib/desktop-auth";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the desktop agent
    const userId = await getDesktopUserId(request);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // 2. Check whether tracking is enabled by HR
    const privacySettings =
      await db.privacySettings.findUnique({
        where: { userId },
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

    // 3. Read request body
    const body = await request.json();

    const {
      storageKey,
      application,
      website,
      capturedAt,
    } = body;

    if (!storageKey) {
      return NextResponse.json(
        {
          success: false,
          error: "storageKey is required",
        },
        { status: 400 }
      );
    }

    // 4. Save screenshot metadata
    const screenshot = await db.screenshot.create({
      data: {
        userId,
        storageKey,
        application: application ?? null,
        website: website ?? null,
        capturedAt: capturedAt
          ? new Date(capturedAt)
          : new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      screenshot: {
        id: screenshot.id,
        storageKey: screenshot.storageKey,
        application: screenshot.application,
        website: screenshot.website,
        capturedAt: screenshot.capturedAt,
      },
    });
  } catch (error) {
    console.error("Screenshot API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to save screenshot metadata",
      },
      { status: 500 }
    );
  }
}