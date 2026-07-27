# Supabase Security Rules

Security is enforced by Supabase Row Level Security and private storage policies in:

- `supabase/schema.sql`
- `supabase/rls-policies.sql`

Frontend checks improve user experience, but Supabase RLS is the security boundary.

Key rules:

- Students can manage only their own online, personal, and academic documents.
- Teachers can read student profiles only for their matching `department_key` and `year`.
- Teachers can read and delete only academic documents for matching students.
- Teachers cannot read online or personal documents.
- Storage bucket `certificates` stays private.
- Signed URLs are used for private file viewing and downloads.
