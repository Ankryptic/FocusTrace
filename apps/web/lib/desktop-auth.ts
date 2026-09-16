import { createHash } from "node:crypto";
import { db } from "@focus-trace/db";

export async function getDesktopUserId(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const device = await db.desktopDevice.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!device) {
    return null;
  }

  // Update device usage time.
  await db.desktopDevice.update({
    where: {
      id: device.id,
    },
    data: {
      lastUsedAt: new Date(),
    },
  });

  return device.userId;
}