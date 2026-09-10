import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewAnimalPage() {
  return (
    <main className="min-h-screen bg-[var(--card-bg)] px-4 pt-4">
      <Link href="/animals" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)]">
        <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
        Back
      </Link>
      <h1 className="mt-4 text-lg font-semibold">Add animal</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Use the More menu on the home screen to record a birth or purchase for now.
      </p>
    </main>
  );
}
