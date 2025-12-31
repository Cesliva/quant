"use client";

import { WizardState } from "../NewProjectWizard";
import { Check } from "lucide-react";

interface Step3ScopeProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
}

const SCOPE_OPTIONS = [
  { key: "structural", label: "Structural Steel", description: "Primary structural framing" },
  { key: "miscMetals", label: "Misc Metals", description: "Miscellaneous steel components" },
  { key: "stairsRails", label: "Stairs / Rails", description: "Stair systems and handrails" },
  { key: "buyouts", label: "Buyouts", description: "Subcontracted items" },
  { key: "finishes", label: "Finishes", description: "Coating, paint, and finishes" },
  { key: "erection", label: "Erection", description: "Field installation services" },
];

export default function Step3Scope({ state, onUpdate }: Step3ScopeProps) {
  const toggleScope = (key: keyof typeof state.scope) => {
    onUpdate({
      scope: {
        ...state.scope,
        [key]: !state.scope[key],
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Scope Snapshot
        </h2>
        <p className="text-gray-600 text-sm">
          Select the types of work included in this project. This helps set expectations and defaults.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SCOPE_OPTIONS.map((option) => {
          const isSelected = state.scope[option.key as keyof typeof state.scope];
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => toggleScope(option.key as keyof typeof state.scope)}
              className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {option.label}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {option.description}
                  </p>
                </div>
                <div
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isSelected && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

