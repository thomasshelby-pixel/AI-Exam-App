# Student App release gaps

## Implemented / integrated screens
- Student email/password login, email-OTP registration, TOTP challenge, one-time recovery-code fallback, forgot/reset password and protected server session.
- Persistent installation identifier on API requests to align with existing device-session and trial-abuse controls.
- Student dashboard, profile/avatar, password change, active-session list/revoke, MFA status/setup, recovery-code regeneration and trusted-device revocation.
- Native paper specification, material availability verification, PDF/image submission, disclaimer, history/status polling, checked-copy/report downloads and review/recheck requests.
- Native Razorpay purchase using server-created order plus server-side signature verification; no local credits or permanent-access grants.
- Purchased credit lot/expiry overview, notifications/preferences, institute enrollment/materials/tests, study planner, personal examiner profile, MCQ Arena, promo/referral, support tickets and student reviews.

## Release/security gates (do not mark complete until verified)
- Confirm production has an independent, high-entropy JWT_SECRET environment variable. The inspected backend source contains a hard-coded fallback; source inspection cannot confirm whether production currently uses it. Do not deploy with the fallback.
- Test device-limit enforcement, MFA enrollment/login/recovery, session revocation, native trusted-device behavior, payment cancellation/idempotency, institute membership scoping and recheck ownership on a real Android device.
- Native trusted-device cookies do not necessarily behave exactly like browser HttpOnly-cookie trust; the screen reads and revokes server state, but end-to-end native trust testing remains necessary.
- Mobile uploads are capped at 30 MB; true 50 MB source file support needs multipart/streaming upload and hosting-limit review.
- Profile API does not expose a validated canonical exam-attempt update contract; the profile attempt field stays informational/read-only.
- Google sign-in endpoints currently return GOOGLE_SIGNIN_DISCONTINUED; native Google OAuth is intentionally not presented as working.
- MCQ Arena and planner screens respect server feature and course gates. A screen being present does not mean the account has access to the feature.
- Only CA answer-sheet evaluation is supported. CS/CMA are Coming Soon.
- The Student App is substantially expanded but is not claimed to be a perfect copy of every website workflow. CI and end-to-end smoke tests are release gates.

The production website/backend repository is unchanged by these mobile changes.
