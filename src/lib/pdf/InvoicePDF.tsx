import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const BLUE = "#2563eb";
const GRAY_LIGHT = "#f9fafb";
const GRAY_BORDER = "#e5e7eb";
const GRAY_TEXT = "#6b7280";
const DARK = "#111827";

const B = "Helvetica-Bold";
const N = "Helvetica";

const s = StyleSheet.create({
  page: { fontFamily: N, fontSize: 9, color: DARK, padding: 48, backgroundColor: "#fff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 },
  brand: { flexDirection: "column" },
  brandName: { fontFamily: B, fontSize: 18, color: BLUE },
  brandSub: { fontSize: 9, color: GRAY_TEXT, marginTop: 2 },
  invoiceMeta: { alignItems: "flex-end" },
  invoiceTitle: { fontFamily: B, fontSize: 22, color: GRAY_BORDER, letterSpacing: 2 },
  invoiceNumber: { fontFamily: B, fontSize: 11, color: DARK, marginTop: 4 },
  divider: { borderBottom: 1, borderColor: GRAY_BORDER, marginBottom: 28 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 36 },
  partyBlock: { flexDirection: "column", maxWidth: 220 },
  partyLabel: { fontFamily: B, fontSize: 7, color: BLUE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  partyName: { fontFamily: B, fontSize: 11, color: DARK, marginBottom: 2 },
  partyText: { fontSize: 9, color: GRAY_TEXT, lineHeight: 1.5 },
  datesRow: { flexDirection: "row", gap: 16, backgroundColor: GRAY_LIGHT, borderRadius: 6, padding: 14, marginBottom: 28 },
  dateBlock: { flex: 1 },
  dateLabel: { fontFamily: B, fontSize: 7, color: BLUE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  dateValue: { fontFamily: B, fontSize: 10, color: DARK },
  tableHeader: { flexDirection: "row", backgroundColor: BLUE, borderRadius: 4, padding: "8 10", marginBottom: 2 },
  tableHeaderText: { fontFamily: B, fontSize: 8, color: "#fff" },
  tableRow: { flexDirection: "row", padding: "8 10", borderBottom: 1, borderColor: GRAY_BORDER },
  tableRowAlt: { flexDirection: "row", padding: "8 10", borderBottom: 1, borderColor: GRAY_BORDER, backgroundColor: GRAY_LIGHT },
  colDesc: { flex: 5 },
  colQty: { flex: 1, alignItems: "center" },
  colPrice: { flex: 2, alignItems: "flex-end" },
  colTotal: { flex: 2, alignItems: "flex-end" },
  rowText: { fontSize: 9, color: DARK },
  rowTextRight: { fontSize: 9, color: DARK, textAlign: "right" },
  totalsBlock: { alignItems: "flex-end", marginTop: 16, marginBottom: 36 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 40, marginBottom: 4 },
  totalLabel: { fontSize: 9, color: GRAY_TEXT, width: 100, textAlign: "right" },
  totalValue: { fontSize: 9, color: DARK, width: 80, textAlign: "right" },
  grandTotalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 40, backgroundColor: BLUE, borderRadius: 4, padding: "10 16", marginTop: 6 },
  grandLabel: { fontFamily: B, fontSize: 11, color: "#fff", width: 100, textAlign: "right" },
  grandValue: { fontFamily: B, fontSize: 11, color: "#fff", width: 80, textAlign: "right" },
  notesBlock: { backgroundColor: GRAY_LIGHT, borderRadius: 6, padding: 14, marginBottom: 28 },
  notesLabel: { fontFamily: B, fontSize: 7, color: BLUE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  notesText: { fontSize: 9, color: GRAY_TEXT, lineHeight: 1.5 },
  footer: { borderTop: 1, borderColor: GRAY_BORDER, paddingTop: 14, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: GRAY_TEXT },
  statusBadge: { backgroundColor: "#dcfce7", borderRadius: 4, padding: "4 10", alignSelf: "flex-start" },
  statusText: { fontFamily: B, fontSize: 8, color: "#15803d" },
});

function fmt(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}
function fmtDate(d: Date | string) {
  return new Intl.DateTimeFormat("it-IT").format(new Date(d));
}

export interface CompanyData {
  name: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  vatNumber?: string | null;
  fiscalCode?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  province?: string | null;
  country?: string | null;
  bankName?: string | null;
  iban?: string | null;
  bic?: string | null;
  invoiceFooter?: string | null;
}

export interface InvoiceData {
  number: string;
  issueDate: Date | string;
  dueDate: Date | string;
  paidAt?: Date | string | null;
  status: string;
  notes?: string | null;
  amount: number;
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[];
  client: {
    name: string;
    company?: string | null;
    email?: string | null;
    vatNumber?: string | null;
    fiscalCode?: string | null;
    address?: string | null;
    city?: string | null;
    zip?: string | null;
    province?: string | null;
    country?: string | null;
  };
}

export default function InvoicePDF({ invoice, company }: { invoice: InvoiceData; company: CompanyData }) {
  const companyAddress = [company.address, company.city, company.zip, company.province, company.country]
    .filter(Boolean).join(", ");
  const clientAddress = [invoice.client.address, invoice.client.city, invoice.client.zip, invoice.client.province, invoice.client.country]
    .filter(Boolean).join(", ");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.brand}>
            <Text style={s.brandName}>{company.name || "Market Your Business"}</Text>
            {company.website && <Text style={s.brandSub}>{company.website}</Text>}
          </View>
          <View style={s.invoiceMeta}>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceNumber}>{invoice.number}</Text>
            {invoice.status === "PAID" && (
              <View style={s.statusBadge}>
                <Text style={s.statusText}>PAGATA</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.divider} />

        {/* Parties */}
        <View style={s.parties}>
          <View style={s.partyBlock}>
            <Text style={s.partyLabel}>Emessa da</Text>
            <Text style={s.partyName}>{company.name || "Market Your Business"}</Text>
            {company.vatNumber && <Text style={s.partyText}>UTR: {company.vatNumber}</Text>}
            {company.email && <Text style={s.partyText}>{company.email}</Text>}
            {company.phone && <Text style={s.partyText}>{company.phone}</Text>}
            {companyAddress && <Text style={s.partyText}>{companyAddress}</Text>}
          </View>
          <View style={s.partyBlock}>
            <Text style={s.partyLabel}>Fatturata a</Text>
            <Text style={s.partyName}>{invoice.client.name}</Text>
            {invoice.client.company && <Text style={s.partyText}>{invoice.client.company}</Text>}
            {invoice.client.vatNumber && <Text style={s.partyText}>P.IVA: {invoice.client.vatNumber}</Text>}
            {invoice.client.fiscalCode && <Text style={s.partyText}>C.F.: {invoice.client.fiscalCode}</Text>}
            {invoice.client.email && <Text style={s.partyText}>{invoice.client.email}</Text>}
            {clientAddress && <Text style={s.partyText}>{clientAddress}</Text>}
          </View>
        </View>

        {/* Dates */}
        <View style={s.datesRow}>
          <View style={s.dateBlock}>
            <Text style={s.dateLabel}>Data emissione</Text>
            <Text style={s.dateValue}>{fmtDate(invoice.issueDate)}</Text>
          </View>
          <View style={s.dateBlock}>
            <Text style={s.dateLabel}>Scadenza</Text>
            <Text style={s.dateValue}>{fmtDate(invoice.dueDate)}</Text>
          </View>
          {invoice.paidAt && (
            <View style={s.dateBlock}>
              <Text style={s.dateLabel}>Data pagamento</Text>
              <Text style={s.dateValue}>{fmtDate(invoice.paidAt)}</Text>
            </View>
          )}
        </View>

        {/* Table */}
        <View style={s.tableHeader}>
          <View style={s.colDesc}><Text style={s.tableHeaderText}>Descrizione</Text></View>
          <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>Qtà</Text></View>
          <View style={s.colPrice}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>Prezzo unit.</Text></View>
          <View style={s.colTotal}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>Totale</Text></View>
        </View>

        {invoice.lineItems.map((li, i) => (
          <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <View style={s.colDesc}><Text style={s.rowText}>{li.description}</Text></View>
            <View style={s.colQty}><Text style={[s.rowText, { textAlign: "center" }]}>{li.quantity}</Text></View>
            <View style={s.colPrice}><Text style={s.rowTextRight}>{fmt(li.unitPrice)}</Text></View>
            <View style={s.colTotal}><Text style={s.rowTextRight}>{fmt(li.total)}</Text></View>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totalsBlock}>
          <View style={s.grandTotalRow}>
            <Text style={s.grandLabel}>Totale</Text>
            <Text style={s.grandValue}>{fmt(invoice.amount)}</Text>
          </View>
        </View>

        {/* Bank details */}
        {(company.iban || company.bankName) && (
          <View style={s.notesBlock}>
            <Text style={s.notesLabel}>Coordinate bancarie</Text>
            {company.bankName && <Text style={s.partyText}>Banca: {company.bankName}</Text>}
            {company.iban && <Text style={s.partyText}>IBAN: {company.iban}</Text>}
            {company.bic && <Text style={s.partyText}>BIC/SWIFT: {company.bic}</Text>}
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={s.notesBlock}>
            <Text style={s.notesLabel}>Note</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            {company.invoiceFooter || `${company.name || "Market Your Business"} — ${invoice.number}`}
          </Text>
          <Text style={s.footerText}>Grazie per la tua fiducia!</Text>
        </View>
      </Page>
    </Document>
  );
}
