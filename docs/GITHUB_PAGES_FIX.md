# GitHub Pages 404 Fix

The repository was originally Flask-based and nested under `student_digital_locker/`. GitHub Pages does not run Flask and expects a static `index.html` in the publishing root.

## Fixed

- Added root `index.html`.
- Added static login/register/dashboard pages.
- Added root `css/style.css`.
- Added root `js/` modules.
- Removed Jinja/template syntax from the deployed static pages.
- Replaced Flask paths with relative paths like `./css/style.css` and `./js/auth.js`.
- Added `.nojekyll`.
- Added root `.gitignore`.
- Added deploy-time Firebase browser config generation.
- Generated `js/firebase-config.js` during GitHub Actions so API keys are not committed.
- GitHub Actions now installs dependencies, runs verification, prepares a clean `dist/` artifact, and deploys only that artifact.

## GitHub Pages Settings

1. Open the GitHub repository.
2. Go to **Settings**.
3. Open **Pages**.
4. Set **Source** to **GitHub Actions**.
5. Click **Save**.

Open:

```text
https://anandhjeeva861-cmyk.github.io/student_digital_locker_github_ready/
```

## If 404 Still Appears

- Wait 1 to 5 minutes after pushing.
- Open the repository **Actions** tab and check the Pages deployment.
- Confirm `index.html` exists at repository root.
- Confirm Pages is set to **GitHub Actions**.
- Confirm the URL includes the repository name.
- Confirm the repository variable `FIREBASE_API_KEY` exists under Actions variables.
- Confirm the GitHub Pages host is added in Firebase Authentication authorized domains.
- Confirm the workflow artifact path is `dist/`, not the repository root.
- Avoid opening `/student_digital_locker/` because the deployed static site is at root.

## Common Causes Fixed

- Missing root `index.html`: fixed by adding `index.html`.
- Flask-only templates: fixed by adding plain static HTML pages.
- Nested project folder: fixed by adding root deploy files.
- Absolute asset paths: fixed by using `./css/...` and `./js/...`.
- Jekyll processing: fixed by adding `.nojekyll`.
- Case-sensitive paths: all root files use lowercase names matching links.
