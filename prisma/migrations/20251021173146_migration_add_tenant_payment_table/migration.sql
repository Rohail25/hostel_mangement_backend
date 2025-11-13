/*
  Warnings:

  - You are about to drop the column `aadharNumber` on the `Tenant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cnicNumber]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  
  Note: For shadow database validation, ensure the `Tenant` table exists before running this migration. The statements below include `IF EXISTS`/`IF NOT EXISTS` guards where available.
*/
-- DropIndex
DROP INDEX IF EXISTS `Tenant_aadharNumber_idx` ON `tenant`;

-- DropIndex
DROP INDEX IF EXISTS `Tenant_aadharNumber_key` ON `tenant`;

-- AlterTable
ALTER TABLE `tenant`
    DROP COLUMN IF EXISTS `aadharNumber`;

ALTER TABLE `tenant`
    ADD COLUMN IF NOT EXISTS `cnicNumber` VARCHAR(20) NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS `Tenant_cnicNumber_key` ON `Tenant`(`cnicNumber`);

-- CreateIndex
CREATE INDEX IF NOT EXISTS `Tenant_cnicNumber_idx` ON `Tenant`(`cnicNumber`);
