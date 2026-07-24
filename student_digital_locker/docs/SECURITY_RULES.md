# Security Rules

The Firebase rules live at:

- `firestore.rules`
- `storage.rules`

## Firestore Rules Protect

- Only signed-in users can access protected collections.
- Students can read their own profile.
- Students can update only `photoURL` and `photoStoragePath`.
- Students cannot edit name, register number, department, year, email, or mobile after registration.
- Teachers can read only student profiles from the same department and year.
- Students can create, read, and delete their own online, personal, and academic document metadata.
- Teachers can access only academic document metadata for same department and year students.
- Teachers cannot access online or personal certificate metadata.
- Teachers can add academic titles only for their own department and year.

## Storage Rules Protect

- Profile photos are stored at `profilePhotos/{uid}/{fileName}`.
- Certificate files are stored at:
  - `documents/{uid}/online/{fileName}`
  - `documents/{uid}/personal/{fileName}`
  - `documents/{uid}/academic/{fileName}`
- Students can access their own files.
- Teachers can access only academic files of matching department and year students.
- Teachers cannot access online or personal certificate files.

## Required Production Security

Firebase web config is visible to browsers. It is not a private password. Real protection must come from:

- Firebase Authentication
- Firestore Security Rules
- Firebase Storage Rules
- Firebase App Check
- careful validation in frontend/backend logic
