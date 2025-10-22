-- AlterTable
ALTER TABLE `settings` ADD COLUMN `addressCity` VARCHAR(191) NULL DEFAULT 'Frederikssund',
    ADD COLUMN `brandName` VARCHAR(191) NULL DEFAULT '944 Trafik',
    ADD COLUMN `contactEmail` VARCHAR(191) NULL DEFAULT 'trafik@944.dk',
    ADD COLUMN `contactPhone` VARCHAR(191) NULL DEFAULT '26444944';
