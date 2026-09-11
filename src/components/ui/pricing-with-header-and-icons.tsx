"use client";

import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PricingPlan = {
  name: string;
  description: string;
  price: string;
  period: string;
  includesLabel: string;
  features: string[];
  featured?: boolean;
  cta: ReactNode;
};

function GridLineHorizontal({ featured }: { featured?: boolean }) {
  return <div className={cn("lx-pricing-line", featured && "is-featured")} />;
}

function Step({
  children,
  featured,
}: {
  children: ReactNode;
  featured?: boolean;
}) {
  return (
    <li className="lx-pricing-step">
      <CheckCircle2 className="lx-pricing-step-ico" aria-hidden />
      <span className={cn(featured && "is-featured-text")}>{children}</span>
    </li>
  );
}

/**
 * Aceternity-style pricing layout.
 * IMPORTANT: do not use global `.grid` — it forces auto-fill and leaves empty columns.
 */
export function PricingWithHeaderAndIcons({
  title,
  subtitle,
  plans,
}: {
  title: string;
  subtitle: string;
  plans: PricingPlan[];
}) {
  return (
    <div className="lx-pricing-wrap">
      <div className="lx-pricing-head">
        <h2 className="lx-pricing-title">{title}</h2>
        <p className="lx-pricing-sub">{subtitle}</p>
      </div>

      <div className="lx-pricing-grid">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn("lx-pricing-card", plan.featured && "is-featured")}
          >
            <div className="lx-pricing-card-top">
              <div className="lx-pricing-intro">
                <h3 className="lx-pricing-name">{plan.name}</h3>
                <p className="lx-pricing-desc">{plan.description}</p>
              </div>

              <div className="lx-pricing-amount">
                <span className="lx-pricing-sum">{plan.price}</span>
                <span className="lx-pricing-per">{plan.period}</span>
              </div>

              <div className="lx-pricing-cta">{plan.cta}</div>
            </div>

            <div className="lx-pricing-line-wrap">
              <GridLineHorizontal featured={plan.featured} />
            </div>

            <div className="lx-pricing-card-bottom">
              <p className="lx-pricing-includes">{plan.includesLabel}</p>
              <ul className="lx-pricing-features">
                {plan.features.map((feature) => (
                  <Step key={feature} featured={plan.featured}>
                    {feature}
                  </Step>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
