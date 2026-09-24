# Bloodline Book — every user flow

**What this is.** A walkthrough of every path a person can take in the current app, from opening it through FAMACHA scoring and kidding. Each flow lists where it starts, what the person does, what branches exist, and where it ends.

**What this is not.** A wishlist. If a path is absent (edit a breeding, upload a file, log milk), it is listed under [Flows that do not exist](#flows-that-do-not-exist).

Companion overview: [PRODUCT-REVIEW.md](PRODUCT-REVIEW.md).

**Shared rules**

- Dates the user picks cannot be in the future, except a task due date, which may be left blank or set to any calendar day the date field allows.
- Almost every save writes on the phone first and syncs later. The screen does not show “waiting to sync.”
- There is no edit or delete after save for health, breeding, kidding, weights, money, feed, documents, or pastures. Tasks can be toggled. Pasture status can be changed. Grazing can be ended. Invites can be revoked. Animals can be edited.
- Lists of animals used inside forms include **active** goats only.
- The herd list also shows **active** goats only. Sold and deceased goats leave that list and cannot be opened again from it.

---

## 1. Opening the app

### 1.1 Credentials missing

**Start:** App opens and the deployment has no Supabase settings.

**Screen:** “Bloodline Book” plus a message that the deployment is not configured. No sign-in button.

**End:** The person cannot go further until the app is rebuilt with credentials.

### 1.2 Still loading

**Start:** App opens and the account or farm list is still loading.

**Screen:** Spinner. No tabs yet.

**End:** Resolves into 1.3, 1.4, or the dashboard.

### 1.3 Not signed in

**Start:** Loading finishes and there is no session.

**End:** Sign-in screen (flow 2).

### 1.4 Signed in, no farm

**Start:** Session exists and this account has no farm membership.

**End:** Create-farm screen (flow 4).

### 1.5 Signed in, farm exists

**Start:** Session exists and at least one farm is on the device.

**End:** Dashboard (flow 5). The app does not ask which farm. It uses the farm it already selected (the one just created, or the first one it knows).

### 1.6 Unknown address

**Start:** A route that is not a real screen.

**Screen:** “This screen doesn't exist” and a link to the home screen.

**End:** Home runs flow 1 again.

---

## 2. Sign in

**Start:** Sign-in screen. Subtitle: herd records for dairy and meat goat operations.

**Fields:** Email, password.

**Steps**

1. Enter email and password.
2. Tap **Sign In**.

**Branches**

- Either field empty → “Enter your email and password.” Stays here.
- Server rejects the password or the account → the server’s error message. Stays here.
- Success → app returns to the opener (flow 1), which sends a farmless account to create-farm and everyone else to the dashboard.

**Also on this screen:** **Sign up** goes to flow 3. There is no “forgot password.”

---

## 3. Sign up

**Start:** Create-account screen, or **Sign up** from sign-in.

**Fields:** Email, password (at least 8 characters).

**Steps**

1. Enter email and password.
2. Tap **Create Account**.

**Branches**

- Either field empty → “Enter your email and password.”
- Password shorter than 8 characters → “Use a password with at least 8 characters.”
- Server rejects the email (already used, invalid) → the server’s error message.
- Account is created and a session starts immediately (email confirmation off, which is the local-dev setup) → opener (flow 1). If this email had a pending farm invite, the database adds them to that farm as they are created, and they land on the dashboard instead of create-farm.
- Account is created but email confirmation is required → green message: check email, then sign in. They stay on this screen until they use **Sign in**.

**Also:** **Sign in** returns to flow 2.

---

## 4. Create a farm

**Start:** Opener sent them here because they have no farm. If they already have a farm and open this screen anyway, it immediately replaces itself with the dashboard. They cannot create a second farm from the product.

**Fields:** Farm name. Segment: Dairy, Meat, or Both (Meat is preselected).

**Steps**

1. Type a name.
2. Tap a segment.
3. Tap **Create Farm**.

**Branches**

- Name blank → “Enter a name for your operation.”
- Save fails → error under the form.
- Save succeeds → they are the owner. Currency defaults to USD. Weight unit defaults to pounds. Dashboard opens.

**What segment changes:** which breed chips appear later. Dairy sees Nigerian Dwarf, Nubian, LaMancha, Alpine, Saanen. Meat sees Boer, Kalahari Red, Kiko, Spanish, Savanna. Both sees all ten. Segment cannot be changed in Settings.

---

## 5. Dashboard

**Start:** Bottom tab **Dashboard**, or the opener after a farm exists.

**If the farm is still loading:** “Loading farm…”

**If no farm is selected:** “No farm selected.” No button to create one from here.

**When the farm is loaded, the screen shows**

- A DEV badge only on development builds.
- Farm name, segment chip, weight-unit chip.
- “N active · M total on record” (total includes sold and deceased; the herd list does not).
- **Add Animal**, **Weigh Day**, **Land**.
- Up to three recent weigh sessions: date and occasion (birth, 30 day, and so on). If none: short explanation and **Start Weigh Day**.

**Branches from the buttons**

- Add Animal → flow 7.
- Weigh Day or Start Weigh Day → flow 10.
- Land → flow 16.

Nothing on this screen opens health, breeding, tasks, or money. Due kiddings and FAMACHA rechecks are not listed here.

---

## 6. Herd list

**Start:** Bottom tab **Livestock**.

**Loading:** “Loading livestock…”

**No farm:** “No farm selected.”

**Empty (no active goats):** “No active animals.” **Add Animal** in the header and in the empty state.

**With goats:** Each row is the name, or the tag if there is no name, or “Unnamed.” Under that: sex and life stage. Badge says active. Tap a row → flow 8.

**Header buttons:** **Add Animal** (flow 7), **Weigh Day** (flow 10).

**Not possible from this list:** search, filter by sex or stage, open a sold or deceased goat.

---

## 7. Add an animal

**Start:** Dashboard, herd list, empty herd, or Weigh Day’s empty state.

**Fields**

- Name (optional; placeholder Daisy).
- Tag number (optional).
- Sex: female (preselected) or male.
- Date of birth (optional, not in the future).
- Breed chips for the farm segment. None selected until tapped. Tapping a chip selects it. Tapping another replaces it. There is no “clear breed” chip.

**Steps:** Fill any of the above. Tap **Save Animal**.

**Branches**

- Save succeeds even with name and tag both blank. The goat is active, life stage kid, and appears on the herd list as “Unnamed.”
- Save fails → error, stay on the form.
- Success → back to the screen that opened the form.

**Not collected:** photo, purpose, parents, registration, tattoo, purchase price, notes. Those wait until edit (notes and life stage only) or never appear.

---

## 8. Open an animal

**Start:** Tap a row on the herd list.

**Loading:** “Loading animal…”

**Missing id or wrong farm record:** “Animal not found” and **Back to Livestock**.

**Page shows**

- Name, or tag, or “Unnamed.” Tag as a second line only when both name and tag exist.
- Status badge (active, sold, deceased, slaughtered, transferred — the edit form only offers the first three, so slaughtered and transferred will not appear unless data was written outside the app).
- Breed name, or “Not set.”
- Sex, life stage.
- Birth date if set.
- Out date if set.
- Pasture: “{name} since {move-in date}” or “Not assigned.”
- Notes if set.
- **Edit Animal** → flow 9.
- Health history: latest 10 events (kind, date, FAMACHA score or product). Empty state explains More → Health Log and offers **Add Health Record**, which opens flow 11 but does **not** pre-select this goat.
- Weight history: every saved weight, newest first (date, occasion, value and unit). Empty text points to Weigh Day. No button on the empty weights block.

**Not on this page:** dam, sire, kids, registration, tattoo, photo, breeding history, withdrawal status, sale price.

---

## 9. Edit an animal

**Start:** **Edit Animal** on the animal page.

**Loading:** “Loading animal…” Missing record → “Animal not found.”

**Fields:** Same identity fields as add, plus life stage, status, notes, and out date when not active.

**Life stages (pick one):** kid, weaned, yearling, breeding, feeder, market ready, adult. New goats start as kid; this is the only place to change it. Changing stage does not create a weaning task or a weight.

**Status**

- Active → out date is cleared on save.
- Sold or Deceased → out-date field appears, defaulting to today if it was empty. User can change it (not in the future). Save stores that date.

**Steps:** Change fields. Tap **Save Changes**.

**Branches**

- Success → back to the animal page. If status is no longer active, the herd list no longer shows them. The animal page can still be on screen until they leave it. There is no list to find them again.
- Failure → error, stay on the form.

**Not offered:** slaughtered, transferred, delete, purpose, registration, parents, photo.

---

## 10. Weigh Day

**Start:** Dashboard or herd list.

**Loading:** “Loading animals…”

**No active goats:** “No animals to weigh” and **Add Animal** (flow 7). **Submit Weigh Day** is disabled.

**Form**

- Weigh date, default today, not in the future.
- Unit line: the farm’s lb or kg. Not changeable here (Settings, flow 27, changes future sessions only).
- Occasion, default Ad hoc. Other chips: Birth, 30 day, 60 day, 90 day, Weaning, Yearling. One occasion for the whole batch.
- One row per active goat: name or tag, sex, and a numeric box.

**Steps**

1. Set date and occasion.
2. Type a weight for each goat that was weighed. Leave the rest blank.
3. Tap **Submit Weigh Day**.

**Branches**

- No box has a number greater than zero (all blank, zero, or not a number) → “Enter at least one weight to save.”
- At least one valid weight → one save writes the session and only the valid rows. Blank and invalid rows are skipped with no per-row error. Success: “Recorded N weight(s) in one transaction.” About a second later, back to the previous screen.
- Save fails → error, stay here. Typed weights remain.

**After:** Dashboard recent sessions and the animal’s weight history include the new rows. Life stage does not change because the occasion was Weaning or Yearling. No task is created.

---

## 11. Health log and scoring

**Start:** More → **Health Log**, or **Add Health Record** on an animal page (goat not pre-selected).

### 11.1 Read the log

**Loading:** “Loading health records…”

**Empty:** “No health records yet” and **Add Health Record**.

**Rows:** Event type, date, animal name, and when relevant the FAMACHA score, product, dosage, and notes. Rows are not tappable. Newest first. Includes events for goats who were later marked sold.

### 11.2 Add any health event (shared steps)

**Fields**

- Animal: active goats. Required.
- Date: default today, not in the future.
- Event type, default Vaccination: Vaccination, FAMACHA, Deworming, Treatment, Injury, Hoof trim, Other.
- Product / medication (optional).
- Dosage (optional).
- Withdrawal days: shown only for vaccination, deworming, and treatment.
- Notes (optional).

**Shared branches**

- No animal selected → “Select an animal.”
- No active goats → the animal field says to add animals on Livestock first. Save still fails with “Select an animal.”
- Withdrawal text is not a whole number ≥ 0 → “Enter a valid withdrawal period in days.”
- Withdrawal left blank → no withdrawal task.
- Success → back to the list (or to the animal page if opened from there). The new row is on the health log and in that goat’s latest-10 history.

### 11.3 FAMACHA score (the scoring flow)

**Start:** Flow 11.2 with event type **FAMACHA**.

**Extra field:** Scores 1 through 5. Default is 3. Helper text: 1 = healthy, 5 = anemic.

**Steps:** Pick the goat, the date, and a score. Optionally type a product or note. Tap **Save Health Record**.

**What save does**

| Score | Record stored | Task created |
|-------|----------------|--------------|
| 1, 2, or 3 | Yes, with that score | None |
| 4 | Yes | “Recheck FAMACHA — {goat name or tag}”, medium priority, due 7 days after the record date |
| 5 | Yes | Same title, high priority, due 7 days after the record date |

The task shows up only under More → Tasks (flow 23). The animal page shows the score. It does not show the recheck. Scoring the same goat again adds another record and, for 4 or 5, another task. It does not close the previous recheck.

Withdrawal days are hidden for FAMACHA, so a FAMACHA row never creates a withdrawal task.

### 11.4 Vaccination, deworming, or treatment

Same as 11.2. If withdrawal days is a positive number, save also creates a high-priority task:

“Meat/milk withdrawal clear — {goat} ({product})”

due that many days after the record date. If product was blank, the parenthesis says “treatment.” Withdrawal of 0 creates no task.

There is no separate meat withdrawal and milk withdrawal. There is no drug list.

### 11.5 Injury, hoof trim, or other

Same as 11.2. No score. No withdrawal field. No automatic task.

---

## 12. Breeding list

**Start:** More → **Breeding & Kidding**.

**Loading:** “Loading breeding records…”

**Query error:** The error text only. No list.

**Empty:** “No breeding records yet” plus the three buttons below.

**Buttons (always, once loaded)**

- **Log Breeding** → flow 13.
- **Log Kidding** → flow 15.
- **Breeding Calendar** → flow 14.

**Breeding rows (not tappable):** Dam name, status badge (bred, confirmed, open, kidded, or dry — the form only creates bred, and kidding flips the latest open one to kidded), bred date, due date, sire name if one was stored (on-farm name preferred over the typed external name).

**Kidding rows (not tappable):** Dam, kid date, kids born, and surviving count when it was entered.

---

## 13. Log a breeding

**Start:** Breeding list.

**Fields**

- Dam: active females. Required.
- Sire (on farm): active males. Optional. Empty copy says to use the external name if the buck is not in the herd.
- External sire name: optional free text.
- Bred date: default today.
- A line under the date: “Estimated due date (150-day gestation): {bred date + 150 days}.” The user cannot type a different due date.
- Notes: optional.

**Steps:** Pick a dam. Optionally pick a buck, type an external name, or both, or neither. Tap **Save Breeding**.

**Branches**

- No dam → “Select a dam.”
- No does in the herd → dam field tells them to add does first.
- Success → one breeding row with status **bred**, due date = bred date + 150 days, and a high-priority task “Expected kidding — {dam}” on that due date. Back to the list.

**If both an on-farm buck and an external name are filled:** both are stored. The list shows the on-farm buck’s name, not the typed name.

**Repeat:** Logging a second breeding for the same doe does not close the first. Both stay bred until a kidding runs (flow 15), which closes only the latest one that is still open.

---

## 14. Breeding calendar

**Start:** **Breeding Calendar** on the breeding list.

**Loading:** “Loading breeding calendar…”

**Error:** Error text only.

**Empty:** “No upcoming due dates.” Explains that open breedings due in the next 120 days appear here.

**Included:** Breedings whose status is bred, confirmed, or open, with a due date from today through today + 120 days.

**Excluded:** Status kidded or dry. Due dates before today. Due dates more than 120 days out. So a breeding just logged (due in ~150 days) does **not** appear until it is inside the 120-day window.

**Layout:** Intro line “Expected kiddings through {end date}.” Then month groups (for example “March 2027”). Each card: dam, status, due date, bred date. Cards are not tappable. No link to log the kidding from the card.

---

## 15. Log a kidding

**Start:** Breeding list. This is separate from the breeding form. The user is not required to have logged a breeding first.

**Fields**

- Dam: active females. Required.
- Sire on farm: optional.
- External sire name: optional.
- Kid date: default today.
- Kids born: default “1”.
- Kids surviving: optional.
- Checkbox, off by default: “Register kids in herd (links litter).”
- If the checkbox is on and kids born is 1–12: one block per kid, sex female or male, default female. No name or tag field. Counts above 12 still show only 12 kid blocks.
- Notes: optional.

**Steps:** Fill the form. Tap **Save Kidding**.

**Branches before save**

- No dam → “Select a dam.”
- Kids born is not a number, or is negative → “Enter a valid number of kids born.” Zero is allowed.
- Kids surviving is filled and is not a number ≥ 0 → “Enter a valid surviving count.” It is not checked against kids born. Surviving can be higher than born.
- Kids surviving left blank → stored as unknown, and the kidding row omits the surviving phrase.

**What one successful save does**

1. Writes the kidding (dam, sire fields, date, born, surviving, notes).
2. Looks up this doe’s breedings that are not yet tied to a kidding, newest bred date first, and takes one.
3. If that breeding’s status is bred, confirmed, or open, sets it to **kidded** and links it to this litter. It then drops off the calendar. The expected-kidding **task is not completed** and is not removed.
4. If that breeding is already kidded or dry, or there is no breeding, the kidding is still saved and no breeding row changes.
5. If “Register kids” is on, creates that many active animals (capped by the blocks on screen, so at most 12):
   - Name: “{dam label} kid 1”, “{dam label} kid 2”, …
   - Sex as chosen.
   - Life stage kid. Birth date = kid date.
   - Dam = the doe. Sire = the on-farm buck if one was picked. External sire name copied onto the kid if typed.
   - Litter id = this kidding.
   - Breed is not copied from the dam.
6. Returns to the breeding list.

**After, the user can**

- See the doe’s breeding badge change to kidded, and the new kidding row.
- See each kid on the Livestock tab.
- Open a kid and see sex, kid stage, and birth date. Dam and sire are **not** shown.
- Weigh those kids later with Weigh Day, occasion Birth (flow 10). That is a second visit. Birth weight is not part of kidding.

**Not possible here:** name the kid, set a tag, set a breed, record a stillbirth as its own animal, edit the litter later, or attach the kidding to a specific older breeding when a newer open breeding exists. The newest open breeding is the one that flips to kidded.

---

## 16. Land home

**Start:** Land tab, or Dashboard → **Land**.

**No farm:** “No farm selected.”

**Loading:** “Loading pastures…”

**Summary card:** number of pastures, number of animals currently on any pasture (open grazing rows).

**Buttons:** **Add Pasture** (17), **Move Animals** (18), **Log Feed** (19).

**Pasture list:** Empty state offers Add Pasture. Otherwise each row shows name, status, forage, acres if set, and “N grazing.” Tap → flow 20.

**Recent feed:** Last five feed logs for the farm (type, date, quantity and unit, or just the unit if quantity was blank). Empty state offers Log Feed.

---

## 17. Add a pasture

**Fields:** Name (required). Acres (optional). Forage, default mixed: mixed, bermuda, clover, browse, hayfield, other. Status, default resting: resting, grazing, hay, overgrazed. Notes optional.

**Branches**

- Blank name → “Enter a pasture name.”
- Acres filled but not a number ≥ 0 → “Enter a valid acreage, or leave it blank.”
- Success → back to Land. The pasture appears in the list. Status is whatever was picked, even if no animals are on it. Choosing “grazing” at creation does not place animals.

---

## 18. Move animals onto a pasture

**Start:** Land → **Move Animals**, or a pasture page → **Move animals here** (that pasture starts selected).

**Fields:** Pasture buttons (required). Moved-in date, default today, not in the future. Multi-select of active goats. Notes optional.

**Branches**

- No pastures exist → “Add a pasture before moving animals.” Save is disabled.
- No pasture selected → “Select a pasture.”
- No goats selected → “Select at least one animal.”
- Success, for each selected goat:
  - Any open grazing stay is closed on the move-in date (the stay’s end date equals the new start date).
  - If the goat was already on the chosen pasture, no duplicate stay is created.
  - Otherwise a new open stay starts.
- Destination pasture: if its status was resting, it becomes grazing. If it was already grazing, hay, or overgrazed, the status stays.
- Previous pasture: if that move removed its last animal and its status was grazing, it becomes resting. Hay, overgrazed, and resting are left alone.

**End:** Back to the previous screen. The animal page shows the new pasture. A goat is only on one pasture at a time.

---

## 19. Log feed

**Start:** Land → **Log Feed**, or a pasture page → **Log feed here** (that pasture starts selected).

**Fields**

- Date, default today, not in the future.
- Feed type, required. Chips fill the box: Hay, Grain, Mineral, Pellets, Browse, Other. Any other text is allowed.
- Quantity, optional.
- Unit, default lb, or kg if the farm weight unit is kg: lb, kg, bale, bag.
- Pasture, optional, including None.
- Notes, optional.

**Branches**

- Blank feed type → “Enter a feed type.”
- Quantity not a number ≥ 0 → “Enter a valid quantity, or leave it blank.”
- Success → back. The log appears in Land’s recent feed. If a pasture was chosen, it also appears on that pasture’s “Feed here” list (latest eight).

Feed does not create a finance row and is not tied to individual goats.

---

## 20. Pasture detail

**Start:** Tap a pasture on Land.

**Missing:** “Pasture not found” and **Back to Land**.

**Page**

- Name, status badge, forage, acres, notes.
- Status buttons: Resting, Grazing, Hay, Overgrazed. Tapping one saves immediately. This override does not move animals. It can disagree with who is actually grazing (a pasture can say hay while goats are still listed as on it).
- **Move animals here** → flow 18 with this pasture selected.
- **Log feed here** → flow 19 with this pasture selected.
- Currently grazing: each open stay shows the goat and “Since {date}” and **Move out**.
- Grazing history: up to 12 finished stays, “start – end.”
- Feed here: up to eight logs tied to this pasture.

### 20.1 Move one animal out

**Steps:** Tap **Move out** on a current stay. The button shows “Moving…” until it finishes.

**Result:** That stay’s end date becomes today. If this was the last animal and the pasture status is grazing, status becomes resting. The button does not ask for a different end date. Failure shows an error and the animal stays listed.

---

## 21. Finances list

**Start:** Finances tab.

**No farm:** “No farm selected.”

**Loading:** “Loading transactions…”

**Summary (all time, no date filter):** Revenue in green, expenses in red, net. Amounts use the farm currency code and two decimal places.

**Empty:** “No transactions yet” and **Add Transaction**.

**Rows:** Category, expense or revenue badge, date, signed amount, notes if any. Not tappable.

---

## 22. Add a transaction

**Fields**

- Date, default today, not in the future.
- Currency line (read-only label).
- Type: expense (preselected) or revenue.
- Category, required. Chips: Feed, Veterinary, Supplies, Animal sales, Milk sales, Equipment, Other. Chips only fill the text box. “Milk sales” does not require a milk log. The user can type any other category.
- Amount, required, must be greater than zero.
- Notes, optional.

**Branches**

- Blank category → “Enter a category.”
- Amount missing, zero, or not a number → “Enter a valid amount greater than zero.”
- Success → back to the list. Totals include the new row.

**Not linked:** goat, pasture, health event, or a “sold” status change. Marking a goat sold (flow 9) does not come here.

---

## 23. Tasks

**Start:** More → **Tasks**.

**Loading:** “Loading tasks…”

**Empty:** “No tasks yet.” **Add Task** is in the header and the empty state.

**List order:** Incomplete first, then by due date, then newest. Completed rows stay, struck through, dimmed.

**Each row:** Title, “Due {date}” if set, priority badge (high uses a danger color).

**Tap a row:** Flips complete ↔ open immediately. No confirm. No separate edit. There is no delete.

### 23.1 Add a task by hand

**Fields:** Title required. Due date optional (“No due date”). Priority low, medium (preselected), or high.

**Branches**

- Blank title → “Enter a task title.”
- Success → back to the list. Source is manual. Nobody is assigned, even though a hand might exist on the team.

### 23.2 Tasks the app creates (no visit to this form)

| Trigger | Title | Due | Priority |
|---------|--------|-----|----------|
| Save breeding (flow 13) | Expected kidding — {dam} | Bred date + 150 days | High |
| FAMACHA 4 (flow 11.3) | Recheck FAMACHA — {goat} | Record date + 7 days | Medium |
| FAMACHA 5 | Recheck FAMACHA — {goat} | Record date + 7 days | High |
| Withdrawal days > 0 on vaccination, deworming, or treatment | Meat/milk withdrawal clear — {goat} ({product or “treatment”}) | Record date + those days | High |

These tasks are not completed when the kidding is logged or when a later FAMACHA score is healthy. The user taps them done in this list.

Weaning and weigh-day task sources exist in the data model and are never created by a screen.

---

## 24. Documents

**Start:** More → **Documents**.

**Loading:** “Loading documents…”

**Empty:** “No documents yet.”

**Rows:** Title and type badge. Notes if entered. Not tappable. No file to open.

### 24.1 Add a document index row

**Fields:** Type, default Other: Registration, Health certificate, Scrapie tag, Insurance, Transfer paper, Other. Title required. Notes optional.

**On the form:** “File upload arrives in a later phase. Metadata is saved now.”

**Branches**

- Blank title → “Enter a document title.”
- Success → back to the list.

**Not on the form:** pick a goat, even though a document can store an animal id. Every document saved from the app is farm-level only. No photo, PDF, or storage path.

---

## 25. Team

**Start:** More → **Team**.

**Loading:** “Loading team…”

### 25.1 See members

Each member is the first characters of an internal id plus a role badge: owner, manager, or hand. Emails and names are not shown. There is no remove or role change.

### 25.2 See and revoke invites

Pending invites show email, role, and **Revoke**. Revoke sets that invite aside. Accepted and revoked invites are not listed. Failure shows an error.

### 25.3 Invite someone

**Fields:** Email. Role: manager or hand (hand preselected). There is no owner invite.

**Steps:** Enter email. Pick role. Tap **Send Invite**.

**Branches**

- Email without an @ → “Enter a valid email address.”
- Success → “Invite recorded. They will be added when they sign up with this email.” The app does not send mail.

**What the invited person does**

1. They create an account with that same email (flow 3) or, if they already had an account before the invite, this app does not add them on a later sign-in. The attach-to-farm step runs when the user record is created.
2. On that signup they become a member with the invited role and the invite is marked accepted.
3. Next time the app loads their farms, they go to the dashboard and see the same tabs as the owner.

**What the role does not change in the UI:** Manager and hand still see Settings, Team, and every add button. The server is expected to reject writes they are not allowed to make. The screen will then show the save error. The owner is the only role meant to change farm settings and invites. Manager and owner are meant to edit herd data. A hand is meant to be blocked from those writes.

---

## 26. Sign out

**Start:** More, bottom of the menu.

**Steps:** Tap **Sign Out**.

**End:** Local session ends. Sign-in screen. The farm data on the device is cleared as part of sign-out, so the next account does not see the previous herd. Signing back in pulls the farm again when the network is available.

---

## 27. Settings

**Start:** More → **Settings**.

**Fields:** Farm name. Currency (free text, stored uppercased, default USD). Weight unit lb or kg. Segment shown as read-only.

**Branches**

- Blank name → “Farm name is required.”
- Success → “Settings saved.” Dashboard chips and later Weigh Day units follow the new values. Old weight rows keep the unit they were saved with. Money rows are not converted.

---

## 28. More menu itself

**Start:** More tab.

**Shows:** Farm name, segment, currency, weight unit. Then Health Log, Breeding & Kidding, Settings, Team, Documents, Tasks. Then Sign Out.

Each row is only a navigation step into the flows above.

---

## 29. End-to-end stories

These are the same flows chained the way a herd manager would actually use them.

### 29.1 First day on a new farm

1. Sign up (3) → create farm, Meat (4) → dashboard with 0 active (5).
2. Add a doe and a buck (7, twice). Herd list shows both (6).
3. Weigh Day, occasion Ad hoc, weights on both (10). Dashboard lists the session.
4. Open the doe (8). Weight is there. Pasture says not assigned. Health is empty.

### 29.2 FAMACHA and a dewormer

1. More → Health → add FAMACHA 5 on the doe (11.3).
2. More → Tasks. High-priority recheck due in 7 days (23).
3. Health → deworming, product name, 30 withdrawal days (11.4).
4. Tasks now also has “Meat/milk withdrawal clear — {doe} ({product})” in 30 days.
5. Open the doe. Both events are in health history. Withdrawal is not called out on the page.
6. Tap each task when the work is done (23).

### 29.3 Breed, wait, kid, score is not involved

1. Log breeding: doe, on-farm buck, today (13). List shows bred and a due date 150 days out. Task “Expected kidding” exists. Calendar does not show it yet (due beyond 120 days).
2. When the due date is inside 120 days, calendar groups it under that month (14).
3. On kid day, log kidding, kids born 2, surviving 2, register kids, one female and one male (15).
4. Breeding row becomes kidded and leaves the calendar. The expected-kidding task is still open until someone taps it.
5. Livestock shows “{doe} kid 1” and “{doe} kid 2.”
6. Weigh Day, occasion Birth, weights only on the two kids (10).

### 29.4 Kid without a prior breeding

Log kidding only (15). Kidding row exists. No breeding row changes. Kids can still be registered.

### 29.5 Rotate pasture and feed

1. Add “North paddock,” 4 acres, bermuda, resting (17).
2. Move the doe and buck there (18). Paddock status becomes grazing. Animal pages show the paddock.
3. Log feed Hay, 3 bales, tied to that paddock (19).
4. Open the paddock. Move the buck out (20.1). Doe remains. Status stays grazing.
5. Move the doe out. Status returns to resting.
6. Or move both straight to a second paddock (18). The first closes and rests. The second becomes grazing.

### 29.6 Sell a goat and record the money separately

1. Edit the doe, status Sold, out date today (9). She leaves the herd list.
2. Finances → revenue, category Animal sales, amount (22). Nothing fills the amount from the animal. The sold goat is not on the transaction.

### 29.7 Invite a hand

1. Team → email, role hand, Send Invite (25.3).
2. That person signs up with the same email (3) and lands in the farm.
3. Owner’s member list shows a short id and “hand,” not the email.

---

## Flows that do not exist

A person cannot, anywhere in the app:

- Reset a password, change their email, or delete the account.
- Create a second farm or switch farms.
- Search or filter the herd. See sold, deceased, slaughtered, or transferred goats in a list.
- Delete an animal. Set slaughtered or transferred. Enter registration, tattoo, photo, purpose, purchase or sale price. See dam, sire, or offspring on an animal.
- Add a custom breed. Change segment.
- Edit or delete a weight, health row, breeding, kidding, transaction, feed log, document, or pasture. Undo a kidding’s kid animals except by editing each kid later (name, tag, status).
- Log FAMACHA, treatment, or breeding for several goats in one save. Weigh Day is the only batch entry.
- Pick meat withdrawal and milk withdrawal separately. Use a drug catalog, lot number, route, body condition, or fecal egg count.
- Change a breeding’s due date, mark confirmed or open or dry, or choose which breeding a kidding closes.
- Name or tag a kid on the kidding form. Record birth weight in that same save.
- See today’s due tasks, due kiddings, or animals in withdrawal on the dashboard.
- Assign a task to a person. Delete a task. Auto-complete the kidding task when kidding is logged.
- Upload a file or tie a document to a goat from the form.
- Email an invite. Remove a member. Hide owner-only screens from a hand.
- Log milk, a lactation, or dry-off. The dairy segment only changes breed chips, and “Milk sales” is only a finance category chip.
- Tie feed, vet cost, or a sale to a goat. Export anything. Print a vet summary.

---

## Flow index

| # | Flow | Where it starts |
|---|------|-----------------|
| 1 | Open the app | Launch |
| 2 | Sign in | Sign-in screen |
| 3 | Sign up | Create account |
| 4 | Create a farm | After first sign-in with no farm |
| 5 | Dashboard | Dashboard tab |
| 6 | Herd list | Livestock tab |
| 7 | Add an animal | Add Animal |
| 8 | Open an animal | Herd row |
| 9 | Edit an animal, including sold or deceased | Edit Animal |
| 10 | Weigh Day | Weigh Day |
| 11 | Health log and FAMACHA scoring | More → Health Log |
| 12 | Breeding list | More → Breeding & Kidding |
| 13 | Log a breeding | Log Breeding |
| 14 | Breeding calendar | Breeding Calendar |
| 15 | Log a kidding and optional kid registration | Log Kidding |
| 16 | Land home | Land tab |
| 17 | Add a pasture | Add Pasture |
| 18 | Move animals onto a pasture | Move Animals |
| 19 | Log feed | Log Feed |
| 20 | Pasture detail and move out | Pasture row |
| 21 | Finances list | Finances tab |
| 22 | Add a transaction | Add Transaction |
| 23 | Tasks, including automatic ones | More → Tasks |
| 24 | Document index | More → Documents |
| 25 | Team and invites | More → Team |
| 26 | Sign out | More |
| 27 | Settings | More → Settings |
| 28 | More menu | More tab |
| 29 | Chained stories | Combines the flows above |
