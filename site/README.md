# Landing page (bloodlinebookapp.com)

One static file, `index.html`. No build step. It is a separate Vercel project
from the app: same repo, Root Directory `site`, Framework "Other".

- The waitlist form posts to the Supabase table `waitlist_signups`
  (migration `0017_waitlist_signups.sql`) with the public anon key, the same
  key the web app ships. The key can add rows only; it cannot read them.
- Read sign-ups in the Supabase dashboard: Table Editor, `waitlist_signups`.
- The logo and the app screenshot are embedded in the file, so there is
  nothing else to deploy.
- Every claim on the page must stay true to the app. Check `/data` wording
  before changing the data promises.
