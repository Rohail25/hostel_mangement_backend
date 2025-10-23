-- AlterTable
ALTER TABLE `payment` MODIFY `hostelId` INTEGER NULL,
    MODIFY `amount` DOUBLE NULL,
    MODIFY `paymentType` ENUM('rent', 'deposit', 'maintenance', 'electricity', 'water', 'other') NULL,
    MODIFY `paymentMethod` ENUM('cash', 'card', 'bank_transfer', 'upi', 'cheque', 'online') NULL,
    MODIFY `paymentDate` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `status` ENUM('pending', 'paid', 'partial', 'overdue') NULL DEFAULT 'paid',
    MODIFY `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `transaction` MODIFY `paymentId` INTEGER NULL,
    MODIFY `gateway` VARCHAR(50) NULL,
    MODIFY `transactionType` VARCHAR(30) NULL,
    MODIFY `amount` DOUBLE NULL,
    MODIFY `status` ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded') NULL DEFAULT 'pending',
    MODIFY `paymentMethod` ENUM('cash', 'card', 'bank_transfer', 'upi', 'cheque', 'online') NULL,
    MODIFY `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NULL;
