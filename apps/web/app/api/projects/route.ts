import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { getDesktopUserId } from "@/lib/desktop-auth";

async function getAuthenticatedUserId(request: Request) {
  // First try desktop token authentication
  const desktopUserId = await getDesktopUserId(request);

  if (desktopUserId) {
    return desktopUserId;
  }

  // Otherwise try normal browser authentication
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

    const projects = await db.project.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Projects GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch projects",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    if (!name) {
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
        name,
        description,
        userId,
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
    console.error("Projects POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create project",
      },
      { status: 500 },
    );
  }
}