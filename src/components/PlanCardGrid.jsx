import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { PLANS } from '../constants/plans';

const getAccentClasses = (accent) => {
  switch (accent) {
    case 'green':
      return {
        border: 'border-green-500',
        text: 'text-green-600',
        bg: 'bg-green-600',
        icon: 'text-green-500',
        btnOutline: 'text-green-700 border-green-500 hover:bg-green-50',
        btnSolid: 'bg-green-600 hover:bg-green-700 text-white',
        savingsBg: 'bg-green-50 text-green-700',
      };
    case 'blue':
      return {
        border: 'border-blue-500',
        text: 'text-blue-600',
        bg: 'bg-blue-600',
        icon: 'text-blue-500',
        btnOutline: 'text-blue-700 border-blue-500 hover:bg-blue-50',
        btnSolid: 'bg-blue-600 hover:bg-blue-700 text-white',
        savingsBg: 'bg-blue-50 text-blue-700',
      };
    case 'purple':
      return {
        border: 'border-purple-500',
        text: 'text-purple-600',
        bg: 'bg-purple-600',
        icon: 'text-purple-500',
        btnOutline: 'text-purple-700 border-purple-500 hover:bg-purple-50',
        btnSolid: 'bg-purple-600 hover:bg-purple-700 text-white',
        savingsBg: 'bg-purple-50 text-purple-700',
      };
    case 'orange':
      return {
        border: 'border-orange-500',
        text: 'text-orange-600',
        bg: 'bg-orange-600',
        icon: 'text-orange-500',
        btnOutline: 'text-orange-700 border-orange-500 hover:bg-orange-50',
        btnSolid: 'bg-orange-600 hover:bg-orange-700 text-white',
        savingsBg: 'bg-orange-50 text-orange-700',
      };
    default:
      return {
        border: 'border-gray-300',
        text: 'text-gray-800',
        bg: 'bg-gray-700',
        icon: 'text-gray-500',
        btnOutline: 'text-gray-700 border-gray-300 hover:bg-gray-50',
        btnSolid: 'bg-gray-700 hover:bg-gray-800 text-white',
        savingsBg: 'bg-gray-50 text-gray-700',
      };
  }
};

export { getAccentClasses };

export default function PlanCardGrid({
  currentTier = null,
  onPlanSelect = null,
  renderAction = null,
  showDescriptions = false,
  className = '',
}) {
  return (
    <div className={`grid md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {PLANS.map((plan) => {
        const colors = getAccentClasses(plan.accent);
        const isCurrent = currentTier === plan.id;

        return (
          <div
            key={plan.id}
            className={[
              'relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-lg',
              `border-t-4 ${colors.border}`,
              isCurrent ? 'ring-2 ring-orange-300' : '',
              plan.lift ? 'md:-translate-y-2' : '',
              plan.badgeText ? 'pt-8' : '',
            ].join(' ')}
          >
            {/* Badge — floating pill above the card */}
            {plan.badgeText && (
              <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-5 py-1.5 text-xs font-bold tracking-wide text-white shadow-md ${colors.bg}`}>
                {plan.badgeText}
              </div>
            )}

            {/* Plan name + tagline + price */}
            <div className="mb-4">
              <h3 className="text-xl font-bold font-heading text-gray-800">{plan.title}</h3>
              {plan.tagline && (
                <p className="mt-0.5 text-xs text-gray-500">{plan.tagline}</p>
              )}
              <div className={`mt-2 text-3xl font-bold ${plan.id === 'basic' ? 'text-gray-900' : colors.text}`}>
                {plan.priceText}
                <span className="text-sm font-normal text-gray-500">{plan.periodText}</span>
              </div>
            </div>

            {/* Feature list */}
            <ul className="mb-6 flex-1 space-y-2.5 text-sm">
              {plan.features.map((feature, idx) => {
                const textClass = feature.excluded
                  ? 'text-gray-400'
                  : feature.dim
                    ? 'text-gray-500'
                    : feature.isStrong
                      ? 'font-semibold text-gray-900'
                      : 'text-gray-700';

                return (
                  <li
                    key={idx}
                    className={`flex items-start${feature.separator ? ' border-t border-gray-100 pt-2.5 mt-3' : ''}`}
                  >
                    {feature.excluded ? (
                      <XCircle className="mt-0.5 mr-2 h-4 w-4 shrink-0 text-red-400" />
                    ) : (
                      <CheckCircle className={`mt-0.5 mr-2 h-4 w-4 shrink-0 ${colors.icon}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={textClass}>{feature.text}</span>
                      {showDescriptions && feature.description && (
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{feature.description}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Savings note */}
            {plan.savingsNote && (
              <div className={`mb-4 rounded-lg px-3 py-2 text-center text-xs font-medium ${colors.savingsBg}`}>
                {plan.savingsNote}
              </div>
            )}

            {/* CTA */}
            {renderAction ? (
              renderAction({ plan, colors, isCurrent })
            ) : (
              <button
                type="button"
                onClick={() => onPlanSelect?.(plan)}
                className={`w-full rounded-lg border py-2 font-bold transition ${
                  plan.buttonVariant === 'solid' ? colors.btnSolid : colors.btnOutline
                }`}
              >
                {plan.ctaLabel}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
