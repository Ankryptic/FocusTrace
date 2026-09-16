-- CreateTable
CREATE TABLE "DesktopDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "DesktopDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopDevice_tokenHash_key" ON "DesktopDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "DesktopDevice_userId_idx" ON "DesktopDevice"("userId");

-- AddForeignKey
ALTER TABLE "DesktopDevice" ADD CONSTRAINT "DesktopDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
