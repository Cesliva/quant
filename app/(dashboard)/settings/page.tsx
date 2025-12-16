"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Save, Building2, DollarSign, Package, Paintbrush, Settings2, Plus, Trash2, Info, AlertCircle, TrendingUp, BookOpen } from "lucide-react";
import CompanyAddressBook from "@/components/settings/CompanyAddressBook";
import { 
  loadCompanySettings, 
  saveCompanySettings, 
  type CompanySettings,
  type CompanyInfo 
} from "@/lib/utils/settingsLoader";
import { validateCompanySettings, getFieldError, type ValidationError } from "@/lib/utils/validation";
import { useCompanyId } from "@/lib/hooks/useCompanyId";

type TabType = "company" | "labor" | "material" | "coating" | "markup" | "advanced" | "executive" | "addressbook";

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

function SettingsPageContent() {
  const companyId = useCompanyId();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(tabParam && ["company", "labor", "material", "coating", "markup", "advanced", "executive", "addressbook"].includes(tabParam) ? tabParam : "company");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("unsaved");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

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

  const DEFAULT_WORKING_DAYS = ["mon", "tue", "wed", "thu", "fri"];
  const DAY_OPTIONS = [
    { key: "sun", label: "Sun" },
    { key: "mon", label: "Mon" },
    { key: "tue", label: "Tue" },
    { key: "wed", label: "Wed" },
    { key: "thu", label: "Thu" },
    { key: "fri", label: "Fri" },
    { key: "sat", label: "Sat" },
  ];

  const [executiveSettings, setExecutiveSettings] = useState({
    shopCapacityHoursPerWeek: 0,
    shopCapacityHoursPerDay: 0,
    backlogForecastWeeks: 24,
    underUtilizedThreshold: 0.7,
    workingDays: DEFAULT_WORKING_DAYS,
    holidays: [] as string[],
  });

  const [pipelineRanges, setPipelineRanges] = useState({
    small: { min: 0, max: 50000 },
    medium: { min: 50000, max: 100000 },
    large: { min: 100000, max: 250000 },
    xlarge: { min: 250000, max: 500000 },
    xxlarge: { min: 500000, max: 999999999 },
  });

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await loadCompanySettings(companyId);
      
      // Load company info
      if (settings.companyInfo) {
        setCompanySettings({
          companyName: settings.companyInfo.companyName || "",
          address: settings.companyInfo.address || "",
          city: settings.companyInfo.city || "",
          state: settings.companyInfo.state || "",
          zip: settings.companyInfo.zip || "",
          phone: settings.companyInfo.phone || "",
          email: settings.companyInfo.email || "",
          licenseNumber: settings.companyInfo.licenseNumber || "",
          taxId: settings.companyInfo.taxId || "",
        });
      }
      
      // Load labor rates
      if (settings.laborRates && settings.laborRates.length > 0) {
        setLaborRates(
          settings.laborRates.map((rate, index) => ({
            id: index.toString(),
            trade: rate.trade,
            rate: rate.rate,
          }))
        );
      }
      
      // Load material grades
      if (settings.materialGrades && settings.materialGrades.length > 0) {
        setMaterialGrades(
          settings.materialGrades.map((grade, index) => ({
            id: index.toString(),
            grade: grade.grade,
            costPerPound: grade.costPerPound,
          }))
        );
      }
      
      // Load coating types
      if (settings.coatingTypes && settings.coatingTypes.length > 0) {
        setCoatingTypes(
          settings.coatingTypes.map((coating, index) => ({
            id: index.toString(),
            type: coating.type,
            costPerSF: coating.costPerSF,
          }))
        );
      }
      
      // Load markup settings
      if (settings.markupSettings) {
        setMarkupSettings(settings.markupSettings);
      }
      
      // Load advanced settings
      if (settings.advancedSettings) {
        setAdvancedSettings(settings.advancedSettings);
      }
      
      // Load pipeline ranges
      if (settings.pipelineRanges) {
        setPipelineRanges(settings.pipelineRanges);
      }
      
      // Load executive dashboard settings
      setExecutiveSettings({
        shopCapacityHoursPerWeek: settings.shopCapacityHoursPerWeek ?? 0,
        shopCapacityHoursPerDay:
          settings.shopCapacityHoursPerDay ??
          (settings.shopCapacityHoursPerWeek
            ? Math.round((settings.shopCapacityHoursPerWeek || 0) / 5)
            : 0),
        backlogForecastWeeks: settings.backlogForecastWeeks ?? 24,
        underUtilizedThreshold: settings.underUtilizedThreshold ?? 0.7,
        workingDays:
          (settings.workingDays && settings.workingDays.length > 0
            ? settings.workingDays
            : DEFAULT_WORKING_DAYS),
        holidays: settings.holidays || [],
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam && ["company", "labor", "material", "coating", "markup", "advanced", "executive", "addressbook"].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [tabParam]);

  const handleSave = async () => {
    // Validate settings
    const validation = validateCompanySettings({
      companyName: companySettings.companyName,
      email: companySettings.email,
      phone: companySettings.phone,
      zip: companySettings.zip,
      state: companySettings.state,
      laborRates,
      materialGrades,
      coatingTypes,
      markupSettings,
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      // Switch to the first tab with errors
      const firstError = validation.errors[0];
      if (firstError.field.startsWith("laborRates")) {
        setActiveTab("labor");
      } else if (firstError.field.startsWith("materialGrades")) {
        setActiveTab("material");
      } else if (firstError.field.startsWith("coatingTypes")) {
        setActiveTab("coating");
      } else if (firstError.field.includes("Percentage") || firstError.field.includes("Factor")) {
        setActiveTab("markup");
      } else {
        setActiveTab("company");
      }
      return;
    }

    setValidationErrors([]);
    setIsSaving(true);
    setSaveStatus("saving");
    
    try {
      const settingsToSave: CompanySettings = {
        companyInfo: {
          companyName: companySettings.companyName,
          address: companySettings.address || undefined,
          city: companySettings.city || undefined,
          state: companySettings.state || undefined,
          zip: companySettings.zip || undefined,
          phone: companySettings.phone || undefined,
          email: companySettings.email || undefined,
          licenseNumber: companySettings.licenseNumber || undefined,
          taxId: companySettings.taxId || undefined,
        },
        materialGrades: materialGrades.map(({ id, ...rest }) => rest),
        laborRates: laborRates.map(({ id, ...rest }) => rest),
        coatingTypes: coatingTypes.map(({ id, ...rest }) => rest),
        markupSettings,
        advancedSettings,
        shopCapacityHoursPerWeek: executiveSettings.shopCapacityHoursPerWeek || undefined,
        shopCapacityHoursPerDay: executiveSettings.shopCapacityHoursPerDay || undefined,
        backlogForecastWeeks: executiveSettings.backlogForecastWeeks || undefined,
        underUtilizedThreshold: executiveSettings.underUtilizedThreshold || undefined,
        workingDays:
          executiveSettings.workingDays && executiveSettings.workingDays.length > 0
            ? executiveSettings.workingDays
            : undefined,
        holidays:
          executiveSettings.holidays?.filter((date) => date && date.trim() !== "") || undefined,
        pipelineRanges: pipelineRanges,
      };

      await saveCompanySettings(companyId, settingsToSave);
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

  const toggleWorkingDay = (dayKey: string) => {
    setExecutiveSettings((prev) => {
      const current = new Set(prev.workingDays || []);
      if (current.has(dayKey)) {
        current.delete(dayKey);
      } else {
        current.add(dayKey);
      }
      const ordered = DAY_OPTIONS.map((day) => (current.has(day.key) ? day.key : null)).filter(
        Boolean
      ) as string[];
      return {
        ...prev,
        workingDays: ordered,
      };
    });
  };

  const handleHolidayChange = (index: number, value: string) => {
    setExecutiveSettings((prev) => {
      const next = [...(prev.holidays || [])];
      next[index] = value;
      return { ...prev, holidays: next };
    });
  };

  const handleAddHoliday = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    setExecutiveSettings((prev) => ({
      ...prev,
      holidays: [...(prev.holidays || []), todayStr],
    }));
  };

  const handleRemoveHoliday = (index: number) => {
    setExecutiveSettings((prev) => {
      const next = [...(prev.holidays || [])];
      next.splice(index, 1);
      return { ...prev, holidays: next };
    });
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
    { id: "addressbook" as TabType, label: "Address Book", icon: BookOpen },
    { id: "executive" as TabType, label: "Executive Dashboard", icon: TrendingUp },
    { id: "advanced" as TabType, label: "Advanced", icon: Settings2 },
  ];

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                Please fix the following errors:
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
                    onChange={(e) => {
                      setCompanySettings({ ...companySettings, companyName: e.target.value });
                      // Clear validation error for this field
                      setValidationErrors(validationErrors.filter(e => e.field !== "companyName"));
                    }}
                    placeholder="Enter company name"
                    required
                    className={getFieldError("companyName", validationErrors) ? "border-red-500" : ""}
                  />
                  {getFieldError("companyName", validationErrors) && (
                    <p className="text-xs text-red-600 mt-1">
                      {getFieldError("companyName", validationErrors)}
                    </p>
                  )}
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
                    onChange={(e) => {
                      setCompanySettings({ ...companySettings, state: e.target.value.toUpperCase() });
                      setValidationErrors(validationErrors.filter(e => e.field !== "state"));
                    }}
                    placeholder="State"
                    maxLength={2}
                    className={getFieldError("state", validationErrors) ? "border-red-500" : ""}
                  />
                  {getFieldError("state", validationErrors) && (
                    <p className="text-xs text-red-600 mt-1">
                      {getFieldError("state", validationErrors)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code
                  </label>
                  <Input
                    value={companySettings.zip}
                    onChange={(e) => {
                      setCompanySettings({ ...companySettings, zip: e.target.value });
                      setValidationErrors(validationErrors.filter(e => e.field !== "zip"));
                    }}
                    placeholder="12345"
                    className={getFieldError("zip", validationErrors) ? "border-red-500" : ""}
                  />
                  {getFieldError("zip", validationErrors) && (
                    <p className="text-xs text-red-600 mt-1">
                      {getFieldError("zip", validationErrors)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    value={companySettings.phone}
                    onChange={(e) => {
                      setCompanySettings({ ...companySettings, phone: e.target.value });
                      setValidationErrors(validationErrors.filter(e => e.field !== "phone"));
                    }}
                    placeholder="(555) 123-4567"
                    className={getFieldError("phone", validationErrors) ? "border-red-500" : ""}
                  />
                  {getFieldError("phone", validationErrors) && (
                    <p className="text-xs text-red-600 mt-1">
                      {getFieldError("phone", validationErrors)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={companySettings.email}
                    onChange={(e) => {
                      setCompanySettings({ ...companySettings, email: e.target.value });
                      setValidationErrors(validationErrors.filter(e => e.field !== "email"));
                    }}
                    placeholder="contact@company.com"
                    className={getFieldError("email", validationErrors) ? "border-red-500" : ""}
                  />
                  {getFieldError("email", validationErrors) && (
                    <p className="text-xs text-red-600 mt-1">
                      {getFieldError("email", validationErrors)}
                    </p>
                  )}
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

        {/* Executive Dashboard Tab */}
        {activeTab === "executive" && (
          <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shop Capacity & Backlog Settings</CardTitle>
              <p className="text-sm text-gray-500 mt-2">
                Configure shop capacity for hours-based backlog calculation and capacity gap detection
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shop Capacity (Hours/Week) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={executiveSettings.shopCapacityHoursPerWeek}
                    onChange={(e) =>
                      setExecutiveSettings({
                        ...executiveSettings,
                        shopCapacityHoursPerWeek: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="800"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Total shop fabrication hours available per week (e.g., 800 hrs/week)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Capacity (Hours/Day)
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={executiveSettings.shopCapacityHoursPerDay}
                    onChange={(e) =>
                      setExecutiveSettings({
                        ...executiveSettings,
                        shopCapacityHoursPerDay: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder={
                      executiveSettings.shopCapacityHoursPerWeek
                        ? Math.round(executiveSettings.shopCapacityHoursPerWeek / 5).toString()
                        : "100"
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used for daily scheduling and capacity colors (e.g., 100 hrs/day)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Backlog Forecast Weeks
                  </label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="104"
                    value={executiveSettings.backlogForecastWeeks}
                    onChange={(e) =>
                      setExecutiveSettings({
                        ...executiveSettings,
                        backlogForecastWeeks: parseInt(e.target.value) || 24,
                      })
                    }
                    placeholder="24"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of weeks to forecast for capacity planning (default: 24 weeks ≈ 6 months)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Under-Utilized Threshold
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={executiveSettings.underUtilizedThreshold}
                      onChange={(e) =>
                        setExecutiveSettings({
                          ...executiveSettings,
                          underUtilizedThreshold: parseFloat(e.target.value) || 0.7,
                        })
                      }
                      placeholder="0.70"
                    />
                    <span className="absolute right-3 top-2 text-gray-500">(0-1)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Weeks below this utilization % are considered "gaps" for aggressive bidding (default: 0.7 = 70%)
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Working Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map((day) => {
                      const isActive = executiveSettings.workingDays?.includes(day.key);
                      return (
                        <label
                          key={day.key}
                          className={`px-3 py-2 rounded-lg border text-sm cursor-pointer ${
                            isActive
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-700 border-gray-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isActive}
                            onChange={() => toggleWorkingDay(day.key)}
                          />
                          {day.label}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Only checked days will be used when auto-scheduling production.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Holidays / Shutdowns
                  </label>
                  <div className="space-y-2">
                    {(executiveSettings.holidays || []).length === 0 && (
                      <p className="text-xs text-gray-500">
                        No holidays added. Days listed here are skipped entirely in the schedule.
                      </p>
                    )}
                    {(executiveSettings.holidays || []).map((holiday, index) => (
                      <div key={`${holiday}-${index}`} className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={holiday}
                          onChange={(e) => handleHolidayChange(index, e.target.value)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-red-600"
                          onClick={() => handleRemoveHoliday(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={handleAddHoliday}>
                      Add Holiday
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">How it works:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Backlog months = Total remaining shop hours ÷ (weekly capacity × 4.345)</li>
                      <li>The system allocates project hours forward into weekly buckets</li>
                      <li>Weeks with utilization below the threshold are flagged as capacity gaps</li>
                      <li>These gaps indicate when you can bid more aggressively</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

            <Card>
          <CardHeader>
            <CardTitle>Pipeline Distribution Ranges</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Configure bid value ranges for the Pipeline Distribution chart on the dashboard
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Small (Min)
                  </label>
                  <Input
                    type="number"
                    value={pipelineRanges.small.min}
                    onChange={(e) =>
                      setPipelineRanges({
                        ...pipelineRanges,
                        small: { ...pipelineRanges.small, min: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Small (Max) - Red
                  </label>
                  <Input
                    type="number"
                    value={pipelineRanges.small.max}
                    onChange={(e) =>
                      setPipelineRanges({
                        ...pipelineRanges,
                        small: { ...pipelineRanges.small, max: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medium (Min) - Orange
                  </label>
                  <Input
                    type="number"
                    value={pipelineRanges.medium.min}
                    onChange={(e) =>
                      setPipelineRanges({
                        ...pipelineRanges,
                        medium: { ...pipelineRanges.medium, min: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medium (Max)
                  </label>
                  <Input
                    type="number"
                    value={pipelineRanges.medium.max}
                    onChange={(e) =>
                      setPipelineRanges({
                        ...pipelineRanges,
                        medium: { ...pipelineRanges.medium, max: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Large (Min) - Yellow
                  </label>
                  <Input
                    type="number"
                    value={pipelineRanges.large.min}
                    onChange={(e) =>
                      setPipelineRanges({
                        ...pipelineRanges,
                        large: { ...pipelineRanges.large, min: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Large (Max)
                  </label>
                  <Input
                    type="number"
                    value={pipelineRanges.large.max}
                    onChange={(e) =>
                      setPipelineRanges({
                        ...pipelineRanges,
                        large: { ...pipelineRanges.large, max: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    X-Large (Min) - Blue
                  </label>
                  <Input
                    type="number"
                    value={pipelineRanges.xlarge.min}
                    onChange={(e) =>
                      setPipelineRanges({
                        ...pipelineRanges,
                        xlarge: { ...pipelineRanges.xlarge, min: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    X-Large (Max)
                  </label>
                  <Input
                    type="number"
                    value={pipelineRanges.xlarge.max}
                    onChange={(e) =>
                      setPipelineRanges({
                        ...pipelineRanges,
                        xlarge: { ...pipelineRanges.xlarge, max: parseFloat(e.target.value) || 0 },
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    XX-Large (Min) - Green
                  </label>
                  <Input
                    type="number"
                    value={pipelineRanges.xxlarge.min}
                    onChange={(e) =>
                      setPipelineRanges({
                        ...pipelineRanges,
                        xxlarge: { ...pipelineRanges.xxlarge, min: parseFloat(e.target.value) || 0 },
                      })
                    }
                    placeholder="500000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    XX-Large (Max)
                  </label>
                  <Input
                    type="text"
                    value="No limit"
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">No upper limit</p>
                </div>
              </div>
            </div>
          </CardContent>
            </Card>
          </div>
        )}

        {/* Address Book Tab */}
        {activeTab === "addressbook" && (
          <div className="space-y-6">
            <CompanyAddressBook companyId={companyId} compact={false} />
          </div>
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

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading settings...</p>
          </div>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}

