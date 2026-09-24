import { CalendarClock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { MemberData, OpportunityCardData } from "./types";

function daysInStage(stageEnteredAt: string): number {
  const ms = Date.now() - new Date(stageEnteredAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function OwnerAvatar({ userId, members, size = 22 }: { userId: string | null; members: MemberData[]; size?: number }) {
  const member = userId ? members.find(m => m.userId === userId) : undefined;
  if (!member) {
    return (
      <div
        className="rounded-full flex items-center justify-center shrink-0"
        style={{ width: size, height: size, backgroundColor: "var(--subtle)", border: "1px dashed var(--border)" }}
        title="Nessun responsabile"
      />
    );
  }
  if (member.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.imageUrl} alt={member.name} title={member.name} className="rounded-full shrink-0 object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.42, backgroundColor: "oklch(0.85 0.04 80)", color: "var(--fg)" }}
      title={member.name}
    >
      {initials(member.name)}
    </div>
  );
}

export function OpportunityCard({
  opp, members, onClick,
}: {
  opp: OpportunityCardData;
  members: MemberData[];
  onClick: () => void;
}) {
  const overdue = opp.status === "OPEN" && !!opp.expectedCloseDate && new Date(opp.expectedCloseDate) < new Date(new Date().toDateString());
  const days = daysInStage(opp.stageEnteredAt);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter") onClick(); }}
      className="rounded-[var(--r-lg)] p-3 cursor-pointer transition-shadow hover:shadow-sm"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-[13px] font-semibold leading-snug mb-1" style={{ color: "var(--fg)" }}>{opp.name}</p>
      <p className="text-[12px] truncate mb-2" style={{ color: "var(--fg-2)" }}>
        {opp.contact.name}
        {opp.contact.companyName && <span style={{ color: "var(--fg-3)" }}> · {opp.contact.companyName}</span>}
      </p>

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--fg)" }}>{formatCurrency(opp.value)}</span>
        <OwnerAvatar userId={opp.ownerUserId} members={members} />
      </div>

      <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--fg-3)" }}>
        <span>{days === 0 ? "oggi" : `${days}g in fase`}</span>
        {opp.expectedCloseDate && (
          <span className="flex items-center gap-1" style={{ color: overdue ? "var(--danger)" : "var(--fg-3)" }}>
            <CalendarClock className="w-3 h-3" />
            {formatDate(opp.expectedCloseDate)}
          </span>
        )}
      </div>
    </div>
  );
}
