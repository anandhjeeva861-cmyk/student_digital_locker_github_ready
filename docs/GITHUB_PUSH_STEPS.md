# GitHub Push Steps

Before pushing, verify the static site:

```bash
npm run build
```

Then commit and push:

```bash
git add .
git commit -m "Convert app to frontend only"
git push
```

No backend config or secret files are required.
