import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { requireHR } from "@/lib/require-hr";

function getUserDayRange(
    dateParam: string,
    timezone: string,
) {
    const startOfDay = fromZonedTime(
        `${dateParam}T00:00:00`,
        timezone,
    );

    const endOfDay = fromZonedTime(
        `${dateParam}T23:59:59.999`,
        timezone,
    );

    return {
        startOfDay,
        endOfDay,
    };
}

export async function GET(
    req: Request,
    {
        params,
    }: {
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

        const { userId } = await params;

        const { searchParams } =
            new URL(req.url);

        const dateParam =
            searchParams.get("date");

        if (
            !dateParam ||
            !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Invalid or missing date. Use YYYY-MM-DD.",
                },
                { status: 400 },
            );
        }

        const timezone =
            searchParams.get("timezone") ||
            "Asia/Kolkata";

        const {
            startOfDay,
            endOfDay,
        } = getUserDayRange(
            dateParam,
            timezone,
        );

        const employee =
            await db.user.findUnique({
                where: {
                    id: userId,
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
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
                    error:
                        "Selected user is not an employee",
                },
                { status: 400 },
            );
        }

        const timesheet =
            await db.timesheet.findUnique({
                where: {
                    userId_date: {
                        userId,
                        date: startOfDay,
                    },
                },
                include: {
                    entries: {
                        orderBy: {
                            startTime: "asc",
                        },
                    },
                },
            });

        if (!timesheet) {
            return NextResponse.json({
                success: true,
                employee,
                timesheet: null,
                entries: [],
            });
        }

        return NextResponse.json({
            success: true,
            employee,
            timesheet: {
                id: timesheet.id,
                date: timesheet.date,
                createdAt: timesheet.createdAt,
            },
            entries: timesheet.entries,
        });
    } catch (error) {
        console.error(
            "HR timesheet error:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    "Could not fetch employee timesheet.",
            },
            { status: 500 },
        );
    }
}