import { db } from "@focus-trace/db";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const users = await db.user.findMany()

        return NextResponse.json({
            success: true,
            users,
        });

    } catch (error) {
        console.log("Database Error: ", error);

        return NextResponse.json(
            {
                success: false,
                error: "Database Connection failed"
            },
            {
                status: 500
            }
        );
    }
}

export async function POST(){
    try {
        const user = await db.user.create({
            data: {
                name: "FocusTrace Test User",
            },
        })

        return NextResponse.json({
            success: true,
            user,
        })
    } catch (error) {
        console.log(error)

        return NextResponse.json(
            {
                success: false,
                error: "Could not Create User"
            },
            {
                status: 500
            }
        )
    }
}