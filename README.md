# Student Digital Locker

Student Digital Locker has a static HTML/CSS/JavaScript frontend and a Node/Express backend.

## Technology Stack

- Frontend: plain HTML, CSS, JavaScript modules
- Backend: Node.js, Express
- Database: SQLite through `better-sqlite3`
- Authentication: JWT with bcrypt password hashing
- File uploads: Multer, stored under `server/uploads`
- Frontend hosting: GitHub Pages
- Backend hosting: run separately on a Node host

GitHub Pages can host only the frontend. The backend API must run on a separate server, and the frontend defaults to:

```text
http://localhost:3000/api
```

To use a deployed backend, set this in browser console once:

```js
localStorage.setItem("sdl_api_base", "https://YOUR_BACKEND_HOST/api")
```

## Installation

```bash
npm install
copy .env.example .env
npm run dev:api
```

In another terminal:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

## Environment Variables

See `.env.example`.

- `PORT`: backend port
- `JWT_SECRET`: JWT signing secret
- `CORS_ORIGIN`: comma-separated frontend origins
- `DATABASE_PATH`: SQLite database path
- `UPLOAD_DIR`: uploaded file directory

## GitHub Pages

The workflow `.github/workflows/pages.yml` deploys the root static frontend. No secrets are required for the frontend deployment.

For the live GitHub Pages site to work with real login/uploads, deploy the backend separately and configure `sdl_api_base` to that backend URL.

## API Documentation

See `docs/API.md`.

## Database Design

See `docs/DATABASE.md`.

## Commands

```bash
npm run build
npm run dev:api
npm run check:api
git add .
git commit -m "Generate Node backend for Student Digital Locker"
git push
```
