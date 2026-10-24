# CA Exam Checker AI — Student App

Android-first student companion for the existing CA Exam Checker AI account. The production website/backend remains the source of truth and is not modified by this repository.

## Features
- Student email/password sign-in, registration with email OTP and authenticator TOTP MFA challenge.
- Dashboard and supported profile updates.
- PDF answer-sheet submission through the existing evaluation service.
- Evaluation history/details with pending-status auto-refresh and server-authoritative marks.
- Authenticated checked-copy and detailed report PDF downloads.
- Notification inbox, unread count, mark-one-read and mark-all-read, plus server-backed email/in-app notification preferences.
- Credits/usage overview and recent credit ledger. Purchase checkout opens the existing website so the backend owns payment verification and credit fulfilment.

## Stack
- Expo SDK 58, React Native 0.88, React 19.3 and TypeScript 6.
- API origin defaults to https://caexamcheckerai.com; EXPO_PUBLIC_API_BASE_URL can override it for staging.
- Session tokens are stored using SecureStore. Sensitive account, evaluation, notification and credit writes go through authenticated server endpoints.

## Local development (PowerShell)
    npm.cmd install
    npx.cmd expo install --fix
    npx.cmd expo-doctor@latest
    npx.cmd expo start -c

Install the Expo Go build matching SDK 58 or use a standalone APK from a successful GitHub Actions run. Keep Metro open while using Expo Go. A standalone Android release build bundles the JavaScript and does not depend on Metro.

## Build verification
GitHub Actions runs Expo dependency checks, Expo Doctor, typecheck, Android bundle export and a standalone release APK build. The APK artifact is retained for 14 days for private testing, not a Play Store release. Before release, test a real student account end-to-end, including sign-in/OTP/TOTP, profile edits, notification-read persistence, answer-sheet submission, status polling, checked-copy/report downloads and credit refresh.

## Boundaries
1. Keep the website repository AI-Exam unchanged.
2. Do not duplicate the answer-marking engine in the client.
3. Do not write directly to Firestore collections authoritative for users, credits, evaluations or results.
4. Validate API responses and handle session expiry, upload failures and durable notification-read errors.
5. Do not report evaluation or payment success before the backend confirms it.
