"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Save, Building2, DollarSign, Package, Paintbrush, Settings2, Plus, Trash2, Info } from "lucide-react";

type TabType = "company" | "labor" | "material" | "coating" | "markup" | "advanced";

interface LaborRate {
  id: string;
  trade: string;
  rate: number;
}

interface MaterialGrade {
  id: string;
  grade: string;
  costPerPound: number;
}

interface CoatingType {
  id: string;
  type: string;
  costPerSF: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("company");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("unsaved");

  const [companySettings, setCompanySettings] = useState({
    companyName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    licenseNumber: "",
    taxId: "",
  });

  const [laborRates, setLaborRates] = useState<LaborRate[]>([
    { id: "1", trade: "Fabricator", rate: 45 },
    { id: "2", trade: "Welder", rate: 55 },
    { id: "3", trade: "Fitter", rate: 50 },
    { id: "4", trade: "Painter", rate: 40 },
  ]);

  const [materialGrades, setMaterialGrades] = useState<MaterialGrade[]>([
    { id: "1", grade: "A36", costPerPound: 0.85 },
    { id: "2", grade: "A572 Gr50", costPerPound: 1.15 },
    { id: "3", grade: "A992", costPerPound: 1.05 },
  ]);

  const [coatingTypes, setCoatingTypes] = useState<CoatingType[]>([
    { id: "1", type: "Galvanized", costPerSF: 2.50 },
    { id: "2", type: "Paint (Primer + Topcoat)", costPerSF: 3.25 },
    { id: "3", type: "Powder Coat", costPerSF: 4.00 },
    { id: "4", type: "None", costPerSF: 0 },
  ]);

  const [markupSettings, setMarkupSettings] = useState({
    overheadPercentage: 15,
    profitPercentage: 10,
    materialWasteFactor: 5,
    laborWasteFactor: 10,
    salesTaxRate: 0,
    useTaxRate: 0,
  });

  const [advancedSettings, setAdvancedSettings] = useState({
    defaultUnit: "imperial",
    currencySymbol: "$",
    stockRounding: 0.125,
    defaultEstimator: "",
    autoSave: true,
  });

  useEffect(() => {
    // TODO: Load settings from Firestore
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("saving");
    
    try {
      // TODO: Save to Firestore
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log("Saving settings:", {
        company: companySettings,
        labor: laborRates,
        material: materialGrades,
        coating: coatingTypes,
        markup: markupSettings,
        advanced: advancedSettings,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("unsaved"), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const addLaborRate = () => {
    const newRate: LaborRate = {
      id: Date.now().toString(),
      trade: "",
      rate: 0,
    };
    setLaborRates([...laborRates, newRate]);
  };

  const removeLaborRate = (id: string) => {
    setLaborRates(laborRates.filter((rate) => rate.id !== id));
  };

  const updateLaborRate = (id: string, field: keyof LaborRate, value: string | number) => {
    setLaborRates(
      laborRates.map((rate) =>
        rate.id === id ? { ...rate, [field]: value } : rate
      )
    );
  };

  const addMaterialGrade = () => {
    const newGrade: MaterialGrade = {
      id: Date.now().toString(),
      grade: "",
      costPerPound: 0,
    };
    setMaterialGrades([...materialGrades, newGrade]);
  };

  const removeMaterialGrade = (id: string) => {
    setMaterialGrades(materialGrades.filter((grade) => grade.id !== id));
  };

  const updateMaterialGrade = (id: string, field: keyof MaterialGrade, value: string | number) => {
    setMaterialGrades(
      materialGrades.map((grade) =>
        grade.id === id ? { ...grade, [field]: value } : grade
      )
    );
  };

  const addCoatingType = () => {
    const newCoating: CoatingType = {
      id: Date.now().toString(),
      type: "",
      costPerSF: 0,
    };
    setCoatingTypes([...coatingTypes, newCoating]);
  };

  const removeCoatingType = (id: string) => {
    setCoatingTypes(coatingTypes.filter((coating) => coating.id !== id));
  };

  const updateCoatingType = (id: string, field: keyof CoatingType, value: string | number) => {
    setCoatingTypes(
      coatingTypes.map((coating) =>
        coating.id === id ? { ...coating, [field]: value } : coating
      )
    );
  };

  const tabs = [
    { id: "company" as TabType, label: "Company Info", icon: Building2 },
    { id: "labor" as TabType, label: "Labor Rates", icon: DollarSign },
    { id: "material" as TabType, label: "Material Costs", icon: Package },
    { id: "coating" as TabType, label: "Coating Rates", icon: Paintbrush },
    { id: "markup" as TabType, label: "Markup & Fees", icon: DollarSign },
    { id: "advanced" as TabType, label: "Advanced", icon: Settings2 },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure company defaults and estimating parameters
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "saved" && (
            <span className="text-sm text-green-600">Saved</span>
          )}
          {saveStatus === "saving" && (
            <span className="text-sm text-blue-600">Saving...</span>
          )}
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Company Info Tab */}
        {activeTab === "company" && (
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={companySettings.companyName}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, companyName: e.target.value })
                    }
                    placeholder="Enter company name"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <Input
                    value={companySettings.address}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, address: e.target.value })
                    }
                    placeholder="123 Main Street"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <Input
                    value={companySettings.city}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, city: e.target.value })
                    }
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <Input
                    value={companySettings.state}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, state: e.target.value })
                    }
                    placeholder="State"
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code
                  </label>
                  <Input
                    value={companySettings.zip}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, zip: e.target.value })
                    }
                    placeholder="12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    value={companySettings.phone}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, phone: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={companySettings.email}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, email: e.target.value })
                    }
                    placeholder="contact@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Number
                  </label>
                  <Input
                    value={companySettings.licenseNumber}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, licenseNumber: e.target.value })
                    }
                    placeholder="Contractor License #"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax ID / EIN
                  </label>
                  <Input
                    value={companySettings.taxId}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, taxId: e.target.value })
                    }
                    placeholder="XX-XXXXXXX"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Labor Rates Tab */}
        {activeTab === "labor" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Labor Rates by Trade</CardTitle>
                <Button variant="outline" size="sm" onClick={addLaborRate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Trade
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {laborRates.map((rate) => (
                  <div key={rate.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Trade
                        </label>
                        <Input
                          value={rate.trade}
                          onChange={(e) =>
                            updateLaborRate(rate.id, "trade", e.target.value)
                          }
                          placeholder="e.g., Fabricator, Welder"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rate ($/hr)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <Input
                            type="number"
                            value={rate.rate}
                            onChange={(e) =>
                              updateLaborRate(rate.id, "rate", parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                            className="pl-8"
                          />
                        </div>
                      </div>
                    </div>
                    {laborRates.length > 1 && (
                      <button
                        onClick={() => removeLaborRate(rate.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove trade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    These rates will be used as defaults for new projects. You can override them per project.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Material Costs Tab */}
        {activeTab === "material" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Material Costs by Grade</CardTitle>
                <Button variant="outline" size="sm" onClick={addMaterialGrade}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Grade
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {materialGrades.map((grade) => (
                  <div key={grade.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Steel Grade
                        </label>
                        <Input
                          value={grade.grade}
                          onChange={(e) =>
                            updateMaterialGrade(grade.id, "grade", e.target.value)
                          }
                          placeholder="e.g., A36, A572 Gr50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cost per Pound ($/lb)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={grade.costPerPound}
                            onChange={(e) =>
                              updateMaterialGrade(grade.id, "costPerPound", parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                            className="pl-8"
                          />
                        </div>
                      </div>
                    </div>
                    {materialGrades.length > 1 && (
                      <button
                        onClick={() => removeMaterialGrade(grade.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove grade"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    Update material costs regularly to ensure accurate estimates. Prices fluctuate with market conditions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coating Rates Tab */}
        {activeTab === "coating" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Coating Rates</CardTitle>
                <Button variant="outline" size="sm" onClick={addCoatingType}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Coating
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {coatingTypes.map((coating) => (
                  <div key={coating.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Coating Type
                        </label>
                        <Input
                          value={coating.type}
                          onChange={(e) =>
                            updateCoatingType(coating.id, "type", e.target.value)
                          }
                          placeholder="e.g., Galvanized, Paint"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cost per Square Foot ($/SF)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={coating.costPerSF}
                            onChange={(e) =>
                              updateCoatingType(coating.id, "costPerSF", parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                            className="pl-8"
                          />
                        </div>
                      </div>
                    </div>
                    {coatingTypes.length > 1 && (
                      <button
                        onClick={() => removeCoatingType(coating.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove coating"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Markup & Fees Tab */}
        {activeTab === "markup" && (
          <Card>
            <CardHeader>
              <CardTitle>Markup & Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Overhead Percentage (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      value={markupSettings.overheadPercentage}
                      onChange={(e) =>
                        setMarkupSettings({
                          ...markupSettings,
                          overheadPercentage: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.0"
                    />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Applied to direct costs</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profit Margin (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      value={markupSettings.profitPercentage}
                      onChange={(e) =>
                        setMarkupSettings({
                          ...markupSettings,
                          profitPercentage: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.0"
                    />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Applied after overhead</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material Waste Factor (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      value={markupSettings.materialWasteFactor}
                      onChange={(e) =>
                        setMarkupSettings({
                          ...markupSettings,
                          materialWasteFactor: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.0"
                    />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Overage for material waste and cutoffs</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Labor Waste Factor (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      value={markupSettings.laborWasteFactor}
                      onChange={(e) =>
                        setMarkupSettings({
                          ...markupSettings,
                          laborWasteFactor: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.0"
                    />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Buffer for rework and efficiency</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sales Tax Rate (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={markupSettings.salesTaxRate}
                      onChange={(e) =>
                        setMarkupSettings({
                          ...markupSettings,
                          salesTaxRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Use Tax Rate (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={markupSettings.useTaxRate}
                      onChange={(e) =>
                        setMarkupSettings({
                          ...markupSettings,
                          useTaxRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Advanced Tab */}
        {activeTab === "advanced" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Defaults</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stock Rounding (inches)
                    </label>
                    <Input
                      type="number"
                      step="0.125"
                      value={advancedSettings.stockRounding}
                      onChange={(e) =>
                        setAdvancedSettings({
                          ...advancedSettings,
                          stockRounding: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.125"
                    />
                    <p className="text-xs text-gray-500 mt-1">Standard stock increments (e.g., 0.125, 0.25)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Estimator
                    </label>
                    <Input
                      value={advancedSettings.defaultEstimator}
                      onChange={(e) =>
                        setAdvancedSettings({
                          ...advancedSettings,
                          defaultEstimator: e.target.value,
                        })
                      }
                      placeholder="Estimator name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit System
                    </label>
                    <select
                      value={advancedSettings.defaultUnit}
                      onChange={(e) =>
                        setAdvancedSettings({
                          ...advancedSettings,
                          defaultUnit: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="imperial">Imperial (lbs, feet, inches)</option>
                      <option value="metric">Metric (kg, meters, mm)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency Symbol
                    </label>
                    <Input
                      value={advancedSettings.currencySymbol}
                      onChange={(e) =>
                        setAdvancedSettings({
                          ...advancedSettings,
                          currencySymbol: e.target.value,
                        })
                      }
                      placeholder="$"
                      maxLength={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={advancedSettings.autoSave}
                      onChange={(e) =>
                        setAdvancedSettings({
                          ...advancedSettings,
                          autoSave: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Auto-save changes
                    </span>
                  </label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Project Defaults Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Additional project-level defaults can be configured in the Project Defaults page.
                </p>
                <Link href="/settings/project-defaults">
                  <Button variant="outline">Go to Project Defaults</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

