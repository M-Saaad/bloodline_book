# Bloodline Book — product brief for expert review

**Audience:** a goat-production or livestock-software expert who has not used the app.  
**Purpose:** describe what a farm user can do today, what the product quietly assumes, and where the experience stops, so you can recommend the next product step.  
**Basis:** the current Expo app on `main` (Phases 0–4 merged). An older planning note, `docs/BLOODLINE-BOOK.md` at GitHub commit `fe665f2`, describes a different phase numbering from a previous Next.js app. That note is summarized in [Appendix B](#appendix-b--older-plan-not-the-current-app). It is not what users see now.

---

## 1. What this product is trying to be

Bloodline Book is a multi-farm herd record for **US goat operations**. One person signs up, creates a farm, and keeps animals, weights, health, breeding, pastures, feed, money, paperwork metadata, and chores in one place. Data is written on the device first and syncs when the network is available.

The farm chooses a **segment** at setup: dairy, meat, or both. That choice filters the breed list. It does not otherwise change screens. There is no milk log, no lactation, and no dairy-specific dashboard.

The intended day-to-day user is someone standing in the barn with a phone: add a goat, weigh the herd, log a treatment, record a breeding, move animals to a paddock, jot an expense, check off a chore.

---

## 2. Who can use it

| Person | How they get in | What they can do in the product |
|--------|-----------------|----------------------------------|
| **Owner** | Signs up with email and password, then creates a farm. They become owner automatically. | Everything below. Settings and invites are meant for the owner. |
| **Manager** | Owner invites their email as manager. They must **sign up later with that same email**. There is no email sent from the app. | Same screens as the owner. The server is supposed to block farm-setting changes and invites. The app does not hide those screens. |
| **Hand** | Same invite path, role “hand”. | Same screens. The server is supposed to block creating or editing herd, health, land, and money records. The app still shows those buttons. |

Practical limits a reviewer should know:

- Team members are listed as the first characters of an internal user id, not a name or email.
- There is no in-app way to remove a member, change a role, or switch between farms.
- Once a farm exists, the setup screen sends the user to the dashboard. Creating a second farm is not part of the flow.
- Farm segment (dairy / meat / both) cannot be changed after creation.
- Currency is a free-text code (default USD). It is a label on money screens, not a real currency system.
- Weight unit is pounds or kilograms for the whole farm. Weigh Day uses that unit. Existing weight rows keep the unit they were saved with.

---

## 3. A first session

1. Open the app. Sign up or sign in (email and password, at least 8 characters).
2. Name the farm and pick Dairy, Meat, or Both.
3. Land on the **Dashboard**: farm name, segment, weight unit, count of active vs all animals, shortcuts to add an animal, start Weigh Day, or open Land, and the last three weigh sessions.
4. Work from five bottom tabs: **Dashboard**, **Livestock**, **Land**, **Finances**, **More**.

There is no guided tour, sample herd, or “what’s due today” list on the home screen. Reminders created by health and breeding live under **More → Tasks**, which the dashboard does not mention.

---

## 4. What the user can do, area by area

### 4.1 Livestock

**List.** Active animals only. Each row shows name (or tag), sex, life stage, and an “active” badge. Sold and deceased goats leave this list. There is no search, no filter by sex or stage, and no way to open an inactive animal from the list.

**Add.** Name, tag number, sex, optional birth date, optional breed. New animals start as kids and active. The user cannot set purpose, parents, registration, tattoo, photo, or purchase price here.

**Open a goat.** Shows breed, sex, life stage, birth date, pasture (name and move-in date, or “Not assigned”), notes, last 10 health events, and full weight history. A button opens edit.

**Edit.** Name, tag, sex, breed, life stage, status (Active, Sold, Deceased), notes, birth date. Leaving the herd asks for an out date (defaults to today). Status options in the database also include slaughtered and transferred; the edit screen does not offer them.

**Weigh Day.** One date and one occasion for the whole session: ad hoc, birth, 30 day, 60 day, 90 day, weaning, or yearling. Every active goat is listed. The user types weights only for the animals they weighed. Blank rows are skipped. One save writes the session and all filled weights together, including while offline. The success message does not show a chart or gain since last weigh.

**Stored on the animal but not shown or editable in the app**

- Photo
- Breed percentage
- Purpose (dairy, meat, breeding stock)
- Dam, sire, and external sire name (except when kids are registered from a kidding — those links are saved, then not displayed on the kid’s page)
- Litter
- Registration body (ADGA, ABGA, USBGA, other) and number
- Tattoo
- Purchase price, sold price, who they were bought from

**Seeded breeds** (global, filtered by farm segment): Nigerian Dwarf, Nubian, LaMancha, Alpine, Saanen (dairy); Boer, Kalahari Red, Kiko, Spanish, Savanna (meat). A “both” farm sees all of them. The user cannot add a custom breed.

### 4.2 Health (More → Health Log)

A farm-wide list, newest first: date, animal name, event type, and a short detail (FAMACHA score or product name).

**Log an event** for one active animal, on a date, as one of:

- Vaccination
- FAMACHA (score 1–5; the screen says 1 is healthy and 5 is anemic)
- Deworming
- Treatment
- Injury
- Hoof trim
- Other

Optional product name, dosage, and notes. Vaccination, deworming, and treatment can include a withdrawal period in days.

**What the app does without asking**

- FAMACHA 4 creates a medium-priority task “Recheck FAMACHA — {goat}” due 7 days later.
- FAMACHA 5 creates the same task at high priority.
- A withdrawal period creates a high-priority task “Meat/milk withdrawal clear — {goat} ({product})” due that many days later.
- Scores 1–3 and events without withdrawal days do not create tasks.
- There is no drug catalog, lot number, route, body condition score, fecal egg count, or separate meat vs milk withdrawal.

The animal page shows the latest 10 events. It does not show open withdrawal dates. The user has to open Tasks to see them.

### 4.3 Breeding and kidding (More → Breeding & Kidding)

**Log a breeding.** Pick a doe, optionally a buck on the farm and/or type an off-farm sire name, and a bred date. The screen shows an estimated due date using a fixed **150-day** gestation. Saving marks the breeding as bred and adds a high-priority task “Expected kidding — {doe}” on that due date. The user cannot type a different due date, set a breeding window, or mark “confirmed pregnant” from the form. Those statuses exist in the data (bred, confirmed, open, kidded, dry) but only “kidded” is set automatically later.

**Breeding calendar.** Open breedings whose due date falls in the **next 120 days**. Past dues and anything beyond 120 days are omitted. It is a list, not a month grid.

**Log a kidding.** Doe, optional sire, kid date, kids born, optional kids surviving, notes. Optional **Register kids in herd**: up to 12 kids, sex only. Each kid is created as an active kid named “{doe} kid 1”, and so on, linked to the litter, dam, and sire. The user cannot name them or set a tag in this step. Saving also marks the doe’s latest open breeding (status bred, confirmed, or open) as kidded and ties it to this litter. If there is no open breeding, the kidding still saves.

**Lists.** Breedings show dam, status, bred date, due date. Kiddings show dam, date, born, and surviving. Neither list lets the user edit or delete a row. The doe’s animal page does not show her breeding or kidding history.

### 4.4 Land

**Pasture list.** Count of pastures and how many animals are currently out. Each pasture shows name, acres, forage, status, and how many animals are on it. Recent feed (five rows) sits under the list.

**Add a pasture.** Name, optional acres, forage (mixed, bermuda, clover, browse, hayfield, other), status (resting, grazing, hay, overgrazed), notes.

**Move animals.** Pick a pasture, a start date, and one or more active animals. Saving closes any earlier open grazing for those animals and puts them on the new pasture. If the pasture was resting, its status becomes grazing. Moving the last animal off a grazing pasture sets that pasture back to resting. Hay and overgrazed statuses are left as the user set them.

**Move out.** From a pasture’s page, end the current stay for selected animals (end date).

**Log feed.** Date, feed name (free text, example “Hay”), optional quantity and unit (lb, kg, bale, bag), optional pasture, notes. Feed is not tied to individual goats and is not copied into Finances.

The animal page shows current pasture only. It does not show grazing history.

### 4.5 Finances

A running total of all revenue, all expenses, and net, in the farm’s currency label. The list is every transaction, newest first: date, category, amount, expense or income.

**Add.** Date, expense or revenue, category (suggestions: Feed, Veterinary, Supplies, Animal sales, Milk sales, Equipment, Other — or any text), amount, optional notes.

Transactions are not linked to a goat, a pasture, a health event, or a sale. Marking a goat sold does not create income. There is no date filter, export, or receipt photo.

### 4.6 Tasks (More → Tasks)

A single list. Open tasks sort before completed ones, then by due date. Tap a row to check it off or reopen it. The user can add a task with a title, optional due date, and priority (low, medium, high).

Tasks also appear from:

- Expected kidding (when a breeding is logged)
- FAMACHA recheck (scores 4–5)
- Withdrawal clearance

The user cannot assign a task to a person, even though the data model has an assignee field. Sources named in the data but never created by the app: weaning and weigh day.

Completed tasks stay in the list with a strikethrough. There is no “due today” view on the dashboard.

### 4.7 Documents (More → Documents)

A list of titles and types: registration, health certificate, scrapie tag, insurance, transfer paper, or other. Optional notes. Optional link to one animal when adding.

**The file itself is not uploaded.** The add screen says file upload comes later. The user is keeping an index of paperwork, not the paperwork.

### 4.8 Settings and sign-out (More)

Change farm name, currency code, and weight unit. Segment is shown and locked. Sign out returns to sign-in. There is no password reset, profile name, or delete-account flow in the app.

---

## 5. How information connects (user view)

```text
Farm
 ├── Animals (active list is the working herd)
 │     ├── Weights (via Weigh Day sessions)
 │     ├── Health events → may create Tasks
 │     ├── Current pasture (via a grazing stay)
 │     └── Optional document index rows
 ├── Breedings → due-date Task; later marked kidded
 │     └── Kiddings → optional new kid animals
 ├── Pastures, grazing stays, feed logs
 ├── Money in / money out (standalone)
 ├── Tasks (manual + automatic)
 ├── Document index (no files)
 └── People (owner, invited manager/hand)
```

Things a producer often expects to be connected, that are **not**:

- Sale of a goat ↔ income
- Feed log ↔ feed expense
- Treatment ↔ vet bill
- Kid registration ↔ names, tags, birth weights
- Withdrawal task ↔ a warning on the animal or on a sale
- Dam/sire on the animal page ↔ pedigree the user can read

---

## 6. Offline, in plain language

The user can sign in, then keep entering herd data without a network. New animals, weights, health, breedings, kiddings, pastures, feed, transactions, tasks, and document index rows are saved on the device and upload when the connection returns.

What still needs the network:

- Creating the account and signing in
- The first connection that pulls the farm down to a new device

The app does not show a clear “saved on this phone / waiting to sync / synced” state on each screen. If the server is missing a table (migrations not applied), local entry can still succeed while upload fails in the background.

---

## 7. What a careful user will notice is missing

Grouped by the job, not by engineering phase.

**Know who is in the herd**

- Search by name, tag, tattoo, or registration number
- See sold, deceased, and transferred animals
- Photo
- Registration and tattoo fields on the screen
- Pedigree (dam, sire, kids) on the animal
- Custom or cross breeds, breed percentage

**Keep goats healthy**

- Drug list with meat and milk withdrawals filled in for them
- Lot, route, expiration
- Body condition and fecal egg count
- “Who is still in withdrawal?” and “who needs a FAMACHA?” on the home screen
- Herd-level treatment (one event for many goats) — health is one animal at a time; Weigh Day is the only batch entry

**Breed and raise kids**

- Edit a breeding (confirm pregnancy, mark open, change due date)
- Due window instead of a single day 150 days out
- Name and tag kids at birth; record birth weight in the same step
- See a doe’s breeding history on her page
- Weaning as a real action (the word exists only as a weigh-day label and an unused task source)

**Feed and land**

- Which animals ate a logged feed
- Rotation history on the animal
- Stocking rate or acre guidance — acres are stored and displayed only

**Money**

- Tie a cost or sale to a goat
- Period reports (this month, this kidding season)
- Export

**Paper and people**

- Attach a PDF or photo to a registration or health certificate
- Email an invite
- See teammate names
- Different screens for a hand vs an owner

**Dairy, if the segment is meant to matter**

- Milk weights, lactation, dry-off, “in milk” on the dashboard
- Milk withdrawal called out separately from meat

**Trust and recovery**

- Edit or undo a wrong health, breeding, kidding, weight, or money row (most of these can only be added)
- Delete an animal
- Password reset

---

## 8. Original intent vs this app

An earlier written plan (not in the current tree; see Appendix B) aimed at **ADGA dairy goat breeders with about 25–100 goats** and sequenced work as: structured health → milk, breeding windows, and a vet summary → US identity fields → a “what needs attention today” home screen. It explicitly postponed inbreeding tools, DHIA import, multi-farm signup, full-herd printouts, a public vet directory, an AI assistant, and offline sync.

The **current** app inverted some of that:

| Earlier plan treated as core | Current app |
|------------------------------|-------------|
| Offline sync later | Offline sync is the foundation |
| One farm, dairy identity (ADGA, tattoos, barn name) | Multi-farm accounts; identity columns exist but the screens do not collect them |
| Milk and vet contacts in the second slice | No milk log, no vet contact book |
| Home screen of today’s alerts | Home screen of herd counts and recent weigh sessions |
| FAMACHA-based reminders instead of a fixed deworm calendar | FAMACHA 4–5 creates a 7-day recheck task; no deworm calendar |

Current build slices (README) were: foundation and Weigh Day; finances, team, documents, tasks; health and breeding; pastures and feed; breeding/health follow-through (kid registration, calendar, withdrawal and FAMACHA tasks).

---

## 9. Questions for the reviewer

Please answer from the producer’s side. Short answers are enough.

1. **Who is the first real user?** A meat-goat commercial herd, a dairy show herd, or a mixed hobby farm of under 30 goats? The segment picker implies all three; the screens fit a simple herd book better than any one of them.
2. **What must be on the home screen the morning they open the app?** Candidates already in the data but not on the dashboard: open tasks, kiddings due in 120 days, FAMACHA rechecks, withdrawal dates, animals with no recent weight.
3. **Is 150 days and a single due date acceptable**, or do users need a due window and a way to mark confirmed / open / dry without logging a kidding?
4. **Should kid entry be one moment?** Sex, name, tag, and birth weight together, instead of kidding now and Weigh Day later.
5. **Which identity fields are non-negotiable on the animal page** (tag, tattoo, ADGA/ABGA number, photo, dam/sire)?
6. **Is a document index without the file useful**, or should the next step be “attach the registration PDF”?
7. **Do finances need to touch the goat** (cost per animal, sale price when status becomes sold), or is a simple expense notebook enough for now?
8. **Does dairy segment need milk before any other feature**, or should dairy stay a breed filter until a dairy user asks?
9. **Are manager and hand roles real**, or is single-owner enough until invites send email and the app respects role?
10. **What is the smallest next release** that would make you willing to enter a real herd for 30 days?

---

## 10. Suggested way to review

Use a test farm. Do not need production data.

1. Sign up, create a meat or dairy farm, add three does and one buck.
2. Run Weigh Day with only two weights filled in. Confirm the blank animal is skipped.
3. Log a FAMACHA 5 and a deworming with a 30-day withdrawal. Open Tasks and confirm both follow-ups.
4. Log a breeding. Confirm the due date is bred date + 150 days, the task exists, and the calendar shows it if that date is within 120 days.
5. Log a kidding with “register kids”. Open Livestock and confirm kids named “{doe} kid 1”. Open a kid and note that dam/sire are not on the page.
6. Add a pasture, move two animals, log hay. Open each animal and confirm pasture. Move them out and confirm the pasture returns to resting if it had been grazing.
7. Add an expense. Mark a doe sold. Confirm she disappears from Livestock and that Finances did not change.
8. Add a document titled like a registration. Confirm there is no file.
9. Invite a second email. Sign up as that person in a second browser. Confirm they see the farm, and that the member list does not show the email.

---

## Appendix A — screen map

| Tab | Screen | User outcome |
|-----|--------|----------------|
| — | Sign in / Sign up | Account |
| — | Create farm | Named farm + segment |
| Dashboard | Home | Counts, three shortcuts, last weigh sessions |
| Livestock | Herd list | Active goats |
| Livestock | Add / Edit | Identity subset in §4.1 |
| Livestock | Animal | Profile, pasture, 10 health rows, weights |
| Livestock | Weigh Day | Batch weights |
| Land | Pastures | Occupancy and recent feed |
| Land | Add pasture / Move / Move out / Log feed | Grazing and feed notes |
| Finances | List + Add | Income, expense, net |
| More | Menu | Health, breeding, settings, team, documents, tasks, sign out |
| More | Health list + Add | Events and automatic tasks |
| More | Breeding list, calendar, add breeding, add kidding | Breeding book |
| More | Tasks | Manual and automatic to-dos |
| More | Documents | Paperwork index |
| More | Team | Members and invites |
| More | Settings | Name, currency, weight unit |

## Appendix B — older plan (not the current app)

Recovered from commit `fe665f2` on GitHub (`docs/BLOODLINE-BOOK.md`, `BACKLOG.md`). It is a planning note for a previous Next.js codebase, kept here so a reviewer can see original intent.

**Then-current phases**

1. Structured health: product, dose, route, withdrawals, lot, FAMACHA, body condition, fecal egg count; vaccine and dewormer catalogs; no automatic dose math.
2. Milk and lactation, breeding exposure start/end, due window from farm settings (default 150 ± 5 days), vet contacts, one-animal printable vet summary.
3. US identity: registered name, barn name, ADGA number, tattoos, scrapie/EID/farm tag; US breed suggestions.

**Explicitly not to build yet (that backlog)**

- Coefficient of inbreeding / mating planner
- DHIA or DHIR import
- Multi-farm self-serve signup (the current app already did this)
- Full-herd printable reports
- Public vet directory
- AI assistant
- Offline sync (the current app already did this)

## Appendix C — where this is implemented

For an engineer sitting with the reviewer:

- Screens: `app/(tabs)/` and `app/(onboarding)/`
- Herd rules: `lib/domain/health.ts`, `lib/domain/breeding.ts`, `lib/domain/land.ts`, `lib/dates.ts` (`GOAT_GESTATION_DAYS = 150`)
- Database: `supabase/migrations/0001` through `0010`
- Phase labels: `README.md`
