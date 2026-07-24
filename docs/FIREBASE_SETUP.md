# Firebase Setup

1. Open Firebase Console and create a project.
2. Add a Web App.
3. Enable Authentication > Sign-in method > Email/Password.
4. Create Cloud Firestore in production mode.
5. Enable Firebase Storage in production mode.
6. Copy the Firebase web config object from Project Settings.
7. Copy `js/firebase-config.example.js` to `js/firebase-config.js`.
8. Paste your real Firebase values into `js/firebase-config.js`.
9. Do not push `js/firebase-config.js` to GitHub.
10. Publish `firestore.rules` in Firestore Rules.
11. Publish `storage.rules` in Storage Rules.
12. Enable App Check before real production use.

Normal HTML browser projects cannot directly read `.env`. The `.env.example` file is included only for future Vite/bundler conversion.

Use this import in browser modules:

```js
import { auth, db, storage } from "./firebase-config.js";
```

Firebase web config is visible in browser JavaScript. It is not a private password, but it identifies your project, so this repo keeps the real local config ignored.
