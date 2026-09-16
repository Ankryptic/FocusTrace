import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { getDesktopUserId } from "@/lib/desktop-auth";

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

        const activities = await db.activity.findMany({
            where: {
                userId,
            },
            orderBy: {
                startedAt: "desc",
            },
            include: {
                project: true,
                classification: true,
            },
        });

        return NextResponse.json({
            success: true,
            activities,
        });
    } catch (error) {
        console.error("Get activities error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not fetch activities",
            },
            { status: 500 },
        );
    }
}

export async function POST(req: Request) {
    try {
        const userId = await getAuthenticatedUserId(req);

        if (!userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 },
            );
        }

        const body = await req.json();

        if (!body.application) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Application is required",
                },
                { status: 400 },
            );
        }

        if (!body.startedAt || !body.endedAt) {
            return NextResponse.json(
                {
                    success: false,
                    error: "StartedAt and EndedAt are required",
                },
                { status: 400 },
            );
        }

        const startedAt = new Date(body.startedAt);
        const endedAt = new Date(body.endedAt);

        if (
            Number.isNaN(startedAt.getTime()) ||
            Number.isNaN(endedAt.getTime())
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid date format",
                },
                { status: 400 },
            );
        }

        if (endedAt <= startedAt) {
            return NextResponse.json(
                {
                    success: false,
                    error: "EndedAt must be after StartedAt",
                },
                { status: 400 },
            );
        }

        /*
         * If a projectId was provided,
         * make sure that project belongs to this user.
         */
        let projectId: string | null = null;

        if (body.projectId) {
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

            projectId = project.id;
        }

        const duration = Math.floor(
            (endedAt.getTime() - startedAt.getTime()) / 1000,
        );

        const activity = await db.activity.create({
            data: {
                application: body.application,
                windowTitle: body.windowTitle ?? null,
                startedAt,
                endedAt,
                duration,
                userId,
                projectId,
            },
            include: {
                project: true,
            },
        });

        // Ask AI service to classify the activity
        try {
            const aiResponse = await fetch(
                "http://127.0.0.1:8000/classify",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        application: activity.application,
                        windowTitle: activity.windowTitle,
                    }),
                },
            );

            if (!aiResponse.ok) {
                throw new Error(
                    `AI service returned ${aiResponse.status}`,
                );
            }

            const aiResult = await aiResponse.json();
            const classification = aiResult.classification;

            // Save classification in PostgreSQL
            await db.activityClassification.create({
                data: {
                    activityId: activity.id,
                    category: classification.category,
                    confidence: classification.confidence,
                    reason: classification.reason,
                },
            });

            console.log(
                "✓ Activity classified:",
                classification,
            );
        } catch (error) {
            // Classification failure should NOT delete the activity
            console.log("AI classification failed:", error);
        }

        // Return the saved activity
        const savedActivity = await db.activity.findUnique({
            where: {
                id: activity.id,
            },
            include: {
                project: true,
                classification: true,
            },
        });

        return NextResponse.json(
            {
                success: true,
                activity: savedActivity,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Create Activity error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not create activity",
            },
            { status: 500 },
        );
    }
}