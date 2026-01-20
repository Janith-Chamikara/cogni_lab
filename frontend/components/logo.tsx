import { useTheme } from "next-themes";
import Image from "next/image";

type LogoProps = {
  size?: number;
  alt?: string;
  className?: string;
  withText?: boolean;
  text?: string;
};

export default function Logo({ alt = "Cogni Lab", className = "" }: LogoProps) {
  const { theme } = useTheme();
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <Image
        src={
          theme === "dark"
            ? "/logo-white.png"
            : theme === "light"
              ? "/logo-black.png"
              : "/logo-white.png"
        }
        alt={alt}
        width={100}
        height={48}
        priority
      />
    </div>
  );
}
