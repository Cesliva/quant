"use client";

import { WizardState } from "../NewProjectWizard";
import Input from "@/components/ui/Input";
import { Building2, User, Briefcase } from "lucide-react";

interface Step2PartiesProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
}

export default function Step2Parties({ state, onUpdate }: Step2PartiesProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Parties
        </h2>
        <p className="text-gray-600 text-sm">
          Add key parties involved in this project. All fields are optional.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Contractor */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            General Contractor / Customer
          </label>
          <div className="relative">
            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              value={state.gc}
              onChange={(e) => onUpdate({ gc: e.target.value })}
              placeholder="e.g., Metro Construction Group"
              className="w-full pl-12"
            />
          </div>
        </div>

        {/* Owner */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Owner
          </label>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              value={state.owner}
              onChange={(e) => onUpdate({ owner: e.target.value })}
              placeholder="e.g., ABC Development LLC"
              className="w-full pl-12"
            />
          </div>
        </div>

        {/* Architect/Engineer */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Architect / Engineer
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              value={state.architectEngineer}
              onChange={(e) => onUpdate({ architectEngineer: e.target.value })}
              placeholder="e.g., Smith & Associates Architecture"
              className="w-full pl-12"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

