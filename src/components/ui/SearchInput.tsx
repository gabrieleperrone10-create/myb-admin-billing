"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
import { Search, X } from "lucide-react";

interface Props {
  placeholder?: string;
  className?: string;
}

export function SearchInput({ placeholder = "Cerca...", className }: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const inputRef     = useRef<HTMLInputElement>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const update = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else        params.delete("q");
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => update(e.target.value), 300);
  }

  function handleClear() {
    if (inputRef.current) inputRef.current.value = "";
    update("");
  }

  const hasValue = !!(searchParams.get("q"));

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        style={{ color: "var(--fg-3)" }}
        strokeWidth={1.6}
      />
      <input
        ref={inputRef}
        type="search"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-8 pr-7 py-1.5 text-[13px] rounded-[6px] border outline-none focus:ring-1"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
          color: "var(--fg)",
          "--tw-ring-color": "var(--info)",
        } as React.CSSProperties}
      />
      {hasValue && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2"
          style={{ color: "var(--fg-3)" }}
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.6} />
        </button>
      )}
    </div>
  );
}
