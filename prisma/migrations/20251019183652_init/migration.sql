-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `password` VARCHAR(255) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'active',
    `role` ENUM('admin', 'manager', 'staff', 'user') NOT NULL DEFAULT 'user',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Hostel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `address` JSON NOT NULL,
    `description` TEXT NULL,
    `totalFloors` INTEGER NOT NULL DEFAULT 0,
    `totalRooms` INTEGER NOT NULL DEFAULT 0,
    `totalBeds` INTEGER NOT NULL DEFAULT 0,
    `occupiedBeds` INTEGER NOT NULL DEFAULT 0,
    `amenities` JSON NULL,
    `contactInfo` JSON NULL,
    `operatingHours` JSON NULL,
    `status` ENUM('active', 'inactive', 'under_maintenance') NOT NULL DEFAULT 'active',
    `managedBy` INTEGER NULL,
    `images` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Hostel_name_idx`(`name`),
    INDEX `Hostel_status_idx`(`status`),
    INDEX `Hostel_managedBy_idx`(`managedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Floor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hostelId` INTEGER NOT NULL,
    `floorNumber` INTEGER NOT NULL,
    `floorName` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `totalRooms` INTEGER NOT NULL DEFAULT 0,
    `totalBeds` INTEGER NOT NULL DEFAULT 0,
    `occupiedBeds` INTEGER NOT NULL DEFAULT 0,
    `amenities` JSON NULL,
    `floorPlan` VARCHAR(500) NULL,
    `status` ENUM('active', 'inactive', 'under_maintenance') NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Floor_status_idx`(`status`),
    INDEX `Floor_hostelId_idx`(`hostelId`),
    UNIQUE INDEX `Floor_hostelId_floorNumber_key`(`hostelId`, `floorNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Room` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hostelId` INTEGER NOT NULL,
    `floorId` INTEGER NOT NULL,
    `roomNumber` VARCHAR(50) NOT NULL,
    `roomType` ENUM('single', 'double', 'triple', 'quad', 'dormitory', 'suite') NOT NULL,
    `totalBeds` INTEGER NOT NULL,
    `occupiedBeds` INTEGER NOT NULL DEFAULT 0,
    `pricePerBed` DOUBLE NOT NULL,
    `status` ENUM('vacant', 'occupied', 'under_maintenance', 'reserved') NOT NULL DEFAULT 'vacant',
    `amenities` JSON NULL,
    `dimensions` JSON NULL,
    `hasAttachedBathroom` BOOLEAN NOT NULL DEFAULT false,
    `hasBalcony` BOOLEAN NOT NULL DEFAULT false,
    `furnishing` ENUM('furnished', 'semi_furnished', 'unfurnished') NOT NULL DEFAULT 'furnished',
    `images` JSON NULL,
    `maintenanceSchedule` JSON NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Room_status_idx`(`status`),
    INDEX `Room_floorId_idx`(`floorId`),
    INDEX `Room_hostelId_idx`(`hostelId`),
    UNIQUE INDEX `Room_hostelId_roomNumber_key`(`hostelId`, `roomNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bed` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hostelId` INTEGER NOT NULL,
    `floorId` INTEGER NOT NULL,
    `roomId` INTEGER NOT NULL,
    `bedNumber` VARCHAR(50) NOT NULL,
    `bedType` ENUM('single', 'bunk_upper', 'bunk_lower', 'double', 'queen', 'king') NOT NULL DEFAULT 'single',
    `position` JSON NULL,
    `status` ENUM('available', 'occupied', 'reserved', 'under_maintenance') NOT NULL DEFAULT 'available',
    `currentTenantId` INTEGER NULL,
    `reservedById` INTEGER NULL,
    `reservationExpiry` DATETIME(3) NULL,
    `condition` ENUM('good', 'fair', 'needs_repair') NOT NULL DEFAULT 'good',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Bed_status_idx`(`status`),
    INDEX `Bed_currentTenantId_idx`(`currentTenantId`),
    INDEX `Bed_hostelId_idx`(`hostelId`),
    INDEX `Bed_floorId_idx`(`floorId`),
    INDEX `Bed_roomId_idx`(`roomId`),
    UNIQUE INDEX `Bed_roomId_bedNumber_key`(`roomId`, `bedNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Allocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hostelId` INTEGER NOT NULL,
    `floorId` INTEGER NOT NULL,
    `roomId` INTEGER NOT NULL,
    `bedId` INTEGER NOT NULL,
    `tenantId` INTEGER NOT NULL,
    `allocatedById` INTEGER NOT NULL,
    `allocationDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checkInDate` DATETIME(3) NOT NULL,
    `checkOutDate` DATETIME(3) NULL,
    `expectedCheckOutDate` DATETIME(3) NULL,
    `rentAmount` DOUBLE NOT NULL,
    `depositAmount` DOUBLE NOT NULL DEFAULT 0,
    `status` ENUM('active', 'checked_out', 'transferred', 'cancelled') NOT NULL DEFAULT 'active',
    `paymentStatus` ENUM('pending', 'paid', 'partial', 'overdue') NOT NULL DEFAULT 'pending',
    `transferHistory` JSON NULL,
    `notes` TEXT NULL,
    `documents` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Allocation_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `Allocation_bedId_status_idx`(`bedId`, `status`),
    INDEX `Allocation_roomId_status_idx`(`roomId`, `status`),
    INDEX `Allocation_hostelId_status_idx`(`hostelId`, `status`),
    INDEX `Allocation_allocationDate_idx`(`allocationDate`),
    INDEX `Allocation_hostelId_idx`(`hostelId`),
    INDEX `Allocation_floorId_idx`(`floorId`),
    INDEX `Allocation_roomId_idx`(`roomId`),
    INDEX `Allocation_bedId_idx`(`bedId`),
    INDEX `Allocation_tenantId_idx`(`tenantId`),
    INDEX `Allocation_allocatedById_idx`(`allocatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Hostel` ADD CONSTRAINT `Hostel_managedBy_fkey` FOREIGN KEY (`managedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Floor` ADD CONSTRAINT `Floor_hostelId_fkey` FOREIGN KEY (`hostelId`) REFERENCES `Hostel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Room` ADD CONSTRAINT `Room_hostelId_fkey` FOREIGN KEY (`hostelId`) REFERENCES `Hostel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Room` ADD CONSTRAINT `Room_floorId_fkey` FOREIGN KEY (`floorId`) REFERENCES `Floor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bed` ADD CONSTRAINT `Bed_hostelId_fkey` FOREIGN KEY (`hostelId`) REFERENCES `Hostel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bed` ADD CONSTRAINT `Bed_floorId_fkey` FOREIGN KEY (`floorId`) REFERENCES `Floor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bed` ADD CONSTRAINT `Bed_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bed` ADD CONSTRAINT `Bed_currentTenantId_fkey` FOREIGN KEY (`currentTenantId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bed` ADD CONSTRAINT `Bed_reservedById_fkey` FOREIGN KEY (`reservedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Allocation` ADD CONSTRAINT `Allocation_hostelId_fkey` FOREIGN KEY (`hostelId`) REFERENCES `Hostel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Allocation` ADD CONSTRAINT `Allocation_floorId_fkey` FOREIGN KEY (`floorId`) REFERENCES `Floor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Allocation` ADD CONSTRAINT `Allocation_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Allocation` ADD CONSTRAINT `Allocation_bedId_fkey` FOREIGN KEY (`bedId`) REFERENCES `Bed`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Allocation` ADD CONSTRAINT `Allocation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Allocation` ADD CONSTRAINT `Allocation_allocatedById_fkey` FOREIGN KEY (`allocatedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
