-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_tenantId_fkey`;

-- AlterTable
ALTER TABLE `payment` ADD COLUMN `bookingId` INTEGER NULL,
    MODIFY `tenantId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Payment_bookingId_idx` ON `Payment`(`bookingId`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
