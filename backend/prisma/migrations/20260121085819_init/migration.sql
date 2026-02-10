-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "userType" TEXT,
    "fullName" TEXT,
    "university" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" DATETIME
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructorId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "description" TEXT,
    "moduleCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "modules_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lab_instances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructorId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "description" TEXT,
    "toleranceMin" DECIMAL,
    "toleranceMax" DECIMAL,
    "toleranceUnit" TEXT,
    "completionStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lab_instances_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lab_instances_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LabInstanceEquipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "positionX" INTEGER NOT NULL,
    "positionY" INTEGER NOT NULL,
    "positionZ" INTEGER NOT NULL,
    "configJson" JSONB,
    CONSTRAINT "LabInstanceEquipment_labId_fkey" FOREIGN KEY ("labId") REFERENCES "lab_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LabInstanceEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "lab_equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wire_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "sourceEquipmentId" TEXT NOT NULL,
    "targetEquipmentId" TEXT NOT NULL,
    "sourceHandle" TEXT,
    "targetHandle" TEXT,
    "wireColor" TEXT NOT NULL DEFAULT '#374151',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wire_connections_labId_fkey" FOREIGN KEY ("labId") REFERENCES "lab_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wire_connections_sourceEquipmentId_fkey" FOREIGN KEY ("sourceEquipmentId") REFERENCES "LabInstanceEquipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wire_connections_targetEquipmentId_fkey" FOREIGN KEY ("targetEquipmentId") REFERENCES "LabInstanceEquipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lab_equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorId" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "equipmentName" TEXT NOT NULL,
    "description" TEXT,
    "supportsConfiguration" BOOLEAN NOT NULL DEFAULT false,
    "defaultConfigJson" JSONB,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lab_equipment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experiment_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "stepDescription" TEXT NOT NULL,
    "procedure" TEXT,
    "minTolerance" DECIMAL,
    "maxTolerance" DECIMAL,
    "unit" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_steps_labId_fkey" FOREIGN KEY ("labId") REFERENCES "lab_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experiment_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "valueSubmitted" DECIMAL,
    "isWithinTolerance" BOOLEAN,
    "feedback" TEXT,
    "notes" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "experiment_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "experiment_progress_labId_fkey" FOREIGN KEY ("labId") REFERENCES "lab_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "experiment_progress_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "experiment_steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
