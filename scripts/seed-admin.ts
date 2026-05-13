import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { users, auditLog } from "../src/db/schema";

function generateTempPassword(): string {
  // 12 url-safe characters, easy enough to read aloud
  return randomBytes(9).toString("base64url");
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      password: { type: "string" },
    },
    strict: true,
  });

  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  if (!email || !name) {
    console.error(
      "Usage: pnpm seed:admin --email=<email> --name=<name> [--password=<pwd>]",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const password = values.password ?? generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.error(`A user with email ${email} already exists. Aborting.`);
    await client.end();
    process.exit(1);
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      name,
      passwordHash,
      role: "manager",
      isActive: true,
    })
    .returning({ id: users.id });

  await db.insert(auditLog).values({
    actorUserId: null,
    action: "user.create",
    entityType: "user",
    entityId: created.id,
    payload: { source: "seed-admin", role: "manager", email, name },
  });

  await client.end();

  console.log("\nManager account created.");
  console.log(`  Email:    ${email}`);
  console.log(`  Name:     ${name}`);
  console.log(`  Password: ${password}`);
  console.log(
    "\nWrite this password down and share it with the manager out-of-band.",
  );
  console.log("It is only printed once.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
