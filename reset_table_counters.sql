-- =============================================
-- RESET TABLE AUTO-INCREMENT COUNTERS
-- Description: Reset auto-increment counters when tables are emptied
-- Usage: Run this script after clearing tables to start numbering from 1
-- =============================================

-- Reset User table auto-increment
ALTER TABLE `user` AUTO_INCREMENT = 1;

-- Reset Ride table auto-increment  
ALTER TABLE `ride` AUTO_INCREMENT = 1;

-- Reset Invoice table auto-increment
ALTER TABLE `invoice` AUTO_INCREMENT = 1;

-- Reset VehicleType table auto-increment
ALTER TABLE `vehicle_type` AUTO_INCREMENT = 1;

-- Reset FavoriteAddress table auto-increment
ALTER TABLE `favorite_address` AUTO_INCREMENT = 1;

-- Reset Complaint table auto-increment
ALTER TABLE `complaint` AUTO_INCREMENT = 1;

-- Reset AuditLog table auto-increment
ALTER TABLE `audit_log` AUTO_INCREMENT = 1;

-- Reset CryptoWallet table auto-increment
ALTER TABLE `crypto_wallet` AUTO_INCREMENT = 1;

-- Reset CryptoPayment table auto-increment
ALTER TABLE `crypto_payment` AUTO_INCREMENT = 1;

-- Reset CardPayment table auto-increment
ALTER TABLE `card_payment` AUTO_INCREMENT = 1;

-- Reset PayPalPayment table auto-increment
ALTER TABLE `paypal_payment` AUTO_INCREMENT = 1;

-- Reset RevolutPayment table auto-increment
ALTER TABLE `revolut_payment` AUTO_INCREMENT = 1;

-- Reset PaymentMethod table auto-increment
ALTER TABLE `payment_method` AUTO_INCREMENT = 1;

-- Show current auto-increment values after reset
SELECT 
    TABLE_NAME,
    AUTO_INCREMENT,
    ROUND(((AUTO_INCREMENT - 1) / TABLE_ROWS), 2) AS `next_id_increment`
FROM 
    INFORMATION_SCHEMA.TABLES 
WHERE 
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('user', 'ride', 'invoice', 'vehicle_type', 'favorite_address', 'complaint', 'audit_log', 'crypto_wallet', 'crypto_payment', 'card_payment', 'paypal_payment', 'revolut_payment', 'payment_method')
ORDER BY TABLE_NAME;
