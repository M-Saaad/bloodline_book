"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimalMediaUpload } from "@/components/AnimalMediaUpload";

type AnimalOption = { id: number; label: string };

export function LogPhotoForm({ animals }: { animals: AnimalOption[] }) {
  const router = useRouter();
  const [animalId, setAnimalId] = useState(animals[0]?.id ?? 0);

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button type="button" onClick={() => router.push("/")} className="text-sm text-[var(--text-secondary)]">
          Cancel
        </button>
        <p className="text-[15px] font-semibold">Add photo</p>
        <div className="w-12" />
      </div>

      <div className="px-4 pb-8">
        <div className="mb-3 py-3">
          <p className="text-xs text-[var(--text-secondary)]">Animal</p>
          <select
            className="mt-1 flex h-[38px] w-full items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm"
            value={animalId}
            onChange={(e) => setAnimalId(Number(e.target.value))}
          >
            {animals.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>

        {animalId > 0 && (
          <AnimalMediaUpload animalId={animalId} />
        )}
      </div>
    </>
  );
}
