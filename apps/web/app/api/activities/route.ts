import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

const TEST_USER_ID = "6d816c76-a738-46a7-8b14-81ce98387b5e";

export async function GET() {
    try {
        const activities = await db.activity.findMany({
            where: {
                userId: TEST_USER_ID,
            },
            orderBy: {
                startedAt: "desc"
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
        console.error("Get activities error: ", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not fetch activities",
            },
            { status: 500 },
        );
    }
}

export async function POST(req: Request){
    try {
        const body = await req.json();

        if(!body.application){
            return NextResponse.json(
                {
                    success: false,
                    error: "Application is required"
                },
                { status: 400 },
            );
        }

        if(!body.startedAt || !body.endedAt){
            return NextResponse.json(
                {
                    success: false,
                    error: "StartedAt and EndedAt are required"
                },
                { status: 400 },
            );
        }

        const startedAt = new Date(body.startedAt);
        const endedAt = new Date(body.endedAt);

        if(
            Number.isNaN(startedAt.getTime()) ||
            Number.isNaN(endedAt.getTime())
        ){
            return NextResponse.json(
                {
                    success: false, 
                    error: "Invalid date format",
                },
                { status: 400 },
            );
        }

        if(endedAt <= startedAt){
            return NextResponse.json(
                {
                    success: false,
                    error: "EndedAt must be after StartedAt",
                },
                { status: 400 },
            );
        }

        const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

        const activity = await db.activity.create({
            data: {
                application: body.application,
                windowTitle: body.windowTitle ?? null,
                startedAt,
                endedAt,
                duration,
                userId: TEST_USER_ID,
                projectId: body.projectId ?? null,
            },
            include: {
                project: true,
            },
        });

        // ask ai service to classify
        try {
            const aiResponse = await fetch("http://127.0.0.1:8000/classify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    application: activity.application,
                    windowTitle: activity.windowTitle
                }),
            })

            if(!aiResponse.ok){
                throw new Error(`AI service returned ${aiResponse.status}`);
            }

            const aiResult = await aiResponse.json();
            const classification = aiResult.classification;

            // save classification in PostgreSQL
            await db.activityClassification.create({
                data: {
                    activityId: activity.id,
                    category: classification.category,
                    confidence: classification.confidence,
                    reason: classification.reason,
                },
            })

            console.log("✓ Activity classified:", classification);
        } catch (error) {
            // Classification failure should NOT delete the actvity
            console.log("AI classification failed: ", error);
        }

        // Return the activity
        const savedActivity = await db.activity.findUnique({
            where: {
                id: activity.id,
            },
            include: {
                project: true,
                classification: true,
            }
        });

        return NextResponse.json(
            {
                success: true,
                activity: savedActivity
            },
            { status: 201 },
        );

    } catch (error) {
        console.error("Create Activity error: ", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not create activity"
            },
            { status: 500 },
        );
    }
}