import { SignUp } from "@clerk/nextjs";
import Image from "next/image";
import signalGenerator from "@/public/signal_generator.png";

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-background to-muted/30" />

      <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="absolute top-1/3 right-1/4 h-96 w-96 rounded-full bg-muted/50 blur-3xl" />
      <div className="absolute bottom-1/3 left-1/4 h-80 w-80 rounded-full bg-muted/40 blur-3xl" />

      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="grid md:grid-cols-2">
          <div className="order-last flex items-center justify-center bg-card p-8 md:order-first md:p-12">
            <div className="w-full max-w-sm">
              <SignUp
                fallbackRedirectUrl={"/onboarding"}
                routing="path"
                path="/sign-up"
              />
            </div>
          </div>

          <div className="relative hidden min-h-[560px] overflow-hidden bg-muted md:block">
            <Image
              src={signalGenerator}
              alt="Signal generator illustration"
              fill
              className="object-cover opacity-50"
              sizes="(min-width: 768px) 50vw, 100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-muted via-muted/80 to-muted/30" />

            <div className="relative flex h-full flex-col justify-end p-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground/10 px-4 py-1.5">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-foreground" />
                  <span className="text-xs font-medium tracking-wider text-muted-foreground">
                    GET STARTED
                  </span>
                </div>
                <h1 className="text-4xl font-bold leading-tight text-foreground">
                  Create your
                  <br />
                  <span className="text-muted-foreground">lab account</span>
                </h1>
                <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                  Join the workspace and collaborate on modules, equipment, and
                  experiment progress instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
