/*
  Warnings:

  - You are about to drop the column `parrt` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `descriptoin` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `souceUrl` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Article" DROP COLUMN "parrt",
ADD COLUMN     "part" TEXT;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "descriptoin",
DROP COLUMN "souceUrl",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "sourceUrl" TEXT;
