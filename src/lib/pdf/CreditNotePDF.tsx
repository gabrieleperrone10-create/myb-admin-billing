import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const RED = "#dc2626";
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
  brandName: { fontFamily: B, fontSize: 18, color: RED },
  brandSub: { fontSize: 9, color: GRAY_TEXT, marginTop: 2 },
  invoiceMeta: { alignItems: "flex-end" },
  invoiceTitle: { fontFamily: B, fontSize: 20, color: GRAY_BORDER, letterSpacing: 1.5 },
  invoiceNumber: { fontFamily: B, fontSize: 11, color: DARK, marginTop: 4 },
  divider: { borderBottom: 1, borderColor: GRAY_BORDER, marginBottom: 28 },
  parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  partyBlock: { flexDirection: "column", maxWidth: 220 },
  partyLabel: { fontFamily: B, fontSize: 7, color: RED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  partyName: { fontFamily: B, fontSize: 11, color: DARK, marginBottom: 2 },
  partyText: { fontSize: 9, color: GRAY_TEXT, lineHeight: 1.5 },
  refBlock: { backgroundColor: GRAY_LIGHT, borderRadius: 6, padding: 14, marginBottom: 28, flexDirection: "row", gap: 16 },
  refCol: { flex: 1 },
  refLabel: { fontFamily: B, fontSize: 7, color: RED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  refValue: { fontFamily: B, fontSize: 10, color: DARK },
  tableHeader: { flexDirection: "row", backgroundColor: RED, borderRadius: 4, padding: "8 10", marginBottom: 2 },
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
  grandTotalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 40, backgroundColor: RED, borderRadius: 4, padding: "10 16", marginTop: 6 },
  grandLabel: { fontFamily: B, fontSize: 11, color: "#fff", width: 100, textAlign: "right" },
  grandValue: { fontFamily: B, fontSize: 11, color: "#fff", width: 100, textAlign: "right" },
  notesBlock: { backgroundColor: GRAY_LIGHT, borderRadius: 6, padding: 14, marginBottom: 28 },
  notesLabel: { fontFamily: B, fontSize: 7, color: RED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  notesText: { fontSize: 9, color: GRAY_TEXT, lineHeight: 1.5 },
  footer: { borderTop: 1, borderColor: GRAY_BORDER, paddingTop: 14, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: GRAY_TEXT },
});

function fmtDate(d: Date | string) {
  return new Intl.DateTimeFormat("it-IT").format(new Date(d));
}

export interface CreditNoteCompanyData {
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
  invoiceFooter?: string | null;
}

export interface CreditNoteData {
  number: string;
  issueDate: Date | string;
  reason?: string | null;
  notes?: string | null;
  amount: number;
  currency: string;
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[];
  originalInvoiceNumber: string;
  originalInvoiceDate?: Date | string | null;
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

export default function CreditNotePDF({ creditNote, company }: { creditNote: CreditNoteData; company: CreditNoteCompanyData }) {
  const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: creditNote.currency || "EUR" }).format(n);

  const companyAddress = [company.address, company.city, company.zip, company.province, company.country]
    .filter(Boolean).join(", ");
  const clientAddress = [creditNote.client.address, creditNote.client.city, creditNote.client.zip, creditNote.client.province, creditNote.client.country]
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
            <Text style={s.invoiceTitle}>NOTA DI CREDITO</Text>
            <Text style={s.invoiceNumber}>{creditNote.number}</Text>
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
            <Text style={s.partyLabel}>Emessa a</Text>
            <Text style={s.partyName}>{creditNote.client.name}</Text>
            {creditNote.client.company && <Text style={s.partyText}>{creditNote.client.company}</Text>}
            {creditNote.client.vatNumber && <Text style={s.partyText}>P.IVA: {creditNote.client.vatNumber}</Text>}
            {creditNote.client.fiscalCode && <Text style={s.partyText}>C.F.: {creditNote.client.fiscalCode}</Text>}
            {creditNote.client.email && <Text style={s.partyText}>{creditNote.client.email}</Text>}
            {clientAddress && <Text style={s.partyText}>{clientAddress}</Text>}
          </View>
        </View>

        {/* Riferimenti */}
        <View style={s.refBlock}>
          <View style={s.refCol}>
            <Text style={s.refLabel}>Data emissione</Text>
            <Text style={s.refValue}>{fmtDate(creditNote.issueDate)}</Text>
          </View>
          <View style={s.refCol}>
            <Text style={s.refLabel}>Riferita a fattura</Text>
            <Text style={s.refValue}>{creditNote.originalInvoiceNumber}</Text>
          </View>
          {creditNote.originalInvoiceDate && (
            <View style={s.refCol}>
              <Text style={s.refLabel}>Data fattura</Text>
              <Text style={s.refValue}>{fmtDate(creditNote.originalInvoiceDate)}</Text>
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

        {creditNote.lineItems.map((li, i) => (
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
            <Text style={s.grandLabel}>Totale a storno</Text>
            <Text style={s.grandValue}>-{fmt(creditNote.amount)}</Text>
          </View>
        </View>

        {/* Motivo */}
        {creditNote.reason && (
          <View style={s.notesBlock}>
            <Text style={s.notesLabel}>Motivo</Text>
            <Text style={s.notesText}>{creditNote.reason}</Text>
          </View>
        )}

        {/* Notes */}
        {creditNote.notes && (
          <View style={s.notesBlock}>
            <Text style={s.notesLabel}>Note</Text>
            <Text style={s.notesText}>{creditNote.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            {company.invoiceFooter || `${company.name || "Market Your Business"} — ${creditNote.number}`}
          </Text>
          <Text style={s.footerText}>Documento generato elettronicamente</Text>
        </View>
      </Page>
    </Document>
  );
}
