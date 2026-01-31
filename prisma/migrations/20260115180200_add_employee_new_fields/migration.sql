-- Add new fields to Employee table for enhanced employee information

-- Personal Information fields
ALTER TABLE `Employee` ADD COLUMN `fatherName` VARCHAR(255) NULL;
ALTER TABLE `Employee` ADD COLUMN `whatsappNumber` VARCHAR(50) NULL;

-- Document fields (renamed and new)
ALTER TABLE `Employee` ADD COLUMN `cnicDocuments` JSON NULL;
ALTER TABLE `Employee` ADD COLUMN `agreementDocument` JSON NULL;
ALTER TABLE `Employee` ADD COLUMN `policeCharacterCertificate` JSON NULL;
ALTER TABLE `Employee` ADD COLUMN `anyOtherDocuments` JSON NULL;

-- Professional fields (same as tenant)
ALTER TABLE `Employee` ADD COLUMN `professionType` VARCHAR(50) NULL;

-- Student fields
ALTER TABLE `Employee` ADD COLUMN `academicName` VARCHAR(255) NULL;
ALTER TABLE `Employee` ADD COLUMN `academicAddress` VARCHAR(500) NULL;
ALTER TABLE `Employee` ADD COLUMN `academicLocation` VARCHAR(500) NULL;
ALTER TABLE `Employee` ADD COLUMN `studentCardNo` VARCHAR(100) NULL;
ALTER TABLE `Employee` ADD COLUMN `academicAttachments` JSON NULL;

-- Job fields
ALTER TABLE `Employee` ADD COLUMN `jobTitle` VARCHAR(255) NULL;
ALTER TABLE `Employee` ADD COLUMN `companyName` VARCHAR(255) NULL;
ALTER TABLE `Employee` ADD COLUMN `jobAddress` VARCHAR(500) NULL;
ALTER TABLE `Employee` ADD COLUMN `jobLocation` VARCHAR(500) NULL;
ALTER TABLE `Employee` ADD COLUMN `jobIdNo` VARCHAR(100) NULL;
ALTER TABLE `Employee` ADD COLUMN `jobAttachments` JSON NULL;

-- Business fields
ALTER TABLE `Employee` ADD COLUMN `businessName` VARCHAR(255) NULL;
ALTER TABLE `Employee` ADD COLUMN `businessAddress` VARCHAR(500) NULL;
ALTER TABLE `Employee` ADD COLUMN `businessLocation` VARCHAR(500) NULL;
ALTER TABLE `Employee` ADD COLUMN `businessAttachments` JSON NULL;

-- Professional description
ALTER TABLE `Employee` ADD COLUMN `professionDescription` TEXT NULL;

-- Emergency Contact fields (enhanced)
ALTER TABLE `Employee` ADD COLUMN `emergencyContactWhatsapp` VARCHAR(50) NULL;
ALTER TABLE `Employee` ADD COLUMN `emergencyContactRelationOther` VARCHAR(255) NULL;
ALTER TABLE `Employee` ADD COLUMN `anyDisease` VARCHAR(255) NULL;
ALTER TABLE `Employee` ADD COLUMN `bloodGroup` VARCHAR(10) NULL;
ALTER TABLE `Employee` ADD COLUMN `nearestRelative` JSON NULL;
