import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values: insertValues }));
  return { insert, insertValues };
});

vi.mock("@/db", () => ({
  db: { insert: mocks.insert },
}));

import { log } from "./audit";
import { auditLog } from "@/db/schema";

describe("log()", () => {
  it("inserts an audit row with the given fields", async () => {
    mocks.insert.mockClear();
    mocks.insertValues.mockClear();

    await log({
      action: "form.approve",
      entityType: "inbound_form",
      entityId: "42",
      payload: { boxes: 100 },
      actorUserId: "user-1",
    });

    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledWith(auditLog);
    expect(mocks.insertValues).toHaveBeenCalledOnce();
    expect(mocks.insertValues).toHaveBeenCalledWith({
      action: "form.approve",
      entityType: "inbound_form",
      entityId: "42",
      payload: { boxes: 100 },
      actorUserId: "user-1",
    });
  });

  it("defaults entityId, payload, and actorUserId when omitted", async () => {
    mocks.insert.mockClear();
    mocks.insertValues.mockClear();

    await log({ action: "user.create", entityType: "user" });

    expect(mocks.insertValues).toHaveBeenCalledWith({
      action: "user.create",
      entityType: "user",
      entityId: null,
      payload: {},
      actorUserId: null,
    });
  });

  it("uses a passed-in transaction client when provided", async () => {
    mocks.insert.mockClear();
    mocks.insertValues.mockClear();

    const txInsertValues = vi.fn().mockResolvedValue(undefined);
    const txInsert = vi.fn(() => ({ values: txInsertValues }));
    const tx = { insert: txInsert } as unknown as Parameters<typeof log>[1];

    await log({ action: "test", entityType: "thing" }, tx);

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(txInsert).toHaveBeenCalledOnce();
    expect(txInsert).toHaveBeenCalledWith(auditLog);
    expect(txInsertValues).toHaveBeenCalledOnce();
  });
});
