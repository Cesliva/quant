"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { 
  Flame, 
  Wrench, 
  ChevronDown, 
  ChevronUp, 
  Info,
  AlertTriangle,
  Zap,
  Scissors,
  Circle
} from "lucide-react";
import { ConsumablesSettings } from "@/lib/utils/settingsLoader";

interface ConsumablesSettingsPanelProps {
  settings: ConsumablesSettings;
  onChange: (settings: ConsumablesSettings) => void;
}

const DEFAULT_CONSUMABLES: ConsumablesSettings = {
  laborDriven: {
    weldingConsumablesPerHour: 8.50,      // wire, gas, grinding
    generalFabConsumablesPerHour: 3.25,   // layout, disposables
  },
  equipmentDriven: {
    plasmaCuttingPerHour: 25.00,
    sawCuttingPerHour: 12.00,
    drillMachiningPerHour: 15.00,
  },
  jobTypeMultipliers: {
    structuralSteel: 1.00,
    miscMetalsStairsRails: 1.15,
    heavyWeldJobs: 1.25,
  },
};

export default function ConsumablesSettingsPanel({
  settings,
  onChange,
}: ConsumablesSettingsPanelProps) {
  const [showJobModifiers, setShowJobModifiers] = useState(false);
  
  // Merge with defaults to ensure all values exist
  const currentSettings: ConsumablesSettings = {
    laborDriven: {
      weldingConsumablesPerHour: settings?.laborDriven?.weldingConsumablesPerHour ?? DEFAULT_CONSUMABLES.laborDriven.weldingConsumablesPerHour,
      generalFabConsumablesPerHour: settings?.laborDriven?.generalFabConsumablesPerHour ?? DEFAULT_CONSUMABLES.laborDriven.generalFabConsumablesPerHour,
    },
    equipmentDriven: {
      plasmaCuttingPerHour: settings?.equipmentDriven?.plasmaCuttingPerHour ?? DEFAULT_CONSUMABLES.equipmentDriven.plasmaCuttingPerHour,
      sawCuttingPerHour: settings?.equipmentDriven?.sawCuttingPerHour ?? DEFAULT_CONSUMABLES.equipmentDriven.sawCuttingPerHour,
      drillMachiningPerHour: settings?.equipmentDriven?.drillMachiningPerHour ?? DEFAULT_CONSUMABLES.equipmentDriven.drillMachiningPerHour,
    },
    jobTypeMultipliers: {
      structuralSteel: settings?.jobTypeMultipliers?.structuralSteel ?? DEFAULT_CONSUMABLES.jobTypeMultipliers!.structuralSteel,
      miscMetalsStairsRails: settings?.jobTypeMultipliers?.miscMetalsStairsRails ?? DEFAULT_CONSUMABLES.jobTypeMultipliers!.miscMetalsStairsRails,
      heavyWeldJobs: settings?.jobTypeMultipliers?.heavyWeldJobs ?? DEFAULT_CONSUMABLES.jobTypeMultipliers!.heavyWeldJobs,
    },
  };

  const handleLaborDrivenChange = (field: keyof ConsumablesSettings['laborDriven'], value: number) => {
    onChange({
      ...currentSettings,
      laborDriven: {
        ...currentSettings.laborDriven,
        [field]: value,
      },
    });
  };

  const handleEquipmentDrivenChange = (field: keyof ConsumablesSettings['equipmentDriven'], value: number) => {
    onChange({
      ...currentSettings,
      equipmentDriven: {
        ...currentSettings.equipmentDriven,
        [field]: value,
      },
    });
  };

  const handleMultiplierChange = (field: keyof NonNullable<ConsumablesSettings['jobTypeMultipliers']>, value: number) => {
    onChange({
      ...currentSettings,
      jobTypeMultipliers: {
        ...currentSettings.jobTypeMultipliers!,
        [field]: value,
      },
    });
  };

  // Check if all rates are zero - show soft warning
  const allRatesZero = 
    currentSettings.laborDriven.weldingConsumablesPerHour === 0 &&
    currentSettings.laborDriven.generalFabConsumablesPerHour === 0 &&
    currentSettings.equipmentDriven.plasmaCuttingPerHour === 0 &&
    currentSettings.equipmentDriven.sawCuttingPerHour === 0 &&
    currentSettings.equipmentDriven.drillMachiningPerHour === 0;

  return (
    <Card>
      <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Flame className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <CardTitle className="font-extrabold text-gray-900 tracking-normal">Consumables & Equipment Drivers</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Consumables are calculated automatically based on labor and equipment usage. They are not part of labor cost.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Soft Warning if all rates are zero */}
        {allRatesZero && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              Consumables are currently set to $0. This may understate true job cost.
            </p>
          </div>
        )}

        {/* Section A: Labor-Driven Consumables */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-bold text-gray-900 tracking-normal">Labor-Driven Consumables</h3>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Applied to direct labor hours. Trade-agnostic (does not depend on labor rate).
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Welding Consumables
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentSettings.laborDriven.weldingConsumablesPerHour}
                  onChange={(e) => handleLaborDrivenChange('weldingConsumablesPerHour', parseFloat(e.target.value) || 0)}
                  className="pl-8"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">/ weld hr</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Wire, gas, grinding discs</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                General Fabrication Consumables
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentSettings.laborDriven.generalFabConsumablesPerHour}
                  onChange={(e) => handleLaborDrivenChange('generalFabConsumablesPerHour', parseFloat(e.target.value) || 0)}
                  className="pl-8"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">/ shop hr</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Layout, minor grinding, disposables</p>
            </div>
          </div>
        </div>

        {/* Section B: Equipment-Driven Consumables */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-bold text-gray-900 tracking-normal">Equipment-Driven Consumables</h3>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Driven by machine time, not labor rate. Machine hours come from estimate logic.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plasma Cutting
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentSettings.equipmentDriven.plasmaCuttingPerHour}
                  onChange={(e) => handleEquipmentDrivenChange('plasmaCuttingPerHour', parseFloat(e.target.value) || 0)}
                  className="pl-8"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">/ hr</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Saw Cutting
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentSettings.equipmentDriven.sawCuttingPerHour}
                  onChange={(e) => handleEquipmentDrivenChange('sawCuttingPerHour', parseFloat(e.target.value) || 0)}
                  className="pl-8"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">/ hr</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Drill / Machining
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentSettings.equipmentDriven.drillMachiningPerHour}
                  onChange={(e) => handleEquipmentDrivenChange('drillMachiningPerHour', parseFloat(e.target.value) || 0)}
                  className="pl-8"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">/ hr</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section C: Job Type Modifiers (Collapsible) */}
        <div className="pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowJobModifiers(!showJobModifiers)}
            className="flex items-center justify-between w-full text-left hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Job-Type Modifiers</span>
              <span className="text-xs text-gray-400">(Optional)</span>
            </div>
            {showJobModifiers ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showJobModifiers && (
            <div className="mt-4 space-y-4 pl-6">
              <p className="text-xs text-gray-500">
                Multipliers applied to total consumables based on job type. Allows realism without forcing complexity.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Structural Steel
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.5"
                      max="2.0"
                      value={currentSettings.jobTypeMultipliers?.structuralSteel ?? 1.0}
                      onChange={(e) => handleMultiplierChange('structuralSteel', parseFloat(e.target.value) || 1.0)}
                    />
                    <span className="absolute right-3 top-2 text-gray-400 text-sm">×</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Misc Metals / Stairs / Rails
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.5"
                      max="2.0"
                      value={currentSettings.jobTypeMultipliers?.miscMetalsStairsRails ?? 1.15}
                      onChange={(e) => handleMultiplierChange('miscMetalsStairsRails', parseFloat(e.target.value) || 1.15)}
                    />
                    <span className="absolute right-3 top-2 text-gray-400 text-sm">×</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heavy Weld Jobs
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.5"
                      max="2.0"
                      value={currentSettings.jobTypeMultipliers?.heavyWeldJobs ?? 1.25}
                      onChange={(e) => handleMultiplierChange('heavyWeldJobs', parseFloat(e.target.value) || 1.25)}
                    />
                    <span className="absolute right-3 top-2 text-gray-400 text-sm">×</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800">
              <p className="font-medium mb-1">How consumables are calculated:</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                <li>Labor consumables = (Weld hours × Weld rate) + (Shop hours × Gen. rate)</li>
                <li>Equipment consumables = (Plasma hrs × rate) + (Saw hrs × rate) + (Drill hrs × rate)</li>
                <li>Total = (Labor + Equipment consumables) × Job type multiplier</li>
              </ul>
              <p className="mt-2 text-blue-600">
                These appear as a separate line in estimate summaries and roll up into Direct Job Cost.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { DEFAULT_CONSUMABLES };
