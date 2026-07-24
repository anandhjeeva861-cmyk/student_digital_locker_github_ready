# GitHub Push Steps

Use these steps to upload the Student Digital Locker project to GitHub.

## 1. Open the project folder

Open terminal inside the project folder:

```bash
cd student_digital_locker
```

## 2. Check files before pushing

Make sure these files exist:

```text
app.py
requirements.txt
README.md
.gitignore
.env.example
LICENSE
static/
templates/
uploads/documents/.gitkeep
uploads/profile_photos/.gitkeep
```

## 3. Do not upload private/runtime files

Do not push these files or folders:

```text
.env
locker.db
venv/
__pycache__/
uploads/documents/actual_uploaded_files
uploads/profile_photos/actual_uploaded_files
```

The `.gitignore` file already blocks them.

## 4. Initialize Git

```bash
git init
```

## 5. Add files

```bash
git add .
```

## 6. Check status

```bash
git status
```

You should not see `.env`, `locker.db`, `venv`, or real uploaded files in the staged list.

## 7. Commit

```bash
git commit -m "Initial commit - Student Digital Locker"
```

## 8. Create GitHub repository

1. Open GitHub.
2. Click **New repository**.
3. Repository name example: `student-digital-locker`.
4. Keep it public or private as needed.
5. Do not add README, `.gitignore`, or license again because this project already has them.
6. Create repository.

## 9. Connect local project to GitHub

Replace `YOUR_USERNAME` with your GitHub username:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/student-digital-locker.git
git push -u origin main
```

## 10. After pushing

Open your GitHub repository and confirm these files are visible:

- `README.md`
- `app.py`
- `requirements.txt`
- `templates/`
- `static/`
- `docs/`
- `.gitignore`
- `.env.example`
- `LICENSE`

## 11. Updating the repository later

After making changes:

```bash
git add .
git commit -m "Describe your change"
git push
```

## 12. Clone and run on another system

```bash
git clone https://github.com/YOUR_USERNAME/student-digital-locker.git
cd student-digital-locker
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

Install and run:

```bash
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:5000
```
