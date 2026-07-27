# Firebase Removal Summary

The active GitHub Pages project has been migrated to Supabase.

Removed from the active root site:

- Firebase config examples and generated config usage
- Firebase deployment config
- Firestore rules
- Storage rules
- Firebase Auth, database, and storage imports

Replacement files:

- `js/supabase-config.example.js`
- `supabase/schema.sql`
- `supabase/rls-policies.sql`
- `.github/workflows/pages.yml`

Supabase is now the only backend, database, and storage provider for the active GitHub Pages project.
