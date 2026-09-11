import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import { loadHomeData } from "@/lib/db/queries";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { actionDeleteVetContact, actionUpsertVetContact } from "@/lib/server-actions";
import { getWriteAccess } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const ROLES = [
  "primary",
  "backup",
  "emergency clinic",
  "teaching hospital",
  "mobile practice",
  "poison control",
] as const;

const ROLE_LABELS: Record<string, string> = {
  primary: "Primary vet",
  backup: "Backup vet",
  "emergency clinic": "Emergency clinic",
  "teaching hospital": "Teaching hospital",
  "mobile practice": "Mobile practice",
  "poison control": "Poison control",
};

export default async function VetPage() {
  const [data, canWrite] = await Promise.all([loadHomeData(), getWriteAccess()]);
  const contacts = data.vet_contacts ?? [];

  return (
    <main className="min-h-screen bg-[var(--card-bg)]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <Link href="/" className="p-1 text-[var(--text-secondary)]" aria-label="Back">
          <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
        </Link>
        <p className="text-[15px] font-semibold">Vet & emergency</p>
        <button type="button" className="p-1 text-[var(--text-secondary)]" aria-label="Edit">
          <Pencil className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>

      <div className="px-4 pb-8">
        {contacts.length === 0 ? (
          <p className="rounded-[var(--radius)] bg-[var(--field-bg)] p-4 text-sm text-[var(--text-secondary)]">
            No vet contacts yet
          </p>
        ) : (
          <div className="space-y-2">
            {contacts.map((v) => (
              <article key={v.id} className="rounded-[var(--radius)] bg-[var(--field-bg)] p-2.5">
                <p className="text-[11px] text-[var(--text-muted)]">
                  {ROLE_LABELS[v.role] ?? v.role}
                </p>
                <p className="mt-0.5 text-sm font-semibold">{v.name}</p>
                {v.phone && (
                  <a href={`tel:${v.phone}`} className="mt-0.5 block text-xs text-[var(--text-secondary)]">
                    {v.phone}
                  </a>
                )}
                {v.vcpr_established && v.vcpr_established !== "unknown" && (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    VCPR: {v.vcpr_established}
                  </p>
                )}
                {canWrite && (
                  <ActionForm action={actionDeleteVetContact} className="mt-2">
                    <input type="hidden" name="id" value={v.id} />
                    <button type="submit" className="text-xs text-[var(--danger-text)]">
                      Delete
                    </button>
                  </ActionForm>
                )}
              </article>
            ))}
          </div>
        )}

        {canWrite && (
          <ActionForm action={actionUpsertVetContact} className="mt-4 space-y-3">
            <p className="text-sm font-semibold">Add contact</p>
            <select name="role" className="h-[38px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm" defaultValue="primary">
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
            <input name="name" required placeholder="Name" className="h-[38px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm" />
            <input name="phone" placeholder="Phone" className="h-[38px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm" />
            <SubmitButton label="Add contact" className="h-[38px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card-bg)] text-sm font-normal text-[var(--text-primary)]" />
          </ActionForm>
        )}

        <Link href="/transactions" className="mt-6 block text-center text-xs text-[var(--accent-text)]">
          Transactions
        </Link>

        <p className="mt-6 border-t border-[var(--border)] pt-2.5 text-[11px] text-[var(--text-muted)]">
          This helps you reach care faster. It doesn&apos;t replace calling your vet.
        </p>
      </div>
    </main>
  );
}
