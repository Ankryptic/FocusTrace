import { db } from "@focus-trace/db";

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