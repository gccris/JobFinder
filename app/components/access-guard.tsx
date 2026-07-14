"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function AccessGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/access", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status !== 403) return;
        const data = await response.json().catch(() => null);
        if (data?.code === "ACCESS_PENDING") window.location.reload();
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [pathname]);

  return null;
}
