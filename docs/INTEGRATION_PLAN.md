# Mobile integration plan

## Non-negotiable boundaries

- The `AI-Exam` repository is the production website/backend source and is not changed by this repo.
- This app calls the existing backend; it does not copy the backend, Firebase service credentials, AI provider keys, model weights or marking algorithms.
- Student identity, attempt selection, credits, evaluation state and result records must come from authoritative server responses.
- No app UI may claim success until the server confirms the write or evaluation state.

## Integration phases

1. **Contract inventory:** inspect existing auth, student profile, attempt master, evaluation, credit, result and checked-copy routes; record exact paths, auth requirements and payload schemas.
2. **Auth adapter:** support existing login, OTP/trusted-device policy and session expiry without weakening the server's role/authorization checks.
3. **Student profile:** load and update only supported profile fields through the existing student API; verify attempt IDs against the authoritative attempt master.
4. **Evaluation:** use existing upload limits, validation, enqueueing, status polling and result APIs. Never run a separate mobile marking engine.
5. **Cross-surface verification:** test a profile/attempt update on mobile then read it on web, and compare result IDs, marks, credits and checked-copy URLs.
6. **Release:** configure build profiles, app icons/splash, privacy disclosures, crash-safe upload retry and store release checks.

## Release blockers

- API base URL not yet configured.
- Exact mobile auth response contract not verified.
- Live backend endpoints and upload limits not yet mapped.
- No Android/iOS device build or end-to-end test has been run.
