-- Add new fields to Tenant table for enhanced tenant information

-- Personal Information fields
ALTER TABLE `Tenant` ADD COLUMN `fullName` VARCHAR(255) NULL;
ALTER TABLE `Tenant` ADD COLUMN `fatherName` VARCHAR(255) NULL;
ALTER TABLE `Tenant` ADD COLUMN `whatsappNumber` VARCHAR(50) NULL;
ALTER TABLE `Tenant` ADD COLUMN `genderOther` VARCHAR(255) NULL;
ALTER TABLE `Tenant` ADD COLUMN `attachments` JSON NULL;

-- Emergency Contact fields
ALTER TABLE `Tenant` ADD COLUMN `emergencyContactWhatsapp` VARCHAR(50) NULL;
ALTER TABLE `Tenant` ADD COLUMN `emergencyContactRelationOther` VARCHAR(255) NULL;
ALTER TABLE `Tenant` ADD COLUMN `anyDisease` VARCHAR(255) NULL;
ALTER TABLE `Tenant` ADD COLUMN `bloodGroup` VARCHAR(10) NULL;
ALTER TABLE `Tenant` ADD COLUMN `nearestRelative` JSON NULL;

-- Professional fields
ALTER TABLE `Tenant` ADD COLUMN `professionType` VARCHAR(50) NULL;

-- Student fields
ALTER TABLE `Tenant` ADD COLUMN `academicName` VARCHAR(255) NULL;
ALTER TABLE `Tenant` ADD COLUMN `academicAddress` VARCHAR(500) NULL;
ALTER TABLE `Tenant` ADD COLUMN `academicLocation` VARCHAR(500) NULL;
ALTER TABLE `Tenant` ADD COLUMN `studentCardNo` VARCHAR(100) NULL;
ALTER TABLE `Tenant` ADD COLUMN `academicAttachments` JSON NULL;

-- Job fields
ALTER TABLE `Tenant` ADD COLUMN `jobTitle` VARCHAR(255) NULL;
ALTER TABLE `Tenant` ADD COLUMN `jobAddress` VARCHAR(500) NULL;
ALTER TABLE `Tenant` ADD COLUMN `jobLocation` VARCHAR(500) NULL;
ALTER TABLE `Tenant` ADD COLUMN `jobIdNo` VARCHAR(100) NULL;
ALTER TABLE `Tenant` ADD COLUMN `jobAttachments` JSON NULL;

-- Business fields
ALTER TABLE `Tenant` ADD COLUMN `businessName` VARCHAR(255) NULL;
ALTER TABLE `Tenant` ADD COLUMN `businessAddress` VARCHAR(500) NULL;
ALTER TABLE `Tenant` ADD COLUMN `businessLocation` VARCHAR(500) NULL;
ALTER TABLE `Tenant` ADD COLUMN `businessAttachments` JSON NULL;

-- Professional description
ALTER TABLE `Tenant` ADD COLUMN `professionDescription` TEXT NULL;

-- Hostel Info fields
ALTER TABLE `Tenant` ADD COLUMN `lateFeesFine` VARCHAR(10) NULL;
ALTER TABLE `Tenant` ADD COLUMN `lateFeesPercentage` DOUBLE NULL;
ALTER TABLE `Tenant` ADD COLUMN `securityDepositFile` JSON NULL;
ALTER TABLE `Tenant` ADD COLUMN `advancedRentReceivedFile` JSON NULL;
ALTER TABLE `Tenant` ADD COLUMN `rentalDocument` JSON NULL;
