"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** router.refresh() periodico mentre la scheda e' visibile. Non renderizza nulla. */
export default function AutoRefresh({ ms = 15_000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}
