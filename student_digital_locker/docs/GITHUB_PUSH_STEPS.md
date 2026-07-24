# GitHub Push Steps

Before pushing, make sure these files are not staged:

- `.env`
- `.env.local`
- `static/js/firebase-config.js`
- `locker.db`
- uploaded files inside `uploads/`
- `node_modules/`

Run:

```bash
git init
git add .
git commit -m "Initial commit - Student Digital Locker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/student-digital-locker.git
git push -u origin main
```

Useful safety checks:

```bash
git status --short
git diff --cached --name-only
```

If a private file is staged by mistake, unstage it:

```bash
git restore --staged .env
git restore --staged static/js/firebase-config.js
```
