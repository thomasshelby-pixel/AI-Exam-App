# Website to Student App feature parity

| Student capability | Mobile state | Source of truth / caveat |
|---|---|---|
| Login, email OTP registration, forgot/reset, TOTP challenge | Integrated | Existing auth API |
| Recovery-code login and MFA settings | Integrated in code; device test required | Existing MFA routes |
| Device ID, session list/revoke, password update | Integrated in code; device test required | Existing auth/session routes |
| Student profile, course, avatar | Integrated | Existing profile API; registration number validated by server |
| Evaluation form, official attempts/material check | Integrated | Public materials APIs; server decides availability |
| Submission, history, polling, checked-copy/report PDF | Integrated | Existing evaluation APIs |
| Recheck requests/history | Integrated | Existing student recheck endpoints; no credits deducted |
| Credit balances, credit lots/expiry, native purchase | Integrated in code | Server order plus payment signature verification; requires standalone native build |
| Notifications, read state, email/in-app preferences | Integrated | Existing notification APIs and durable backend |
| Institute join, materials, assigned tests | Integrated in code | Membership and course access are server-enforced |
| Study planner, chapter strength, roadmap and study log | Integrated in code | Planner capability is course/feature gated server-side |
| MCQ practice, sessions, progress, bookmarks, mistake vault | Integrated in code | MCQ feature gate may deny access; only published questions are returned |
| Personal examiner profile | Integrated in code | Depends on evaluation history returned by the server |
| Promo/referral, support tickets, student review | Integrated in code | Eligibility, spam throttles and code limits enforced by server |
| Google OAuth in native app | Not available | Current backend explicitly discontinues Google sign-in |
| CS/CMA answer-sheet checking | Not available | Backend supports CA evaluation only |
| Institute Admin / Super Admin app | Separate projects, not this app | Must be developed independently |
| True 50 MB upload support | Not complete | Current app cap 30 MB until multipart/streaming and hosting limits are addressed |

“Integrated in code” does not mean real-device acceptance tests have passed. Release requires successful CI and end-to-end testing using test accounts and payment credentials.
