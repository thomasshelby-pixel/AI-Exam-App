/**
 * Static integration inventory only; runtime compatibility is not yet proven.
 * See docs/INTEGRATION_STATUS.md for the routes inspected against AI-Exam main.
 */
export const INTEGRATION_GATE = {
  routeContractsInspected: true,
  endToEndVerified: false,
  reason: "Static source inspection is complete; CI, live API smoke tests, Expo build and device tests remain unverified.",
} as const;
