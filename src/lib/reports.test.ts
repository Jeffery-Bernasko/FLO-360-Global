import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import {
  ReportError,
  defaultRange,
  parseReportParams,
  reportFilename,
  validateRange,
} from "./reports";

describe("report date ranges", () => {
  it("defaults to the last 30 days", () => {
    const range = defaultRange(new Date("2026-05-13T12:00:00.000Z"));

    expect(range.from.toISOString()).toBe("2026-04-13T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-05-13T23:59:59.999Z");
  });

  it("rejects ranges over one year", () => {
    expect(() =>
      validateRange({
        from: new Date("2025-01-01T00:00:00.000Z"),
        to: new Date("2026-05-13T00:00:00.000Z"),
      }),
    ).toThrow(ReportError);
  });

  it("parses movement kind filters from search params", () => {
    const filter = parseReportParams(
      new URLSearchParams({
        from: "2026-05-01",
        to: "2026-05-13",
        kind: "adjustment",
      }),
      new Date("2026-05-13T12:00:00.000Z"),
    );

    expect(filter.from.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(filter.to.toISOString()).toBe("2026-05-13T23:59:59.999Z");
    expect(filter.kind).toBe("adjustment");
    expect(filter.kinds).toEqual(["adjustment"]);
  });

  it("uses stable date-range filenames", () => {
    expect(
      reportFilename(
        "stock-movements",
        {
          from: new Date("2026-05-01T00:00:00.000Z"),
          to: new Date("2026-05-13T23:59:59.999Z"),
        },
        "csv",
      ),
    ).toBe("stock-movements_2026-05-01_2026-05-13.csv");
  });
});
