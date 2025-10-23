-- DropForeignKey
ALTER TABLE `allocation` DROP FOREIGN KEY `Allocation_tenantId_fkey`;

-- CreateTable
CREATE TABLE `Tenant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NOT NULL,
    `alternatePhone` VARCHAR(50) NULL,
    `gender` ENUM('male', 'female', 'other') NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `aadharNumber` VARCHAR(20) NULL,
    `address` JSON NULL,
    `permanentAddress` JSON NULL,
    `emergencyContact` JSON NULL,
    `occupation` VARCHAR(255) NULL,
    `companyName` VARCHAR(255) NULL,
    `designation` VARCHAR(255) NULL,
    `monthlyIncome` DOUBLE NULL,
    `documents` JSON NULL,
    `profilePhoto` VARCHAR(500) NULL,
    `status` ENUM('active', 'inactive', 'blacklisted') NOT NULL DEFAULT 'active',
    `totalPaid` DOUBLE NOT NULL DEFAULT 0,
    `totalDue` DOUBLE NOT NULL DEFAULT 0,
    `securityDeposit` DOUBLE NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `rating` INTEGER NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tenant_email_key`(`email`),
    UNIQUE INDEX `Tenant_aadharNumber_key`(`aadharNumber`),
    INDEX `Tenant_email_idx`(`email`),
    INDEX `Tenant_phone_idx`(`phone`),
    INDEX `Tenant_aadharNumber_idx`(`aadharNumber`),
    INDEX `Tenant_status_idx`(`status`),
    INDEX `Tenant_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `allocationId` INTEGER NULL,
    `hostelId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `paymentType` ENUM('rent', 'deposit', 'maintenance', 'electricity', 'water', 'other') NOT NULL,
    `paymentMethod` ENUM('cash', 'card', 'bank_transfer', 'upi', 'cheque', 'online') NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `forMonth` VARCHAR(20) NULL,
    `forPeriod` JSON NULL,
    `transactionId` VARCHAR(255) NULL,
    `receiptNumber` VARCHAR(100) NULL,
    `status` ENUM('pending', 'paid', 'partial', 'overdue') NOT NULL DEFAULT 'paid',
    `remarks` TEXT NULL,
    `collectedBy` INTEGER NULL,
    `attachments` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_receiptNumber_key`(`receiptNumber`),
    INDEX `Payment_tenantId_idx`(`tenantId`),
    INDEX `Payment_allocationId_idx`(`allocationId`),
    INDEX `Payment_hostelId_idx`(`hostelId`),
    INDEX `Payment_paymentDate_idx`(`paymentDate`),
    INDEX `Payment_forMonth_idx`(`forMonth`),
    INDEX `Payment_status_idx`(`status`),
    INDEX `Payment_paymentType_idx`(`paymentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Allocation` ADD CONSTRAINT `Allocation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_allocationId_fkey` FOREIGN KEY (`allocationId`) REFERENCES `Allocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_hostelId_fkey` FOREIGN KEY (`hostelId`) REFERENCES `Hostel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_collectedBy_fkey` FOREIGN KEY (`collectedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
