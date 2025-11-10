/*
  Warnings:

  - You are about to drop the column `customerName` on the `ride` table. All the data in the column will be lost.
  - You are about to drop the column `customerPhone` on the `ride` table. All the data in the column will be lost.
  - You are about to drop the column `driverId` on the `ride` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `ride` table. All the data in the column will be lost.
  - The values [ACCEPTED] on the enum `Ride_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `driver` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `passengers` to the `Ride` table without a default value. This is not possible if the table is not empty.
  - Added the required column `riderName` to the `Ride` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Ride` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `ride` DROP FOREIGN KEY `Ride_driverId_fkey`;

-- AlterTable
ALTER TABLE `ride` DROP COLUMN `customerName`,
    DROP COLUMN `customerPhone`,
    DROP COLUMN `driverId`,
    DROP COLUMN `notes`,
    ADD COLUMN `distanceKm` DECIMAL(8, 2) NULL,
    ADD COLUMN `durationMin` INTEGER NULL,
    ADD COLUMN `paid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `passengers` INTEGER NOT NULL,
    ADD COLUMN `riderName` VARCHAR(191) NOT NULL,
    ADD COLUMN `scheduled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `userId` INTEGER NOT NULL,
    MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'DISPATCHED', 'ONGOING', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'PENDING';

-- DropTable
DROP TABLE `driver`;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `hashedPassword` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `street` VARCHAR(191) NOT NULL,
    `houseNumber` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `emailVerifyCode` VARCHAR(191) NULL,
    `emailVerifyExpires` DATETIME(3) NULL,
    `resetToken` VARCHAR(191) NULL,
    `resetExpires` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dayBase` DECIMAL(10, 2) NOT NULL,
    `dayPerKm` DECIMAL(10, 2) NOT NULL,
    `dayPerMin` DECIMAL(10, 2) NOT NULL,
    `nightBase` DECIMAL(10, 2) NOT NULL,
    `nightPerKm` DECIMAL(10, 2) NOT NULL,
    `nightPerMin` DECIMAL(10, 2) NOT NULL,
    `workStart` VARCHAR(191) NOT NULL,
    `workEnd` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Ride` ADD CONSTRAINT `Ride_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
