# GitHub Actions Firebase Deploy

The live GitHub Pages site uses the root static files:

- `index.html`
- `css/`
- `js/`

The active Firebase config for GitHub Pages is:

```text
js/firebase-config.js
```

This file is generated during deployment by GitHub Actions from Repository Secrets. The real config is not committed to the repository.

The Flask/local config file is separate and is not used by GitHub Pages:

```text
student_digital_locker/static/js/firebase-config.js
```

## Required Repository Secrets

Add these in GitHub:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Required secrets:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

## GitHub Pages Setting

Set GitHub Pages to use Actions:

```text
Settings -> Pages -> Source -> GitHub Actions
```

Do not use `Deploy from a branch` for this setup, because the workflow must generate `js/firebase-config.js` before deployment.

## Verify Deployment

After pushing to `main`, open:

```text
https://anandhjeeva861-cmyk.github.io/student_digital_locker_github_ready/
```

Check deployment logs:

```text
Repository -> Actions -> Deploy GitHub Pages
```

Open the latest run and confirm:

- Checkout succeeded.
- Generate Firebase config succeeded.
- Upload Pages artifact succeeded.
- Deploy to GitHub Pages succeeded.

In the browser developer console, confirm:

- `./js/firebase-config.js` loads without 404.
- `./js/auth.js` loads.
- Firebase Auth requests are reaching your Firebase project.

## Security Note

Firebase web config is visible in browser JavaScript after deployment. It is not a private password. Real security must come from:

- Firebase Authentication
- Firestore Rules
- Storage Rules
- Firebase App Check
