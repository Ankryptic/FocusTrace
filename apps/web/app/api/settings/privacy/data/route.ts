import { db } from "@focus-trace/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";

export async function DELETE() {
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

        const result = await db.activity.deleteMany({
            where: {
                userId,
            },
        });

        return NextResponse.json({
            success: true,
            deletedCount: result.count,
            message: "All activity data has been deleted.",
        });
    } catch (error) {
        console.error(
            "Activity data deletion error:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                error: "Failed to delete activity data",
            },
            { status: 500 },
        );
    }
}