-- AlterTable
ALTER TABLE `Settings`
    ADD COLUMN `minScheduledLeadMinutes` INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN `minScheduledPrice` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `minImmediatePrice` INTEGER NOT NULL DEFAULT 0;
