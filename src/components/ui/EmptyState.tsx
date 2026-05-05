import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, subtitle, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <Icon className="w-9 h-9 text-fg-3 mb-4" strokeWidth={1.4} />
      <p className="text-[14px] font-medium text-fg-2">{title}</p>
      {subtitle && <p className="text-[12px] text-fg-3 mt-1">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
