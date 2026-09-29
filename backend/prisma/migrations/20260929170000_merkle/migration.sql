-- CreateTable
CREATE TABLE "MerkleRoot" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "fromSeq" BIGINT NOT NULL,
    "toSeq" BIGINT NOT NULL,
    "leafCount" INTEGER NOT NULL,
    "root" TEXT NOT NULL,
    "prevChain" TEXT NOT NULL,
    "chainHash" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerkleRoot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerkleRoot_chainHash_key" ON "MerkleRoot"("chainHash");

-- CreateIndex
CREATE INDEX "MerkleRoot_fromSeq_toSeq_idx" ON "MerkleRoot"("fromSeq", "toSeq");

