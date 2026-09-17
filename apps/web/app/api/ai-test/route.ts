import { NextResponse } from "next/server";

export async function GET() {
    try {
        const response = await fetch(
            `${process.env.AI_SERVICE_URL}/classify`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    appName: "Visual Studio Code",
                    windowTitle: "FocusTrace - route.ts",
                }),
            }
        );

        const data = await response.json();

        return NextResponse.json({
            success: response.ok,
            aiStatus: response.status,
            aiResponse: data,
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: String(error),
            },
            { status: 500 }
        );
    }
}