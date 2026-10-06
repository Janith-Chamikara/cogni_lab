-- AlterTable
ALTER TABLE "lab_instances" ADD COLUMN "circuitRulesJson" JSONB;

-- CreateTable
CREATE TABLE "lab_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "circuitStateJson" JSONB NOT NULL,
    "actionLogJson" JSONB,
    "validationResultJson" JSONB NOT NULL,
    "validationMode" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lab_attempts_labId_fkey" FOREIGN KEY ("labId") REFERENCES "lab_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lab_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "lab_attempts_labId_userId_idx" ON "lab_attempts"("labId", "userId");
