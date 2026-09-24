import {
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { db } from "@focus-trace/db";
import { getDesktopUserId } from "@/lib/desktop-auth";
import { b2 } from "@/lib/b2";

export const runtime = "nodejs";

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
        const privacySettings = await db.privacySettings.findUnique({
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

        // 3. Read multipart form data
        const formData = await request.formData();

        const file = formData.get("file");
        const application = formData.get("application");
        const website = formData.get("website");
        const capturedAt = formData.get("capturedAt");

        if (!(file instanceof File)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Screenshot file is required",
                },
                { status: 400 }
            );
        }

        // 4. Validate file type
        if (file.type !== "image/jpeg") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Only JPEG screenshots are supported",
                },
                { status: 400 }
            );
        }

        // 5. Protect the server from unexpectedly large uploads
        const maxSize = 5 * 1024 * 1024; // 5 MB

        if (file.size > maxSize) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Screenshot exceeds the 5 MB limit",
                },
                { status: 400 }
            );
        }

        // 6. Generate a private storage key
        const screenshotId = crypto.randomUUID();

        const date = new Date();

        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");

        const storageKey =
            `screenshots/${userId}/${year}/${month}/${day}/${screenshotId}.jpg`;

        // 7. Convert uploaded file to bytes
        const fileBuffer = Buffer.from(
            await file.arrayBuffer()
        );

        // 8. Upload JPEG to Backblaze B2
        await b2.send(
            new PutObjectCommand({
                Bucket: process.env.B2_BUCKET_NAME!,
                Key: storageKey,
                Body: fileBuffer,
                ContentType: "image/jpeg",
            })
        );

        // 9. Save metadata in PostgreSQL
        const screenshot = await db.screenshot.create({
            data: {
                userId,
                storageKey,
                application:
                    typeof application === "string"
                        ? application
                        : null,
                website:
                    typeof website === "string"
                        ? website
                        : null,
                capturedAt:
                    typeof capturedAt === "string"
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
        console.error(
            "Screenshot upload error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: "Failed to upload screenshot",
            },
            { status: 500 }
        );
    }
}