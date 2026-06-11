-- AlterEnum
ALTER TYPE "RedemptionResult" ADD VALUE 'NOT_AUTHORIZED';

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Staff_email_idx" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_promoterId_email_key" ON "Staff"("promoterId", "email");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
