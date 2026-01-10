import React from "react";
import { CheckCircle } from "lucide-react";
import { cn } from "../lib/cn";

const ACCENT_STYLES = {
  green: {
    topBorder: "border-green-500",
    icon: "text-green-500",
    price: "text-gray-900",
    badge: "bg-green-600",
    outlineBtn: "border-green-500 text-green-700 hover:bg-green-50",
    solidBtn: "bg-green-600 hover:bg-green-700 text-white",
  },
  blue: {
    topBorder: "border-blue-500",
    icon: "text-blue-500",
    price: "text-blue-600",
    badge: "bg-blue-500",
    outlineBtn: "border-blue-500 text-blue-700 hover:bg-blue-50",
    solidBtn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  purple: {
    topBorder: "border-purple-500",
    icon: "text-purple-500",
    price: "text-purple-600",
    badge: "bg-purple-600",
    outlineBtn: "border-purple-500 text-purple-700 hover:bg-purple-50",
    solidBtn: "bg-purple-600 hover:bg-purple-700 text-white",
  },
  orange: {
    topBorder: "border-orange-500",
    icon: "text-orange-500",
    price: "text-orange-600",
    badge: "bg-orange-600",
    outlineBtn: "border-orange-500 text-orange-700 hover:bg-orange-50",
    solidBtn: "bg-orange-600 hover:bg-orange-700 text-white",
  },
};

export default function PricingCard({ plan, onSelect }) {
  const accent = ACCENT_STYLES[plan.accent] ?? ACCENT_STYLES.green;
  const buttonClasses =
    plan.buttonVariant === "solid" ? accent.solidBtn : accent.outlineBtn;

  return (
    <div
      className={cn(
        "bg-white p-6 rounded-2xl border-t-4 shadow-lg hover:shadow-xl transition flex flex-col relative",
        accent.topBorder,
        plan.lift && "transform md:-translate-y-2"
      )}
    >
      {plan.badgeText ? (
        <div
          className={cn(
            "absolute top-0 right-0 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg",
            accent.badge
          )}
        >
          {plan.badgeText}
        </div>
      ) : null}

      <div className="mb-4">
        <h3 className="text-xl font-bold font-heading text-gray-800">
          {plan.title}
        </h3>

        <div className={cn("mt-2 text-3xl font-bold", accent.price)}>
          {plan.priceText}
          <span className="text-sm font-normal text-gray-500">
            {plan.periodText}
          </span>
        </div>
      </div>

      <ul className="space-y-3 mb-8 flex-1 text-sm text-gray-600">
        {plan.features.map((f, idx) => (
          <li key={idx} className="flex items-start">
            <CheckCircle
              aria-hidden="true"
              className={cn("w-4 h-4 mr-2 mt-1 shrink-0", accent.icon)}
            />
            <span className={cn(f.isStrong && "font-semibold text-gray-800")}>
              {f.text}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        className={cn(
          "w-full py-2 font-bold rounded-lg transition shadow-md border-2",
          plan.buttonVariant === "solid" ? "border-transparent" : "",
          buttonClasses,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
        )}
      >
        {plan.ctaLabel}
      </button>
    </div>
  );
}