export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      onboardingComplete?: boolean;
    };
  }

  interface Window {
    __COGNI_AI_CONTEXT__?: unknown;
  }
}
