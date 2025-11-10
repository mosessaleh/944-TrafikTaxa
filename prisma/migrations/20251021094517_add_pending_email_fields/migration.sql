/*
  Warnings:

  - A unique constraint covering the columns `[pendingEmail]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `pendingEmail` VARCHAR(191) NULL,
    ADD COLUMN `pendingEmailCode` VARCHAR(191) NULL,
    ADD COLUMN `pendingEmailExpires` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_pendingEmail_key` ON `User`(`pendingEmail`);
