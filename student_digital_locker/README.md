# Student Digital Locker

A DigiLocker-inspired certificate management web application for students and teachers.

Students can store online, personal, and academic certificates. Teachers can access only academic certificates of students from the same department and same year.

## Features

### Student Portal

- Student email/password login
- Student registration with:
  - Name in uppercase
  - Register number, for example `25BSC003`
  - Year, for example `I`
  - Department, for example `BSCCS`
  - Mobile number
  - Email
  - Password
- Duplicate account prevention using email, mobile number, and register number
- Dashboard with welcome message and dark mode toggle
- Profile page with read-only student details
- Profile photo update only
- Online certificate upload, view, download, and remove
- Personal certificate upload, view, download, and remove
- Academic certificate upload, view, download, and remove
- Already uploaded academic title is hidden from upload select list

### Teacher Portal

- Teacher email/password login
- Teacher registration with:
  - Name in uppercase
  - Department
  - Year
  - Mobile number
  - Email
  - Password
- Duplicate account prevention using email and mobile number
- Dashboard with welcome message and dark mode toggle
- Teacher can view only same department/year students
- Student list page
- Student search by name
- Academic document view/download/remove for eligible students
- Document submission status page
- Add academic document title for matching department/year students

### Academic Certificate Titles

Default academic titles:

- AADHAR CARD
- INCOME CERTIFICATE
- COMMUNITY CERTIFICATE
- 10TH MARKSHEET
- 12TH MARKSHEET
- BANK PASS BOOK

Teachers can add extra academic document titles. Those titles appear in the Academic Certificate section of matching students.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Python Flask
- Database: SQLite
- File storage: Local `uploads` folder
- Template engine: Jinja2

## Project Structure

```text
student_digital_locker/
├── app.py
├── requirements.txt
├── README.md
├── LICENSE
├── .env.example
├── .gitignore
├── .gitattributes
├── run_windows.bat
├── run_mac_linux.sh
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── templates/
│   ├── base.html
│   ├── login.html
│   ├── error.html
│   ├── partials/
│   │   └── flash.html
│   ├── student/
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── dashboard.html
│   │   ├── profile.html
│   │   └── certificates.html
│   └── teacher/
│       ├── login.html
│       ├── register.html
│       ├── dashboard.html
│       ├── profile.html
│       ├── students.html
│       ├── student_detail.html
│       ├── status.html
│       └── add_title.html
├── uploads/
│   ├── documents/
│   │   └── .gitkeep
│   └── profile_photos/
│       └── .gitkeep
└── docs/
    ├── GITHUB_PUSH_STEPS.md
    └── FIREBASE_BACKEND_PROMPT.md
```

## Local Setup

### 1. Clone or extract the project

```bash
git clone https://github.com/YOUR_USERNAME/student-digital-locker.git
cd student-digital-locker
```

Or extract the ZIP and open the extracted folder in VS Code.

### 2. Create a virtual environment

```bash
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

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Create environment file

Copy `.env.example` to `.env`.

Windows:

```bash
copy .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Then change the `SECRET_KEY` value inside `.env`.

> Note: The current `app.py` reads `SECRET_KEY` from environment variables. The `.env` file is ignored by GitHub for safety.

### 5. Run the project

```bash
python app.py
```

Open this URL in your browser:

```text
http://127.0.0.1:5000
```

## Quick Run Scripts

Windows:

```bash
run_windows.bat
```

macOS/Linux:

```bash
chmod +x run_mac_linux.sh
./run_mac_linux.sh
```

## GitHub Upload Steps

Full steps are available in [`docs/GITHUB_PUSH_STEPS.md`](docs/GITHUB_PUSH_STEPS.md).

Basic commands:

```bash
git init
git add .
git commit -m "Initial commit - Student Digital Locker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/student-digital-locker.git
git push -u origin main
```

## Important GitHub Notes

Do not commit:

- `.env`
- `locker.db`
- uploaded student documents
- uploaded profile photos
- `venv` folder

These are already protected by `.gitignore`.

## Firebase Migration

The current version uses Flask + SQLite. If you want to migrate the database and file storage to Firebase, use the prompt in:

[`docs/FIREBASE_BACKEND_PROMPT.md`](docs/FIREBASE_BACKEND_PROMPT.md)

Recommended Firebase services:

- Firebase Authentication for login/register
- Cloud Firestore for student, teacher, title, and document metadata
- Firebase Storage for certificate files
- Firebase Security Rules for role-based access

## Security Notes

This is an academic/demo project. Before production use, add:

- HTTPS deployment
- Strong secret key through environment variable
- Email verification
- Password reset
- Teacher approval by admin
- File virus scanning
- Cloud storage security rules
- Audit logs for document access and deletion

## License

This project is licensed under the MIT License. See [`LICENSE`](LICENSE).
