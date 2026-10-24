# Firebase and push-notification integration

## Keep one authoritative data store

The native app currently calls the same student API as the website at `https://caexamcheckerai.com`. Student profile, credits, evaluation history, payment verification, course access, and existing in-app notifications should continue using that API as their source of truth. Do not write a second copy of those records directly from the app into Firestore: without a deliberate backend migration and security rules, that can create duplicate, inconsistent data.

Receiving a password-reset email means the existing backend mail workflow is operating for that flow. It does not by itself prove that Firestore is configured or that mobile push is configured.

## Firebase Cloud Messaging (FCM) requirements for Android push

Push messages that should appear while the app is backgrounded/closed require server-side sending as well as native client registration:

1. In Firebase Console, add an Android app whose package ID is exactly `com.caexamchecker.aiapp`.
2. Download its `google-services.json` and supply it as a protected build input at the path configured by `expo.android.googleServicesFile`. The Firebase project file is not present in this repository yet.
3. Configure the FCM HTTP v1 service-account credential in a server/deployment secret store, never in React Native source code.
4. Add backend endpoints to register/remove a student's FCM token and a server-side notification sender. Bind tokens to the authenticated user, rate-limit registration, and remove tokens on logout/account deletion. Admin broadcasts must be sent through the backend.
5. Add client token registration once the API route and Firebase Android config are available, then test on a standalone release build. Expo Go is not a valid push delivery test for the installed app.

## Scope and limitations

- This mobile branch does not migrate or replace the production website database.
- It does not claim that Firestore is connected to production; the deployed server data-store implementation and Firebase project must be checked independently.
- In-app notifications use the existing API. Background push requires the FCM pieces above.
- Never commit service-account private keys, SMTP credentials, API secrets or payment secrets.
