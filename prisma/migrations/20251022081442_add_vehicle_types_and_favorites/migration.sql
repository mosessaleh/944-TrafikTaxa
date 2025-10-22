-- 1) جداول جديدة: VehicleType + FavoriteAddress
CREATE TABLE IF NOT EXISTS `VehicleType` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `key` ENUM('SEDAN5','SEVEN_NO_BAG','VAN','LIMO') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `capacity` INT NOT NULL DEFAULT 4,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `multiplier` DOUBLE NOT NULL DEFAULT 1.0,
  `note` VARCHAR(191) NULL,
  UNIQUE INDEX `VehicleType_key_key` (`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `FavoriteAddress` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `address` VARCHAR(191) NOT NULL,
  `lat` DOUBLE NULL,
  `lon` DOUBLE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `FavoriteAddress_userId_idx` (`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `FavoriteAddress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) عمود vehicleTypeId مؤقتًا كـ NULL
ALTER TABLE `Ride` ADD COLUMN `vehicleTypeId` INT NULL;

-- 3) إدخال/تحديث أنواع السيارات الافتراضية
INSERT INTO `VehicleType` (`key`,`title`,`capacity`,`active`,`multiplier`)
VALUES
  ('SEDAN5','5-seater car',5, TRUE, 1.00),
  ('SEVEN_NO_BAG','7-seater (no luggage)',7, TRUE, 1.20),
  ('VAN','Van',8, TRUE, 1.50),
  ('LIMO','Luxe limousine',4, TRUE, 2.00)
ON DUPLICATE KEY UPDATE
  `title`=VALUES(`title`),
  `capacity`=VALUES(`capacity`),
  `active`=VALUES(`active`),
  `multiplier`=VALUES(`multiplier`);

-- 4) تعبئة السجلات القديمة بقيمة افتراضية (SEDAN5)
UPDATE `Ride`
SET `vehicleTypeId` = (SELECT `id` FROM `VehicleType` WHERE `key`='SEDAN5' LIMIT 1)
WHERE `vehicleTypeId` IS NULL;

-- 5) تحويل العمود إلى NOT NULL + إضافة المفتاح الخارجي
ALTER TABLE `Ride` MODIFY `vehicleTypeId` INT NOT NULL;
ALTER TABLE `Ride` ADD CONSTRAINT `Ride_vehicleTypeId_fkey`
  FOREIGN KEY (`vehicleTypeId`) REFERENCES `VehicleType`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
