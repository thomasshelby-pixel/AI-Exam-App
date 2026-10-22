# Known limitations (do not ship as complete yet)

- This repo has not been installed, typechecked, built, or tested on a physical device in this session.
- Configure `EXPO_PUBLIC_API_BASE_URL` to the actual existing API origin before login.
- Student sign-in stores the bearer token securely. MFA challenge currently asks the user to finish verification on the website; mobile MFA UX is not implemented.
- Registration and OTP resend/verify screens are not implemented yet.
- The student profile is read-only; exam attempt cannot yet be selected because the current main branch profile response does not expose the new exam-attempt field. Related change exists only in an unmerged draft PR in the website repo and was intentionally not merged.
- Answer-sheet submission UI calls the existing `POST /api/student/evaluate` route and requires explicit disclaimer acknowledgement. It must still be verified against live feature gating, subject keys, institute enrollment rules and server file-size constraints.
- Checked-copy/report download routes exist on the backend but the app does not yet implement authenticated binary download and local viewing.
- No changes were made to the AI-Exam website repository by this app implementation.
