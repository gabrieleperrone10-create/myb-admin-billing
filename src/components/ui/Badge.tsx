import { cn } from "@/lib/utils";

export type BadgeVariant = "ok" | "warn" | "danger" | "info" | "neutral";

const VARIANTS: Record<BadgeVariant, string> = {
  ok:      "bg-ok-soft text-ok border-ok/20",
  warn:    "bg-warn-soft text-warn border-warn/20",
  danger:  "bg-danger-soft text-danger border-danger/20",
  info:    "bg-info-soft text-info border-info/20",
  neutral: "bg-subtle text-fg-2 border-border",
};

const DOT_COLORS: Record<BadgeVariant, string> = {
  ok:      "bg-ok",
  warn:    "bg-warn",
  danger:  "bg-danger",
  info:    "bg-info",
  neutral: "bg-fg-3",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-medium border",
        VARIANTS[variant],
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOT_COLORS[variant])} />
      {children}
    </span>
  );
}

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
export type DepositStatus = "PENDING" | "PAID" | "REFUNDED";

const INVOICE_STATUS: Record<InvoiceStatus, { variant: BadgeVariant; label: string }> = {
  DRAFT:     { variant: "neutral", label: "Bozza" },
  SENT:      { variant: "info",    label: "Inviata" },
  PAID:      { variant: "ok",      label: "Pagata" },
  OVERDUE:   { variant: "danger",  label: "Scaduta" },
  CANCELLED: { variant: "neutral", label: "Annullata" },
};

const DEPOSIT_STATUS: Record<DepositStatus, { variant: BadgeVariant; label: string }> = {
  PENDING:  { variant: "warn",    label: "In Attesa" },
  PAID:     { variant: "ok",      label: "Pagato" },
  REFUNDED: { variant: "neutral", label: "Rimborsato" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { variant, label } = INVOICE_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  const { variant, label } = DEPOSIT_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}
