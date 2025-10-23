-- CreateTable
CREATE TABLE `Employee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `employeeCode` VARCHAR(50) NULL,
    `role` ENUM('staff', 'manager', 'supervisor', 'receptionist', 'maintenance', 'accountant') NOT NULL DEFAULT 'staff',
    `department` VARCHAR(100) NULL,
    `designation` VARCHAR(100) NULL,
    `salary` DOUBLE NOT NULL,
    `salaryType` VARCHAR(20) NULL DEFAULT 'monthly',
    `joinDate` DATETIME(3) NOT NULL,
    `terminationDate` DATETIME(3) NULL,
    `status` ENUM('active', 'inactive', 'on_leave', 'terminated') NOT NULL DEFAULT 'active',
    `workingHours` JSON NULL,
    `hostelAssigned` INTEGER NULL,
    `bankDetails` JSON NULL,
    `address` JSON NULL,
    `documents` JSON NULL,
    `profilePhoto` VARCHAR(500) NULL,
    `emergencyContact` JSON NULL,
    `qualifications` JSON NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employee_userId_key`(`userId`),
    UNIQUE INDEX `Employee_employeeCode_key`(`employeeCode`),
    INDEX `Employee_userId_idx`(`userId`),
    INDEX `Employee_employeeCode_idx`(`employeeCode`),
    INDEX `Employee_role_idx`(`role`),
    INDEX `Employee_status_idx`(`status`),
    INDEX `Employee_hostelAssigned_idx`(`hostelAssigned`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
