import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  console.log("[Onboarding Layout] onboardingComplete:", session.sessionClaims?.onboardingComplete);
  
  if (session.sessionClaims?.onboardingComplete === true) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
