# GitHub Push Steps

Before pushing, verify the static site:

```bash
npm run config:firebase
npm run build
```

Then commit and push:

```bash
git add .
git commit -m "Integrate Firebase for Student Digital Locker"
git push
```

Keep `.env`, `.env.local`, `.env.production`, `js/firebase-config.js`, Admin SDK files, and service account JSON files out of commits.
