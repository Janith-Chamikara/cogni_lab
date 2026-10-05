export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      onboardingComplete?: boolean;
      role?: "STUDENT" | "INSTRUCTOR" | "ADMIN";
    };
  }

  interface Window {
    __COGNI_AI_CONTEXT__?: unknown;
  }
}
