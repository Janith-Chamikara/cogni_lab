"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function Home() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 15000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.1,
        });
      }
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(120, 120, 120, ${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });
      });

      // Draw particles
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 100, 100, ${p.opacity})`;
        ctx.fill();
      });
    };

    const updateParticles = () => {
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });
    };

    const animate = () => {
      updateParticles();
      drawParticles();
      animationId = requestAnimationFrame(animate);
    };

    resize();
    createParticles();
    animate();

    window.addEventListener("resize", () => {
      resize();
      createParticles();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-white dark:bg-black">
      {/* Animated Background Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
        style={{ opacity: 0.6 }}
      />

      {/* Gradient Overlays */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-gray-100 to-transparent opacity-60 blur-3xl dark:from-gray-900" />
        <div className="absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-tl from-gray-200 to-transparent opacity-40 blur-3xl dark:from-gray-800" />
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-24">
        {/* Hero Section */}
        <div className="flex max-w-4xl flex-col items-center text-center">
          {/* Artistic Logo Mark */}
          <div className="mb-8 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-gray-300 via-gray-500 to-gray-300 opacity-20 blur-xl dark:from-gray-700 dark:via-gray-500 dark:to-gray-700" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-gray-200 bg-white/80 shadow-2xl backdrop-blur-sm dark:border-gray-800 dark:bg-black/80">
                <svg
                  viewBox="0 0 24 24"
                  className="h-12 w-12 text-black dark:text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-2.273.379a14.5 14.5 0 01-4.724 0l-2.273-.38c-1.717-.292-2.3-2.378-1.067-3.61L5 14.5"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="mb-6 font-serif text-6xl font-light tracking-tight text-black dark:text-white md:text-7xl lg:text-8xl">
            Cogni<span className="font-normal">Lab</span>
          </h1>

          {/* Tagline */}
          <p className="mb-4 text-xl font-light tracking-wide text-gray-600 dark:text-gray-400 md:text-2xl">
            Where Science Meets Imagination
          </p>

          {/* Description */}
          <p className="mb-12 max-w-2xl text-base leading-relaxed text-gray-500 dark:text-gray-500">
            Experience the future of virtual laboratories. Build, simulate, and
            explore complex experiments in an elegant, intuitive environment
            designed for curious minds.
          </p>

          {/* CTA Buttons */}
          <SignedOut>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <Link href={"/sign-in"}>
                <button className="group relative overflow-hidden rounded-full bg-black px-8 py-4 text-sm font-medium tracking-wide text-white transition-all duration-300 hover:shadow-2xl dark:bg-white dark:text-black">
                  <span className="relative z-10">Enter Laboratory</span>
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-gray-800 to-gray-600 transition-transform duration-300 group-hover:translate-x-0 dark:from-gray-200 dark:to-gray-400" />
                </button>
              </Link>
              <Link href={"/sign-up"}>
                <button className="group rounded-full border border-gray-300 bg-transparent px-8 py-4 text-sm font-medium tracking-wide text-gray-800 transition-all duration-300 hover:border-black hover:bg-black hover:text-white dark:border-gray-700 dark:text-gray-200 dark:hover:border-white dark:hover:bg-white dark:hover:text-black">
                  Create Account
                </button>
              </Link>
            </div>
          </SignedOut>

          <SignedIn>
            <button
              onClick={() => router.push("/dashboard")}
              className="group relative overflow-hidden rounded-full bg-black px-10 py-4 text-sm font-medium tracking-wide text-white transition-all duration-300 hover:shadow-2xl dark:bg-white dark:text-black"
            >
              <span className="relative z-10 flex items-center gap-2">
                Go to Dashboard
                <svg
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </span>
            </button>
          </SignedIn>
        </div>

        {/* Feature Cards */}
        <div className="mt-24 grid max-w-5xl gap-6 sm:grid-cols-3">
          {[
            {
              icon: (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                  />
                </svg>
              ),
              title: "Real-time Simulation",
              description:
                "Watch experiments unfold with live physics calculations and dynamic visualizations.",
            },
            {
              icon: (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              ),
              title: "Precise Control",
              description:
                "Fine-tune every parameter with intuitive controls and instant feedback.",
            },
            {
              icon: (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                  />
                </svg>
              ),
              title: "Learn & Discover",
              description:
                "Guided experiments and comprehensive analytics to deepen understanding.",
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white/60 p-8 backdrop-blur-sm transition-all duration-300 hover:border-gray-400 hover:shadow-xl dark:border-gray-800 dark:bg-black/60 dark:hover:border-gray-600"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-gray-900" />
              <div className="relative">
                <div className="mb-4 inline-flex rounded-full border border-gray-200 p-3 text-black dark:border-gray-800 dark:text-white">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-medium text-black dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-500">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Decorative Element */}
        <div className="mt-24 flex items-center gap-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-gray-300 dark:to-gray-700" />
          <span className="text-xs uppercase tracking-widest text-gray-400 dark:text-gray-600">
            Experiment Without Limits
          </span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-gray-300 dark:to-gray-700" />
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 z-10 py-6 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-600">
          © 2026 CogniLab. Crafted with precision.
        </p>
      </footer>
    </div>
  );
}
