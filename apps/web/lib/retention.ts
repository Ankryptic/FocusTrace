import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { db } from "@focus-trace/db";
import { b2 } from "@/lib/b2";

export async function cleanupExpiredActivities() {
    const settingsList = await db.privacySettings.findMany();

    let totalDeleted = 0;

    const results = [];

    for (const settings of settingsList) {
        const cutoff = new Date();

        cutoff.setDate(
            cutoff.getDate() - settings.retentionDays,
        );

        const result = await db.activity.deleteMany({
            where: {
                userId: settings.userId,
                startedAt: {
                    lt: cutoff,
                },
            },
        });

        totalDeleted += result.count;

        results.push({
            userId: settings.userId,
            deletedCount: result.count,
            retentionDays: settings.retentionDays,
            cutoff,
        });
    }

    return {
        deletedCount: totalDeleted,
        usersProcessed: settingsList.length,
        results,
    };
}

export async function cleanupExpiredScreenshots() {
    const employees = await db.user.findMany({
        where: {
            role: "EMPLOYEE",
        },
        select: {
            id: true,
            privacySettings: {
                select: {
                    retentionDays: true,
                },
            },
        },
    });

    let deletedCount = 0;
    let failedCount = 0;

    for (const employee of employees) {
        const retentionDays =
            employee.privacySettings?.retentionDays ?? 30;

        const cutoff = new Date(
            Date.now() -
            retentionDays * 24 * 60 * 60 * 1000,
        );

        const screenshots = await db.screenshot.findMany({
            where: {
                userId: employee.id,
                capturedAt: {
                    lt: cutoff,
                },
            },
            select: {
                id: true,
                storageKey: true,
            },
        });

        for (const screenshot of screenshots) {
            try {
                // Delete the actual image from B2 first
                await b2.send(
                    new DeleteObjectCommand({
                        Bucket: process.env.B2_BUCKET_NAME!,
                        Key: screenshot.storageKey,
                    }),
                );

                // Delete the database record only after B2 succeeds
                await db.screenshot.delete({
                    where: {
                        id: screenshot.id,
                    },
                });

                deletedCount++;

                console.log(
                    `Deleted expired screenshot: ${screenshot.id}`,
                );
            } catch (error) {
                failedCount++;

                console.error(
                    `Failed to delete screenshot ${screenshot.id}:`,
                    error,
                );
            }
        }
    }

    return {
        deletedCount,
        failedCount,
    };
}