import { db } from "@focus-trace/db";

const TEST_USER_ID =
  "6d816c76-a738-46a7-8b14-81ce98387b5e";

export async function cleanupExpiredActivities(
  userId: string = TEST_USER_ID,
) {
  const settings =
    await db.privacySettings.findUnique({
      where: {
        userId,
      },
    });

  if (!settings) {
    throw new Error(
      "Privacy settings not found",
    );
  }

  const cutoff = new Date();

  cutoff.setDate(
    cutoff.getDate() -
      settings.retentionDays,
  );

  const result =
    await db.activity.deleteMany({
      where: {
        userId,
        startedAt: {
          lt: cutoff,
        },
      },
    });

  return {
    deletedCount: result.count,
    retentionDays:
      settings.retentionDays,
    cutoff,
  };
}