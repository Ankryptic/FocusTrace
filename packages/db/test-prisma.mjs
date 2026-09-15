import { PrismaClient } from "@prisma/client";

const db = new PrismaClient()

try {
    const count = await db.user.count();

    console.log("Prisma Works: ", count);
} catch (error) {   
    console.error("Prisma failed:")
    console.log(error)
} finally{
    await db.$disconnect();
}