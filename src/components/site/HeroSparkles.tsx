"use client";

import { SparklesCore } from "@/components/ui/sparkles";
import { useTheme } from "@/components/providers/ThemeProvider";

export function HeroSparkles() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className="site-hero-sparkles" aria-hidden>
      <SparklesCore
        key={theme}
        id={`lexify-hero-sparkles-${theme}`}
        background="transparent"
        minSize={0.4}
        maxSize={1.2}
        particleDensity={isLight ? 100 : 120}
        particleColor={isLight ? "#3b7bf0" : "#9fc9c4"}
        speed={1.5}
        className="site-hero-sparkles-canvas"
      />
      <div className="site-hero-sparkles-fade" />
    </div>
  );
}
