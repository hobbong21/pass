-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "password_failed_tries" INTEGER NOT NULL DEFAULT 0,
    "password_locked_until" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "name" TEXT,
    "avatar" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "last_login_at" DATETIME
);
INSERT INTO "new_users" ("avatar", "created_at", "email", "id", "last_login_at", "name", "phone", "phone_verified", "status", "updated_at") SELECT "avatar", "created_at", "email", "id", "last_login_at", "name", "phone", "phone_verified", "status", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE INDEX "users_phone_idx" ON "users"("phone");
CREATE INDEX "users_status_idx" ON "users"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
