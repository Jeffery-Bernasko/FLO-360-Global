import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { parseArgs } from "node:util";
import { users, auditLog } from "../src/db/schema";
import { generateTempPassword, hashPassword } from "../src/lib/passwords";

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
      "Usage: npm run seed:admin -- --email=<email> --name=<name> [--password=<pwd>]",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const password = values.password ?? generateTempPassword();
  const passwordHash = await hashPassword(password);

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      console.error(`A user with email ${email} already exists. Aborting.`);
      process.exit(1);
    }

    await db.transaction(async (tx) => {
      const createdRows = await tx
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          role: "manager",
          isActive: true,
        })
        .returning({ id: users.id });

      if (createdRows.length === 0) {
        throw new Error("Failed to create manager account");
      }
      const created = createdRows[0];

      await tx.insert(auditLog).values({
        actorUserId: null,
        action: "user.create",
        entityType: "user",
        entityId: created.id,
        payload: { source: "seed-admin", role: "manager", email, name },
      });
    });
  } finally {
    await client.end();
  }

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
