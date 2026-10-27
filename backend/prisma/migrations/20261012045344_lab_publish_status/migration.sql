-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_lab_instances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructorId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "description" TEXT,
    "toleranceMin" DECIMAL,
    "toleranceMax" DECIMAL,
    "toleranceUnit" TEXT,
    "completionStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "publishStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "circuitRulesJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lab_instances_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lab_instances_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_lab_instances" ("circuitRulesJson", "completionStatus", "createdAt", "description", "id", "instructorId", "labName", "moduleId", "toleranceMax", "toleranceMin", "toleranceUnit", "updatedAt") SELECT "circuitRulesJson", "completionStatus", "createdAt", "description", "id", "instructorId", "labName", "moduleId", "toleranceMax", "toleranceMin", "toleranceUnit", "updatedAt" FROM "lab_instances";
DROP TABLE "lab_instances";
ALTER TABLE "new_lab_instances" RENAME TO "lab_instances";
CREATE INDEX "lab_instances_publishStatus_idx" ON "lab_instances"("publishStatus");

-- Labs that existed before publishing was added stay visible to students,
-- unless they are empty (no parts and no steps); those start as drafts.
UPDATE "lab_instances" SET "publishStatus" = 'PUBLISHED'
WHERE EXISTS (SELECT 1 FROM "LabInstanceEquipment" WHERE "LabInstanceEquipment"."labId" = "lab_instances"."id")
   OR EXISTS (SELECT 1 FROM "experiment_steps" WHERE "experiment_steps"."labId" = "lab_instances"."id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
