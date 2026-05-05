import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-[12px] font-medium text-fg-2">
        {label}
        {props.required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <input
        id={inputId}
        className={cn(
          "w-full px-3 py-2 border rounded-[var(--r-md)] text-[13px] text-fg bg-surface transition-colors",
          "focus:outline-none focus:border-info focus:ring-3 focus:ring-info-soft",
          "placeholder:text-fg-3 disabled:bg-subtle disabled:text-fg-3",
          error ? "border-danger focus:border-danger focus:ring-danger-soft" : "border-border",
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-[11px] text-fg-3">{hint}</p>}
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className, id, ...props }: SelectProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-[12px] font-medium text-fg-2">
        {label}
        {props.required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <select
        id={inputId}
        className={cn(
          "w-full px-3 py-2 border rounded-[var(--r-md)] text-[13px] text-fg bg-surface transition-colors",
          "focus:outline-none focus:border-info focus:ring-3 focus:ring-info-soft",
          "disabled:bg-subtle disabled:text-fg-3",
          error ? "border-danger" : "border-border",
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-[12px] font-medium text-fg-2">
        {label}
      </label>
      <textarea
        id={inputId}
        rows={3}
        className={cn(
          "w-full px-3 py-2 border rounded-[var(--r-md)] text-[13px] text-fg bg-surface resize-none transition-colors",
          "focus:outline-none focus:border-info focus:ring-3 focus:ring-info-soft",
          "placeholder:text-fg-3",
          error ? "border-danger" : "border-border",
          className
        )}
        {...props}
      />
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
