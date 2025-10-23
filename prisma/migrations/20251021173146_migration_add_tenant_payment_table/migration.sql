/*
  Warnings:

  - You are about to drop the column `aadharNumber` on the `tenant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cnicNumber]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `Tenant_aadharNumber_idx` ON `tenant`;

-- DropIndex
DROP INDEX `Tenant_aadharNumber_key` ON `tenant`;

-- AlterTable
ALTER TABLE `tenant` DROP COLUMN `aadharNumber`,
    ADD COLUMN `cnicNumber` VARCHAR(20) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Tenant_cnicNumber_key` ON `Tenant`(`cnicNumber`);

-- CreateIndex
CREATE INDEX `Tenant_cnicNumber_idx` ON `Tenant`(`cnicNumber`);
