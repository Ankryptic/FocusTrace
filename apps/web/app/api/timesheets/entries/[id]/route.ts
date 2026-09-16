import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function PATCH(
    req: Request,
    context: RouteContext,
) {
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
        const { id } = await context.params;
        const body = await req.json();

        /*
         * Find the entry and verify that its timesheet
         * belongs to the authenticated user.
         */
        const existingEntry = await db.timesheetEntry.findFirst({
            where: {
                id,
                timesheet: {
                    userId,
                },
            },
        });

        if (!existingEntry) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Timesheet entry not found",
                },
                { status: 404 },
            );
        }

        const data: {
            startTime?: Date;
            endTime?: Date;
            description?: string;
            category?:
                | "DESIGN"
                | "RESEARCH"
                | "COMMUNICATION"
                | "DOCUMENTATION"
                | "DEVELOPMENT"
                | "OTHER";
            confidence?: number | null;
            approved?: boolean;
            projectId?: string | null;
        } = {};

        if (body.startTime !== undefined) {
            const startTime = new Date(body.startTime);

            if (Number.isNaN(startTime.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Invalid startTime",
                    },
                    { status: 400 },
                );
            }

            data.startTime = startTime;
        }

        if (body.endTime !== undefined) {
            const endTime = new Date(body.endTime);

            if (Number.isNaN(endTime.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Invalid endTime",
                    },
                    { status: 400 },
                );
            }

            data.endTime = endTime;
        }

        const finalStartTime =
            data.startTime ?? existingEntry.startTime;

        const finalEndTime =
            data.endTime ?? existingEntry.endTime;

        if (finalEndTime <= finalStartTime) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Endtime must be after startTime",
                },
                { status: 400 },
            );
        }

        if (body.description !== undefined) {
            if (
                typeof body.description !== "string" ||
                !body.description.trim()
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Description cannot be empty.",
                    },
                    { status: 400 },
                );
            }

            data.description = body.description.trim();
        }

        if (body.category !== undefined) {
            const validCategories = [
                "DESIGN",
                "RESEARCH",
                "COMMUNICATION",
                "DOCUMENTATION",
                "DEVELOPMENT",
                "OTHER",
            ];

            if (!validCategories.includes(body.category)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Invalid category",
                    },
                    { status: 400 },
                );
            }

            data.category = body.category;
        }

        if (body.confidence !== undefined) {
            if (
                body.confidence !== null &&
                (
                    typeof body.confidence !== "number" ||
                    body.confidence < 0 ||
                    body.confidence > 1
                )
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Confidence must be between 0 and 1.",
                    },
                    { status: 400 },
                );
            }

            data.confidence = body.confidence;
        }

        if (body.approved !== undefined) {
            if (typeof body.approved !== "boolean") {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Approved must be boolean.",
                    },
                    { status: 400 },
                );
            }

            data.approved = body.approved;
        }

        /*
         * If projectId is being changed,
         * verify that the project belongs to this user.
         */
        if (body.projectId !== undefined) {
            if (body.projectId === null) {
                data.projectId = null;
            } else {
                const project = await db.project.findFirst({
                    where: {
                        id: body.projectId,
                        userId,
                    },
                });

                if (!project) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: "Project not found",
                        },
                        { status: 404 },
                    );
                }

                data.projectId = project.id;
            }
        }

        const entry = await db.timesheetEntry.update({
            where: {
                id,
            },
            data,
            include: {
                project: true,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Timesheet entry updated.",
            entry,
        });
    } catch (error) {
        console.error(
            "Update timesheet entry error:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                error: "Could not update timesheet entry.",
            },
            { status: 500 },
        );
    }
}

export async function DELETE(
    req: Request,
    context: RouteContext,
) {
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
        const { id } = await context.params;

        /*
         * Only find the entry if its parent timesheet
         * belongs to the authenticated user.
         */
        const existingEntry = await db.timesheetEntry.findFirst({
            where: {
                id,
                timesheet: {
                    userId,
                },
            },
        });

        if (!existingEntry) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Timesheet entry not found.",
                },
                { status: 404 },
            );
        }

        await db.timesheetEntry.delete({
            where: {
                id,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Timesheet entry deleted.",
        });
    } catch (error) {
        console.error(
            "Delete timesheet error:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                error: "Could not delete timesheet entry.",
            },
            { status: 500 },
        );
    }
}