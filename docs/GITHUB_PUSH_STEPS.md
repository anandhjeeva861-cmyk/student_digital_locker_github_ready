# GitHub Push Steps

Before pushing, verify the static site:

```bash
npm run build
```

Then commit and push:

```bash
git add .
git commit -m "Fix Supabase student and teacher login"
git push
```

Confirm `js/supabase-config.js`, `.env`, and `.env.local` are not committed.
