-- CreateTable
CREATE TABLE "instructor_follows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "instructor_follows_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "instructor_follows_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "instructor_follows_instructorId_idx" ON "instructor_follows"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_follows_studentId_instructorId_key" ON "instructor_follows"("studentId", "instructorId");
