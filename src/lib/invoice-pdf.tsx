import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatGhs } from "@/lib/money";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700 },
  subtitle: { fontSize: 11, color: "#64748b", marginTop: 4 },
  meta: { textAlign: "right" },
  metaLabel: { fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 12, marginBottom: 6 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  customerBlock: { fontSize: 11, lineHeight: 1.4 },
  table: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#cbd5e1" },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  cellDescription: { flexGrow: 1 },
  cellQty: { width: 60, textAlign: "right" },
  cellPrice: { width: 100, textAlign: "right" },
  cellTotal: { width: 110, textAlign: "right", fontWeight: 700 },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 18 },
  totalsBox: { width: 220 },
  totalsLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalsLabel: { color: "#64748b" },
  totalsAmount: { fontWeight: 700 },
  grandTotal: { fontSize: 14, marginTop: 6, borderTopWidth: 1, borderTopColor: "#cbd5e1", paddingTop: 6 },
  footer: { marginTop: 40, fontSize: 9, color: "#94a3b8", textAlign: "center" },
});

export type InvoiceData = {
  invoiceNumber: string;
  date: Date;
  warehouseName: string;
  warehouseContact: string;
  customer: {
    name: string;
    phone?: string | null;
    location?: string | null;
  };
  lineItem: {
    description: string;
    boxes: number;
    unitPricePesewas: number;
    totalPesewas: number;
  };
};

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document title={`Invoice ${data.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{data.warehouseName}</Text>
            <Text style={styles.subtitle}>{data.warehouseContact}</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Invoice</Text>
            <Text style={styles.metaValue}>#{data.invoiceNumber}</Text>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>
              {data.date.toLocaleDateString("en-GH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bill to</Text>
          <View style={styles.customerBlock}>
            <Text>{data.customer.name}</Text>
            {data.customer.location ? <Text>{data.customer.location}</Text> : null}
            {data.customer.phone ? <Text>{data.customer.phone}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, { backgroundColor: "#f8fafc" }]}>
            <Text style={styles.cellDescription}>Description</Text>
            <Text style={styles.cellQty}>Boxes</Text>
            <Text style={styles.cellPrice}>Unit price</Text>
            <Text style={styles.cellTotal}>Total</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellDescription}>{data.lineItem.description}</Text>
            <Text style={styles.cellQty}>{data.lineItem.boxes}</Text>
            <Text style={styles.cellPrice}>
              {formatGhs(data.lineItem.unitPricePesewas)}
            </Text>
            <Text style={styles.cellTotal}>
              {formatGhs(data.lineItem.totalPesewas)}
            </Text>
          </View>
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsLine}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsAmount}>
                {formatGhs(data.lineItem.totalPesewas)}
              </Text>
            </View>
            <View style={[styles.totalsLine, styles.grandTotal]}>
              <Text>Total due</Text>
              <Text>{formatGhs(data.lineItem.totalPesewas)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Thank you for your business.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdfBuffer(data: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
