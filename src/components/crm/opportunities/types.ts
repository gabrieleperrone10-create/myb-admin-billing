import type { CustomFieldType, StageKind } from "@prisma/client";

/** Riga opportunità già appiattita per i componenti client (kanban/lista/drawer). */
export type OpportunityCardData = {
  id: string;
  name: string;
  value: number;
  status: "OPEN" | "WON" | "LOST";
  pipelineId: string;
  stageId: string;
  position: number;
  ownerUserId: string | null;
  productId: string | null;
  productName: string | null;
  expectedCloseDate: string | null; // ISO date
  stageEnteredAt: string; // ISO datetime
  lostReason: string | null;
  customFields: Record<string, unknown>;
  contact: { id: string; name: string; email: string | null; companyName: string | null };
};

export type StageData = {
  id: string;
  name: string;
  order: number;
  kind: StageKind;
  probability: number | null;
  color: string;
};

export type PipelineData = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: StageData[];
};

export type MemberData = { userId: string; name: string; imageUrl: string | null };

export type ProductData = { id: string; name: string; basePrice: number };

export type CustomFieldDefData = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
};
