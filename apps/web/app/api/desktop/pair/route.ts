import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createHash, randomBytes } from "node:crypto";

export async function POST(request: Request) {
  try {
    // 1. Make sure the user is logged in
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

    // 2. Read optional device name
    let body: { name?: unknown } = {};

    try {
      body = await request.json();
    } catch {
      // Empty body is allowed
    }

    const name =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim().slice(0, 100)
        : "FocusTrace Desktop";

    // 3. Generate a secure random token
    const token = `ftd_${randomBytes(32).toString("hex")}`;

    // 4. Store ONLY the hash in PostgreSQL
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const device = await db.desktopDevice.create({
      data: {
        name,
        tokenHash,
        userId: session.user.id,
      },
    });

    // 5. Return the raw token ONCE
    return NextResponse.json({
      success: true,
      device: {
        id: device.id,
        name: device.name,
      },
      token,
    });
  } catch (error) {
    console.error("Desktop pairing error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to pair desktop device",
      },
      { status: 500 },
    );
  }
}