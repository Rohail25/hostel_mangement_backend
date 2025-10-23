-- CreateTable
CREATE TABLE `Booking` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingCode` VARCHAR(50) NULL,
    `tenantId` INTEGER NULL,
    `hostelId` INTEGER NULL,
    `roomId` INTEGER NULL,
    `bedId` INTEGER NULL,
    `checkInDate` DATETIME(3) NULL,
    `checkOutDate` DATETIME(3) NULL,
    `bookingDate` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bookingType` ENUM('online', 'walkin', 'admin') NULL DEFAULT 'online',
    `status` ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'expired') NULL DEFAULT 'pending',
    `numberOfGuests` INTEGER NULL DEFAULT 1,
    `remarks` TEXT NULL,
    `totalAmount` DOUBLE NULL,
    `advancePaid` DOUBLE NULL DEFAULT 0,
    `paymentStatus` ENUM('pending', 'paid', 'partial', 'overdue') NULL DEFAULT 'pending',
    `paymentMethod` ENUM('cash', 'card', 'bank_transfer', 'upi', 'cheque', 'online') NULL,
    `transactionId` VARCHAR(255) NULL,
    `customerName` VARCHAR(255) NULL,
    `customerEmail` VARCHAR(255) NULL,
    `customerPhone` VARCHAR(50) NULL,
    `customerCnic` VARCHAR(20) NULL,
    `createdBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Booking_bookingCode_key`(`bookingCode`),
    INDEX `Booking_tenantId_idx`(`tenantId`),
    INDEX `Booking_hostelId_idx`(`hostelId`),
    INDEX `Booking_roomId_idx`(`roomId`),
    INDEX `Booking_bedId_idx`(`bedId`),
    INDEX `Booking_status_idx`(`status`),
    INDEX `Booking_bookingDate_idx`(`bookingDate`),
    INDEX `Booking_checkInDate_idx`(`checkInDate`),
    INDEX `Booking_bookingCode_idx`(`bookingCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_hostelId_fkey` FOREIGN KEY (`hostelId`) REFERENCES `Hostel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_bedId_fkey` FOREIGN KEY (`bedId`) REFERENCES `Bed`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
