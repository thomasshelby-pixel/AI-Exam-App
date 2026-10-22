/**
 * Integration gate:
 * The current server's exact route names and request/response schemas must be
 * inspected before replacing these placeholders with live calls.
 *
 * Verify at minimum:
 * - auth login/register and OTP/trusted-device flows
 * - GET/PUT student profile and canonical exam-attempt ID
 * - student evaluation list/status/result and checked-copy download
 * - credit balance and payment history
 *
 * Do not guess endpoint names. Keep all writes behind the existing backend's
 * authorization, validation, atomic credit consumption and Firestore sync paths.
 */
export const INTEGRATION_GATE = {
  verified: false,
  reason: "Existing backend route and payload contracts have not yet been validated end-to-end.",
} as const;
