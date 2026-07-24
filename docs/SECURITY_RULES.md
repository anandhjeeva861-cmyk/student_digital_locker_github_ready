# Security Rules

Use:

- `firestore.rules`
- `storage.rules`

Firestore rules enforce:

- signed-in users only
- students can read/update only their own profile
- students can update only `photoURL` and `photoStoragePath`
- teachers can read only same department/year student profiles
- teachers can access only same department/year academic document metadata
- teachers cannot access online or personal certificate metadata
- teachers can add academic titles only for their own department/year

Storage rules enforce:

- student profile photos stay under `profilePhotos/{uid}/{fileName}`
- online files stay under `documents/{uid}/online/{fileName}`
- personal files stay under `documents/{uid}/personal/{fileName}`
- academic files stay under `documents/{uid}/academic/{fileName}`
- students can access their own files
- teachers can access only academic files for same department/year students

Frontend checks are helpful, but they are not security. Firebase Authentication, Firestore Rules, Storage Rules, and App Check are required for real protection.
