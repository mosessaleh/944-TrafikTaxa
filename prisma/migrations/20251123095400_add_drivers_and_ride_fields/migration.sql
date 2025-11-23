-- CreateTable
CREATE TABLE `comDriver` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `comId` INTEGER NOT NULL,
    `drFname` VARCHAR(191) NOT NULL,
    `drLname` VARCHAR(191) NOT NULL,
    `sex` ENUM('MALE', 'FEMALE') NOT NULL,
    `drAddress` VARCHAR(191) NOT NULL,
    `drPhone` VARCHAR(191) NOT NULL,
    `drEmail` VARCHAR(191) NULL,
    `licenceNr` VARCHAR(191) NOT NULL,
    `drCard` VARCHAR(191) NOT NULL,
    `rating` DOUBLE NOT NULL DEFAULT 5.00,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `car` VARCHAR(191) NULL,
    `currentRideId` INTEGER NULL,
    `drUsername` VARCHAR(191) NOT NULL,
    `drPass` VARCHAR(191) NOT NULL,
    `lastLocation` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `comDriver_drUsername_key`(`drUsername`),
    INDEX `comDriver_comId_idx`(`comId`),
    INDEX `comDriver_isOnline_idx`(`isOnline`),
    INDEX `comDriver_currentRideId_idx`(`currentRideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `PartnerCompany` ADD COLUMN `comEmail` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Ride` ADD COLUMN `car` VARCHAR(191) NULL,
    ADD COLUMN `driverId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `comDriver` ADD CONSTRAINT `comDriver_comId_fkey` FOREIGN KEY (`comId`) REFERENCES `PartnerCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;