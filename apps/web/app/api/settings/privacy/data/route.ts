import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

const TEST_USER_ID =
  "6d816c76-a738-46a7-8b14-81ce98387b5e";

export async function DELETE() {
  try {
    const result =
      await db.activity.deleteMany({
        where: {
          userId: TEST_USER_ID,
        },
      });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message:
        "All activity data has been deleted.",
    });
  } catch (error) {
    console.error(
      "Activity data deletion error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to delete activity data",
      },
      { status: 500 },
    );
  }
}