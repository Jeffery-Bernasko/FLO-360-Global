import { NextRequest } from "next/server";
import { requireManager } from "@/auth-server";
import { csvResponse, perCustomerCsv } from "@/lib/report-csv";
import { pdfResponse, renderCustomerReportPdf } from "@/lib/report-pdf";
import {
  ReportError,
  parseReportParams,
  perCustomerReport,
  reportFilename,
} from "@/lib/reports";

export async function GET(request: NextRequest) {
  const user = await requireManager();
  const range = parseReportParams(request.nextUrl.searchParams);
  let rows: Awaited<ReturnType<typeof perCustomerReport>>;
  try {
    rows = await perCustomerReport(range);
  } catch (err) {
    if (err instanceof ReportError) return new Response(err.message, { status: 400 });
    throw err;
  }
  const format = request.nextUrl.searchParams.get("format");

  if (format === "pdf") {
    const buffer = await renderCustomerReportPdf({
      rows,
      range,
      generatedBy: user.name,
    });
    return pdfResponse(buffer, reportFilename("customers", range, "pdf"));
  }

  return csvResponse(perCustomerCsv(rows), reportFilename("customers", range, "csv"));
}
