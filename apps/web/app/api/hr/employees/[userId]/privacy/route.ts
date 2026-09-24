import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/require-hr";

type RouteContext = {
    params: Promise<{
        userId: string;
    }>;
};

export async function PATCH(
    request: Request,
    { params }: RouteContext,
) {
    try {
        const hr = await requireHR();

        if (!hr.authorized) {
            return NextResponse.json(
                { success: false, error: hr.error },
                { status: hr.status },
            );
        }

        const { userId } = await params;
        const body = await request.json();

        const employee = await db.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                role: true,
            },
        });

        if (!employee) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Employee not found",
                },
                { status: 404 },
            );
        }

        if (employee.role !== "EMPLOYEE") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Target user is not an employee",
                },
                { status: 400 },
            );
        }

        const data: {
            trackingEnabled?: boolean;
            inactivityTimeoutMinutes?: number;
            retentionDays?: number;
            screenshotIntervalMinutes?: number;
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

            data.inactivityTimeoutMinutes =
                body.inactivityTimeoutMinutes;
        }

        if (body.screenshotIntervalMinutes !== undefined) {
            if (
                !Number.isInteger(body.screenshotIntervalMinutes) ||
                body.screenshotIntervalMinutes < 1 ||
                body.screenshotIntervalMinutes > 60
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "screenshotIntervalMinutes must be an integer between 1 and 60",
                    },
                    { status: 400 },
                );
            }

            data.screenshotIntervalMinutes =
                body.screenshotIntervalMinutes;
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
                        error:
                            "retentionDays must be an integer between 1 and 365",
                    },
                    { status: 400 },
                );
            }

            data.retentionDays = body.retentionDays;
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
                inactivityTimeoutMinutes:
                    data.inactivityTimeoutMinutes ?? 30,
                screenshotIntervalMinutes:
                    data.screenshotIntervalMinutes ?? 5,
                retentionDays: data.retentionDays ?? 30,
            },
        });

        return NextResponse.json({
            success: true,
            settings,
        });
    } catch (error) {
        console.error("HR employee privacy PATCH error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not update employee privacy settings",
            },
            { status: 500 },
        );
    }
}