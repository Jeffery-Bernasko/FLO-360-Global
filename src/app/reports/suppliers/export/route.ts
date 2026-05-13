import { NextRequest } from "next/server";
import { requireManager } from "@/auth-server";
import { csvResponse, perSupplierCsv } from "@/lib/report-csv";
import { pdfResponse, renderSupplierReportPdf } from "@/lib/report-pdf";
import {
  ReportError,
  parseReportParams,
  perSupplierReport,
  reportFilename,
} from "@/lib/reports";

export async function GET(request: NextRequest) {
  const user = await requireManager();
  const range = parseReportParams(request.nextUrl.searchParams);
  let rows: Awaited<ReturnType<typeof perSupplierReport>>;
  try {
    rows = await perSupplierReport(range);
  } catch (err) {
    if (err instanceof ReportError) return new Response(err.message, { status: 400 });
    throw err;
  }
  const format = request.nextUrl.searchParams.get("format");

  if (format === "pdf") {
    const buffer = await renderSupplierReportPdf({
      rows,
      range,
      generatedBy: user.name,
    });
    return pdfResponse(buffer, reportFilename("suppliers", range, "pdf"));
  }

  return csvResponse(perSupplierCsv(rows), reportFilename("suppliers", range, "csv"));
}
