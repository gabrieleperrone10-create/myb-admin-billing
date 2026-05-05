import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium rounded-[var(--r-md)] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none";

  const sizes = {
    sm: "px-2.5 py-1.5 text-[12px]",
    md: "px-3 py-[7px] text-[13px]",
  };

  const variants = {
    primary:  "bg-fg text-white hover:bg-fg/90 active:bg-fg/80",
    secondary:"bg-surface text-fg-2 border border-border hover:bg-subtle hover:text-fg",
    ghost:    "bg-transparent text-fg-2 hover:bg-subtle hover:text-fg",
    danger:   "bg-danger-soft text-danger border border-danger/30 hover:bg-danger/10",
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0 flex items-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
