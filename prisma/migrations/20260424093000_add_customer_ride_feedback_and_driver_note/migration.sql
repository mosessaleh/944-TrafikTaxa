ALTER TABLE `Ride`
  ADD COLUMN `driverNote` VARCHAR(500) NULL,
  ADD COLUMN `customerRating` INTEGER NULL,
  ADD COLUMN `customerReview` VARCHAR(500) NULL,
  ADD COLUMN `customerRatedAt` DATETIME(3) NULL;

CREATE INDEX `Ride_driverId_customerRating_idx` ON `Ride`(`driverId`, `customerRating`);
