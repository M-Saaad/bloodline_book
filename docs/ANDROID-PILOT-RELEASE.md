# Android pilot release (agent runbook)

Use this when **`main` has app changes** (UI, features, fixes) and pilot farmers need a **new installable Android APK**. Merging to `main` or passing CI does **not** update phones automatically.

## Quick facts

| Item | Value |
|------|--------|
| EAS owner / slug | `bloodline-books-team` / `blood-line-book-app` (`app.config.ts` → `extra.eas.projectId`) |
| Android package | `com.bloodlinebook.app` |
| Pilot build profile | `pilot` in `eas.json` (internal **APK**, production database) |
| CI | `.github/workflows/ci.yml` — typecheck + tests only; **no EAS Build** |
| Local dev | `npm run android` (Expo dev client / emulator) — **not** the same as a pilot APK |

Background on branch → database and EAS env vars: [environments.md](environments.md#pilot-builds).

Expo SDK for this repo: **57** — follow [Expo v57 docs](https://docs.expo.dev/versions/v57.0.0/) for native/build changes.

---

## When to run this workflow

Run after:

1. Changes are **merged to `main`** (or you are explicitly asked to ship from `main`).
2. `npm run typecheck` and `npm test` pass on the commit you will build.
3. The user (or task) asks for an **updated Android app** / pilot APK — not only “merge the PR.”

Do **not** assume web deploy (Vercel) replaces an Android build; they are separate pipelines.

---

## Prerequisites

### EAS CLI and login

- Install: `npm install -g eas-cli` or `npx eas-cli@">=16.0.0"`.
- Log in: `eas login` (interactive) **or** set **`EXPO_TOKEN`** for non-interactive Cloud Agent / CI use ([Expo access tokens](https://docs.expo.dev/accounts/programmatic-access/)).

### Production client env (EAS **production** environment)

EAS Build does **not** run `scripts/setup-env.sh`. The pilot profile uses `environment: "production"` and profile env `EXPO_PUBLIC_DATABASE_TARGET=production`.

These must exist in the EAS **production** environment (plain or sensitive visibility for `EXPO_PUBLIC_*` — **not** “secret” visibility, or they will not inline into the client bundle):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_POWERSYNC_URL`

`DATABASE_TARGET` / `EXPO_PUBLIC_DATABASE_TARGET` are already set on the `pilot` profile in `eas.json`.

Manage vars:

```bash
eas env:list --environment production
eas env:create production   # if a name is missing
```

Never ship farmer APKs with the `preview` profile (development database).

### Optional pre-ship checks

- [support.ts](../lib/config/support.ts) — support email / WhatsApp are real (not placeholders).
- Native dependency or SDK changes may need `npx expo-doctor` and an Expo doc review before building.

---

## Version numbers

`eas.json` sets `cli.appVersionSource` to **`remote`**. The **`production`** profile has `autoIncrement: true` (Play Store–style `versionCode` on EAS).

The **`pilot`** profile does **not** auto-increment. For each new pilot APK:

1. **User-facing version** — update `version` in `app.config.ts` when pilots should see a new release number (e.g. `1.0.0` → `1.0.1`).
2. **Android `versionCode`** — must increase for installs over an existing APK on the same device. Options:
   - Run a **`production`** build once (increments remote `versionCode`), then build `pilot`, **or**
   - Set/sync explicitly: `eas build:version:set` / [App version management](https://docs.expo.dev/build-reference/app-versions/), **or**
   - Add `"autoIncrement": true` to the `pilot` profile in `eas.json` (team decision; not enabled today).

Commit `app.config.ts` version bumps on `main` before building if you want git to record the release label.

---

## Build pilot APK (standard command)

From repo root, on **`main`** at the commit to ship:

```bash
git fetch origin main
git checkout main
git pull origin main
npm ci
npm run typecheck
npm test

eas build -p android --profile pilot --non-interactive
```

Use `--non-interactive` when `EXPO_TOKEN` is set (Cloud Agents). Without a token, the human must run the same command locally after `eas login`.

### After the build

1. Open the build URL from the CLI or [expo.dev](https://expo.dev) → project **Bloodline Book** → Builds.
2. Download the **APK** artifact (`pilot` uses `android.buildType: "apk"`).
3. Distribute via your usual channel (link, email, WhatsApp — see support config).
4. Tell pilots they must **install over** the old app (or uninstall first if `versionCode` did not increase).

List recent builds:

```bash
eas build:list --platform android --limit 5
```

---

## Verify the build (agent checklist)

Evidence to leave in the PR comment or task summary:

- [ ] Build status **finished** on EAS for commit SHA matching `main`.
- [ ] Profile **`pilot`**, platform **Android**, artifact type **APK**.
- [ ] `EXPO_PUBLIC_DATABASE_TARGET=production` (no “Development DB” badge on dashboard after install).
- [ ] Smoke: sign in, open Today / Herd, confirm offline/sync badge behavior if relevant to the change.

Cloud Agents often **cannot** install APKs on physical devices in this environment; record the EAS build URL and SHA. Use `npm run android` only to sanity-check JS/UI, not as proof of the release APK.

---

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| Build fails: missing env | `eas env:list --environment production`; compare [.env.production.example](../.env.production.example) |
| App shows dev database | Wrong profile or missing `environment: "production"` on `pilot` |
| Cannot install over old APK | Bump `versionCode` (see [Version numbers](#version-numbers)) |
| `eas` not authenticated in agent | Add `EXPO_TOKEN` to Cloud Agent secrets or hand off to a human with `eas login` |
| Native module / Gradle errors | Expo 57 upgrade notes; run `npx expo-doctor` |

---

## Related docs

- [environments.md](environments.md) — branch → DB, EAS profiles, pilot overview  
- [vercel-supabase-setup.md](vercel-supabase-setup.md) — **web** deploy (separate from Android)  
- [TEST-ACCOUNT.md](TEST-ACCOUNT.md) — demo account for smoke tests  

---

## Suggested PR / task note (copy-paste)

```text
Android: EAS build triggered for main @ <sha>
- Profile: pilot
- EAS build: <url>
- app.config version: <x.y.z>
- Tests: npm run typecheck && npm test (pass)
```
