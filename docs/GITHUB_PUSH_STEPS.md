# GitHub Push Steps

Before pushing, verify the static site:

```bash
npm run config:firebase
npm run build
npm run pages:artifact
```

Then commit and push:

```bash
git add .
git commit -m "Integrate Firebase for Student Digital Locker"
git push
```

Keep `.env`, `.env.local`, `.env.production`, Admin SDK files, and service account JSON files out of commits. `js/firebase-config.js` contains only Firebase Web SDK browser config and must be present for branch/root GitHub Pages deployments.
