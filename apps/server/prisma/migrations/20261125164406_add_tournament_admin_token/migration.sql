/*
  Warnings:

  - Added the required column `admin_token` to the `tournaments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "admin_token" TEXT NOT NULL;
