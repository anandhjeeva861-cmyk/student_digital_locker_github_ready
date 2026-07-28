# Frontend-Only Mode

The active GitHub Pages app is now frontend-only.

Removed:

- Backend API calls
- Database SQL files
- Auth provider configuration
- Storage provider configuration
- Repository secrets requirement

Browser behavior:

- Student and teacher accounts are stored in `localStorage`.
- Certificate uploads are stored as browser data URLs.
- Teacher views read from the same browser storage.
- Data is local to one browser and is not a real secure backend.
