# Admin scripts

These scripts are for **operators only**. They use secrets that must never ship in the mobile or web app.

## Security

- **`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security.** Keep it out of the repo, out of `.env` files used by Expo, and out of every `EXPO_PUBLIC_*` variable.
- Export credentials in your shell for the single command, then unset them or close the terminal.

## Password recovery link (`scripts/admin-recovery-link.mjs`)

**When to use it:** A farmer forgot their password and Supabase’s built-in recovery email only reaches your team inbox (or you need to paste a link into your own channel — SMS, WhatsApp, support ticket).

The script does **not** send email. It prints one **action link** you can copy and send securely.

### Run

```bash
export SUPABASE_URL='https://YOUR_PROJECT.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
node scripts/admin-recovery-link.mjs farmer@example.com
```

The script prints the project URL, asks you to type `yes`, then prints the recovery link (nothing else from the API response).

If there is no auth user with that email, it exits with: `No Supabase Auth user exists for: …`

### Redirect URL

After the farmer opens the link, Supabase redirects them to your app’s reset screen. That target must be allowed in the Supabase dashboard:

**Authentication → URL Configuration → Redirect URLs**

Bloodline Book expects paths like:

- `bloodlinebook://reset-password` (native)
- `http://localhost:8081/reset-password` (local web)
- `https://bloodline-book.vercel.app/reset-password` (production web)

See also [vercel-supabase-setup.md](vercel-supabase-setup.md).

**How to see which redirect a link uses:** The printed `action_link` is a Supabase verify URL. Decode the `redirect_to` query parameter (URL-encoded), for example:

```bash
node -e "const u=new URL(process.argv[1]); console.log(u.searchParams.get('redirect_to'))" 'PASTE_ACTION_LINK_HERE'
```

If `redirect_to` is missing or wrong, set **Site URL** / **Redirect URLs** in Supabase Auth settings, or pass a redirect when generating links (future script option). The app’s in-app “Forgot password?” flow uses `Linking.createURL('/reset-password')` — match that pattern in Auth settings for each environment.

### Farmer flow

1. Open the link on the device where they use Bloodline Book.
2. Land on **Reset password** (`app/(auth)/reset-password.tsx`).
3. Enter a new password (same rules as sign-up: at least 8 characters).
