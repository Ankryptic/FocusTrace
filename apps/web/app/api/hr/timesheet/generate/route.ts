import { NextResponse } from "next/server";
import { db } from "@focus-trace/db";
import { requireHR } from "@/lib/require-hr";
import { generateDailyTimesheet } from "@/lib/timesheet";

export async function POST(request: Request) {
    try {
        const hr = await requireHR();

        if (!hr.authorized) {
            return NextResponse.json(
                {
                    success: false,
                    error: hr.error,
                },
                {
                    status: hr.status,
                }
            );
        }

        const body = await request.json();

        const userId = body.userId;
        const dateString = body.date;

        if (!userId || !dateString) {
            return NextResponse.json(
                {
                    success: false,
                    error: "userId and date are required",
                },
                {
                    status: 400,
                }
            );
        }

        const employee = await db.user.findUnique({
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

        if (!employee || employee.role !== "EMPLOYEE") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Employee not found",
                },
                {
                    status: 404,
                }
            );
        }

        const timesheet = await generateDailyTimesheet({
            userId: employee.id,
            date: dateString,
            timezone: "Asia/Kolkata",
            inactivityTimeoutMinutes:
                employee.privacySettings
                    ?.inactivityTimeoutMinutes ?? 30,
        });

        return NextResponse.json({
            success: true,
            timesheet,
        });
    } catch (error) {
        console.error("Timesheet generation error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to generate timesheet",
            },
            {
                status: 500,
            }
        );
    }
}