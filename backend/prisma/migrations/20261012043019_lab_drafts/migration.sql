-- CreateTable
CREATE TABLE "lab_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "circuitStateJson" JSONB NOT NULL,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lab_drafts_labId_fkey" FOREIGN KEY ("labId") REFERENCES "lab_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lab_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "lab_drafts_userId_idx" ON "lab_drafts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_drafts_labId_userId_key" ON "lab_drafts"("labId", "userId");
