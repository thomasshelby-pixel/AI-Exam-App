# Integration status

## Server contracts inspected
- Auth is mounted at /api/auth; student routes are mounted at /api/student and authenticate requests.
- Student login uses POST /api/auth/login with portalScope STUDENT; an enrolled authenticator can return an MFA challenge session token. Registration uses POST /api/auth/register, POST /api/auth/resend-otp and POST /api/auth/verify-otp.
- Profile read/write uses GET /api/student/profile and PUT /api/student/profile. Only backend-supported fields are editable.
- Disclaimer acknowledgement uses GET /api/student/disclaimer/status and POST /api/student/disclaimer/acknowledge.
- Evaluation submission uses POST /api/student/evaluate; it remains subject to backend feature access, institute enrollment, reference-material and credit checks.
- History/details use GET /api/student/evaluations and GET /api/student/evaluations/:id; downloads use GET /api/student/evaluations/:id/download-checked-copy and GET /api/student/evaluations/:id/download-report.
- Credits use GET /api/student/credits and GET /api/student/credit-lots; notifications use GET /api/student/notifications, PUT /api/student/notifications/:id/read, PUT /api/student/notifications/read-all and notification-preferences routes.

## Student mobile flows present
- Login, registration email OTP, authenticator TOTP challenge, logout and session expiry.
- Student dashboard and supported profile edits.
- PDF submission, disclaimer acknowledgement, evaluation list/detail with automatic polling, authenticated PDF downloads.
- Notification inbox with server-backed unread count, mark-one-read and mark-all-read; email, marketing email and in-app preference toggles.
- Credit balance/allowance/ledger screen; checkout opens the existing website.

## Still to verify
- Static route inspection does not replace end-to-end API tests. CI and a real Android device must verify login, OTP/TOTP, persisted notification read state, profile update, submission, polling, downloads and credit balance refresh.
- Canonical exam-attempt selection is deliberately not implemented until the server exposes a validated attempt identifier.
- The mobile app must never write credits, evaluation results or entitlements directly to Firestore or report success before the API confirms it.

No website/backend source files were modified.
