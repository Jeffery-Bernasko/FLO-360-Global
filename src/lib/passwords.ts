import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

/**
 * Generates a 12-char URL-safe random password.
 * Suitable for handing to a worker out-of-band as a one-time temp password.
 */
export function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * bcrypt-hash a plaintext password. Centralised so the cost factor is uniform.
 */
export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}
