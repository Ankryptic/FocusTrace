import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@focus-trace/db";

export async function requireHR() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return {
            authorized: false as const,
            status: 401,
            error: "Unauthorized",
        };
    }

    const user = await db.user.findUnique({
        where: {
            id: session.user.id,
        },
        select: {
            id: true,
            role: true,
        },
    });

    if (!user) {
        return {
            authorized: false as const,
            status: 401,
            error: "User not found",
        };
    }

    if (user.role !== "HR") {
        return {
            authorized: false as const,
            status: 403,
            error: "HR access required",
        };
    }

    return {
        authorized: true as const,
        user,
    };
}