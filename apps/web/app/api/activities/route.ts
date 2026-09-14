import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

const TEST_USER_ID = "6d816c76-a738-46a7-8b14-81ce98387b5e";

export async function GET() {
    try {
        const activities = await db.activity.findMany({
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
                projectId: body.projectId ?? null
            },
            include: {
                project: true,
            },
        });

        return NextResponse.json(
            {
                success: true,
                activity,
            },
            { status: 201 }
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