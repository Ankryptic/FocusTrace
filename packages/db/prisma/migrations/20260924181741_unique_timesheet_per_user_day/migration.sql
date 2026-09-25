/*
  Warnings:

  - A unique constraint covering the columns `[userId,date]` on the table `Timesheet` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_userId_date_key" ON "Timesheet"("userId", "date");
