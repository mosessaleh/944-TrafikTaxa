-- =============================================
-- DATABASE CHECK AND FIX SCRIPT
-- Date: November 12, 2025
-- Description: Check if invoice table has required fields and add them if missing
-- =============================================

-- 1. Check current structure of invoice table
DESCRIBE invoice;

-- 2. Check if required columns exist
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'invoice' 
  AND TABLE_SCHEMA = DATABASE()
ORDER BY COLUMN_NAME;

-- 3. Check if indexes exist
SHOW INDEXES FROM invoice;

-- 4. Add missing columns if they don't exist
ALTER TABLE `invoice` 
ADD COLUMN IF NOT EXISTS `paymentMethod` VARCHAR(255) NULL COMMENT 'Payment method used (card, crypto, admin_confirmed, etc.)',
ADD COLUMN IF NOT EXISTS `paymentRef` VARCHAR(255) NULL COMMENT 'Payment reference number',
ADD COLUMN IF NOT EXISTS `paymentDate` DATETIME NULL COMMENT 'Date when payment was received',
ADD COLUMN IF NOT EXISTS `paymentAmount` DECIMAL(10,2) NULL COMMENT 'Actual payment amount received',
ADD COLUMN IF NOT EXISTS `paymentNotes` TEXT NULL COMMENT 'Additional payment notes',
ADD COLUMN IF NOT EXISTS `confirmedBy` INT NULL COMMENT 'Admin ID who confirmed the payment',
ADD COLUMN IF NOT EXISTS `confirmedAt` DATETIME NULL COMMENT 'When payment was confirmed',
ADD COLUMN IF NOT EXISTS `receiptNumber` VARCHAR(255) NULL COMMENT 'Generated receipt number';

-- 5. Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS `invoice_paymentMethod_idx` ON `invoice`(`paymentMethod`);
CREATE INDEX IF NOT EXISTS `invoice_paymentRef_idx` ON `invoice`(`paymentRef`);
CREATE INDEX IF NOT EXISTS `invoice_paymentDate_idx` ON `invoice`(`paymentDate`);
CREATE INDEX IF NOT EXISTS `invoice_confirmedBy_idx` ON `invoice`(`confirmedBy`);
CREATE INDEX IF NOT EXISTS `invoice_receiptNumber_idx` ON `invoice`(`receiptNumber`);
CREATE INDEX IF NOT EXISTS `invoice_paymentStatus_paymentDate_idx` ON `invoice`(`paymentStatus`, `paymentDate`);
CREATE INDEX IF NOT EXISTS `invoice_confirmedBy_confirmedAt_idx` ON `invoice`(`confirmedBy`, `confirmedAt`);

-- 6. Test query to verify new fields are working
SELECT 
    id,
    invoiceNumber,
    paymentStatus,
    paymentMethod,
    paymentRef,
    paymentDate,
    paymentAmount,
    confirmedBy,
    confirmedAt,
    receiptNumber
FROM invoice 
LIMIT 1;

-- 7. Check total count of invoices
SELECT COUNT(*) as total_invoices FROM invoice;

-- =============================================
-- END OF SCRIPT
-- If you see the column names in step 2, the fix is successful!
-- =============================================