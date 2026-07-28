# GitHub Push Steps

Before pushing, verify the static site:

```bash
npm run build
npm run check:api
```

Then commit and push:

```bash
git add .
git commit -m "Generate Node backend for Student Digital Locker"
git push
```

Keep `.env`, `server/data/`, and `server/uploads/` out of commits.
