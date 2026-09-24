# Bloodline Book — ROADMAP

Single source of truth for build phases **0–16**: what shipped, what’s next, acceptance checks, and migration numbers.

Written 24 Sep 2026 against `main` at `b0307cf` (Phase 4 merged). Phases **5–16** follow the producer review of `PRODUCT-REVIEW.md` and `USER-FLOWS.md` (order: data-loss fixes first, then the ten review questions, each phase building only on earlier ones).

## At a glance

| Phase | Name | Status | Review item | Size | Needs |
|---|---|---|---|---|---|
| 0 | Foundation | **Complete** | — | — | — |
| 1 | Finances & More | **Complete** | — | — | 0 |
| 2 | Health & breeding | **Complete** | — | — | 0 |
| 3 | Land | **Complete** | — | — | 2 |
| 4 | Breeding & health follow-ups | **Complete** | — | — | 2, 3 |
| 5 | Nothing gets lost | **Complete** | Data-loss fixes, FAMACHA default, password reset | M | — |
| 6 | Fix mistakes | **Complete** | Q10: edit and delete | L (can split 6a / 6b) | 5 |
| 7 | Know every goat | **Complete** | Q5: identity, parents, search | M | 6 |
| 8 | Breeding the way it happens | **Complete** | Q3: due window, confirm / open | M | 5, 6 |
| 9 | Kidding in one step | **Complete** | Q4: kids, birth weights, weaning | M | 7, 8 |
| 10 | Health you can trust at sale time | **Complete** | Q8: meat/milk withdrawal, FAMACHA | M | 6, 7 |
| 11 | The Today screen | **Complete** | Q2 | M | 8, 10 |
| — | **Checkpoint: 30-day trial release** | **Next** | Q10 | — | 5–11 |
| 12 | Money tied to goats | Planned | Q7 | M | 7, 10 |
| 13 | Herd work day | Planned | — | L | 10 |
| 14 | Team that works on a real farm | Planned | Q9 | L | 5, 13 |
| 15 | Paperwork with the paper | Planned | Q6 | L | 7 |
| 16 | Dairy (gated) | Planned | Q8: milk records | L | 9, 10 |

**How to use this file**

- One phase = one branch = one PR. Give Cursor one phase at a time: the phase section plus [Rules for every phase](#rules-for-every-phase).
- Phases **5–11** together are the 30-day trial release. Put a real farm on it before starting Phase 12.
- Phase **16** only starts when dairy farms ask for it.
- When a phase merges, set its **Status** in the table above to **Complete** and set the next row to **Next**.

---

## Phases 0–4 (complete)

Summaries of what is already on `main`. Detailed specs for new work start at [Phase 5](#phase-5--nothing-gets-lost).

### Phase 0 — Foundation

- Expo + TypeScript + NativeWind + Expo Router
- Supabase Auth (email/password) with farm creation flow
- PowerSync local SQLite for `farms`, `farm_members`, `breeds`, `animals`, `weigh_sessions`, `weight_logs`
- Weigh Day batch entry (single local transaction)
- Animal detail/edit, FormMessage on web, loading and empty states

**Done when (offline smoke test)**

1. Sign up and create a farm.
2. Add at least one animal.
3. Enable airplane mode on the device.
4. Complete a Weigh Day session — data saves locally.
5. Disable airplane mode — data syncs to Supabase (Table Editor).

### Phase 1 — Finances & More

- **Finances** — transaction tracking (`transactions`, migration `0007`)
- **More** — settings, team invites, documents, tasks (migrations `0008`–`0009`)
- PowerSync sync rules updated for new tables

### Phase 2 — Health & breeding

- Health records and breeding/kidding (migrations `0005`–`0006`)
- Kidding kid records, health-driven tasks, breeding calendar

### Phase 3 — Land

- Pastures, grazing occupancy, and feed logs (migration `0010`)

### Phase 4 — Breeding & health follow-ups

- Kidding links open breedings, optional kid registration (`litter_id`), breeding calendar, due-date tasks
- FAMACHA 4–5 and withdrawal tasks; health timeline on animal detail
- Web SQL — portable `ORDER BY` (no `NULLS LAST`) for PowerSync web SQLite

**Database migrations shipped through Phase 4** (run in order from `supabase/migrations/`):

`0001` → `0003` → `0004` → `0005` → `0006` → `0007` → `0008` → `0009` → `0010`

---

## Decisions this plan assumes

Change these here first if you disagree, because later phases depend on them.

1. **First real user (Q1): a commercial or seedstock meat herd, about 20–100 does.** Create-farm keeps all three segments and Meat stays preselected. Defaults (Today screen, reminders, withdrawal fields) are tuned for meat herds first.
2. **Dairy stays a breed filter (Q8)** until at least two dairy farms ask for milk records. One exception ships now: separate meat and milk withdrawal (Phase 10).
3. **Single owner at launch (Q9).** Team is hidden in Phase 5 and rebuilt in Phase 14.
4. **Documents hidden (Q6)** in Phase 5 until files can be attached (Phase 15).
5. **No built-in drug withdrawal list.** Most drug use in goats is extra-label, so withdrawal times come from the farm's vet. The app remembers what the farm entered last time; it never supplies the numbers itself.

---

## Rules for every phase

Give these to Cursor with every phase.

1. Read `AGENTS.md` first (Expo v57 docs).
2. Every new table or column needs all of:
   - a new numbered file in `supabase/migrations/` (the next number is `0016`)
   - `lib/powersync/schema.ts`
   - `powersync/sync-rules.yaml` **and** `powersync/sync-config.yaml` (keep them identical)
   - `lib/types/*` and `lib/db/mappers.ts`
   - After merging: run the migration on Supabase and redeploy the sync rules.
3. Anything that writes more than one row saves in one `powersync.writeTransaction`.
4. Test offline every time: airplane mode on, run the "Done when" steps, airplane mode off, then check the Supabase tables.
5. From Phase 5 on, the "Changes not saved" list must be empty after the "Done when" steps. If it isn't, the phase isn't done.
6. Ask for confirmation with `confirmAction()` (added in 5.9). Never use `window.confirm` directly.
7. When the PR merges, update **Status** in the [At a glance](#at-a-glance) table in this file (and `USER-FLOWS.md` / `PRODUCT-REVIEW.md` if you keep them).

---

## Phase 5 — Nothing gets lost

**Needs:** nothing.
**Why:** three paths in today's app lose a farmer's work without any warning. No real herd goes in until they are closed.

### Build

**5.1 Show rejected uploads instead of throwing them away**
- `lib/powersync/connector.ts`: when `isFatalUploadError()` is true, write **every op of that transaction** into a new local-only table `upload_failures`, then `complete()` the transaction as today. Mark which ops had already been applied before the failure.
  - Use a PowerSync `Table` with `localOnly: true`. Columns: `table_name`, `op`, `row_id`, `op_data` (JSON text), `error_code`, `error_message`, `created_at`.
- PATCH and DELETE: add `.select('id')` to the Supabase call. **Zero rows back = rejected.** Record it the same way. Today a blocked update or delete returns no error and quietly reverts on the phone.
- New screen: More → "Changes not saved". It shows the record type, when, a plain-words reason, and the data. Buttons: Copy details, Dismiss.
- Plain-words reasons:
  - `42501` → "Your role on this farm can't make this change."
  - `23503` → "This record is linked to other records."
  - Keep ignoring the `23505` duplicate, as today.

**5.2 Sync badge**
- `components/SyncBadge.tsx` in the header of every tab (`app/(tabs)/_layout.tsx`).
- Uses `useStatus()` and `powersync.getUploadQueueStats()`.
- States: "All saved" · "Saving…" · "Offline · N waiting" · "N not saved" (tap opens the 5.1 list).

**5.3 Sign-out can't delete unsent work**
- In `app/(tabs)/more/index.tsx`, before `signOut()`, read `getUploadQueueStats().count`:
  - 0 → sign out.
  - More than 0 and online → show "Uploading N changes…", wait up to 30 seconds for the count to reach 0, then sign out.
  - Still more than 0 → block: "N changes are only on this phone. Connect to the internet and wait for 'All saved' before signing out." A second button, "Sign out and delete N changes", sits behind `confirmAction()`.
- `providers/PowerSyncProvider.tsx`: stop calling `disconnectAndClearPowerSync()` whenever the session becomes null. Clear only:
  - in the explicit sign-out path above, and
  - when a **different** user signs in.
- An expired or revoked session must never wipe the phone.

**5.4 One role check in the app**
- Hook `useFarmRole()`: reads `farm_members` for the current user and active farm.
- If the role is `hand`: hide every add and edit button and show a read-only banner. Real hand permissions come in Phase 14.

**5.5 Hide Team and Documents** from the More menu (`app/(tabs)/more/index.tsx`). Keep the routes and code.

**5.6 "Open" means not pregnant**
- `lib/domain/breeding.ts`: remove `'open'` from `BREEDING_STATUSES_OPEN_FOR_KIDDING`.
- `lib/db/breeding.ts` → `getUpcomingBreedingsForFarm`: `status IN ('bred', 'confirmed')`.

**5.7 FAMACHA has no default score**
- `app/(tabs)/more/health/add.tsx`: start with no score selected (today it defaults to 3).
- Saving without a score shows "Pick a FAMACHA score."

**5.8 Password reset**
- "Forgot password?" on sign-in calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
- New screen `app/(auth)/reset-password.tsx` handles the recovery link and calls `supabase.auth.updateUser({ password })`.
- Add the Vercel URL and the app scheme to Supabase Auth redirect URLs, and write the steps into `docs/vercel-supabase-setup.md`.

**5.9 `lib/ui/confirm.ts`**
- `confirmAction(title, message, confirmLabel): Promise<boolean>`.
- Web uses `window.confirm`; native uses `Alert.alert` with two buttons.

### Data changes
None on the server. One local-only table: `upload_failures`.

### Done when
1. **Offline sign-out.** Airplane mode on, weigh 3 goats. The badge shows changes waiting. Sign Out is blocked and gives the count. Airplane mode off, the badge reaches "All saved", and Sign Out works.
2. **Hand is read-only.** In SQL, add a second user to `farm_members` as `hand`. Signed in as them, there are no add buttons and the read-only banner shows.
3. **Rejected insert.** Still as the hand, turn one add button back on in a dev build and log a health record. After sync it appears in "Changes not saved" with the role message.
4. **Rejected update.** Same, ticking a task: it appears in "Changes not saved" (the zero-rows case).
5. **Open status.** In SQL, set a breeding to `open`. It leaves the calendar, and logging a kidding for that doe does not mark it kidded.
6. **FAMACHA.** Saving without a score shows the error.
7. **Password reset.** Forgot password → email → set a new password → sign in, on web and on one phone.
8. **Expired session keeps data.** With 2 changes waiting offline, sign the user out from the Supabase dashboard. Reopen the app and sign in as the same user: the 2 changes upload.

### Not in this phase
Real hand permissions (Phase 14). Edit and delete (Phase 6).

---

## Phase 6 — Fix mistakes

**Needs:** 5.
**Why:** a farmer who types 110 instead of 11.0, or picks the wrong goat, can't fix it today. After a week of that they stop trusting the records.

Every list row becomes tappable. It opens an edit screen with Delete at the bottom, confirmed with `confirmAction()`.

### Build

**6.1 Weights**
- A weight row on the animal page → edit the value or delete it.
- Deleting the last weight in a session also deletes the session.
- Tapping a session on the dashboard → session page with every weight and "Delete whole session".

**6.2 Health records.** Edit every field. The linked tasks (`tasks.source_id` = health record id) follow the edit:
- Date or withdrawal days changed → move the open withdrawal task's due date.
- Withdrawal removed → delete the open withdrawal task.
- FAMACHA changed to 1–3 → delete the open recheck task. Changed to 4–5 → create one if missing.
- Record deleted → delete its open tasks. Completed tasks stay.

**6.3 Breedings**
- Edit dam, sire and bred date. The due date is recalculated and the open "Expected kidding" task moves with it.
- Delete → also deletes its open kidding task.
- A breeding already linked to a kidding can't be deleted; delete the kidding first. (Status buttons come in Phase 8.)

**6.4 Kiddings**
- Edit date, counts, sire and notes.
- Delete → the linked breeding goes back to `bred` with `kidding_event_id` null.
- Then ask: "Also delete the 2 kids registered from this kidding?" If a kid already has weights or health records, say so in the question.

**6.5 Goats entered by mistake**
- "Delete goat" on the edit screen, allowed only when no breeding, kidding or offspring points to the goat. Those foreign keys block deletes (`restrict` on breedings and kiddings, the default `no action` on `dam_id` / `sire_id`), so the server would reject the delete.
- Before deleting, show what goes with it (weights, health records, grazing stays).
- If the goat is referenced, the button explains: "This goat has breeding records — mark her Sold or Dead instead."

**6.6 Money.** Edit and delete transactions.

**6.7 Land**
- Edit a pasture (name, acres, forage, notes).
- Edit and delete feed logs.
- Edit a grazing stay's start and end dates on the pasture page.

**6.8 Tasks.** Task detail screen: edit title, due date and priority, or delete. Tapping the circle still ticks it.

### Data changes
Migration `0011_updated_at.sql`: add `updated_at timestamptz not null default now()` to `health_records`, `transactions`, `weigh_sessions`, `weight_logs`, `feed_logs`, `grazing_records`, `tasks` and `documents`. Set it on every local update.

### Done when
- For every record type: create → edit → sync → Supabase shows the edit. Delete → the row is gone on the server.
- Linked tasks behave as listed above.
- Deleting a doe that has a breeding is blocked with the message.
- "Changes not saved" is empty.

**Split if it's too big:** 6a = 6.1–6.5 (herd records), 6b = 6.6–6.8.

---

## Phase 7 — Know every goat (Q5)

**Needs:** 6.
**Why:** a breeder looks goats up by tag at the pen, needs the official ID at sale, and reads dam and sire before every breeding.

### Build

**7.1 Identity section on Add and Edit Animal**
- Tag number, and **official ID** (scrapie tag / USDA official ID).
- Registry: ADGA, ABGA, USBGA or Other (`registration_body`), plus the registration number.
- Tattoo: one field, with the hint "Right ear / Left ear".

**7.2 Name or tag required**
- A goat with neither doesn't save.
- A tag already used by another goat on the farm shows a warning but doesn't block. A server rule would reject offline saves.

**7.3 Parents on Add and Edit**
- Dam picker: every female on the farm, including sold and dead.
- Sire picker: every male on the farm, or type an external sire name.
- Uses the existing `dam_id`, `sire_id` and `sire_external_name` columns.

**7.4 Breeds**
- "Other breed…" lets the farm add its own breed (a `breeds` row with `farm_id`; the insert policy already exists).
- Optional breed percentage (the existing `breed_percentage`) with quick picks 50 / 75 / 88 / 94 / 100.

**7.5 Animal page**
- Identity block: tag, official ID, registry and number, tattoo.
- Parents: dam and sire as links, or the external sire name.
- Offspring: every goat whose `dam_id` or `sire_id` is this goat, newest first, each one tappable.
- For does: kidding history (date, born, alive).
- Status options add Slaughtered and Transferred. The database already allows both.

**7.6 Herd list** (`app/(tabs)/livestock/index.tsx`)
- Search box: name, tag, official ID, registration number, tattoo.
- Filters: sex, life stage, and status (Active by default, then Sold, Dead, Slaughtered, Transferred, All).
- Any goat opens, whatever its status.
- Each row shows tag and name, sex, stage, and age from the birth date.
- The dashboard's "M total on record" opens the list with the All filter.

### Data changes
Migration `0012`: `animals.official_id text`; index on `animals(farm_id, tag_number)`.

### Done when
- A goat with only a tag saves. A goat with neither name nor tag shows an error.
- A second goat with the same tag shows a warning.
- After setting a dam and sire, the parent and offspring pages link to each other.
- Searching by tattoo finds the goat.
- A goat marked Sold appears under the Sold filter and still opens.
- Kids registered in Phase 4 kiddings show their dam and sire.

---

## Phase 8 — Breeding the way it happens (Q3)

**Needs:** 5 (the "open" fix), 6 (breeding edit).
**Why:** a single day 150 days out doesn't fit how does kid. Meat herds often run a buck with the does for weeks. Farmers confirm pregnancy by ultrasound or a blood test, and does that didn't take come back into heat.

### Build

**8.1 Two ways to log a breeding**
- **Hand-bred / AI on one date:** today's form.
- **Buck exposure:** the buck runs with the does from a start date to an end date. Pick several does at once; each doe gets her own breeding row.

**8.2 A due window instead of one date**
- New farm setting "Gestation (days)", default 150. Use it everywhere `GOAT_GESTATION_DAYS` is used today.
- Hand-bred: the window runs from bred date + (gestation − 5) to bred date + (gestation + 5). `due_date` stays bred date + gestation.
- Buck exposure: from start + (gestation − 5) to end + (gestation + 5).
- Show "Due between Feb 14 and Feb 24" everywhere.
- The kidding task is due when the window opens: "Kidding due — {doe} (Feb 14–24)".

**8.3 Breeding page** (tap a breeding row or a calendar card)
- **Confirm pregnant:** date and method (ultrasound, blood test, other).
- **Mark open (not pregnant):** closes the kidding task and removes her from the calendar.
- **Mark lost (abortion or resorption):** same as open, plus a note. Uses a new status, `lost`.
- **Log kidding:** opens the Phase 9 form with this doe and this breeding already chosen.
- Edit and Delete (from Phase 6).

**8.4 Back in heat**
- Logging a breeding for a doe who already has a `bred` or `confirmed` breeding asks: "Daisy is recorded as bred on May 2. Mark that breeding open?"
- Yes → the 8.3 open rules run on the old breeding.

**8.5 A kidding closes its task.** When a kidding links a breeding, mark that breeding's task (`source = 'breeding'`, `source_id` = breeding id) completed.

**8.6 The kidding form asks "Which breeding is this?"** It lists the doe's `bred` and `confirmed` breedings (newest one preselected), plus "Not recorded".

**8.7 Calendar**
- Show every `bred` and `confirmed` breeding; drop the 120-day limit.
- Group by the month the window opens.
- A top section, "Past due — check these does", lists breedings whose window has ended.
- Cards are tappable and open 8.3.

**8.8 Doe page:** breeding history (date, buck, status, window).

### Data changes
Migration `0013`:
- `farms.gestation_days integer not null default 150`
- `breeding_events`:
  - `exposure_end_date date`
  - `due_window_start date` and `due_window_end date`
  - `confirmed_date date`
  - `confirm_method text` (ultrasound, blood_test, other)
- Status check adds `lost`. `dry` stays in the check but unused (Phase 16 moves it to lactations).
- Backfill the window for existing rows as `due_date` ± 5 days.

### Done when
- **Hand-bred today:** the window is +145 to +155 days and the task is due at +145.
- **Buck exposure:** pen-breeding 3 does from 1 to 30 Sep creates three breedings, each with a window from 1 Sep + 145 to 30 Sep + 155.
- **Open:** marking one doe open takes her off the calendar and closes her task.
- **Confirmed kidding:** confirm one doe, then log her kidding from her card. The breeding becomes kidded and the task is done.
- **Bred twice:** logging a second breeding for a doe asks to mark the first one open.
- **Calendar:** a breeding due 150 days from now appears.

---

## Phase 9 — Kidding in one step (Q4)

**Needs:** 7 (identity fields, parents), 8 (breeding link, task closing).
**Why:** kids are counted, sexed and weighed in the same few minutes. Today that takes two forms and several visits, and kids can't be named or tagged.

### Build

**9.1 New kidding form**
- Top: doe, sire (prefilled from the linked breeding), date, kidding ease (unassisted / assisted / vet), notes.
- One row per kid: sex, born alive or dead, birth weight (farm unit, optional), tag (optional), name (optional, placeholder "{doe} kid 1").
- "Kids born" is the number of rows (+ and − buttons).
- The alive count is worked out from the rows. Store it in `kids_surviving`, which now means "alive at birth", and remove the separate box.
- "Register kids in herd" is on by default. Only kids born alive become animals.
- `createKiddingEvent` already accepts `name` and `tagNumber` per kid (`KiddingKidDraft`); the form just needs to pass them.

**9.2 Birth weights in the same save:** one `weigh_session` (date = kid date, `weigh_point = 'birth'`) and one `weight_log` per kid with a weight, in the same `writeTransaction` as the kidding.

**9.3 What kids inherit**
- Dam, sire, external sire name and `litter_id` (as today), plus birth date.
- Breed from the dam when the sire has the same breed or no breed set.

**9.4 After saving:** a litter summary showing each kid with its weight, each one tappable.

**9.5 Kid page:** "Twin (2 born, 2 alive)", birth weight, litter siblings.

**9.6 Weaning**
- New farm setting "Wean at (days)", default 90. Farms can change it or turn it off.
- A kidding with live kids creates the task "Wean — {doe}'s kids" (`source = 'weaning'`, `source_id` = kidding id).
- On Weigh Day, picking occasion Weaning offers "Also mark these kids as weaned". It sets `lifecycle_stage = 'weaned'` for the kids weighed and completes their weaning task.

### Data changes
Migration `0014`:
- `kidding_events.kidding_ease text` (unassisted, assisted, vet)
- `farms.weaning_days integer default 90` (null = off)

### Done when
All of this works in airplane mode, and then syncs cleanly.
- **Twins, one weighed:** the kidding shows 2 born, 2 alive. Both kids appear in Livestock with dam, sire and breed, and one has a Birth weight in its history.
- **Triplets, one dead:** 3 born, 2 alive, 2 new animals.
- **Tasks:** the expected-kidding task is done, and a weaning task exists 90 days out.
- **Weaning:** a Weigh Day with occasion Weaning and the box ticked sets the kids to weaned and completes the task.

---

## Phase 10 — Health you can trust at sale time (Q8 withdrawal, FAMACHA)

**Needs:** 6 (health edit), 7 (animal page).
**Why:**
- **Withdrawal:** one withdrawal number is a residue risk. Cornell's goat dewormer chart lists fenbendazole at 16 days for meat and 4 for milk.
- **FAMACHA:** standard advice is to deworm goats scoring 4 or 5, and 3s that are kids, pregnant or nursing does, or thin. The app only schedules a recheck.

### Build

**10.1 Two withdrawal fields: Meat (days) and Milk (days)**
- Milk shows only on dairy or both farms.
- Existing `withdrawal_days` values are copied into both, which is how the app treats them today.
- Two tasks: "Meat withdrawal clears — {goat} ({product})" and "Milk withdrawal clears — {goat} ({product})".

**10.2 Route and lot number (optional).** Route: oral, SC injection, IM injection, topical, other.

**10.3 Remember products**
- The product box suggests products this farm has used before.
- Picking one fills dosage, route and both withdrawal numbers from the last time it was used.
- Helper text: "Goat withdrawal times usually come from your vet — most goat drug use is extra-label."
- No built-in numbers.

**10.4 Withdrawal status on the goat**
- For each goat, work out the latest meat and milk clear dates that are still in the future.
- Show them as a badge on the animal page and the herd list row, e.g. "Meat withdrawal until Oct 12".

**10.5 Sale warning.** Changing status to Sold or Slaughtered while meat withdrawal is active asks: "Buttercup is in meat withdrawal until Oct 12 (Safe-Guard). Continue?"

**10.6 FAMACHA follow-up that matches practice**
- **Score 4 or 5:** after saving, ask "Deworm now?"
  - Yes → the deworming form opens with the goat, date and last-used product filled in.
  - No → a high-priority task "Deworm — {goat} (FAMACHA 5)" due today.
- **Recheck:** a recheck task in 14 days, from a new farm setting "FAMACHA recheck (days)".
- **Score 3:** helper text "Consider deworming 3s that are kids, pregnant or nursing does, or thin." No task.
- **Rescoring a goat** closes her older open recheck task. Find it through `tasks.source_id` → `health_records.animal_id`.
- **Herd flag for Phase 11:** more than 10% of goats scored in the last 14 days are at 4–5.

### Data changes
Migration `0015`:
- `health_records`:
  - `meat_withdrawal_days int` and `milk_withdrawal_days int`, both filled from `withdrawal_days`
  - `route text` and `lot_number text`
- `farms.famacha_recheck_days int not null default 14`
- Keep `withdrawal_days` for one release, then drop it.

### Done when
- **Deworming:** logging 16 meat / 4 milk creates two tasks, and her page shows "Meat withdrawal until …".
- **Sale warning:** marking her Sold shows the warning.
- **FAMACHA 5, treated:** answering Yes to "Deworm now?" opens a prefilled form.
- **FAMACHA 5, not treated:** answering No creates a deworm task due today and a recheck in 14 days.
- **Rescore:** scoring her 2 later closes the old recheck.
- **Meat farm:** there is no milk withdrawal field.

---

## Phase 11 — The Today screen (Q2)

**Needs:** 8 (due windows), 10 (withdrawal status, FAMACHA flag). Uses the 5.2 badge.
**Why:** the farmer opens the app in the morning to see what needs doing. Today's dashboard shows counts and weigh sessions.

### Build

`app/(tabs)/dashboard.tsx` becomes **Today**. A section only shows when it has items, and every row opens the goat or the task.

1. **Overdue and due today:** tasks; tap the circle to tick one off.
2. **In withdrawal:** goat, meat or milk, clear date.
3. **Kidding soon:** windows opening in the next 21 days, plus past-due does.
4. **FAMACHA:**
   - Rechecks due in the next 3 days.
   - Herd flag when more than 10% scored 4–5: "X of Y goats scored 4–5 in the last 2 weeks — recheck weekly."
5. **Coming this week:** the rest of the next 7 days, collapsed.

Below the list:
- Quick actions: Weigh Day, Log health, Log kidding, Add goat.
- Counts: active goats, does bred, kids born this year.
- The last 3 weigh sessions.

A new farm with no goats sees a short "Start here": add goats, run your first Weigh Day.

Tasks screen: Open / Done tabs. Done hides tasks completed more than 30 days ago.

### Data changes
None. Every section is a local `useQuery`, so it works offline.

### Done when
- With test data from Phases 8–10, each section shows the right goats.
- Ticking a task removes it from Today.
- In airplane mode the screen still loads and updates.
- A new farm sees "Start here".

---

## Checkpoint — 30-day trial release

Phases 5–11 are the "smallest release" from review Q10.

**Before inviting farms:**
- Do a full offline run in airplane mode: weigh, treat, breed, kid, move pasture. Back online: "All saved", and nothing in "Changes not saved".
- Test on web (Vercel) and at least one Android phone.
- If a pilot farm asks how to get their data out, move Phase 12's CSV export up.

**The pilot:**
- 3–5 meat goat farms, 20–100 does each, entering their real herd for 30 days.
- Track each week:
  - goats entered
  - records per week
  - how many "not saved" entries appear
  - what the farmers ask for

---

## Phase 12 — Money tied to goats (Q7)

**Needs:** 7, 10.

### Build

**12.1 Selling a goat**
- When a goat's status becomes Sold, ask "Record the sale?"
- Yes → Add Transaction opens prefilled: revenue, "Animal sales", date = out date, goat linked. The amount entered is also saved to `animals.sold_price`.
- The Phase 10 withdrawal warning runs first.

**12.2 Buying a goat:** optional purchase price on Add Animal (the existing `purchase_price`). Saving offers an "Animal purchase" expense linked to the goat.

**12.3 Link any transaction to a goat:** optional goat picker on Add and Edit Transaction. The animal page gets a "Money" section: purchase, sale, linked costs.

**12.4 Feed cost:** Log Feed gets an optional "Cost" that creates a Feed expense in the same save.

**12.5 Period filter on Finances:** This month, This year, Last year, All, or a custom range. Totals and a by-category list for the period.

**12.6 CSV export**
- Transactions for the selected period.
- The herd list: identity, status, birth date, dam, sire, latest weight and its date.
- Web: file download. Phone: `expo-file-system` + `expo-sharing` (new packages).

### Data changes
Migration `0016`: `transactions.animal_id uuid references animals(id) on delete set null`; index on `(farm_id, animal_id)`.

### Done when
- Selling a goat prompts for the sale, and the revenue row is linked and shows on her page.
- A feed log with a cost creates an expense.
- "This year" totals match a hand count.
- Both CSVs open correctly in Excel or Google Sheets.

---

## Phase 13 — Herd work day

**Needs:** 10 (route, withdrawal, product memory).
**Why:** goats are worked as a group through a pen or chute: weigh them, check eyelids, deworm the ones that need it, trim feet. Weigh Day already covers weight; this makes it cover the rest. During the worm season FAMACHA is checked every 2 weeks, so this screen gets used often.

### Build

**13.1 Weigh Day becomes Work Day.** Weight-only stays the default. At the top, pick what you're recording today: Weight, FAMACHA, Body condition (1–5 in half steps), Deworm, Hoof trim.

**13.2 Pick who:** all active goats, one pasture group, kids only, does only, or hand-picked.

**13.3 One row per goat with only the inputs you chose**
- Deworm: pick the product once for the session. Dose per goat is optional. Withdrawal comes from the product memory (10.3).
- Tick the goats you treat. A FAMACHA 4 or 5 in the row pre-ticks Deworm.

**13.4 One save** writes the weigh session, weights, health records and every follow-up task (Phase 10 rules) in one `writeTransaction`.

**13.5 Summary after saving**
- Goats worked and goats treated.
- For each goat, weight gained since the last weigh and average daily gain (ADG), plus the group average.
- ADG also appears in the animal page's weight history.

**13.6 Fecal egg count** is its own health event (eggs per gram), entered when the lab result comes back, not in the chute grid.

### Data changes
Migration `0017`:
- The `health_records` kind check adds `body_condition` and `fecal_egg_count`.
- New columns `bcs_score numeric(2,1)` (1–5) and `fec_epg integer`.

### Done when
- Offline, work 10 goats with weight, FAMACHA and deworming in one save.
- Every record is written, and only treated goats get withdrawal tasks.
- The summary shows ADG, and the upload syncs cleanly.

### Later, not this phase
Performance reports: adjusted weaning weights, pounds of kid weaned per doe. Check which formula your target registry or extension program uses before building them.

---

## Phase 14 — Team that works on a real farm (Q9)

**Needs:** 5 (role hook), 13 (so hands can run Work Day).
**Why:** hands are the people who weigh, treat and do the chores. Today's rules block exactly that.

### Build

**14.1 New role rules**

| Can… | Hand | Manager | Owner |
|---|---|---|---|
| Record what happened: weights, Work Day, health, kiddings (including kids), pasture moves, feed | ✓ | ✓ | ✓ |
| Tick tasks off | ✓ | ✓ | ✓ |
| Add goats (other than kids) and edit goats | | ✓ | ✓ |
| Breedings; edit or delete any record | | ✓ | ✓ |
| See money | | ✓ | ✓ |
| Settings, team, delete goats | | | ✓ |

Server side:
- Rewrite the RLS policies in a new migration to match the table.
- Tasks: allow hands to update, and add a `BEFORE UPDATE` trigger so a hand can change only `completed`.
- Kids: hands may insert animals only when `litter_id` is set.
- Money:
  - The `transactions` select policy is manager and above.
  - The `transactions` sync-stream query filters by role, so hands never download money rows.

**14.2 The app follows the same table.** `useFarmRole()` hides the Finances tab, Settings, Team, edit/delete and the breeding forms from hands.

**14.3 Invites by email**
- A Supabase Edge Function sends the invite with a sign-up link, through an email provider such as Resend.
- For existing accounts, call a new RPC `accept_pending_invites()` after sign-in. Today only brand-new sign-ups get attached to a farm.

**14.4 Member list shows names and emails**
- A `profiles` table (`id`, `email`, `display_name`) filled by an auth trigger and readable by members of the same farm.
- A small profile screen to set a display name.

**14.5 Manage members:** the owner can change a member's role or remove them.

**14.6 Assign tasks** to a member (`tasks.assigned_to` already exists). Add a "My tasks" filter; on Today, hands see their own tasks first.

**14.7 More than one farm:** a farm switcher on More when a user belongs to several farms, plus "Create another farm".

**14.8 Team returns** to the More menu.

### Data changes
Migration `0018`:
- the new policies and the tasks trigger
- `profiles` and its auth trigger
- `accept_pending_invites()`
- the invite email function

### Done when
- **Work Day as a hand:** a hand runs a Work Day offline, it syncs, and "Changes not saved" stays empty.
- **Money hidden:** a hand can't see Finances, and their phone has no transaction rows.
- **Task editing:** a hand can tick a task. If they rename it, the server rejects the change and it shows in "Changes not saved".
- **Invites:** inviting an existing account adds them on their next sign-in.
- **Members:** the member list shows emails, and a role change takes effect after sync.

---

## Phase 15 — Paperwork with the paper (Q6)

**Needs:** 7.
**Why:** at the sale barn or the vet, the farmer needs the actual registration paper or health certificate, not just its title.

### Build

**15.1 Storage bucket** `farm-files` with paths `{farm_id}/…`. Farm members can read; managers and above can write.

**15.2 Offline attachments**
- Use the `AttachmentQueue` in `@powersync/common`.
- Take a photo or pick a PDF offline; it uploads when the phone is back online.
- New packages: `expo-image-picker`, `expo-document-picker`.

**15.3 Document form**
- Type, title, goat (`animal_id` already exists), file.
- Expiry date, for health certificates.
- Open, zoom and share the file.

**15.4 Animal page:** a profile photo (`animals.photo_storage_path` already exists) and a Documents list.

**15.5 Today:** "Health certificate for Daisy expires in 7 days."

**15.6 Documents returns** to the More menu.

### Data changes
Migration `0019`: `documents.expires_on date`; the storage bucket and its policies.

### Done when
- In airplane mode, photograph a registration paper: it shows on the phone at once.
- Back online, it uploads and opens on another device.
- An expiry date shows on Today.

---

## Phase 16 — Dairy (Q8), gated

**Start only when** at least two dairy farms say milk records would make them use the app. Until then dairy means the breed filter plus the milk withdrawal from Phase 10.

**Scope when it opens:**
- **Lactations:** a lactation starts automatically at kidding, and a "Dry off" action ends it. `dry` moves out of the breeding statuses into lactations.
- **Milk weights:** per doe, daily or on test days, AM/PM or a daily total, in the farm unit.
- **Milk withdrawal:** milk logged while a doe is in milk withdrawal is marked "discard" and not counted as saleable.
- **Today:**
  - "In milk" count.
  - Does due to dry off, from a farm setting "Dry off N days before the kidding window", default 60.
- **Lactation summary:** days in milk, total to date.

**Not included:** DHIR/DHIA import, ADGA linear appraisal.

**Data:**
- `lactations`: `id`, `farm_id`, `animal_id`, `kidding_event_id`, `start_date`, `dry_off_date`
- `milk_logs`: `id`, `farm_id`, `animal_id`, `lactation_id`, `date`, `session`, `amount`, `unit`, `discarded`

---

## Where each review item landed

| Review item | Phase |
|---|---|
| Fix: a hand's saves are thrown away after sync | 5.1, 5.4 (stopgap), 14 (real fix) |
| Fix: sign-out deletes unsent work | 5.3 |
| Fix: no "waiting to sync" state | 5.2 |
| Fix: "open" treated as still pregnant | 5.6, 8.3 |
| FAMACHA defaults to 3 | 5.7 |
| Password reset | 5.8 |
| Q1 First real user | Decision 1 |
| Q2 Home screen | 11 |
| Q3 150 days, single date, statuses | 8 |
| Q4 Kid entry in one moment | 9 |
| Q5 Identity fields | 7 |
| Q6 Document index without files | 5.5 (hide), 15 |
| Q7 Finances touching the goat | 12 |
| Q8 Dairy and milk | 10.1 (withdrawal split), 16 (milk) |
| Q9 Manager and hand roles | 5.4–5.5 (single owner), 14 |
| Q10 Smallest release for 30 days | Phases 5–11 + checkpoint |
| Edit and delete wrong records | 6 |
| Herd work day | 13 |
| Cut for now: Documents, Team, milk, AI | 15, 14, 16; AI not planned |

## Sources for the herd-practice rules

- FAMACHA treatment by score: [Hobby Farms — Control Barber's Pole Worms With FAMACHA](https://www.hobbyfarms.com/control-barbers-pole-worm-with-famacha/)
- FAMACHA recheck frequency: [ACSRPC — Do's and Don'ts of FAMACHA Scoring](https://www.wormx.info/dosdonts)
- Meat vs milk withdrawal examples: [Cornell AHDC — Dewormer Chart for Goats](https://www.vet.cornell.edu/animal-health-diagnostic-center/programs/new-york-state-cattle-health-assurance-program/modules-documents/dewormer-chart-goats)
- Registry tattoos as official ID: [USDA APHIS — Registry Tattoos Approved for Scrapie ID](https://www.aphis.usda.gov/animal-disease/sheep-goat/scrapie/registry)
