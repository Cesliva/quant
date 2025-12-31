"use client";

import { WizardState } from "../NewProjectWizard";
import Input from "@/components/ui/Input";
import { Building2, Hash, MapPin, Calendar, Info } from "lucide-react";

interface Step1BasicsProps {
  state: WizardState;
  errors: Record<string, string>;
  autoProjectNumber: string;
  onUpdate: (updates: Partial<WizardState>) => void;
}

const PROJECT_TYPES = [
  "Commercial",
  "Industrial",
  "Healthcare",
  "Education",
  "Public",
  "Other",
];

export default function Step1Basics({
  state,
  errors,
  autoProjectNumber,
  onUpdate,
}: Step1BasicsProps) {
  const handleProjectNumberChange = (value: string) => {
    onUpdate({
      projectNumber: value,
      projectNumberSource: value === autoProjectNumber ? "auto" : "manual",
    });
  };

  const handleResetProjectNumber = () => {
    onUpdate({
      projectNumber: autoProjectNumber,
      projectNumberSource: "auto",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Project Basics
        </h2>
        <p className="text-gray-600 text-sm">
          Provide the essential information about your project. All fields are required.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Project Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              value={state.projectName}
              onChange={(e) => onUpdate({ projectName: e.target.value })}
              placeholder="e.g., Downtown Office Tower - Structural Steel"
              required
              className={`w-full pl-12 ${errors.projectName ? "border-red-500" : ""}`}
            />
          </div>
          {errors.projectName && (
            <p className="mt-1 text-sm text-red-600">{errors.projectName}</p>
          )}
        </div>

        {/* Project Number */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Project Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              value={state.projectNumber}
              onChange={(e) => handleProjectNumberChange(e.target.value)}
              placeholder="Auto-generated"
              required
              className={`w-full pl-12 ${errors.projectNumber ? "border-red-500" : ""}`}
            />
          </div>
          {state.projectNumberSource === "auto" && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-blue-900">
                  Auto-generated from company settings. You can edit this if needed.
                </p>
              </div>
            </div>
          )}
          {state.projectNumberSource === "manual" && state.projectNumber !== autoProjectNumber && (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleResetProjectNumber}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Reset to auto-generated
              </button>
            </div>
          )}
          {errors.projectNumber && (
            <p className="mt-1 text-sm text-red-600">{errors.projectNumber}</p>
          )}
        </div>

        {/* Project Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Project Type
          </label>
          <select
            value={state.projectType}
            onChange={(e) => onUpdate({ projectType: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">Select type...</option>
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Location
          </label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              value={state.location}
              onChange={(e) => onUpdate({ location: e.target.value })}
              placeholder="City, State"
              className="w-full pl-12"
            />
          </div>
        </div>

        {/* Bid Due Date */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Bid Due Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="date"
              value={state.bidDueDate}
              onChange={(e) => onUpdate({ bidDueDate: e.target.value })}
              className="w-full pl-12"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

