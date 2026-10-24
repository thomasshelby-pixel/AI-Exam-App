# Current release gaps

## Implemented in the student app
- Student email/password sign-in with a server-issued bearer token stored in SecureStore; admin roles are rejected from the student app.
- Student registration with required CA course and ICAI registration number, email OTP verification, resend-code action, and authenticator-based TOTP MFA challenge.
- Dashboard and edits to fields supported by the active profile API.
- Answer-sheet PDF submission with disclaimer acknowledgement, evaluation history/details with automatic status refresh, and authenticated checked-copy/report PDF downloads.
- Native in-app notification inbox with server-backed unread count, mark-one-read and mark-all-read actions, plus server-backed notification preference toggles.
- Credit balance, monthly free allowance, paid-credit balance and recent ledger display; paid-credit checkout continues through the existing website.
- Notification preference toggles saved by the server.
- Self-service student account deletion through the server's provider-aware identity verification, explicit DELETE confirmation and session clearing.

## Remaining release gates
- Run a clean SDK 58 dependency install, Expo dependency compatibility check, Expo Doctor, TypeScript typecheck, Android bundle export and release APK build in CI.
- Complete live API smoke tests with a test student: login, registration OTP, TOTP MFA, profile update, durable notification read state, PDF submission, pending/completed status, checked-copy/report downloads, session expiry and refreshed credit balance.
- The current profile endpoint does not expose a canonical exam-attempt selection API. Do not let the app write arbitrary attempt IDs; add that only when the backend exposes and validates the canonical contract.
- Submission sends PDF content as base64 JSON and applies a client-side 4 MB limit. Verify server-side limits and eligibility/material gates before release.
- Native Google/Apple OAuth and embedded Razorpay checkout are not part of this build. Account payments are opened on the existing website; the backend remains the source of truth for payment verification and credits.
- Do not label the app release-ready until CI and real-device/API smoke tests pass.

The website/backend repository remains unchanged by this mobile-app work.
