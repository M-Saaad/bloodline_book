"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Chip } from "@/components/ui/Chip";

const filters = [
  { id: "all", label: "All" },
  { id: "does", label: "Does" },
  { id: "bucks", label: "Bucks" },
  { id: "kids", label: "Kids" },
];

export function AnimalsFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("filter") || "all";
  const q = sp.get("q") || "";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function setFilter(id: string) {
    const params = new URLSearchParams(sp.toString());
    if (id === "all") params.delete("filter");
    else params.set("filter", id);
    router.push(`/animals?${params.toString()}`);
  }

  function onSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      router.push(`/animals?${params.toString()}`);
    }, 300);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex h-[38px] items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.8} />
        <input
          type="search"
          placeholder="Search by name, tattoo, or ADGA#"
          defaultValue={q}
          onChange={(e) => onSearch(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            selected={current === f.id}
            onClick={() => setFilter(f.id)}
          />
        ))}
      </div>
    </div>
  );
}
