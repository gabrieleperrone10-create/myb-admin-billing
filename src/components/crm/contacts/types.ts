import type { ContactLifecycle } from "@prisma/client";
import type { CustomFieldValues } from "@/lib/crm/customFields";
import type { StandardColumn } from "@/lib/crm/contactQuery";

export type ContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  lifecycle: ContactLifecycle;
  source: string | null;
  ownerUserId: string | null;
  lastActivityAt: Date | null;
  createdAt: Date;
  customFields: CustomFieldValues;
  tags: { id: string; name: string; color: string }[];
};

export type MemberOption = { userId: string; name: string };

export type CustomFieldDefLite = {
  id: string;
  key: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "MULTISELECT" | "CHECKBOX" | "URL" | "EMAIL" | "PHONE";
  options: string[];
  required: boolean;
  order: number;
};

export type TagOption = { id: string; name: string; color: string };

export type SavedViewLite = {
  id: string;
  name: string;
  isShared: boolean;
  mine: boolean;
  filters: Record<string, unknown>;
  columns: string[];
  sort: { key: string; dir: "asc" | "desc" } | null;
};

export const LIFECYCLE_META: Record<ContactLifecycle, { label: string; color: string }> = {
  LEAD: { label: "Lead", color: "#f97316" },
  CUSTOMER: { label: "Cliente", color: "#10b981" },
  ARCHIVED: { label: "Archiviato", color: "#94a3b8" },
};

export const STANDARD_COLUMN_LABELS: Record<StandardColumn, string> = {
  lifecycle: "Stato",
  email: "Email",
  phone: "Telefono",
  companyName: "Azienda",
  jobTitle: "Ruolo",
  tags: "Etichette",
  owner: "Responsabile",
  source: "Fonte",
  lastActivityAt: "Ultima attività",
  createdAt: "Creato il",
};
