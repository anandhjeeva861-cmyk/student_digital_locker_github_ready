import os
import re
import sqlite3
from datetime import datetime
from functools import wraps
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    flash,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE = BASE_DIR / "locker.db"
UPLOAD_ROOT = BASE_DIR / "uploads"
DOCUMENT_UPLOADS = UPLOAD_ROOT / "documents"
PHOTO_UPLOADS = UPLOAD_ROOT / "profile_photos"

ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "webp", "doc", "docx"}
ALLOWED_PHOTO_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
DEFAULT_ACADEMIC_TITLES = [
    "AADHAR CARD",
    "INCOME CERTIFICATE",
    "COMMUNITY CERTIFICATE",
    "10TH MARKSHEET",
    "12TH MARKSHEET",
    "BANK PASS BOOK",
]

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "student-digital-locker-dev-key")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
STATIC_FRONTEND_MODE = os.environ.get("STATIC_FRONTEND", "1") == "1"

DOCUMENT_UPLOADS.mkdir(parents=True, exist_ok=True)
PHOTO_UPLOADS.mkdir(parents=True, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def normalize_department(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().upper())


def department_key(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.strip().upper())


def normalize_year(value: str) -> str:
    return value.strip().upper()


def normalize_title(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().upper())


def allowed_file(filename: str, allowed_extensions: set[str]) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions


def unique_filename(original_filename: str) -> str:
    safe = secure_filename(original_filename)
    ext = safe.rsplit(".", 1)[1].lower() if "." in safe else "bin"
    return f"{uuid4().hex}.{ext}"


def init_db():
    with get_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                regno TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                year TEXT NOT NULL,
                department TEXT NOT NULL,
                department_key TEXT NOT NULL,
                mobile TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                photo_filename TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS teachers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                year TEXT NOT NULL,
                department TEXT NOT NULL,
                department_key TEXT NOT NULL,
                mobile TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS doc_titles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                department TEXT,
                department_key TEXT,
                year TEXT,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_by_teacher_id INTEGER,
                created_at TEXT NOT NULL,
                UNIQUE(title, department_key, year)
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                category TEXT NOT NULL CHECK(category IN ('online','personal','academic')),
                title TEXT NOT NULL,
                title_id INTEGER,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL UNIQUE,
                uploaded_at TEXT NOT NULL,
                uploaded_by_role TEXT NOT NULL,
                FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
                FOREIGN KEY(title_id) REFERENCES doc_titles(id) ON DELETE SET NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS uq_student_academic_title
            ON documents(student_id, title_id, category)
            WHERE category = 'academic' AND title_id IS NOT NULL;
            """
        )
        for title in DEFAULT_ACADEMIC_TITLES:
            db.execute(
                """
                INSERT OR IGNORE INTO doc_titles
                (title, department, department_key, year, is_default, created_at)
                VALUES (?, NULL, NULL, NULL, 1, ?)
                """,
                (title, datetime.now().isoformat(timespec="seconds")),
            )
        db.commit()


@app.before_request
def ensure_database():
    if not DATABASE.exists():
        init_db()


def login_required(role: str):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            if session.get("role") != role or not session.get("user_id"):
                if STATIC_FRONTEND_MODE:
                    session["role"] = role
                    session["user_id"] = 0
                    return view_func(*args, **kwargs)
                flash("Please login first.", "warning")
                return redirect(url_for(f"{role}_login"))
            return view_func(*args, **kwargs)

        return wrapper

    return decorator


def current_student():
    if session.get("role") != "student":
        return None
    if STATIC_FRONTEND_MODE and session.get("user_id") == 0:
        return {
            "id": 0,
            "name": "STUDENT",
            "regno": "",
            "email": "",
            "year": "",
            "department": "",
            "department_key": "",
            "mobile": "",
            "photo_filename": None,
        }
    with get_db() as db:
        return db.execute("SELECT * FROM students WHERE id = ?", (session["user_id"],)).fetchone()


def current_teacher():
    if session.get("role") != "teacher":
        return None
    if STATIC_FRONTEND_MODE and session.get("user_id") == 0:
        return {
            "id": 0,
            "name": "TEACHER",
            "email": "",
            "year": "",
            "department": "",
            "department_key": "",
            "mobile": "",
        }
    with get_db() as db:
        return db.execute("SELECT * FROM teachers WHERE id = ?", (session["user_id"],)).fetchone()


def get_academic_titles_for_student(student):
    with get_db() as db:
        return db.execute(
            """
            SELECT * FROM doc_titles
            WHERE is_default = 1
               OR (department_key = ? AND year = ?)
            ORDER BY is_default DESC, title ASC
            """,
            (student["department_key"], student["year"]),
        ).fetchall()


def get_unuploaded_academic_titles(student):
    with get_db() as db:
        return db.execute(
            """
            SELECT dt.*
            FROM doc_titles dt
            WHERE (dt.is_default = 1 OR (dt.department_key = ? AND dt.year = ?))
              AND dt.id NOT IN (
                SELECT title_id FROM documents
                WHERE student_id = ? AND category = 'academic' AND title_id IS NOT NULL
              )
            ORDER BY dt.is_default DESC, dt.title ASC
            """,
            (student["department_key"], student["year"], student["id"]),
        ).fetchall()


def get_document_or_404(doc_id: int):
    with get_db() as db:
        document = db.execute(
            """
            SELECT d.*, s.name AS student_name, s.regno, s.department_key, s.department, s.year
            FROM documents d
            JOIN students s ON s.id = d.student_id
            WHERE d.id = ?
            """,
            (doc_id,),
        ).fetchone()
    if not document:
        abort(404)
    return document


def can_access_document(document) -> bool:
    role = session.get("role")
    user_id = session.get("user_id")
    if role == "student":
        return document["student_id"] == user_id
    if role == "teacher":
        teacher = current_teacher()
        return (
            document["category"] == "academic"
            and teacher
            and teacher["department_key"] == document["department_key"]
            and teacher["year"] == document["year"]
        )
    return False


@app.route("/")
def index():
    return redirect(url_for("login"))


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/student/register", methods=["GET", "POST"])
def student_register():
    if request.method == "POST":
        name = request.form.get("name", "").strip().upper()
        regno = request.form.get("regno", "").strip().upper()
        email = request.form.get("email", "").strip().lower()
        year = normalize_year(request.form.get("year", ""))
        department = normalize_department(request.form.get("department", ""))
        mobile = request.form.get("mobile", "").strip()
        password = request.form.get("password", "")

        if not re.fullmatch(r"[A-Z ]{2,60}", name):
            flash("Name must be uppercase letters only.", "danger")
        elif not re.fullmatch(r"\d{2}[A-Z]{3}\d{3}", regno):
            flash("Register number format should be like 25BSC003.", "danger")
        elif not re.fullmatch(r"[6-9]\d{9}", mobile):
            flash("Mobile number must be a valid 10 digit Indian number.", "danger")
        elif len(password) < 6:
            flash("Password must contain at least 6 characters.", "danger")
        else:
            try:
                with get_db() as db:
                    db.execute(
                        """
                        INSERT INTO students
                        (name, regno, email, year, department, department_key, mobile, password_hash, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            name,
                            regno,
                            email,
                            year,
                            department,
                            department_key(department),
                            mobile,
                            generate_password_hash(password),
                            datetime.now().isoformat(timespec="seconds"),
                        ),
                    )
                    db.commit()
                flash("Student account created. Please login.", "success")
                return redirect(url_for("student_login"))
            except sqlite3.IntegrityError:
                flash("Account already exists with this email, register number, or mobile number.", "danger")

    return render_template("student/register.html")


@app.route("/student/login", methods=["GET", "POST"])
def student_login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        with get_db() as db:
            student = db.execute("SELECT * FROM students WHERE email = ?", (email,)).fetchone()
        if student and check_password_hash(student["password_hash"], password):
            session.clear()
            session["role"] = "student"
            session["user_id"] = student["id"]
            flash("Login successful.", "success")
            return redirect(url_for("student_dashboard"))
        flash("Invalid student email or password.", "danger")
    return render_template("student/login.html")


@app.route("/student/dashboard")
@login_required("student")
def student_dashboard():
    student = current_student()
    with get_db() as db:
        counts = {
            "online": db.execute("SELECT COUNT(*) AS c FROM documents WHERE student_id=? AND category='online'", (student["id"],)).fetchone()["c"],
            "personal": db.execute("SELECT COUNT(*) AS c FROM documents WHERE student_id=? AND category='personal'", (student["id"],)).fetchone()["c"],
            "academic": db.execute("SELECT COUNT(*) AS c FROM documents WHERE student_id=? AND category='academic'", (student["id"],)).fetchone()["c"],
        }
    return render_template("student/dashboard.html", student=student, counts=counts)


@app.route("/student/profile", methods=["GET", "POST"])
@login_required("student")
def student_profile():
    student = current_student()
    if request.method == "POST":
        photo = request.files.get("photo")
        if not photo or not photo.filename:
            flash("Choose a profile photo.", "warning")
        elif not allowed_file(photo.filename, ALLOWED_PHOTO_EXTENSIONS):
            flash("Only PNG, JPG, JPEG, or WEBP photos are allowed.", "danger")
        else:
            filename = unique_filename(photo.filename)
            photo.save(PHOTO_UPLOADS / filename)
            if student["photo_filename"]:
                old_photo = PHOTO_UPLOADS / student["photo_filename"]
                if old_photo.exists():
                    old_photo.unlink()
            with get_db() as db:
                db.execute("UPDATE students SET photo_filename=? WHERE id=?", (filename, student["id"]))
                db.commit()
            flash("Profile photo updated.", "success")
            return redirect(url_for("student_profile"))
    student = current_student()
    return render_template("student/profile.html", student=student)


@app.route("/student/certificates/<category>", methods=["GET", "POST"])
@login_required("student")
def student_certificates(category):
    if category not in {"online", "personal", "academic"}:
        abort(404)
    student = current_student()

    if request.method == "POST":
        file = request.files.get("document")
        if not file or not file.filename:
            flash("Choose a document file.", "warning")
            return redirect(url_for("student_certificates", category=category))
        if not allowed_file(file.filename, ALLOWED_DOCUMENT_EXTENSIONS):
            flash("Allowed files: PDF, image, DOC, or DOCX.", "danger")
            return redirect(url_for("student_certificates", category=category))

        if category == "academic":
            title_id = request.form.get("title_id", type=int)
            with get_db() as db:
                title_row = db.execute(
                    """
                    SELECT * FROM doc_titles
                    WHERE id = ? AND (is_default = 1 OR (department_key = ? AND year = ?))
                    """,
                    (title_id, student["department_key"], student["year"]),
                ).fetchone()
            if not title_row:
                flash("Select a valid academic certificate title.", "danger")
                return redirect(url_for("student_certificates", category=category))
            title = title_row["title"]
        else:
            title_id = None
            title = normalize_title(request.form.get("title", ""))
            if len(title) < 2:
                flash("Enter document title.", "danger")
                return redirect(url_for("student_certificates", category=category))

        stored_filename = unique_filename(file.filename)
        file.save(DOCUMENT_UPLOADS / stored_filename)
        try:
            with get_db() as db:
                db.execute(
                    """
                    INSERT INTO documents
                    (student_id, category, title, title_id, original_filename, stored_filename, uploaded_at, uploaded_by_role)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        student["id"],
                        category,
                        title,
                        title_id,
                        secure_filename(file.filename),
                        stored_filename,
                        datetime.now().isoformat(timespec="seconds"),
                        "student",
                    ),
                )
                db.commit()
            flash("Document uploaded successfully.", "success")
        except sqlite3.IntegrityError:
            upload_path = DOCUMENT_UPLOADS / stored_filename
            if upload_path.exists():
                upload_path.unlink()
            flash("This academic certificate is already uploaded.", "warning")
        return redirect(url_for("student_certificates", category=category))

    with get_db() as db:
        documents = db.execute(
            """
            SELECT * FROM documents
            WHERE student_id = ? AND category = ?
            ORDER BY uploaded_at DESC
            """,
            (student["id"], category),
        ).fetchall()
    available_titles = get_unuploaded_academic_titles(student) if category == "academic" else []
    all_titles = get_academic_titles_for_student(student) if category == "academic" else []
    return render_template(
        "student/certificates.html",
        student=student,
        category=category,
        documents=documents,
        available_titles=available_titles,
        all_titles=all_titles,
    )


@app.route("/teacher/register", methods=["GET", "POST"])
def teacher_register():
    if request.method == "POST":
        name = request.form.get("name", "").strip().upper()
        email = request.form.get("email", "").strip().lower()
        year = normalize_year(request.form.get("year", ""))
        department = normalize_department(request.form.get("department", ""))
        mobile = request.form.get("mobile", "").strip()
        password = request.form.get("password", "")

        if not re.fullmatch(r"[A-Z ]{2,60}", name):
            flash("Name must be uppercase letters only.", "danger")
        elif not re.fullmatch(r"[6-9]\d{9}", mobile):
            flash("Mobile number must be a valid 10 digit Indian number.", "danger")
        elif len(password) < 6:
            flash("Password must contain at least 6 characters.", "danger")
        else:
            try:
                with get_db() as db:
                    db.execute(
                        """
                        INSERT INTO teachers
                        (name, email, year, department, department_key, mobile, password_hash, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            name,
                            email,
                            year,
                            department,
                            department_key(department),
                            mobile,
                            generate_password_hash(password),
                            datetime.now().isoformat(timespec="seconds"),
                        ),
                    )
                    db.commit()
                flash("Teacher account created. Please login.", "success")
                return redirect(url_for("teacher_login"))
            except sqlite3.IntegrityError:
                flash("Account already exists with this email or mobile number.", "danger")

    return render_template("teacher/register.html")


@app.route("/teacher/login", methods=["GET", "POST"])
def teacher_login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        with get_db() as db:
            teacher = db.execute("SELECT * FROM teachers WHERE email = ?", (email,)).fetchone()
        if teacher and check_password_hash(teacher["password_hash"], password):
            session.clear()
            session["role"] = "teacher"
            session["user_id"] = teacher["id"]
            flash("Login successful.", "success")
            return redirect(url_for("teacher_dashboard"))
        flash("Invalid teacher email or password.", "danger")
    return render_template("teacher/login.html")


@app.route("/teacher/dashboard")
@login_required("teacher")
def teacher_dashboard():
    teacher = current_teacher()
    with get_db() as db:
        student_count = db.execute(
            "SELECT COUNT(*) AS c FROM students WHERE department_key=? AND year=?",
            (teacher["department_key"], teacher["year"]),
        ).fetchone()["c"]
        academic_count = db.execute(
            """
            SELECT COUNT(d.id) AS c
            FROM documents d
            JOIN students s ON s.id = d.student_id
            WHERE d.category='academic' AND s.department_key=? AND s.year=?
            """,
            (teacher["department_key"], teacher["year"]),
        ).fetchone()["c"]
        title_count = db.execute(
            """
            SELECT COUNT(*) AS c FROM doc_titles
            WHERE is_default=1 OR (department_key=? AND year=?)
            """,
            (teacher["department_key"], teacher["year"]),
        ).fetchone()["c"]
    return render_template("teacher/dashboard.html", teacher=teacher, student_count=student_count, academic_count=academic_count, title_count=title_count)


@app.route("/teacher/profile")
@login_required("teacher")
def teacher_profile():
    return render_template("teacher/profile.html", teacher=current_teacher())


@app.route("/teacher/students")
@login_required("teacher")
def teacher_students():
    teacher = current_teacher()
    with get_db() as db:
        students = db.execute(
            """
            SELECT s.*,
                   (SELECT COUNT(*) FROM documents d WHERE d.student_id=s.id AND d.category='academic') AS academic_count
            FROM students s
            WHERE s.department_key=? AND s.year=?
            ORDER BY s.name ASC
            """,
            (teacher["department_key"], teacher["year"]),
        ).fetchall()
    return render_template("teacher/students.html", teacher=teacher, students=students, query=None)


@app.route("/teacher/search")
@login_required("teacher")
def teacher_search():
    teacher = current_teacher()
    query = request.args.get("q", "").strip()
    like = f"%{query.upper()}%"
    with get_db() as db:
        students = db.execute(
            """
            SELECT s.*,
                   (SELECT COUNT(*) FROM documents d WHERE d.student_id=s.id AND d.category='academic') AS academic_count
            FROM students s
            WHERE s.department_key=? AND s.year=? AND (s.name LIKE ? OR s.regno LIKE ?)
            ORDER BY s.name ASC
            """,
            (teacher["department_key"], teacher["year"], like, like),
        ).fetchall()
    return render_template("teacher/students.html", teacher=teacher, students=students, query=query)


@app.route("/teacher/student/<int:student_id>")
@login_required("teacher")
def teacher_student_detail(student_id):
    teacher = current_teacher()
    with get_db() as db:
        student = db.execute(
            "SELECT * FROM students WHERE id=? AND department_key=? AND year=?",
            (student_id, teacher["department_key"], teacher["year"]),
        ).fetchone()
        if not student:
            abort(403)
        documents = db.execute(
            """
            SELECT * FROM documents
            WHERE student_id=? AND category='academic'
            ORDER BY title ASC
            """,
            (student["id"],),
        ).fetchall()
    titles = get_academic_titles_for_student(student)
    uploaded_titles = {doc["title_id"] for doc in documents if doc["title_id"]}
    pending_titles = [title for title in titles if title["id"] not in uploaded_titles]
    return render_template("teacher/student_detail.html", teacher=teacher, student=student, documents=documents, pending_titles=pending_titles)


@app.route("/teacher/status")
@login_required("teacher")
def teacher_status():
    teacher = current_teacher()
    with get_db() as db:
        students = db.execute(
            "SELECT * FROM students WHERE department_key=? AND year=? ORDER BY name ASC",
            (teacher["department_key"], teacher["year"]),
        ).fetchall()
        titles = db.execute(
            """
            SELECT * FROM doc_titles
            WHERE is_default=1 OR (department_key=? AND year=?)
            ORDER BY is_default DESC, title ASC
            """,
            (teacher["department_key"], teacher["year"]),
        ).fetchall()
        docs = db.execute(
            """
            SELECT d.student_id, d.title_id
            FROM documents d
            JOIN students s ON s.id = d.student_id
            WHERE d.category='academic' AND s.department_key=? AND s.year=?
            """,
            (teacher["department_key"], teacher["year"]),
        ).fetchall()

    uploaded_pairs = {(doc["student_id"], doc["title_id"]) for doc in docs}
    status_rows = []
    for title in titles:
        uploaded = [s for s in students if (s["id"], title["id"]) in uploaded_pairs]
        pending = [s for s in students if (s["id"], title["id"]) not in uploaded_pairs]
        status_rows.append({"title": title["title"], "uploaded": uploaded, "pending": pending})
    return render_template("teacher/status.html", teacher=teacher, status_rows=status_rows)


@app.route("/teacher/add-title", methods=["GET", "POST"])
@login_required("teacher")
def teacher_add_title():
    teacher = current_teacher()
    if request.method == "POST":
        title = normalize_title(request.form.get("title", ""))
        if len(title) < 2:
            flash("Enter a valid document title.", "danger")
        else:
            try:
                with get_db() as db:
                    db.execute(
                        """
                        INSERT INTO doc_titles
                        (title, department, department_key, year, is_default, created_by_teacher_id, created_at)
                        VALUES (?, ?, ?, ?, 0, ?, ?)
                        """,
                        (
                            title,
                            teacher["department"],
                            teacher["department_key"],
                            teacher["year"],
                            teacher["id"],
                            datetime.now().isoformat(timespec="seconds"),
                        ),
                    )
                    db.commit()
                flash("Academic certificate title added to student portal.", "success")
                return redirect(url_for("teacher_add_title"))
            except sqlite3.IntegrityError:
                flash("This title already exists for your department and year.", "warning")

    with get_db() as db:
        custom_titles = db.execute(
            """
            SELECT * FROM doc_titles
            WHERE department_key=? AND year=? AND is_default=0
            ORDER BY created_at DESC
            """,
            (teacher["department_key"], teacher["year"]),
        ).fetchall()
    return render_template("teacher/add_title.html", teacher=teacher, custom_titles=custom_titles)


@app.route("/document/<int:doc_id>/view")
def view_document(doc_id):
    document = get_document_or_404(doc_id)
    if not can_access_document(document):
        abort(403)
    return send_from_directory(DOCUMENT_UPLOADS, document["stored_filename"], as_attachment=False, download_name=document["original_filename"])


@app.route("/document/<int:doc_id>/download")
def download_document(doc_id):
    document = get_document_or_404(doc_id)
    if not can_access_document(document):
        abort(403)
    return send_from_directory(DOCUMENT_UPLOADS, document["stored_filename"], as_attachment=True, download_name=document["original_filename"])


@app.route("/document/<int:doc_id>/remove", methods=["POST"])
def remove_document(doc_id):
    document = get_document_or_404(doc_id)
    if not can_access_document(document):
        abort(403)
    file_path = DOCUMENT_UPLOADS / document["stored_filename"]
    if file_path.exists():
        file_path.unlink()
    with get_db() as db:
        db.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        db.commit()
    flash("Document removed.", "success")
    if session.get("role") == "teacher":
        return redirect(request.referrer or url_for("teacher_students"))
    return redirect(request.referrer or url_for("student_dashboard"))


@app.route("/uploads/profile_photos/<filename>")
@login_required("student")
def profile_photo(filename):
    student = current_student()
    if not student or student["photo_filename"] != filename:
        abort(403)
    return send_from_directory(PHOTO_UPLOADS, filename)


@app.route("/logout")
def logout():
    session.clear()
    flash("Logged out successfully.", "info")
    return redirect(url_for("login"))


@app.errorhandler(403)
def forbidden(_error):
    return render_template("error.html", code=403, message="Access denied."), 403


@app.errorhandler(404)
def not_found(_error):
    return render_template("error.html", code=404, message="Page not found."), 404


if __name__ == "__main__":
    init_db()
    debug_mode = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(debug=debug_mode)
