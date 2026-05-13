import { describe, expect, it } from "vitest";
import { formatGhs, formatGhsPlain, parseGhsToPesewas } from "./money";

describe("formatGhs", () => {
  it("renders whole cedi amounts with .00", () => {
    expect(formatGhs(5000)).toBe("GH₵ 50.00");
  });

  it("renders fractional amounts", () => {
    expect(formatGhs(1234)).toBe("GH₵ 12.34");
    expect(formatGhs(7)).toBe("GH₵ 0.07");
  });

  it("inserts thousand separators", () => {
    expect(formatGhs(1234567)).toBe("GH₵ 12,345.67");
  });

  it("handles negatives", () => {
    expect(formatGhs(-1234)).toBe("-GH₵ 12.34");
  });

  it("accepts bigint", () => {
    expect(formatGhs(1234n)).toBe("GH₵ 12.34");
  });

  it("renders zero", () => {
    expect(formatGhs(0)).toBe("GH₵ 0.00");
  });
});

describe("formatGhsPlain", () => {
  it("produces a CSV-safe decimal", () => {
    expect(formatGhsPlain(1234567)).toBe("12345.67");
    expect(formatGhsPlain(7)).toBe("0.07");
    expect(formatGhsPlain(0)).toBe("0.00");
  });
});

describe("parseGhsToPesewas", () => {
  it("parses whole numbers", () => {
    expect(parseGhsToPesewas("50")).toBe(5000);
  });

  it("parses one-decimal", () => {
    expect(parseGhsToPesewas("50.5")).toBe(5050);
  });

  it("parses two-decimal", () => {
    expect(parseGhsToPesewas("12.34")).toBe(1234);
  });

  it("trims whitespace", () => {
    expect(parseGhsToPesewas("  50.00  ")).toBe(5000);
  });

  it("rejects more than two decimals", () => {
    expect(parseGhsToPesewas("12.345")).toBeNull();
  });

  it("rejects letters or symbols", () => {
    expect(parseGhsToPesewas("GH₵ 50")).toBeNull();
    expect(parseGhsToPesewas("50,000")).toBeNull();
    expect(parseGhsToPesewas("")).toBeNull();
    expect(parseGhsToPesewas("abc")).toBeNull();
  });

  it("rejects negative numbers with sign", () => {
    expect(parseGhsToPesewas("-5")).toBe(-500);
  });
});
