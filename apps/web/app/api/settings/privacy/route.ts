import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

const TEST_USER_ID =
  "6d816c76-a738-46a7-8b14-81ce98387b5e";

export async function GET() {
  try {
    let settings =
      await db.privacySettings.findUnique({
        where: {
          userId: TEST_USER_ID,
        },
      });

    /*
     * Create default settings if they
     * don't exist yet.
     */
    if (!settings) {
      settings =
        await db.privacySettings.create({
          data: {
            userId: TEST_USER_ID,
            trackingEnabled: false,
            retentionDays: 30,
          },
        });
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error(
      "Privacy settings GET error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load privacy settings",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const {
      trackingEnabled,
      retentionDays,
    } = body;

    const data: {
      trackingEnabled?: boolean;
      retentionDays?: number;
    } = {};

    if (
      trackingEnabled !== undefined
    ) {
      if (
        typeof trackingEnabled !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "trackingEnabled must be a boolean",
          },
          { status: 400 },
        );
      }

      data.trackingEnabled =
        trackingEnabled;
    }

    if (
      retentionDays !== undefined
    ) {
      if (
        typeof retentionDays !==
          "number" ||
        !Number.isInteger(
          retentionDays,
        ) ||
        retentionDays < 1 ||
        retentionDays > 365
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "retentionDays must be an integer between 1 and 365",
          },
          { status: 400 },
        );
      }

      data.retentionDays =
        retentionDays;
    }

    const settings =
      await db.privacySettings.upsert({
        where: {
          userId: TEST_USER_ID,
        },

        update: data,

        create: {
          userId: TEST_USER_ID,

          trackingEnabled:
            trackingEnabled ?? false,

          retentionDays:
            retentionDays ?? 30,
        },
      });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error(
      "Privacy settings PATCH error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to update privacy settings",
      },
      { status: 500 },
    );
  }
}