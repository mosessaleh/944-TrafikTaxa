# Auto-Increment Reset Guide

## Problem: Auto-Increment Counters Don't Reset After Table Clearing

When you empty tables (using TRUNCATE, DELETE, or clearing data through the admin interface), MySQL's auto-increment counters continue from the highest number that was previously used.

### Example:
- Original bookings: 1, 2, 3, 4, 5
- Table emptied
- Next booking created gets ID: **6** (not 1)

## Solution: Use the Reset Script

### File: `reset_table_counters.sql`

This script resets all auto-increment counters back to 1 for all tables.

### How to Use:

1. **After clearing any table(s)**, run this SQL:
   ```sql
   mysql -u your_user -p your_database < reset_table_counters.sql
   ```

2. **Or run directly in database**:
   ```sql
   SOURCE reset_table_counters.sql;
   ```

### What the Script Does:
- Resets auto-increment counters for ALL tables back to 1
- Shows current auto-increment values for verification
- Affects tables: user, ride, invoice, vehicle_type, favorite_address, complaint, audit_log, crypto_wallet, crypto_payment, card_payment, paypal_payment, revolut_payment, payment_method

### Result After Reset:
- Empty table → Next record gets ID: **1** ✅
- Empty table → Next booking → Invoice: **TUR-000001** ✅
- Empty table → Next user → ID: **1** ✅

## When to Run This Script:

**Run after:**
- Using "Clear All Data" in admin interface
- Manually deleting records
- Database migrations with data clearing
- Any operation that empties tables

**Don't run when:**
- You want to preserve existing IDs
- Other records depend on the current numbering
- You have important historical data

## Verification:

After running the script, verify with:
```sql
SELECT 
    TABLE_NAME,
    AUTO_INCREMENT
FROM 
    INFORMATION_SCHEMA.TABLES 
WHERE 
    TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;
```

All AUTO_INCREMENT values should show **1** after the reset.

This ensures proper numbering for new data after clearing tables.
