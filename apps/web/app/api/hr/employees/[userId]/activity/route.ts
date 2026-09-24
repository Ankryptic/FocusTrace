import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/require-hr";

export async function GET(
    request: Request,
    context: {
        params: Promise<{ userId: string }>;
    },
) {
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

        const { userId } = await context.params;

        const { searchParams } =
            new URL(request.url);

        const date =
            searchParams.get("date");

        let startDate: Date;
        let endDate: Date;

        if (date) {
            startDate = new Date(`${date}T00:00:00`);
            endDate = new Date(`${date}T23:59:59.999`);
        } else {
            const now = new Date();

            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
        }

        const employee = await db.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
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
                    error: "User is not an employee",
                },
                { status: 400 },
            );
        }

        const activityEvents =
            await db.activityEvent.findMany({
                where: {
                    userId,
                    timestamp: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                orderBy: {
                    timestamp: "asc",
                },
                select: {
                    id: true,
                    type: true,
                    timestamp: true,
                    mouseDistance: true,
                    mouseClicks: true,
                    keyPresses: true,
                    metadata: true,
                },
            });

        const screenshots =
            await db.screenshot.findMany({
                where: {
                    userId,
                    capturedAt: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                orderBy: {
                    capturedAt: "asc",
                },
                select: {
                    id: true,
                    storageKey: true,
                    application: true,
                    website: true,
                    capturedAt: true,
                },
            });

        return NextResponse.json({
            success: true,

            employee,

            date: {
                start: startDate,
                end: endDate,
            },

            activityEvents,

            screenshots,
        });
    } catch (error) {
        console.error(
            "HR employee activity GET error:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                error: "Could not fetch employee activity",
            },
            { status: 500 },
        );
    }
}