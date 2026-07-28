# API Documentation

Base URL:

```text
http://localhost:3000/api
```

## Health

`GET /health`

- Purpose: backend health check
- Auth: none
- Response: `{ "ok": true }`

## Register Student

`POST /auth/register/student`

- Auth: none
- Request: `name`, `regNo`, `email`, `year`, `department`, `mobile`, `password`
- Response: `{ "token": "...", "profile": {...} }`

## Register Teacher

`POST /auth/register/teacher`

- Auth: none
- Request: `name`, `email`, `year`, `department`, `mobile`, `password`
- Response: `{ "token": "...", "profile": {...} }`

## Login

`POST /auth/login`

- Auth: none
- Request: `email`, `password`
- Response: `{ "token": "...", "profile": {...} }`

## Current Profile

`GET /auth/me`

- Auth: Bearer token
- Response: `{ "profile": {...} }`

## Student Profile

`GET /student/profile`

- Auth: student
- Response: `{ "profile": {...} }`

## Upload Student Photo

`POST /student/profile/photo`

- Auth: student
- Form data: `photo`
- Response: `{ "profile": {...} }`

## Student Documents

`GET /student/documents?category=online|personal|academic`

- Auth: student
- Response: `{ "documents": [...] }`

`POST /student/documents/:category`

- Auth: student
- Form data: `title`, `document`
- Response: `{ "document": {...} }`

`DELETE /student/documents/:id`

- Auth: student owner
- Response: `{ "ok": true }`

## Student Academic Titles

`GET /student/academic-titles`

- Auth: student
- Response: `{ "titles": [...] }`

## Teacher Students

`GET /teacher/students?q=SEARCH`

- Auth: teacher
- Scope: same department and year
- Response: `{ "students": [...] }`

`GET /teacher/students/:id`

- Auth: teacher
- Scope: same department and year
- Response: `{ "student": {...}, "documents": [...] }`

## Teacher Academic Documents

`GET /teacher/academic-documents`

- Auth: teacher
- Scope: academic documents only, same department and year
- Response: `{ "documents": [...] }`

`DELETE /teacher/academic-documents/:id`

- Auth: teacher
- Scope: academic documents only, same department and year
- Response: `{ "ok": true }`

## Teacher Academic Titles

`GET /teacher/academic-titles`

- Auth: teacher
- Response: `{ "titles": [...], "customTitles": [...] }`

`POST /teacher/academic-titles`

- Auth: teacher
- Request: `title`
- Response: `{ "title": {...} }`

## Submission Status

`GET /teacher/status`

- Auth: teacher
- Response: `{ "status": [{ "title": "...", "uploaded": [...], "pending": [...] }] }`

## Files

`GET /files/:filePath`

- Auth: Bearer token
- Purpose: view/download authorized uploaded files
