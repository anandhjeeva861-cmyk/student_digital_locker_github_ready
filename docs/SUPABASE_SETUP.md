# Supabase Setup

1. Create a project in Supabase.
2. Enable Email Auth under Authentication.
3. Run `supabase/schema.sql` in the SQL Editor.
4. Run `supabase/rls-policies.sql` in the SQL Editor.
5. Confirm the private `certificates` storage bucket exists.
6. Add your deployed GitHub Pages URL to allowed Auth redirect URLs if email confirmation is enabled.

Use only the project URL and anon key in frontend configuration.
