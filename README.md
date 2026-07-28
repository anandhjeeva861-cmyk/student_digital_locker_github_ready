# Student Digital Locker

Static frontend-only Student Digital Locker website for GitHub Pages.

This version does not use any backend, database, Firebase, Supabase, server, or API. Login/register, profile data, academic titles, and uploaded certificate previews are stored only in the current browser with `localStorage`.

## Project Structure

- `index.html`
- `student-login.html`
- `student-register.html`
- `student-dashboard.html`
- `teacher-login.html`
- `teacher-register.html`
- `teacher-dashboard.html`
- `css/style.css`
- `js/auth.js`
- `js/local-db.js`
- `js/student.js`
- `js/teacher.js`
- `js/validation.js`
- `images/sankara-logo.png`

## GitHub Pages

The site deploys from the repository root using `.github/workflows/pages.yml`.

Required:

- Root `index.html`
- Root `.nojekyll`
- Relative asset paths like `./css/style.css`, `./js/auth.js`, and `./images/sankara-logo.png`

No repository secrets are required.

## Local Testing

```bash
npm install
npm run build
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

## Important

Because this is frontend-only, data is not shared between browsers or devices. Clearing browser storage removes registered users and documents.

## Useful Commands

```bash
npm run build
git add .
git commit -m "Convert app to frontend only"
git push
```
