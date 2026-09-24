import { requireCompany } from "@/lib/company";
import { listCompanyMembers } from "@/lib/crm/members";
import { contactDisplayName } from "@/lib/crm/contacts";
import { listTasks } from "@/lib/crm/tasks";
import { TasksTabClient } from "./TasksTabClient";
import type { ContactTabProps } from "./types";

// Proprietario: agente Task.
export default async function TasksTab({ slug, contactId }: ContactTabProps) {
  const { db, companyId, company, userId } = await requireCompany(slug);

  const [contact, members, openTasks, completedTasks] = await Promise.all([
    db.contact.findUnique({ where: { id: contactId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } }),
    listCompanyMembers(companyId),
    listTasks(db, { contactId, status: "OPEN" }),
    listTasks(db, { contactId, status: "DONE", take: 5 }),
  ]);

  if (!contact) return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>Contatto non trovato</p>;

  return (
    <TasksTabClient
      contact={{ id: contact.id, name: contactDisplayName(contact), email: contact.email, companyName: contact.companyName }}
      openTasks={openTasks}
      completedTasks={completedTasks}
      members={members.map(m => ({ userId: m.userId, name: m.name }))}
      currentUserId={userId}
      companyTimezone={company.timezone}
    />
  );
}
