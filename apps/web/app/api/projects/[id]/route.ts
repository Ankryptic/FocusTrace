import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

const TEST_USER_ID = "6d816c76-a738-46a7-8b14-81ce98387b5e";

type RouteContext = {
    params: Promise<{
        id: string,
    }>;
};

export async function GET(
    request: Request,
    context: RouteContext
){
    try {
        const { id } = await context.params;

        const project = await db.project.findFirst({
            where: {
                id: id,
                userId: TEST_USER_ID,
            },
        });

        if(!project){
            return NextResponse.json(
                {
                    success: false,
                    error: "Project not found"
                },
                { status: 404 },
            );
        };

        return NextResponse.json({
            success: true,
            project,
        });

    } catch (error) {
        console.error("Get project error: ", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not fetch project"
            },
            { status: 500 },
        );
    }
}

export async function PATCH(
    request: Request,
    context: RouteContext
){
    try {
        const { id } = await context.params;
        const body = await request.json();

        const existingProject = await db.project.findFirst({
            where: {
                id,
                userId: TEST_USER_ID,
            },
        });

        if(!existingProject){
            return NextResponse.json(
                {
                    success: false,
                    error: "Project not found"
                },
                { status: 404 },
            );
        }

        const project = await db.project.update({
            where: {
                id, 
            }, 
            data: {
                ...(body.name !== undefined && {
                    name: body.name,
                }),
                ...(body.description !== undefined && {
                    description: body.description,
                }),
            },
        });

        return NextResponse.json({
            success: true,
            project,
        });

    } catch (error) {
        console.error("Update Project error: ", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not update project"
            },
            { status: 500 },
        );
    }
}


export async function DELETE(
    request: Request,
    context: RouteContext
) {
    try {
        const { id } = await context.params;

        const existingProject = await db.project.findFirst({
            where: {
                id,
            },
        });

        if(!existingProject){
            return NextResponse.json(
                {
                    success: false,
                    error: "Project not found",
                },
                { status: 404 },
            );
        }

        await db.project.delete({
            where: {
                id
            },
        });

        return NextResponse.json({
            success: true,
            message: "Project Deleted"
        });

    } catch (error) {
        console.error("Delete Project error: ", error);

        return NextResponse.json(
            {
                success: false,
                error: "Could not delete project",
            },
            {
                status: 500
            },
        );
    }
}