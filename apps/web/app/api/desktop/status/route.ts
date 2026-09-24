import { db } from "@focus-trace/db";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    try {
        const authorization = request.headers.get("authorization");

        if (!authorization?.startsWith("Bearer ")) {
            return NextResponse.json(
                {
                    success: false,
                    authenticated: false,
                    error: "Missing authorization",
                },
                { status: 401 }
            );
        }

        const token = authorization
            .slice("Bearer ".length)
            .trim();

        if (!token) {
            return NextResponse.json(
                {
                    success: false,
                    authenticated: false,
                    error: "Missing token",
                },
                { status: 401 }
            );
        }

        const tokenHash = createHash("sha256")
            .update(token)
            .digest("hex");

        const device = await db.desktopDevice.findUnique({
            where: {
                tokenHash,
            },
            select: {
                id: true,
                userId: true,
                user: {
                    select: {
                        privacySettings: {
                            select: {
                                trackingEnabled: true,
                                inactivityTimeoutMinutes: true,
                                screenshotIntervalMinutes: true,
                            },
                        },
                    },
                },
            },
        });

        if (!device) {
            return NextResponse.json(
                {
                    success: false,
                    authenticated: false,
                    error: "Desktop credential is invalid",
                },
                { status: 401 }
            );
        }

        await db.desktopDevice.update({
            where: {
                id: device.id,
            },
            data: {
                lastUsedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            authenticated: true,
            deviceId: device.id,
            trackingEnabled:
                device.user.privacySettings?.trackingEnabled ?? false,
            inactivityTimeoutMinutes:
                device.user.privacySettings?.inactivityTimeoutMinutes ?? 30,
            screenshotIntervalMinutes:
                device.user.privacySettings?.screenshotIntervalMinutes ?? 5,
        });
    } catch (error) {
        console.error("Desktop status error:", error);

        return NextResponse.json(
            {
                success: false,
                authenticated: false,
                error: "Failed to verify desktop credential",
            },
            { status: 500 }
        );
    }
}