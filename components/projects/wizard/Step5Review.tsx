"use client";

import { WizardState } from "../NewProjectWizard";
import { Check, X } from "lucide-react";

interface Step5ReviewProps {
  state: WizardState;
}

export default function Step5Review({ state }: Step5ReviewProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return "Not set";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const hasScope = Object.values(state.scope).some(v => v);
  const hasParties = state.gc || state.owner || state.architectEngineer;
  const hasDefaults = state.complexity || state.competitiveLevel || state.notes;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-normal mb-2">
          Review & Create
        </h2>
        <p className="text-gray-600 text-sm">
          Review your project information before creating. You can go back to edit any step.
        </p>
      </div>

      <div className="space-y-6">
        {/* Basics */}
        <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="font-bold text-gray-900 tracking-normal mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">1</span>
            Project Basics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Project Name:</span>
              <p className="font-medium text-gray-900 mt-1">{state.projectName || "—"}</p>
            </div>
            <div>
              <span className="text-gray-600">Project Number:</span>
              <p className="font-medium text-gray-900 mt-1">{state.projectNumber || "—"}</p>
            </div>
            {state.projectType && (
              <div>
                <span className="text-gray-600">Project Type:</span>
                <p className="font-medium text-gray-900 mt-1">{state.projectType}</p>
              </div>
            )}
            {state.location && (
              <div>
                <span className="text-gray-600">Location:</span>
                <p className="font-medium text-gray-900 mt-1">{state.location}</p>
              </div>
            )}
            {state.bidDueDate && (
              <div>
                <span className="text-gray-600">Bid Due Date:</span>
                <p className="font-medium text-gray-900 mt-1">{formatDate(state.bidDueDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Parties */}
        {hasParties && (
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-900 tracking-normal mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">2</span>
              Parties
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {state.gc && (
                <div>
                  <span className="text-gray-600">General Contractor:</span>
                  <p className="font-medium text-gray-900 mt-1">{state.gc}</p>
                </div>
              )}
              {state.owner && (
                <div>
                  <span className="text-gray-600">Owner:</span>
                  <p className="font-medium text-gray-900 mt-1">{state.owner}</p>
                </div>
              )}
              {state.architectEngineer && (
                <div>
                  <span className="text-gray-600">Architect/Engineer:</span>
                  <p className="font-medium text-gray-900 mt-1">{state.architectEngineer}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scope */}
        {hasScope && (
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-900 tracking-normal mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">3</span>
              Scope
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {Object.entries(state.scope).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  {value ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-300" />
                  )}
                  <span className={value ? "text-gray-900 font-medium" : "text-gray-400"}>
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Defaults */}
        {hasDefaults && (
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-900 tracking-normal mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">4</span>
              Estimating Defaults
            </h3>
            <div className="space-y-3 text-sm">
              {state.complexity && (
                <div>
                  <span className="text-gray-600">Complexity:</span>
                  <p className="font-medium text-gray-900 mt-1 capitalize">{state.complexity}</p>
                </div>
              )}
              {state.competitiveLevel && (
                <div>
                  <span className="text-gray-600">Competitive Level:</span>
                  <p className="font-medium text-gray-900 mt-1 capitalize">{state.competitiveLevel}</p>
                </div>
              )}
              {state.notes && (
                <div>
                  <span className="text-gray-600">Notes:</span>
                  <p className="font-medium text-gray-900 mt-1 whitespace-pre-wrap">{state.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!hasParties && !hasScope && !hasDefaults && (
          <div className="p-6 bg-blue-50 rounded-xl border border-blue-200 text-center">
            <p className="text-blue-800 text-sm">
              Only required fields (Project Basics) are filled. Optional steps were skipped.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

