-- CreateTable
CREATE TABLE `user_payment_methods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `last4` VARCHAR(191) NULL,
    `expiryMonth` INTEGER NULL,
    `expiryYear` INTEGER NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_payment_methods_userId_isActive_idx`(`userId`, `isActive`),
    INDEX `user_payment_methods_userId_isDefault_idx`(`userId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_payment_methods` ADD CONSTRAINT `user_payment_methods_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add savedPaymentMethodId to rides table
ALTER TABLE `ride` ADD COLUMN `savedPaymentMethodId` INTEGER NULL;

-- Add payment processing fields to rides table
ALTER TABLE `ride` ADD COLUMN `paymentRetryCount` INTEGER NULL DEFAULT 0;
ALTER TABLE `ride` ADD COLUMN `paymentNextRetry` DATETIME(3) NULL;
ALTER TABLE `ride` ADD COLUMN `paymentLastAttempt` DATETIME(3) NULL;
ALTER TABLE `ride` ADD COLUMN `paymentFailureReason` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `ride` ADD CONSTRAINT `ride_savedPaymentMethodId_fkey` FOREIGN KEY (`savedPaymentMethodId`) REFERENCES `user_payment_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `ride_savedPaymentMethodId_idx` ON `ride`(`savedPaymentMethodId`);
CREATE INDEX `ride_paymentStatus_idx` ON `ride`(`paymentStatus`);
CREATE INDEX `ride_paymentNextRetry_idx` ON `ride`(`paymentNextRetry`);