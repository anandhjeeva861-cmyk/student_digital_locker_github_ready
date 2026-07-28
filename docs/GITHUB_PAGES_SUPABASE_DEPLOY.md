# GitHub Pages Supabase Deploy

The root site is deployed by `.github/workflows/pages.yml`.

Required GitHub Repository Secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

The workflow validates those secrets, generates `js/supabase-config.js`, uploads the static artifact, and deploys to GitHub Pages.

GitHub Pages setup:

1. Open repository Settings.
2. Open Pages.
3. Set Source to GitHub Actions.
4. Push to `main` or run the workflow manually.

Do not add `SUPABASE_SERVICE_ROLE_KEY` to frontend code or generated static files.

Supabase Auth URL setup:

```text
https://anandhjeeva861-cmyk.github.io/student_digital_locker_github_ready/
```
