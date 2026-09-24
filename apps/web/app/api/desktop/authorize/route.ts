import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createHash, randomBytes } from "node:crypto";

export async function POST() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                },
                { status: 401 }
            );
        }

        // Generate a short-lived one-time authorization code.
        const code = randomBytes(32).toString("hex");

        // Never store the raw code in the database.
        const codeHash = createHash("sha256")
            .update(code)
            .digest("hex");

        const expiresAt = new Date(
            Date.now() + 5 * 60 * 1000
        );

        await db.desktopAuthCode.create({
            data: {
                codeHash,
                userId: session.user.id,
                expiresAt,
            },
        });

        return NextResponse.json({
            success: true,
            code,
            expiresAt,
        });
    } catch (error) {
        console.error("Desktop authorization error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to authorize desktop",
            },
            { status: 500 }
        );
    }
}