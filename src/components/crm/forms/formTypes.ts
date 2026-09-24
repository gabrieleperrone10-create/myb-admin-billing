import type { CustomFieldType } from "@prisma/client";

/** Tipi condivisi fra i pezzi client dell'editor del form builder. */

export type EditorPipeline = {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
};

export type EditorTag = { id: string; name: string; color: string };

export type EditorMember = { userId: string; name: string };

export type EditorCustomFieldDef = {
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
};

export type EditorSubmission = {
  id: string;
  createdAt: string;
  contactId: string | null;
  contactName: string | null;
  data: Record<string, unknown>;
};
