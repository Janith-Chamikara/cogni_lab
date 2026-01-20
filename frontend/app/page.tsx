"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { useState } from "react";

export default function Home() {
  const { getToken, isSignedIn } = useAuth();
  const [backendResponse, setBackendResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const callBackend = async () => {
    if (!isSignedIn) {
      setBackendResponse("You must be signed in to call the API.");
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

      if (!baseUrl) {
        setBackendResponse("Missing NEXT_PUBLIC_API_BASE_URL.");
        return;
      }

      const response = await fetch(`${baseUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
        },
      });

      const text = await response.text();
      setBackendResponse(text);
    } catch (error) {
      setBackendResponse("Failed to reach the backend.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 px-8 py-24 text-center text-zinc-950 dark:text-zinc-50">
        <h1 className="text-3xl font-semibold tracking-tight">
          Clerk + NestJS is ready
        </h1>
        <p className="max-w-xl text-base text-zinc-600 dark:text-zinc-400">
          Sign in with Clerk on the frontend and call the protected NestJS
          backend using your session token.
        </p>

        <SignedOut>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <SignInButton mode="modal">
              <button className="rounded-full bg-black px-6 py-2 text-sm font-medium text-white">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-full border border-zinc-300 px-6 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Create account
              </button>
            </SignUpButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="flex flex-col items-center gap-4">
            <UserButton afterSignOutUrl="/" />
            <button
              className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
              onClick={callBackend}
              disabled={isLoading}
            >
              {isLoading ? "Calling backend..." : "Call protected backend"}
            </button>
            {backendResponse && (
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
                {backendResponse}
              </div>
            )}
          </div>
        </SignedIn>
      </main>
    </div>
  );
}
