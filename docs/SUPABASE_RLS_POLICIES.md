# Supabase RLS Policies

The required RLS and storage policies are in `supabase/rls-policies.sql`.

Run order:

1. `supabase/schema.sql`
2. `supabase/rls-policies.sql`

Policy coverage:

- Users can read their own profile.
- Students and teachers can create their own profile row after Auth signup.
- Users can update only profile photo fields through column grants.
- Teachers can read matching student profiles by department and year.
- Students can manage their own documents.
- Teachers can read and delete matching academic documents only.
- Academic titles are scoped by department and year.
- The private `certificates` bucket uses signed URLs and path-scoped policies.
