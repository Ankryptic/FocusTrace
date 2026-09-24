import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/require-hr";

export async function GET() {
    try {
        const hr = await requireHR();

        if (!hr.authorized) {
            return NextResponse.json(
                { success: false, error: hr.error },
                { status: hr.status },
            );
        }

        const employees = await db.user.findMany({
            where: {
                role: "EMPLOYEE",
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                privacySettings: {
                    select: {
                        trackingEnabled: true,
                        inactivityTimeoutMinutes: true,
                        screenshotIntervalMinutes: true,
                        retentionDays: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });

        return NextResponse.json({
            success: true,
            employees,
        });
    } catch (error) {
        console.error("HR employees GET error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not fetch employees",
            },
            { status: 500 },
        );
    }
}