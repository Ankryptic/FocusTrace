import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/auth";
import { generateDailyTimesheet } from "@/lib/timesheet";

export async function POST(request: Request) {
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

        const body = await request.json();

        const date = body.date;
        const timezone =
            body.timezone || "Asia/Kolkata";

        if (!date) {
            return NextResponse.json(
                {
                    success: false,
                    error: "date is required",
                },
                { status: 400 },
            );
        }

        const userId = session.user.id;

        const user = await db.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                role: true,
                privacySettings: {
                    select: {
                        inactivityTimeoutMinutes: true,
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error: "User not found",
                },
                { status: 404 },
            );
        }

        const timesheet =
            await generateDailyTimesheet({
                userId: user.id,
                date,
                timezone,
                inactivityTimeoutMinutes:
                    user.privacySettings
                        ?.inactivityTimeoutMinutes ?? 30,
            });

        return NextResponse.json({
            success: true,
            timesheet,
        });
    } catch (error) {
        console.error(
            "Timesheet generation error:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                error: "Failed to generate timesheet",
            },
            { status: 500 },
        );
    }
}

export async function GET(request: Request) {
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

        const { searchParams } = new URL(request.url);

        const date =
            searchParams.get("date");

        const timezone =
            searchParams.get("timezone") ||
            "Asia/Kolkata";

        if (!date) {
            return NextResponse.json(
                {
                    success: false,
                    error: "date is required",
                },
                { status: 400 },
            );
        }

        const userId = session.user.id;

        const timesheet =
            await generateDailyTimesheet({
                userId,
                date,
                timezone,
            });

        if (!timesheet) {
            return NextResponse.json({
                success: true,
                timesheet: null,
                entries: [],
            });
        }

        return NextResponse.json({
            success: true,
            timesheet: {
                id: timesheet.id,
                date: timesheet.date,
            },
            entries: timesheet.entries,
        });
    } catch (error) {
        console.error(
            "Timesheet fetch error:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                error: "Failed to load timesheet",
            },
            { status: 500 },
        );
    }
}