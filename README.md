# AI Exam App

Mobile companion app for CA Exam Checker AI. The existing `AI-Exam` website/backend remains the source of truth and is not modified by this repository.

## Architecture

- **Mobile client:** Expo + React Native + TypeScript.
- **Backend:** Calls the existing authenticated AI-Exam API. Do not duplicate evaluation/marking logic or embed provider secrets/model weights in the app.
- **Identity and data:** Reuse the existing account/session contract and canonical student records through backend APIs. Firestore access stays server-mediated unless the existing product's documented client contract explicitly requires otherwise.
- **Evaluation:** Upload submissions through existing API routes; read authoritative evaluation status, results, credits and checked-copy links from the backend.

## Development status

This is the initial app foundation. API paths and payloads must be verified against the existing backend before enabling real account or evaluation actions. Never use guessed endpoints in production.

## Setup

```bash
npm install
npx expo start
```

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the deployed AI-Exam API base URL. Never put API keys, service-account credentials, JWT signing secrets, or model-provider secrets in `EXPO_PUBLIC_*` variables.

## Safety rules

1. Keep website repository `AI-Exam` unchanged from this app repo.
2. Do not implement a second answer-marking engine.
3. Do not write directly to Firestore collections that are authoritative for credits, results, users or evaluation records.
4. Validate API responses and handle expired sessions and upload failures.
5. Do not report an evaluation as complete until the backend confirms it.
