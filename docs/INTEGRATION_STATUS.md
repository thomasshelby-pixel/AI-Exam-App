# Integration status

## Verified against AI-Exam main source

- Auth router is mounted at `/api/auth`.
- Student router is mounted at `/api/student` and applies `authenticateToken` to student routes.
- `POST /api/auth/login` accepts email, password and optional portalScope. A successful response includes `token` and a user object; MFA may return `mfaRequired` instead.
- `GET /api/student/profile` returns the signed-in user, profile and credit/evaluation summaries.
- `GET /api/student/evaluations` returns the signed-in student's evaluation records.
- `POST /api/auth/logout` exists; client clears its secure token regardless of logout network outcome.

## Mobile implementation now present

- Student-only sign-in uses the verified existing login endpoint and stores its token in SecureStore.
- Dashboard loads profile and evaluation list from existing endpoints.
- Evaluation history displays authoritative status and marks.
- Profile screen displays existing profile data without pretending edits have been saved.

## Still blocking production readiness

- MFA completion/trusted-device flows need a dedicated mobile UX; admin accounts are intentionally rejected by the app.
- Registration OTP flow needs full route/payload contract and error-state implementation.
- Profile editing must map every field to the server's exact validation/persistence behavior.
- Answer-sheet upload and checked-copy download need actual route and multipart/storage contracts verified.
- API URL must be configured for the target environment.
- Typecheck, Expo build and real device tests are not run by the GitHub file API. Do not label this release-ready until they pass.
