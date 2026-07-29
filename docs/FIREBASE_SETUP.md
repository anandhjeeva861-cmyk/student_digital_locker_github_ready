# Firebase Setup

Student Digital Locker uses Firebase directly from the static GitHub Pages frontend.

## Services

- Firebase Authentication: student and teacher email/password login.
- Cloud Firestore: profiles, academic titles, and document metadata.
- Firebase Storage: uploaded profile photos and certificate files.
- Analytics: initialized only when the browser supports it.

## Local Setup

```bash
npm install
npm run config:firebase
npm run build
npm run dev
```

Open:

```text
http://localhost:5173
```

`.env.local` and `.env.production` are ignored by Git. Keep only Firebase Web SDK values there. Do not add Admin SDK service account files.

## GitHub Pages Config

GitHub Pages must use the GitHub Actions workflow in this repository. The workflow generates `js/firebase-config.js` during deployment and deploys it inside the clean `dist/` artifact. The generated config file is ignored by Git and must not be committed.

Local `.env.local` can override the public config with individual values:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

The GitHub Actions workflow requires the API key from an Actions repository variable or secret named `FIREBASE_API_KEY`. Without that value, config generation fails instead of deploying a broken or placeholder config.

## Firebase Console

1. Enable Authentication -> Sign-in method -> Email/Password.
2. Create Firestore Database.
3. Create Firebase Storage.
4. Publish `firebase/firestore.rules` in Firestore Rules.
5. Publish `firebase/storage.rules` in Storage Rules.
6. Import or create indexes from `firebase/firestore.indexes.json`.
7. Add authorized domain for GitHub Pages:

```text
anandhjeeva861-cmyk.github.io
```

Only add the host name, not the repository path. For a custom domain, add that host name too.

## Allowed Academic Values

Departments:

```text
BSC CS
BSC AI&ML
BSC IT
CSDA
BCOM
BCOM CA
BCOM PA
CS&HM
BCOM IT
MBA
BBA
```

Years:

```text
I
II
III
```

These values are shared from `js/options.js` in the frontend and enforced in `firebase/firestore.rules`.

## Firestore Collections

- `profiles`: student and teacher profile records keyed by Firebase Auth UID.
- `documents`: uploaded certificate metadata.
- `academicTitles`: teacher-added academic certificate requirements per department/year.
- `uniqueMobileNumbers`: mobile uniqueness guard.
- `uniqueRegisterNumbers`: student register number uniqueness guard.

## Storage Paths

- `profilePhotos/{uid}/{fileName}`: profile photos readable and removable only by that signed-in user.
- `documents/{uid}/{category}/{documentId}/{fileName}`: certificate files uploaded by the owning student.

Teachers can read or remove only `academic` Storage objects when their department and year match the document metadata. Online and personal certificates stay private to the student.

## Document Metadata

Firestore `documents/{documentId}` stores metadata only:

- `id`
- `ownerId`, `userId`, `uploadedUserId`
- `uploadedUserEmail`
- `ownerName`, `ownerRegNo`
- `department`, `departmentKey`, `year`
- `category`
- `title`
- `originalName`
- `fileName`
- `storageProvider`
- `storagePath`
- `fileDataVersion`
- `chunkCount`
- `fileType`
- `mimeType`
- `size`
- `description`
- `accessLevel`
- `status`
- `uploadedAt`, `createdAt`, `updatedAt`

New uploads use `storageProvider: "firebase-storage"`, a non-empty `storagePath`, `fileDataVersion: ""`, and `chunkCount: 0`. If metadata saving fails, the frontend deletes the just-uploaded Storage object before showing the error.
