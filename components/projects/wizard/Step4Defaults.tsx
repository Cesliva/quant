"use client";

import { WizardState } from "../NewProjectWizard";
import { TrendingUp, Target, FileText } from "lucide-react";

interface Step4DefaultsProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
}

const COMPLEXITY_OPTIONS = [
  { value: "low", label: "Low", description: "Standard, straightforward work" },
  { value: "medium", label: "Medium", description: "Moderate complexity" },
  { value: "high", label: "High", description: "Complex or challenging" },
];

const COMPETITIVE_LEVELS = [
  { value: "soft", label: "Soft", description: "Favorable competitive environment" },
  { value: "normal", label: "Normal", description: "Standard market conditions" },
  { value: "aggressive", label: "Aggressive", description: "Highly competitive bidding" },
];

export default function Step4Defaults({ state, onUpdate }: Step4DefaultsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Estimating Defaults
        </h2>
        <p className="text-gray-600 text-sm">
          Set default assumptions for this project's estimate. These can be adjusted later in Project Settings.
        </p>
      </div>

      <div className="space-y-6">
        {/* Complexity */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Complexity
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COMPLEXITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdate({ complexity: option.value })}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  state.complexity === option.value
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                <div className="font-semibold text-gray-900 mb-1">
                  {option.label}
                </div>
                <div className="text-xs text-gray-600">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Competitive Level */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            <Target className="w-4 h-4 inline mr-2" />
            Competitive Level
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COMPETITIVE_LEVELS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdate({ competitiveLevel: option.value })}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  state.competitiveLevel === option.value
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                <div className="font-semibold text-gray-900 mb-1">
                  {option.label}
                </div>
                <div className="text-xs text-gray-600">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            Notes / Assumptions
          </label>
          <textarea
            value={state.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Add any important notes or assumptions for this project..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          />
        </div>
      </div>
    </div>
  );
}

