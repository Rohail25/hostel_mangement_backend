-- CreateTable
CREATE TABLE `Owner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `ownerCode` VARCHAR(50) NULL,
    `name` VARCHAR(255) NOT NULL,
    `alternatePhone` VARCHAR(50) NULL,
    `HostelName` VARCHAR(255) NULL,
    `taxId` VARCHAR(100) NULL,
    `registrationNumber` VARCHAR(100) NULL,
    `address` JSON NULL,
    `bankDetails` JSON NULL,
    `documents` JSON NULL,
    `profilePhoto` VARCHAR(500) NULL,
    `status` VARCHAR(50) NULL DEFAULT 'active',
    `emergencyContact` JSON NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Owner_userId_key`(`userId`),
    UNIQUE INDEX `Owner_ownerCode_key`(`ownerCode`),
    INDEX `Owner_userId_idx`(`userId`),
    INDEX `Owner_ownerCode_idx`(`ownerCode`),
    INDEX `Owner_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Hostel` ADD COLUMN `ownerId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Hostel_ownerId_idx` ON `Hostel`(`ownerId`);

-- AddForeignKey
ALTER TABLE `Owner` ADD CONSTRAINT `Owner_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Hostel` ADD CONSTRAINT `Hostel_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

