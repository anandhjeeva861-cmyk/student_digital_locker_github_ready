# Supabase Setup

1. Create a project in Supabase.
2. Enable Email Auth under Authentication > Providers.
3. For easy testing, either disable email confirmation or verify the email before login.
4. Add the GitHub Pages URL in Authentication > URL Configuration:

```text
https://anandhjeeva861-cmyk.github.io/student_digital_locker_github_ready/
```

5. Run `supabase/schema.sql` first in the SQL Editor.
6. Run `supabase/rls-policies.sql` second in the SQL Editor.
7. Confirm the private `certificates` storage bucket exists.
8. Add GitHub Repository Secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

Use only the project URL and anon key in frontend configuration.
