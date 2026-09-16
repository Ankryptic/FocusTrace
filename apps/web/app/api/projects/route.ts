import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

const TEST_USER_ID = "6d816c76-a738-46a7-8b14-81ce98387b5e";

export async function GET() {
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

        const projects = await db.project.findMany({
            where: {
                userId: userId,
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        return NextResponse.json({
            success: true,
            projects,
        })
    } catch (error) {
        console.error("Get Projects error: ", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not fetch projects"
            },
            { status: 500 },
        );
    }
}

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

        const userId = session.user.id;

        const body = await request.json();

        if (!body.name || typeof body.name !== "string") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Project name is required",
                },
                { status: 400 },
            );
        }

        const project = await db.project.create({
            data: {
                name: body.name,
                description: body.description ?? null,
                userId: userId,
            },
        });

        return NextResponse.json(
            {
                success: true,
                project,
            },
            { status: 201 },
        );

    } catch (error) {
        console.error("Create Project error: ", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not create project",
            },
            { status: 500 }
        );
    }
}