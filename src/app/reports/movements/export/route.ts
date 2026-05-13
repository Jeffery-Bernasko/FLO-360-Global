import { NextRequest } from "next/server";
import { requireManager } from "@/auth-server";
import { csvResponse, stockMovementCsv } from "@/lib/report-csv";
import {
  pdfResponse,
  renderStockMovementReportPdf,
} from "@/lib/report-pdf";
import {
  ReportError,
  parseReportParams,
  reportFilename,
  stockMovementReport,
} from "@/lib/reports";

export async function GET(request: NextRequest) {
  const user = await requireManager();
  const filter = parseReportParams(request.nextUrl.searchParams);
  let rows: Awaited<ReturnType<typeof stockMovementReport>>;
  try {
    rows = await stockMovementReport(filter);
  } catch (err) {
    if (err instanceof ReportError) return new Response(err.message, { status: 400 });
    throw err;
  }
  const format = request.nextUrl.searchParams.get("format");

  if (format === "pdf") {
    const buffer = await renderStockMovementReportPdf({
      rows,
      range: filter,
      generatedBy: user.name,
    });
    return pdfResponse(buffer, reportFilename("stock-movements", filter, "pdf"));
  }

  return csvResponse(
    stockMovementCsv(rows),
    reportFilename("stock-movements", filter, "csv"),
  );
}
