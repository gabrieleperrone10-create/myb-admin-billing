import type { Activity } from "@prisma/client";
import { activityIcon, describeActivity } from "./describeActivity";

/** Una riga della cronologia (tutto tranne le note, che sono card espanse — vedi ActivityTab). */
export function ActivityItem({
  activity,
  fieldLabels,
  authorName,
  timeLabel,
}: {
  activity: Pick<Activity, "type" | "data">;
  fieldLabels: Record<string, string>;
  authorName: string | null;
  timeLabel: string;
}) {
  const { Icon, color } = activityIcon(activity.type);
  const { title, detail } = describeActivity(activity, fieldLabels);

  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px]" style={{ color: "var(--fg)" }}>{title}</p>
        {detail && <p className="text-[12px] truncate" style={{ color: "var(--fg-3)" }}>{detail}</p>}
      </div>
      <div className="text-[11px] shrink-0 text-right" style={{ color: "var(--fg-3)" }}>
        <p>{timeLabel}</p>
        {authorName && <p>{authorName}</p>}
      </div>
    </div>
  );
}
