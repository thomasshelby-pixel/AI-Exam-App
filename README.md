# CA Exam Checker AI — Student App

Android-first student companion for the existing CA Exam Checker AI account. The production website/backend remains the source of truth and is not modified by this repository.

## Features
- Student email/password sign-in, registration with email OTP and authenticator TOTP MFA challenge.
- Dashboard and supported profile updates.
- Course-aware paper specification matching the website: CA level, group, canonical subject/paper key, MTP/PYQ/model-paper type, official MTP series, server-provided exam attempts, evaluator strictness and material availability pre-check.
- PDF/image answer-sheet submission with a 30 MB client limit. The current API accepts base64 in JSON and has a 50 MB JSON body limit, so the app deliberately stays below the nominal website 50 MB file picker limit until a streaming upload transport is implemented.
- Native in-app Razorpay checkout for combo/custom evaluation credits, using server-created orders and server-side payment signature verification. Prices/credits are not trusted or granted by the client.
- Credits and recent ledger; permanent evaluation access is displayed only when confirmed by the authenticated server.
- Evaluation history/details with pending-status auto-refresh and authenticated checked-copy/report PDF downloads.
- Notification inbox, unread count, mark-one-read and mark-all-read, plus server-backed email/in-app notification preferences.
- Forgot password, profile settings, and secure self-service account deletion using the account's required password, email OTP or registered-email verification method.

## Stack
- Expo SDK 58, React Native 0.88, React 19.3 and TypeScript 6.
- API origin defaults to https://caexamcheckerai.com; EXPO_PUBLIC_API_BASE_URL can override it for staging.
- Session tokens are stored using SecureStore. Sensitive account, evaluation, payment, notification and credit writes go through authenticated server endpoints.

## Local development (PowerShell)
    npm.cmd install
    npx.cmd expo install --check
    npx.cmd expo start -c

## Native payment note
Razorpay's React Native SDK is a native module. Use the standalone APK (or a custom development build that includes the module); Expo Go does not include native Razorpay. GitHub Actions runs a standalone Android release build and stores the APK artifact for 14 days when the job succeeds. It is not a Play Store release.

## Verification / remaining parity
Automated checks and a built APK must pass before describing the app as release-ready. Test real test-key checkout, payment cancellation, verification, duplicate callbacks/idempotent fulfilment, permanent-access account behavior, OTP/TOTP, notification persistence, profile course change, material availability, 30 MB uploads, evaluation polling and secured PDF downloads on a real Android device. Native Google OAuth, MCQ Arena, the study planner and institute-specific workflows are not yet full native screens; do not assume the mobile app is fully feature-equivalent to the website until those gaps are separately implemented and tested.
