# Integration status

## Contracts inspected against AI-Exam main

- Auth router is mounted at `/api/auth`; the student router is mounted at `/api/student` and authenticates requests.
- `POST /api/auth/login` accepts email, password and `portalScope: "STUDENT"`; MFA-enrolled users may receive `mfaRequired` and `mfaSessionToken`.
- Registration uses `POST /api/auth/register`, `POST /api/auth/resend-otp`, and `POST /api/auth/verify-otp`. The backend validates the ICAI registration number and verifies the email OTP before account creation.
- `POST /api/auth/mfa/verify-challenge` accepts `mfaSessionToken` and `otpCode`. Source inspection confirms this challenge validates TOTP from an enrolled authenticator, not email OTP.
- `GET /api/student/profile` returns `user`, `profile`, `entitlement`, `creditStatus`, and stats. `PUT /api/student/profile` supports fullName, phone, city, caLevel, preferredSubjects, avatarUrl, and icaiRegistrationNumber. Exam-attempt editing is not exposed by this route.
- Disclaimer status and acknowledgement routes are `/api/student/disclaimer/status` and `/api/student/disclaimer/acknowledge`; status returns `acknowledged` and `currentVersion`.
- `POST /api/student/evaluate` accepts a base64 answer-sheet PDF plus evaluation metadata. It checks disclaimer, institute sponsorship/enrollment, entitlement, reference-material availability and credits, then queues evaluation asynchronously.
- `GET /api/student/evaluations` returns student evaluation records; `GET /api/student/evaluations/:id` returns the report detail.
- Checked-copy and report download routes are `/api/student/evaluations/:id/download-checked-copy` and `/api/student/evaluations/:id/download-report`; server permissions and disclaimer requirements still apply.

## Mobile implementation present

- Student-only sign-in, email-OTP registration and TOTP MFA challenge screen.
- Session token stored in SecureStore; API helper clears it after HTTP 401.
- Dashboard, supported profile editing, evaluation history/detail, PDF submission and authenticated PDF downloads.
- Upload reads the current disclaimer version from the backend and includes MTP series where required.
- EAS Android build profiles and a GitHub Actions workflow for TypeScript and Expo config checks.

## Remaining release blockers

- Configure `EXPO_PUBLIC_API_BASE_URL` for the deployed backend; it must not be guessed or hardcoded.
- CI status, TypeScript check, Expo build, authenticated live API smoke tests and Android device tests have not been verified in this work session.
- Evaluation submission can fail legitimately due to eligibility, institute rules, entitlements/credits, or missing approved reference material.
- PDF download availability depends on server permissions, evaluation state and disclaimer status.
- Attempt editing remains unavailable until the backend exposes a canonical supported route/field.
- This is a student-only app; institute-admin and super-admin apps are separate scope.

Static source inspection is not end-to-end verification. The production `AI-Exam` website/backend repository has not been modified by this mobile-app work.
