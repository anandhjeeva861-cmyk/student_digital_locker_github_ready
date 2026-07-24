# GitHub Pages Firebase Setup

The active GitHub Pages website uses the root static files:

- `index.html`
- `css/`
- `js/`

## Active Firebase Config

For the live GitHub Pages website, the browser loads:

```text
js/firebase-config.js
```

This file must exist in the repository and be committed for Firebase to work on GitHub Pages.

The Flask/local config file is separate:

```text
student_digital_locker/static/js/firebase-config.js
```

That Flask file is ignored and is not used by GitHub Pages.

## Paste Firebase Values

Paste your Firebase Console web config values into:

```text
js/firebase-config.js
```

Do not paste real values into:

```text
.env.example
js/firebase-config.example.js
student_digital_locker/static/js/firebase-config.example.js
```

## Commit And Push

After pasting real values for the live site:

```bash
git add js/firebase-config.js
git add README.md docs/GITHUB_PAGES_FIREBASE_SETUP.md .gitignore
git commit -m "Configure Firebase for GitHub Pages"
git push
```

## Verify

Open:

```text
https://anandhjeeva861-cmyk.github.io/student_digital_locker_github_ready/
```

In the browser developer console, check that:

- `./js/auth.js` loads.
- `./js/student.js` loads on the student dashboard.
- `./js/teacher.js` loads on the teacher dashboard.
- `./js/firebase-config.js` loads without a 404.

If Firebase still does not work, check Firebase Auth, Firestore Rules, Storage Rules, and App Check settings.
