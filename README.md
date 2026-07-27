# Student Digital Locker

Static HTML/CSS/JavaScript Student Digital Locker for GitHub Pages. The active root site now uses Supabase Auth, Supabase PostgreSQL, Supabase Storage, and Supabase Row Level Security.

## Active Project

- Frontend: `index.html`, dashboard HTML files, `css/style.css`, and `js/*.js`
- Backend provider: Supabase only
- Runtime config: `js/supabase-config.js`
- Public placeholder config: `js/supabase-config.example.js`
- Database setup: `supabase/schema.sql`
- RLS and storage policies: `supabase/rls-policies.sql`

The `student_digital_locker/` folder is a legacy Flask/SQLite copy and is not the active GitHub Pages deployment.

## GitHub Repository Secrets

Add exactly these secrets in GitHub:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Never commit:

- `SUPABASE_SERVICE_ROLE_KEY`
- `.env`
- `.env.local`
- `js/supabase-config.js`

The frontend must use only the anon key. Do not expose a service role key in browser code.

## Supabase Setup

1. Create a Supabase project.
2. In Authentication, enable Email Auth.
3. Open SQL Editor and run `supabase/schema.sql`.
4. Open SQL Editor and run `supabase/rls-policies.sql`.
5. Confirm the `certificates` storage bucket exists and is private.
6. Keep storage paths in this format:
   - `documents/{userId}/online/{timestamp-fileName}`
   - `documents/{userId}/personal/{timestamp-fileName}`
   - `documents/{userId}/academic/{timestamp-fileName}`
   - `profilePhotos/{userId}/{timestamp-fileName}`

## GitHub Pages Deployment

1. Go to repository Settings.
2. Open Secrets and variables, then Actions.
3. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. Go to Pages.
5. Set Source to GitHub Actions.
6. Push to `main`.

The workflow generates `js/supabase-config.js` during deployment from repository secrets.

## Local Testing

For local browser testing, copy the example config and paste your own local Supabase values:

```bash
cp js/supabase-config.example.js js/supabase-config.js
npm install
npm run build
npm run dev
```

On Windows PowerShell:

```powershell
Copy-Item js\supabase-config.example.js js\supabase-config.js
npm install
npm run build
npm run dev
```

## Useful Commands

```bash
npm run build
git add .
git commit -m "Migrate backend from Firebase to Supabase"
git push
```
