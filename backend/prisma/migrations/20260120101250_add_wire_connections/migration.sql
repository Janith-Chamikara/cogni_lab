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
