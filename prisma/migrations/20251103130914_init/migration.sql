-- AlterTable
ALTER TABLE `booking` MODIFY `paymentMethod` ENUM('cash', 'card', 'bank_transfer', 'upi', 'cheque', 'online', 'stripe') NULL;

-- AlterTable
ALTER TABLE `payment` MODIFY `paymentMethod` ENUM('cash', 'card', 'bank_transfer', 'upi', 'cheque', 'online', 'stripe') NULL;

-- AlterTable
ALTER TABLE `transaction` MODIFY `paymentMethod` ENUM('cash', 'card', 'bank_transfer', 'upi', 'cheque', 'online', 'stripe') NULL;

-- CreateTable
CREATE TABLE `Vendor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hostelId` INTEGER NULL,
    `name` VARCHAR(255) NOT NULL,
    `companyName` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `alternatePhone` VARCHAR(50) NULL,
    `taxId` VARCHAR(100) NULL,
    `category` VARCHAR(100) NULL,
    `services` JSON NULL,
    `contactPerson` JSON NULL,
    `address` JSON NULL,
    `paymentTerms` ENUM('prepaid', 'cod', 'net15', 'net30', 'net45', 'net60') NULL DEFAULT 'net30',
    `creditLimit` DOUBLE NULL DEFAULT 0,
    `totalPayable` DOUBLE NULL DEFAULT 0,
    `totalPaid` DOUBLE NULL DEFAULT 0,
    `balance` DOUBLE NULL DEFAULT 0,
    `documents` JSON NULL,
    `notes` TEXT NULL,
    `status` ENUM('active', 'inactive', 'blacklisted') NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vendor_email_key`(`email`),
    INDEX `Vendor_name_idx`(`name`),
    INDEX `Vendor_category_idx`(`category`),
    INDEX `Vendor_status_idx`(`status`),
    INDEX `Vendor_hostelId_idx`(`hostelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Alert` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('bill', 'rent', 'payable', 'receivable', 'maintenance') NOT NULL,
    `status` ENUM('pending', 'in_progress', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `maintenanceType` ENUM('room_cleaning', 'repairs', 'purchase_demand') NULL,
    `hostelId` INTEGER NULL,
    `roomId` INTEGER NULL,
    `tenantId` INTEGER NULL,
    `allocationId` INTEGER NULL,
    `paymentId` INTEGER NULL,
    `amount` DOUBLE NULL,
    `dueDate` DATETIME(3) NULL,
    `assignedTo` INTEGER NULL,
    `createdBy` INTEGER NULL,
    `resolvedBy` INTEGER NULL,
    `resolvedAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `attachments` JSON NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Alert_type_idx`(`type`),
    INDEX `Alert_status_idx`(`status`),
    INDEX `Alert_priority_idx`(`priority`),
    INDEX `Alert_hostelId_idx`(`hostelId`),
    INDEX `Alert_roomId_idx`(`roomId`),
    INDEX `Alert_tenantId_idx`(`tenantId`),
    INDEX `Alert_assignedTo_idx`(`assignedTo`),
    INDEX `Alert_createdBy_idx`(`createdBy`),
    INDEX `Alert_dueDate_idx`(`dueDate`),
    INDEX `Alert_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Vendor` ADD CONSTRAINT `Vendor_hostelId_fkey` FOREIGN KEY (`hostelId`) REFERENCES `Hostel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_hostelId_fkey` FOREIGN KEY (`hostelId`) REFERENCES `Hostel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_allocationId_fkey` FOREIGN KEY (`allocationId`) REFERENCES `Allocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_resolvedBy_fkey` FOREIGN KEY (`resolvedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
