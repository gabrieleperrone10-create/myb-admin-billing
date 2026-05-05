import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ExpenseForm from "../new/ExpenseForm";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) notFound();

  return (
    <div className="space-y-[14px]" style={{ maxWidth: 1200 }}>
      <div>
        <h1 className="font-semibold" style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg)" }}>
          Modifica spesa
        </h1>
        <p className="font-mono text-[12px]" style={{ color: "var(--fg-3)" }}>{expense.id}</p>
      </div>
      <ExpenseForm existing={expense} />
    </div>
  );
}
