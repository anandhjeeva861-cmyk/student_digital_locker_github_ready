# Supabase Login Troubleshooting

Use this when student or teacher login/register fails.

## Invalid Credentials

- Confirm the email and password are correct.
- Confirm the user exists in Supabase Authentication.
- If the same email was registered with a different role, use the correct login page.

## Email Not Confirmed

- Supabase can block login until email verification is complete.
- For easy testing, go to Authentication > Providers > Email and disable email confirmation.
- For production, keep verification enabled and ask users to verify email before login.

## Profile Not Found

- Run `supabase/schema.sql` first.
- Run `supabase/rls-policies.sql` second.
- Register again if the old Auth user was created before the profile trigger existed.
- Check browser console for `Profile fetch failed` or `Profile creation fallback failed`.

## RLS Violation

- RLS blocked the browser request.
- Run both SQL files again in order.
- Confirm policies exist for `profiles`, `documents`, `academic_titles`, and `storage.objects`.

## Missing Table Or Function

If you see errors like missing `profiles`, `documents`, `academic_titles`, or `profile_value_exists`:

1. Open Supabase > SQL Editor.
2. Run `supabase/schema.sql`.
3. Run `supabase/rls-policies.sql`.

## Missing GitHub Secrets

GitHub Pages deployment needs exactly:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Add them in GitHub repository Settings > Secrets and variables > Actions.

## Missing Supabase Auth Redirect URL

In Supabase > Authentication > URL Configuration, add:

```text
https://anandhjeeva861-cmyk.github.io/student_digital_locker_github_ready/
```

For local testing, also add:

```text
http://localhost:8000
```

## Storage Bucket Missing

Confirm Supabase Storage has a private bucket named:

```text
certificates
```

If missing, run `supabase/rls-policies.sql`, or create the bucket manually and keep it private.

## Local Config Missing

For local static testing:

```bash
copy js\supabase-config.example.js js\supabase-config.js
```

Paste only your Supabase project URL and anon/public key. Do not commit `js/supabase-config.js`.

## Local Server

Run:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

If login still fails, the red browser console error is the exact reason.
