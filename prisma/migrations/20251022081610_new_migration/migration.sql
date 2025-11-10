/*
  Warnings:

  - You are about to alter the column `price` on the `ride` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Int`.
  - You are about to alter the column `distanceKm` on the `ride` table. The data in that column could be lost. The data in that column will be cast from `Decimal(8,2)` to `Double`.
  - You are about to drop the `settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX `User_pendingEmail_key` ON `user`;

-- AlterTable
ALTER TABLE `ride` MODIFY `price` INTEGER NOT NULL,
    MODIFY `distanceKm` DOUBLE NULL,
    MODIFY `passengers` INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE `settings`;

-- RenameIndex
ALTER TABLE `ride` RENAME INDEX `Ride_userId_fkey` TO `Ride_userId_idx`;

-- RenameIndex
ALTER TABLE `ride` RENAME INDEX `Ride_vehicleTypeId_fkey` TO `Ride_vehicleTypeId_idx`;
