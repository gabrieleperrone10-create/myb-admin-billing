import ExpenseForm from "./ExpenseForm";

export default function NewExpensePage() {
  return (
    <div className="space-y-[14px]" style={{ maxWidth: 1200 }}>
      <div>
        <h1 className="font-semibold" style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg)" }}>
          Nuova spesa
        </h1>
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
          Registra una voce di costo
        </p>
      </div>
      <ExpenseForm />
    </div>
  );
}
