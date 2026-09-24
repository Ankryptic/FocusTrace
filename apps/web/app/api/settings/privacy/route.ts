import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { getDesktopUserId } from "@/lib/desktop-auth";
import { requireHR } from "@/lib/require-hr";

async function getAuthenticatedUserId(request: Request) {
    // Try Electron desktop token first
    const desktopUserId = await getDesktopUserId(request);

    if (desktopUserId) {
        return desktopUserId;
    }

    // Otherwise try browser NextAuth session
    const session = await getServerSession(authOptions);

    return session?.user?.id ?? null;
}

export async function GET(request: Request) {
    try {
        const userId = await getAuthenticatedUserId(request);

        if (!userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        let settings = await db.privacySettings.findUnique({
            where: {
                userId,
            },
        });

        // Create default settings if they don't exist
        if (!settings) {
            settings = await db.privacySettings.create({
                data: {
                    userId,
                    trackingEnabled: true,
                    retentionDays: 30,
                },
            });
        }

        return NextResponse.json({
            success: true,
            settings,
        });
    } catch (error) {
        console.error("Privacy GET error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not fetch privacy settings",
            },
            { status: 500 },
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const hr = await requireHR();

        if (!hr.authorized) {
            return NextResponse.json(
                {
                    success: false,
                    error: hr.error,
                },
                { status: hr.status },
            );
        }

        const userId = hr.user.id;

        const body = await request.json();

        const data: {
            trackingEnabled?: boolean;
            retentionDays?: number;
            inactivityTimeoutMinutes?: number;
        } = {};

        if (body.trackingEnabled !== undefined) {
            if (typeof body.trackingEnabled !== "boolean") {
                return NextResponse.json(
                    {
                        success: false,
                        error: "trackingEnabled must be a boolean",
                    },
                    { status: 400 },
                );
            }

            data.trackingEnabled = body.trackingEnabled;
        }

        if (body.retentionDays !== undefined) {
            if (
                !Number.isInteger(body.retentionDays) ||
                body.retentionDays < 1 ||
                body.retentionDays > 365
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "retentionDays must be an integer between 1 and 365",
                    },
                    { status: 400 },
                );
            }

            data.retentionDays = body.retentionDays;
        }

        if (body.inactivityTimeoutMinutes !== undefined) {
            if (
                !Number.isInteger(body.inactivityTimeoutMinutes) ||
                body.inactivityTimeoutMinutes < 1 ||
                body.inactivityTimeoutMinutes > 480
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "inactivityTimeoutMinutes must be an integer between 1 and 480",
                    },
                    { status: 400 },
                );
            }

            data.inactivityTimeoutMinutes = body.inactivityTimeoutMinutes;
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "No valid settings provided",
                },
                { status: 400 },
            );
        }

        const settings = await db.privacySettings.upsert({
            where: {
                userId,
            },
            update: data,
            create: {
                userId,
                trackingEnabled: data.trackingEnabled ?? true,
                retentionDays: data.retentionDays ?? 30,
                inactivityTimeoutMinutes:
                    data.inactivityTimeoutMinutes ?? 30,
            },
        });

        return NextResponse.json({
            success: true,
            settings,
        });
    } catch (error) {
        console.error("Privacy PATCH error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not update privacy settings",
            },
            { status: 500 },
        );
    }
}