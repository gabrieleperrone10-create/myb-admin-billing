import type { TaskPriority, TaskType } from "@prisma/client";
// `lib/crm/tasks.ts` e' "server-only": qui si importa solo il *tipo* (erasato
// alla compilazione, nessun codice server finisce nel bundle client).
import type { TaskRow } from "@/lib/crm/tasks";

export type { TaskRow };

export type TaskMemberOption = { userId: string; name: string };

/** Riassunto del prossimo task aperto di un'opportunità, per la card del kanban. */
export type NextTaskSummary = { id: string; title: string; type: TaskType; dueAt: string | null; overdue: boolean };

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  TODO: "Da fare",
  CALL: "Chiamata",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  MEETING: "Riunione",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Bassa",
  NORMAL: "Normale",
  HIGH: "Alta",
};
