"use client";

import { SparklesCore } from "@/components/ui/sparkles";

export function HeroSparkles() {
  return (
    <div className="site-hero-sparkles" aria-hidden>
      <SparklesCore
        id="lexify-hero-sparkles"
        background="transparent"
        minSize={0.4}
        maxSize={1.2}
        particleDensity={120}
        particleColor="#FFFFFF"
        speed={1.5}
        className="site-hero-sparkles-canvas"
      />
      <div className="site-hero-sparkles-fade" />
    </div>
  );
}
