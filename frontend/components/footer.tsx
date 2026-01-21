import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Youtube, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Section - Logo and Copyright */}
          <div className="flex flex-col items-start justify-center gap-4 h-full relative">
            <div className="flex items-center">
              <Image
                src="/logo-black.png"
                alt="CogniLab AI Logo"
                width={300}
                height={300}
                className="dark:invert"
              />
            </div>
            <p className="text-xs text-muted-foreground absolute bottom-0 left-0">
              ©2024 All Rights Reserved
            </p>
          </div>

          {/* Right Section - Description and Social Links */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold">
              CogniLab AI: Intelligent Virtual Laboratory for Sri Lanka
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              CogniLab AI is your smart platform for hands-on virtual
              experiments powered by artificial intelligence. Whether you're
              learning electronics, circuits, or embedded systems, CogniLab AI
              provides an interactive, Tinkercad-like environment guided by an
              AI instructor for a seamless and engaging learning experience.
            </p>
            
            {/* Social Media Icons */}
            <div className="flex gap-4 mt-2">
              <Link
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </Link>
              <Link
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </Link>
              <Link
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5" />
              </Link>
              <Link
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
