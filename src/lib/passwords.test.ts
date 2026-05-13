import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { generateTempPassword, hashPassword } from "./passwords";

describe("generateTempPassword", () => {
  it("returns a non-empty url-safe string", () => {
    const p = generateTempPassword();
    expect(p.length).toBeGreaterThanOrEqual(10);
    expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns a different value each call", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).not.toBe(b);
  });
});

describe("hashPassword", () => {
  it("produces a bcrypt hash that verifies the original", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare("hunter2", hash)).toBe(true);
    expect(await bcrypt.compare("wrong", hash)).toBe(false);
  });
});
