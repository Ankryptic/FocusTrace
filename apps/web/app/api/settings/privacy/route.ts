import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        let settings = await db.privacySettings.findUnique({
            where: {
                userId,
            },
        });

        if (!settings) {
            settings = await db.privacySettings.create({
                data: {
                    userId,
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
        console.error("Privacy settings GET error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to load privacy settings",
            },
            { status: 500 },
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        const body = await request.json();

        if (
            body.trackingEnabled !== undefined &&
            typeof body.trackingEnabled !== "boolean"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "trackingEnabled must be a boolean",
                },
                { status: 400 },
            );
        }

        if (
            body.retentionDays !== undefined &&
            (
                !Number.isInteger(body.retentionDays) ||
                body.retentionDays < 1 ||
                body.retentionDays > 365
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "retentionDays must be an integer between 1 and 365",
                },
                { status: 400 },
            );
        }

        const settings = await db.privacySettings.upsert({
            where: {
                userId,
            },
            update: {
                ...(body.trackingEnabled !== undefined && {
                    trackingEnabled: body.trackingEnabled,
                }),
                ...(body.retentionDays !== undefined && {
                    retentionDays: body.retentionDays,
                }),
            },
            create: {
                userId,
                trackingEnabled: body.trackingEnabled ?? false,
                retentionDays: body.retentionDays ?? 30,
            },
        });

        return NextResponse.json({
            success: true,
            settings,
        });
    } catch (error) {
        console.error("Privacy settings PATCH error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to update privacy settings",
            },
            { status: 500 },
        );
    }
}