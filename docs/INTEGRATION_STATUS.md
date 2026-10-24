# Student App integration status

## Security and authentication
- Existing student auth APIs remain authoritative. Login/register pass a persistent SecureStore installation ID; authenticated requests send X-Device-Id.
- Session token and installation ID use SecureStore. API calls send Bearer auth and clear the session only on known invalid/expired session responses.
- The MFA challenge accepts a TOTP code or server-verified single-use recovery code.
- Security screen exposes active sessions/revoke others, MFA status/setup, recovery-code regeneration, trusted-device revocation and password change.
- Google sign-in is not offered because the active backend routes return GOOGLE_SIGNIN_DISCONTINUED.
- Verify production JWT_SECRET configuration; the backend source has a hard-coded fallback that must not be used in production.

## Student routes integrated
- Profile and avatar, credits/credit lots, native Razorpay order creation and payment verification, notifications/read state/preferences, account deletion and forgot/reset password.
- Paper specification uses official attempt and reference-material checks; answer-sheet submission, history/detail/status polling, checked-copy/report download and review/recheck use the existing student routes.
- Institute join, active enrolments, institute materials and tests use authenticated membership-scoped routes.
- Study planner uses server curriculum, chapter strengths, schedules, roadmap, saved plans and progress endpoints.
- MCQ Arena uses the authenticated MCQ service for curriculum, sessions, answer scoring, finish, progress, bookmarks and mistake vault.
- Personal examiner profile, promo/referral redemption, support tickets and student review use existing student endpoints.

## Remaining release/validation gates
- Run Expo dependency compatibility, Expo Doctor, TypeScript, Android bundle export/prebuild and standalone release APK build.
- Real Android tests still required for payments, MFA/trusted devices, device limits, institute submissions, rechecks, downloads, session expiry and notification persistence.
- Uploads are capped at 30 MB with current base64 JSON transport and a 50 MB server parser limit. Multipart/streaming is needed for robust larger files.
- Profile API does not currently expose a validated canonical exam-attempt update field.
- MCQ/planner/evaluation features remain subject to server feature gates and account eligibility; CA is the only enabled answer-sheet checking type.
