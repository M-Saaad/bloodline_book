"use client";

import { useEffect, useState } from "react";

export function SyncBadge({ pending = false }: { pending?: boolean }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online && !pending) return null;

  return (
    <p className="text-xs text-[var(--text-muted)]">
      {!online ? "Saved locally, will sync when online" : "Syncing…"}
    </p>
  );
}
