-- CreateTable
CREATE TABLE `Transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `paymentId` INTEGER NOT NULL,
    `tenantId` INTEGER NULL,
    `hostelId` INTEGER NULL,
    `gateway` VARCHAR(50) NOT NULL,
    `transactionType` VARCHAR(30) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'PKR',
    `fee` DOUBLE NULL DEFAULT 0,
    `gatewayRef` VARCHAR(255) NULL,
    `orderId` VARCHAR(255) NULL,
    `merchantTxnId` VARCHAR(255) NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    `responseCode` VARCHAR(100) NULL,
    `responseMessage` VARCHAR(500) NULL,
    `rawResponse` JSON NULL,
    `paymentMethod` ENUM('cash', 'card', 'bank_transfer', 'upi', 'cheque', 'online') NOT NULL,
    `ipAddress` VARCHAR(100) NULL,
    `userAgent` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Transaction_paymentId_idx`(`paymentId`),
    INDEX `Transaction_tenantId_idx`(`tenantId`),
    INDEX `Transaction_hostelId_idx`(`hostelId`),
    INDEX `Transaction_gateway_idx`(`gateway`),
    INDEX `Transaction_status_idx`(`status`),
    INDEX `Transaction_transactionType_idx`(`transactionType`),
    INDEX `Transaction_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_hostelId_fkey` FOREIGN KEY (`hostelId`) REFERENCES `Hostel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
