-- AlterTable
ALTER TABLE `Settings` ADD COLUMN `immediateCancellationFee` DOUBLE NOT NULL DEFAULT 50,
    ADD COLUMN `scheduledCancellationFee1` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `scheduledCancellationFee2` DOUBLE NOT NULL DEFAULT 25,
    ADD COLUMN `scheduledCancellationFee3` DOUBLE NOT NULL DEFAULT 50;