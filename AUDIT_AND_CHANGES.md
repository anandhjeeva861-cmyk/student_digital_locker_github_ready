# Student Digital Locker Audit and Changes

## Alumni and Batch Management Extension (September 2026)

The application now supports the `alumni` lifecycle role without creating a second authentication account or changing document ownership. An assigned teacher can create explicit department batches, manually associate exact department/year matches, view Current and Previous batches, convert an eligible student, or atomically graduate an eligible batch of up to 200 active students. Conversion updates the existing `profiles/{uid}` document, creates immutable conversion audit records, and leaves all `documents.ownerId` values unchanged.

The Alumni portal adds role-aware login, protected dashboard access, the existing three document categories, career profile editing, read-only institutional fields with safe contact-link updates, and simple achievements. Teachers can view career details only for Alumni in their assigned batches. Firestore rules compile successfully and enforce assigned-teacher batch access, graduation-year eligibility, protected profile fields, owner-only private documents, and immutable audit collections. Existing records without `batchId` are never guessed; they require explicit assignment, while legacy department/year access remains available only until an explicit matching batch controls that cohort.

## Scope

The repository was reviewed as a plain HTML, CSS, and JavaScript application using Firebase Authentication, Cloud Firestore profiles/metadata, and Firestore subcollections for chunked file content. The active deployment workflow targets GitHub Pages and builds a static `dist` artifact.

The audit covered the student and teacher dashboards, the complete student profile/photo flow, authentication redirects and route guards, navigation, document upload/retrieval/deletion, malformed legacy data handling, responsive behavior, accessibility, SEO, performance, error handling, code quality, and deployment validation.

## Root Cause of the Large Student Profile Initial

The profile page contains one intended photo element (`#studentPhoto`) and one intended fallback initial (`#studentAvatar`); there was no duplicated profile component or duplicated avatar in the HTML. JavaScript correctly applied the `hidden` attribute to the fallback after selecting a profile image, but `.avatar-placeholder { display: grid; }` in `css/style.css` overrode the browser's built-in `[hidden] { display: none; }` rule. The fallback therefore remained visible as a full-width square below the real image, which produced the large extra initial such as `A`.

This was a CSS cascade bug in the visibility contract between the profile renderer and its fallback element, not a localStorage, sessionStorage, Firestore persistence, or duplicate-DOM problem.

## Root Cause of the Student Login Popup

The message `Stored file data is incomplete. Upload the file again.` originates in `buildObjectUrl()` in `js/firebase-service.js`. That function reconstructs a stored file or profile photo from Firestore chunks and correctly throws when chunk data is incomplete.

The student dashboard used to call `refreshProfilePhoto()` automatically during protected-page initialization. A legacy student profile could contain `photoFileDataVersion` and `photoChunkCount` metadata while the referenced `photoChunks` were absent or incomplete. As a result, optional profile-photo reconstruction ran during login and its document-oriented error was displayed even though the student had not requested a file operation.

## Fixes Completed

### Student dashboard and navigation

- Reused the existing student dashboard section; no duplicate page or route was created.
- Added one `DASHBOARD` button to the student sidebar.
- Kept the dashboard as the successful login/registration destination.
- Added active menu state with `aria-current="page"`.
- Added hash-backed view state and browser Back/Forward handling.
- Kept the existing responsive overlay menu and made sidebar navigation close it after selection.
- Added a Recent Documents table using the authenticated student's real Firestore metadata. No sample student data was added.
- Consolidated the initial student document count/recent-list load from three category queries into one owner query.

### Student popup and profile photo

- Removed profile-photo chunk retrieval from student login/dashboard initialization.
- Profile photos stored in Firestore are now retrieved only when the Profile view is opened or after a photo upload.
- Changed the fallback rule to `.avatar-placeholder:not([hidden])`, so its grid layout applies only while the renderer intentionally exposes it. No `display: none`, `visibility`, `opacity`, or `!important` concealment was added.
- Kept the fallback initial available in the single correct profile-image position when no usable photo exists.
- Preloaded reconstructed profile images before switching from the fallback, so a corrupt or undecodable image cannot leave a broken image element visible.
- Added a request sequence guard so a slower, stale photo request cannot overwrite a newer upload or view state.
- Extended the request guard through Firebase retrieval and image-decode failure paths, so an older failed request cannot restore the fallback after a newer photo has already rendered.
- After a successful upload, the saved photo is retrieved and rendered immediately; the same Firestore metadata/chunks are used after refresh or re-login when the Profile view is opened.
- Missing legacy photo chunks fall back to the existing avatar and show a profile-photo-specific warning only in the relevant Profile view.
- Blob URLs created for profile photos are revoked when replaced or when the page is left.
- Added an accessible label to the fallback avatar and capped both photo/fallback width on narrow layouts to prevent an oversized profile block.
- Document chunk validation remains active on explicit View/Download operations.

### Teacher dashboard and navigation

- Reused the existing teacher dashboard section; no duplicate page or route was created.
- Added one `DASHBOARD` button to the teacher sidebar.
- Kept the dashboard as the successful login/registration destination.
- Added the same active state, hash navigation, Back/Forward behavior, and responsive menu handling as the student portal.
- Marked the student-detail section as transient so reloading a stale `#student-detail` hash returns to the populated dashboard instead of exposing an empty detail view without a selected student.
- Deferred student tables, submission status, and title-management queries until those views are opened.
- Added a consolidated dashboard-summary service to avoid duplicate document queries for the dashboard counts.
- Connected the existing teacher academic-document delete service to a visible Remove action in student detail, with scope checks and confirmation.

### Authentication audit

- Student and teacher login continue to verify the role stored in the authenticated Firestore profile.
- A role mismatch signs the Firebase user out and rejects entry.
- Both protected dashboards continue to require the expected role and redirect unauthorized/missing-profile sessions to the public landing page.
- Firebase auth persistence remains local-first with session and in-memory fallbacks.
- Login, registration, logout, account deletion, and unauthorized redirects now use history replacement so browser Back does not intentionally retain a stale login/protected-page entry.
- Firestore rules continue to enforce owner access for private student documents and matching teacher department/year access for academic documents.
- No authentication or authorization rule was weakened.

### File handling audit

- Uploads still validate extension, MIME type, non-empty content, and size before writing.
- New uploads still write versioned base64 chunks followed by metadata, roll metadata back on failure, and remove obsolete versions after success.
- Partial chunk cleanup is attempted when a chunk write fails.
- Retrieval now validates required metadata, exact chunk count, continuous ordered indexes, per-chunk count consistency, non-empty chunk strings, valid base64, and reconstructed byte size when size metadata exists.
- Malformed stored timestamps now produce an empty displayed date instead of breaking login/list rendering.
- Legacy remote file URLs are restricted to HTTPS (or local HTTP during development) before use.
- Student deletion remains owner-only. Teacher deletion remains academic-only and scoped by year plus current or legacy department metadata.
- Metadata listing does not reconstruct or validate file bytes; byte validation occurs only for View/Download or profile-photo display.
- Student and teacher View actions now reserve the preview tab synchronously from the user click before awaiting Firestore reconstruction, preventing browsers from treating the eventual document tab as an unsolicited pop-up. Failed retrieval closes the reserved tab and still reports the genuine file error.
- No files or stored metadata were deleted by this repository change.

### Navigation and functional audit

- Checked every local HTML, CSS, JavaScript, image, robots, and sitemap reference for missing targets.
- Checked dashboard controls for button semantics and duplicate Dashboard entries.
- Checked all HTML files for duplicate IDs.
- Checked form labels for matching control IDs.
- Checked public Back links, login/register links, dashboard view controls, logout, account removal, uploads, document actions, teacher search, report download, and title actions in source and static validation.
- All dynamic document/profile values rendered through HTML strings continue to use HTML escaping.
- Toasts now expose `status` or `alert` roles.
- All image elements have alternative text and all buttons explicitly declare their type.

### SEO audit

- Added unique titles, descriptions, HTTPS canonical URLs, and favicon links to every HTML page.
- Added Open Graph, X/Twitter card, and WebApplication structured data to the public landing page using only repository-backed information.
- Added `robots.txt` and `sitemap.xml`; the sitemap contains only the public landing page.
- Login, registration, and authenticated dashboards are marked `noindex`; authenticated dashboards are also `nofollow`.
- Preserved relative static asset paths for subpath hosting.
- Updated the Pages artifact builder and static verifier to include/check SEO files.

### Performance and responsive audit

- Removed eager profile-photo chunk download from student login.
- Reduced student dashboard document metadata queries from three to one.
- Removed duplicate academic-title initialization.
- Deferred non-dashboard teacher views and optimized teacher summary/status query composition.
- Preserved lazy Firebase service imports.
- Added safe cleanup for profile-photo object URLs.
- Prevented stale asynchronous photo loads from causing unnecessary or incorrect UI updates.
- The added Dashboard buttons use the existing scrollable overlay sidebar. Existing table wrappers retain horizontal scrolling on narrow screens, dashboard grids retain their current tablet/mobile one-column breakpoints, and profile media is bounded while retaining the existing design.
- Long welcome names now ellipsize inside the top bar, and long profile values wrap safely instead of forcing narrow layouts wider than the viewport.

### Code quality and error handling

- Removed unused teacher view/data helpers after consolidating dashboard queries.
- Removed the confirmed-unused exported authentication profile lookup helper and unused compatibility aliases from normalized profile/document objects, while retaining aliases that still have callers.
- Removed confirmed-unused CSS classes and consolidated duplicated `.brand-logo` declarations. A repository-wide class reference audit found no remaining stylesheet class names without an HTML/JavaScript reference.
- Added safe URL/hash decoding and localStorage fallback behavior.
- Added safe invalid-date handling and safer legacy name sorting.
- Added explicit `type="button"` to every button generated by student/teacher table rendering and made the verifier reject future implicit button types.
- Kept genuine file errors visible during relevant operations while replacing the unrelated login popup with contextual profile-photo handling.
- Expanded static checks for SEO metadata, missing local files, duplicate IDs, label associations, Dashboard menu presence, navigation history/active state, lazy photo behavior, robust chunk validation, exactly one profile photo/fallback element, the hidden-safe fallback selector, photo preloading, and stale-request protection.
- Added an `npm test` script for the existing Node test suite.

## Files Changed

- `css/style.css`
- `index.html`
- `js/auth.js`
- `js/dashboard-nav.js`
- `js/darkmode.js`
- `js/firebase-service.js`
- `js/student.js`
- `js/teacher.js`
- `js/validation.js`
- `package.json`
- `scripts/local-server.js`
- `scripts/prepare-pages-artifact.js`
- `scripts/verify-static-site.js`
- `student-dashboard.html`
- `student-login.html`
- `student-register.html`
- `teacher-dashboard.html`
- `teacher-login.html`
- `teacher-register.html`

## Files Created

- `AUDIT_AND_CHANGES.md`
- `robots.txt`
- `sitemap.xml`

## Validation Performed

- `npm ci`: completed successfully; 176 production packages audited.
- JavaScript syntax: `node --check` passed for 18 application/build JavaScript files.
- `npm test`: passed (1 test, 0 failures).
- `npm run build`: passed (`Static site verification passed`).
- `npm run pages:artifact`: passed and produced the clean static `dist` artifact.
- `git diff --check`: passed; only the repository's existing Windows line-ending notices were reported.
- Local HTTP validation: all seven HTML routes, CSS, dashboard navigation JavaScript, logo, `robots.txt`, and `sitemap.xml` returned HTTP 200 with expected MIME types; a missing route returned 404.
- Profile regression audit: the static verifier confirms one photo element, one fallback element, a hidden-aware fallback selector, image preloading, and stale-request protection; it rejects the original unconditional placeholder rule.
- Headless Chrome visual fixtures exercised the actual profile HTML/CSS at desktop and narrow viewport sizes in both states: photo-only and fallback-only. No duplicate placeholder appeared in either state.
- Static audit: no missing local references, duplicate IDs, unassociated labels, missing image alt text, buttons without explicit types, dashboard `href="#"` controls, application `console.log`/`debugger` statements, or unreferenced stylesheet classes were found.

## Remaining Limitations

- Live Firebase student/teacher/Alumni login, real profile upload/change/persistence, batch graduation, upload/view/download/delete, refresh persistence, and logout flows require valid owner-controlled accounts plus live Firestore test data. No fake accounts or records were created, so those external-state tests remain for the owner or an authorized test environment. The repository currently supports replacing a profile image but has no explicit remove-photo control.
- `npm audit` reports two moderate findings for `uuid@8.3.2`, pulled transitively by the current latest `exceljs@4.4.0`. The advisory concerns UUID v3/v5/v6 calls with caller-provided buffers; this application uses ExcelJS only to create the submission workbook and does not expose those UUID APIs. npm's offered remediation is a breaking downgrade to `exceljs@3.4.0`, so it was not applied without a supported upstream fix.
- The repository's configured production workflow and remote identify GitHub Pages, not Vercel. All application paths remain static and relative, but the canonical/sitemap URLs intentionally match the configured GitHub Pages site. If a different Vercel production domain is authoritative, the owner must provide it before those SEO URLs should be changed.
