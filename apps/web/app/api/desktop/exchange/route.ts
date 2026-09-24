import { createHash, randomBytes } from "node:crypto";
import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const code = body?.code;

        if (typeof code !== "string" || !code) {
            return NextResponse.json(
                { success: false, error: "Authorization code is required" },
                { status: 400 }
            );
        }

        // Hash the one-time code so we never query/store the raw code.
        const codeHash = createHash("sha256")
            .update(code)
            .digest("hex");

        const authCode = await db.desktopAuthCode.findUnique({
            where: { codeHash },
        });

        if (!authCode) {
            return NextResponse.json(
                { success: false, error: "Invalid authorization code" },
                { status: 401 }
            );
        }

        if (authCode.usedAt) {
            return NextResponse.json(
                { success: false, error: "Authorization code has already been used" },
                { status: 401 }
            );
        }

        if (authCode.expiresAt <= new Date()) {
            return NextResponse.json(
                { success: false, error: "Authorization code has expired" },
                { status: 401 }
            );
        }

        // Generate the permanent desktop credential.
        const token = `ftd_${randomBytes(32).toString("hex")}`;

        const tokenHash = createHash("sha256")
            .update(token)
            .digest("hex");

        const device = await db.desktopDevice.create({
            data: {
                tokenHash,
                userId: authCode.userId,
                name: "FocusTrace Desktop",
            },
            select: {
                id: true,
            },
        });

        // Make the authorization code single-use.
        await db.desktopAuthCode.update({
            where: {
                id: authCode.id,
            },
            data: {
                usedAt: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            deviceId: device.id,
            token,
        });
    } catch (error) {
        console.error("Desktop token exchange error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to exchange authorization code",
            },
            { status: 500 }
        );
    }
}