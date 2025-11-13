RISMA_MIGRATION_SQL.sql</path>
<content">-- =============================================
-- PRISMA MIGRATION: Add Payment Receipt Tracking Fields
-- Date: November 12, 2025
-- Description: Add payment receipt tracking fields to Invoice table
-- =============================================

-- Add new columns to invoice table
ALTER TABLE `invoice` 
ADD COLUMN `paymentMethod` VARCHAR(255) NULL,
ADD COLUMN `paymentRef` VARCHAR(255) NULL,
ADD COLUMN `paymentDate` DATETIME NULL,
ADD COLUMN `paymentAmount` DECIMAL(10,2) NULL,
ADD COLUMN `paymentNotes` TEXT NULL,
ADD COLUMN `confirmedBy` INT NULL,
ADD COLUMN `confirmedAt` DATETIME NULL,
ADD COLUMN `receiptNumber` VARCHAR(255) NULL;

-- Add indexes for performance optimization
CREATE INDEX `invoice_paymentMethod_idx` ON `invoice`(`paymentMethod`);
CREATE INDEX `invoice_paymentRef_idx` ON `invoice`(`paymentRef`);
CREATE INDEX `invoice_paymentDate_idx` ON `invoice`(`paymentDate`);
CREATE INDEX `invoice_confirmedBy_idx` ON `invoice`(`confirmedBy`);
CREATE INDEX `invoice_receiptNumber_idx` ON `invoice`(`receiptNumber`);
CREATE INDEX `invoice_paymentStatus_paymentDate_idx` ON `invoice`(`paymentStatus`, `paymentDate`);
CREATE INDEX `invoice_confirmedBy_confirmedAt_idx` ON `invoice`(`confirmedBy`, `confirmedAt`);

-- Add foreign key constraint for confirmedBy (if users table exists)
-- ALTER TABLE `invoice` ADD CONSTRAINT `invoice_confirmedBy_fkey` FOREIGN KEY (`confirmedBy`) REFERENCES `user`(`id`) ON DELETE SET NULL;

-- Update existing records to have default values if needed
UPDATE `invoice` SET 
  paymentStatus = COALESCE(paymentStatus, 'UNPAID'),
  status = COALESCE(status, 1),
  createdAt = COALESCE(createdAt, NOW())
WHERE paymentStatus IS NULL OR status IS NULL OR createdAt IS NULL;

-- =============================================
-- Migration Complete
-- Total columns added: 8
-- Total indexes added: 7
-- =============================================