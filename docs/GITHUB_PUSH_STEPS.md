# GitHub Push Steps

```bash
git init
git add .
git commit -m "Fix GitHub Pages static Firebase deployment"
git branch -M main
git remote add origin https://github.com/anandhjeeva861-cmyk/student_digital_locker_github_ready.git
git push -u origin main
```

If the remote already exists:

```bash
git remote set-url origin https://github.com/anandhjeeva861-cmyk/student_digital_locker_github_ready.git
git push -u origin main
```

Before committing, check:

```bash
git status --short
git diff --cached --name-only
```

Never commit:

- `.env`
- uploaded documents
- local database files
- `node_modules/`
