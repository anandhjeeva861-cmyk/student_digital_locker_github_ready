# Firebase Setup

Student Digital Locker uses Firebase directly from the static GitHub Pages frontend.

## Services

- Firebase Authentication: student and teacher email/password login.
- Cloud Firestore: profiles, academic titles, document metadata, profile photo chunks, and uploaded document chunks.
- Firebase Storage: not required. The included Storage rules deny all reads and writes.
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

## Firebase Console (required manual steps)

1. Open the Firebase project `student-digi-locker-2-3293a` in Firebase Console.
2. Go to **Build > Authentication > Get started > Sign-in method**. Select **Email/Password**, enable **Email/Password** (leave Email link disabled unless deliberately needed), and click **Save**.
3. In **Authentication > Settings > Authorized domains**, click **Add domain**, enter only `anandhjeeva861-cmyk.github.io`, and save. Do not include `https://` or the repository path.
4. Go to **Build > Firestore Database** and create the database if it does not exist. Choose the region intentionally because it cannot be changed later.
5. Deploy the tracked rules and indexes from the repository with `npm run deploy:firebase` after authenticating the Firebase CLI (`npx firebase-tools login`). Alternatively, paste the complete contents of `firebase/firestore.rules` into **Firestore Database > Rules** and click **Publish**, then create the indexes described by `firebase/firestore.indexes.json`.
6. In GitHub, go to **Repository Settings > Secrets and variables > Actions**. Under **Variables** (preferred for the Firebase Web API key) or **Secrets**, create `FIREBASE_API_KEY`. Never put its value in workflow YAML or tracked files.
7. Go to **Repository Settings > Pages** and set **Source** to **GitHub Actions**, then run the **Deploy GitHub Pages** workflow.
8. Optional hardening: publish `firebase/storage.rules` only if Firebase Storage is enabled later; the current app stores file chunks in Firestore.

Authorized domain value:

```text
anandhjeeva861-cmyk.github.io
```

Only add the host name, not the repository path. For a custom domain, add that host name too.

## Previously committed keys

If secret scanning reports a Firebase API key from repository history, restricting or deleting the current file is not enough. In Google Cloud Console, restrict the browser key to the required Firebase APIs and HTTP referrers, rotate it if exposure is unacceptable, update the GitHub Actions variable/secret, and purge the old generated file from Git history with `git filter-repo --path js/firebase-config.js --invert-paths`. History rewriting changes commit IDs and requires coordinating a force-push with every collaborator; do it deliberately, then revoke the old key.

## Deploy Firebase Rules

After changing rules locally, deploy them with:

```bash
npm run deploy:firebase
```

This uses `.firebaserc`, `firebase.json`, `firebase/firestore.rules`, and `firebase/firestore.indexes.json`.

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
- `profiles/{uid}/photoChunks`: profile photo base64 chunks stored in Firestore.
- `documents`: uploaded certificate metadata.
- `documents/{documentId}/fileChunks`: uploaded certificate base64 chunks stored in Firestore.
- `academicTitles`: teacher-added academic certificate requirements per department/year.
- `uniqueMobileNumbers`: mobile uniqueness guard.
- `uniqueRegisterNumbers`: student register number uniqueness guard.

## Uploaded File Data

Uploaded binary files are base64 encoded and split into Firestore chunks. Firestore `documents/{documentId}` stores metadata:

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
- `fileDataVersion`
- `chunkCount`
- `fileType`
- `mimeType`
- `size`
- `description`
- `accessLevel`
- `status`
- `uploadedAt`, `createdAt`, `updatedAt`

New uploads use `storageProvider: "firestore"`, a non-empty `fileDataVersion`, and a positive `chunkCount`. If metadata saving fails, the frontend deletes the just-written Firestore chunks before showing the error.
