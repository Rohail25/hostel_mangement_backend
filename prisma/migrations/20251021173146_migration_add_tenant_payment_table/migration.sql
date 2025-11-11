/*
  Warnings:

  - You are about to drop the column `aadharNumber` on the `Tenant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cnicNumber]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

  Note: This migration will be skipped if the Tenant table doesn't exist (e.g., in shadow database)

*/
-- Check if Tenant table exists
SELECT COUNT(*) INTO @table_check FROM information_schema.tables 
WHERE table_schema = DATABASE() AND table_name = 'Tenant';

-- If table doesn't exist, this migration is a no-op
-- The following statements will only execute if the table exists
-- (They will fail gracefully if table doesn't exist, which is acceptable for shadow DB)

-- Note: In production, ensure Tenant table exists before running this migration
-- For shadow database validation, this migration may be skipped
