"use client";

import { SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/footer";
import { FlaskConical, Zap, Bot, Cloud } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const features = [
    {
      icon: FlaskConical,
      title: "VIRTUAL EXPERIMENTS",
      description: "Safely perform hands-on experiments in a fully interactive virtual laboratory environment",
    },
    {
      icon: Zap,
      title: "REAL-TIME SIMULATIONS",
      description: "Build, test, and visualize experiments with instant feedback and live simulations",
    },
    {
      icon: Bot,
      title: "AI LAB ASSISTANT",
      description: "Get step-by-step guidance, explanations, and insights from your virtual AI assistant",
    },
    {
      icon: Cloud,
      title: "ANYWHERE ACCESS",
      description: "Access your labs anytime, anywhere—no physical equipment required",
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(/backgroundlab.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-black/75" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-8 md:px-16 pt-32 pb-32 min-h-[70vh] flex flex-col justify-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight max-w-4xl">
            EXPERIMENT SMARTER
            <br />
            WITH AI
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-xl">
            Experience the next generation of hands-on learning - guided by your
            <br/>
            virtual AI lab assistant.
            <br/>
            <br/>
            Build, test, and analyze experiments anywhere, anytime.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg" className="bg-white hover:bg-gray-100 text-black px-8 py-6 text-base font-semibold rounded-full w-fit">
                  START EXPERIMENTING...
                </Button>
              </SignUpButton>
              <Button 
                size="lg" 
                variant="outline" 
                className="bg-transparent border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-base font-semibold rounded-full w-fit"
                onClick={() => router.push('/labs')}
              >
                LEARN MORE
              </Button>
            </SignedOut>
            
            <SignedIn>
              <Button 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
                onClick={() => router.push('/dashboard')}
              >
                GO TO DASHBOARD
              </Button>
            </SignedIn>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="bg-white/10 backdrop-blur-md border-white/20 p-6 hover:bg-white/20 transition-all duration-300 group cursor-pointer"
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 rounded-full bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                      <Icon className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-white font-bold text-lg tracking-wide">
                      {feature.title}
                    </h3>
                    <p className="text-gray-300 text-sm">
                      {feature.description}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
