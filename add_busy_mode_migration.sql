-- Add busyMode column to comDriver table
ALTER TABLE comDriver ADD COLUMN busyMode VARCHAR(10) DEFAULT NULL;

-- Update existing records to have busyMode = 'manual' if isBusy = 1, else NULL
UPDATE comDriver SET busyMode = 'manual' WHERE isBusy = 1;
UPDATE comDriver SET busyMode = NULL WHERE isBusy = 0;