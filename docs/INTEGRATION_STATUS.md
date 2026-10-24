# Integration status

## Server contracts inspected
- Auth is mounted at /api/auth; student routes are mounted at /api/student and require authentication.
- Student login uses POST /api/auth/login with portalScope STUDENT; authenticator MFA can return a challenge session token. Registration uses POST /api/auth/register, POST /api/auth/resend-otp and POST /api/auth/verify-otp.
- Profile read/write uses GET /api/student/profile and PUT /api/student/profile; only backend-supported fields are editable.
- Permanent-access eligibility is read from the authenticated server response, not inferred from email or client state.
- Evaluation submission uses POST /api/student/evaluate and remains subject to backend feature access, institute enrollment, reference-material and credit checks.
- Official attempts use GET /api/public/attempts?level=LEVEL, reference availability uses GET /api/public/materials-check, and server-created Razorpay orders/payment verification use POST /api/payments/create-order and POST /api/payments/verify.
- History/details use GET /api/student/evaluations and GET /api/student/evaluations/:id; checked-copy and report PDF downloads use authenticated server routes.
- Credits use GET /api/student/credits; notifications use GET /api/student/notifications, PUT /api/student/notifications/:id/read, PUT /api/student/notifications/read-all and notification preference routes.

## Student mobile flows present
- Login, email-OTP registration, authenticator TOTP challenge, logout and session expiry.
- Dashboard and supported profile edits.
- Website-aligned CA paper selection, server attempt list, official reference-material check, disclaimer acknowledgement and answer-sheet evaluation submission.
- 30 MB app-side upload limit to keep base64 JSON payload below the current server's 50 MB request-body cap.
- Native Razorpay purchase flow uses a server-created order, invokes native checkout, and verifies the payment signature on the server before reporting success or refreshing the credit ledger.
- Permanent free access is displayed only if the server's authenticated entitlement response confirms it; the app never creates or grants that access.
- Evaluation list/detail with automatic polling and authenticated PDF downloads.
- Notification inbox with server-backed unread count/read state and email, marketing and in-app notification preference toggles.
- Credit balance/allowance/ledger and secure self-service deletion.

## Release gates and known gaps
- The Razorpay native module must be included in a standalone APK/custom development build. Expo Go cannot load native Razorpay.
- Run TypeScript, Expo dependency compatibility, Expo Doctor, Android bundle export, Android prebuild and a standalone release APK build after these changes. Then test checkout with Razorpay test credentials and an Android device.
- The main website permits selecting files up to 50 MB, but it transmits base64 in JSON with a 50 MB body-parser limit. This mobile UI caps source files at 30 MB to avoid constructing requests that exceed the currently inspected server limit. True 50 MB raw-file support should be added through streaming/multipart upload and hosting-specific size checks.
- End-to-end validation is required for permanent-access identities and real payment fulfillment. No credits, payment success, or entitlement is written locally.
- Native Google OAuth, MCQ Arena, the study planner and institute/coaching workflows are not yet full native screens. They must be implemented and tested before claiming full website feature parity.
- The production website/backend repository has not been modified by this mobile change.
