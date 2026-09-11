import Link from "next/link";
import { loadHomeData } from "@/lib/db/queries";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
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

export default async function VetPage() {
  const [data, canWrite] = await Promise.all([loadHomeData(), getWriteAccess()]);
  const contacts = data.vet_contacts ?? [];

  return (
    <main className="px-4 pt-6">
      <AppHeader eyebrow="Health" title="Vet contacts" subtitle="Farm-level veterinarian directory" />
      <p className="mb-4 text-sm text-stone-600">
        Bloodline Book does not establish a VCPR. Use these contacts to call your vet — never for in-app diagnosis or dosing advice.
      </p>

      <div className="space-y-3">
        {contacts.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-stone-600 ring-1 ring-stone-200">
            No vet contacts yet.
          </p>
        ) : (
          contacts.map((v) => (
            <article key={v.id} className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-stone-900">{v.name}</p>
                  <p className="text-xs uppercase tracking-wide text-stone-500">{v.role}</p>
                </div>
                {canWrite && (
                  <ActionForm action={actionDeleteVetContact}>
                    <input type="hidden" name="id" value={v.id} />
                    <button type="submit" className="text-sm text-red-700">Delete</button>
                  </ActionForm>
                )}
              </div>
              {v.phone && <p className="mt-2 text-sm">Phone: {v.phone}</p>}
              {v.emergency_phone && <p className="text-sm">Emergency: {v.emergency_phone}</p>}
              {v.address && <p className="text-sm text-stone-600">{v.address}</p>}
              {v.services_offered && <p className="mt-1 text-sm text-stone-600">{v.services_offered}</p>}
            </article>
          ))
        )}
      </div>

      {canWrite && (
        <section className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <h2 className="mb-3 text-sm font-bold text-stone-900">Add vet contact</h2>
          <ActionForm action={actionUpsertVetContact}>
            <label className="block text-sm font-medium text-stone-700">Role</label>
            <select name="role" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" defaultValue="primary">
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <label className="mt-3 block text-sm font-medium text-stone-700">Name</label>
            <input name="name" required className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
            <label className="mt-3 block text-sm font-medium text-stone-700">Phone</label>
            <input name="phone" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
            <label className="mt-3 block text-sm font-medium text-stone-700">Emergency phone</label>
            <input name="emergencyPhone" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
            <label className="mt-3 block text-sm font-medium text-stone-700">Address</label>
            <input name="address" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
            <label className="mt-3 block text-sm font-medium text-stone-700">Services offered</label>
            <textarea name="servicesOffered" rows={2} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
            <SubmitButton label="Save contact" />
          </ActionForm>
        </section>
      )}

      <p className="mt-6 text-center">
        <Link href="/health" className="text-sm font-semibold text-emerald-800">← Back to Health</Link>
      </p>
      <BottomNav active="health" />
    </main>
  );
}
