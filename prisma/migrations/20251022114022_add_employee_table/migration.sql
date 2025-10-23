/*
  Warnings:

  - The values [supervisor,receptionist,maintenance,accountant] on the enum `Employee_role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `employee` MODIFY `role` ENUM('staff', 'manager') NOT NULL DEFAULT 'staff';
