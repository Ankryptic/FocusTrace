import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { b2 } from "@/lib/b2";
import { db } from "@focus-trace/db";
import { requireHR } from "@/lib/require-hr";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const hr = await requireHR();

    if (!hr) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    const screenshot = await db.screenshot.findUnique({
      where: { id },
    });

    if (!screenshot) {
      return NextResponse.json(
        {
          success: false,
          error: "Screenshot not found",
        },
        { status: 404 }
      );
    }

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: screenshot.storageKey,
    });

    const url = await getSignedUrl(b2, command, {
      expiresIn: 300,
    });

    return NextResponse.json({
      success: true,
      url,
      expiresIn: 300,
    });
  } catch (error) {
    console.error("Screenshot URL API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate screenshot URL",
      },
      { status: 500 }
    );
  }
}