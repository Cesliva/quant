"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Save, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { 
  loadCompanySettings, 
  saveCompanySettings, 
  type CompanySettings 
} from "@/lib/utils/settingsLoader";

interface CompanySettingsPanelProps {
  companyId: string;
  compact?: boolean;
}

export default function CompanySettingsPanel({ companyId, compact = false }: CompanySettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("unsaved");

  const [companySettings, setCompanySettings] = useState({
    companyName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
  });

  const [laborRates, setLaborRates] = useState<Array<{ id: string; trade: string; rate: number }>>([]);
  const [materialGrades, setMaterialGrades] = useState<Array<{ id: string; grade: string; costPerPound: number }>>([]);
  const [coatingTypes, setCoatingTypes] = useState<Array<{ id: string; type: string; costPerSF?: number; costPerPound?: number }>>([]);
  const [markupSettings, setMarkupSettings] = useState({
    overheadPercentage: 15,
    profitPercentage: 10,
  });

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await loadCompanySettings(companyId);
      
      if (settings.companyInfo) {
        setCompanySettings({
          companyName: settings.companyInfo.companyName || "",
          address: settings.companyInfo.address || "",
          city: settings.companyInfo.city || "",
          state: settings.companyInfo.state || "",
          zip: settings.companyInfo.zip || "",
          phone: settings.companyInfo.phone || "",
          email: settings.companyInfo.email || "",
        });
      }

      setLaborRates(
        settings.laborRates.map((rate, index) => ({
          id: index.toString(),
          ...rate,
        }))
      );

      setMaterialGrades(
        settings.materialGrades.map((grade, index) => ({
          id: index.toString(),
          ...grade,
        }))
      );

      setCoatingTypes(
        settings.coatingTypes.map((coating, index) => ({
          id: index.toString(),
          ...coating,
        }))
      );

      setMarkupSettings({
        overheadPercentage: settings.markupSettings.overheadPercentage,
        profitPercentage: settings.markupSettings.profitPercentage,
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
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
        },
        materialGrades: materialGrades.map(({ id, ...rest }) => rest),
        laborRates: laborRates.map(({ id, ...rest }) => rest),
        coatingTypes: coatingTypes.map(({ id, ...rest }) => rest),
        markupSettings: {
          ...markupSettings,
          materialWasteFactor: 5,
          laborWasteFactor: 10,
          salesTaxRate: 0,
          useTaxRate: 0,
        },
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Company Settings
          </CardTitle>
          {compact && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Company Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companySettings.companyName}
                  onChange={(e) => setCompanySettings({ ...companySettings, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={companySettings.city}
                  onChange={(e) => setCompanySettings({ ...companySettings, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={companySettings.state}
                  onChange={(e) => setCompanySettings({ ...companySettings, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={companySettings.phone}
                  onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={companySettings.email}
                  onChange={(e) => setCompanySettings({ ...companySettings, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Labor Rates Summary */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Labor Rates</h3>
            <div className="space-y-2">
              {laborRates.slice(0, compact ? 3 : laborRates.length).map((rate) => (
                <div key={rate.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{rate.trade}</span>
                  <span className="font-medium text-gray-900">${rate.rate}/hr</span>
                </div>
              ))}
            </div>
          </div>

          {/* Material Grades Summary */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Material Grades</h3>
            <div className="space-y-2">
              {materialGrades.slice(0, compact ? 3 : materialGrades.length).map((grade) => (
                <div key={grade.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{grade.grade}</span>
                  <span className="font-medium text-gray-900">${grade.costPerPound}/lb</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coating Types Summary */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Coating Types</h3>
            <div className="space-y-2">
              {coatingTypes.slice(0, compact ? 3 : coatingTypes.length).map((coating) => {
                const isGalvanizing = coating.type.toLowerCase().includes("galvanizing") || coating.type.toLowerCase().includes("galv");
                const costDisplay = isGalvanizing 
                  ? (coating.costPerPound !== undefined ? `$${coating.costPerPound}/lb` : "-")
                  : (coating.costPerSF !== undefined ? `$${coating.costPerSF}/SF` : "-");
                return (
                  <div key={coating.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{coating.type}</span>
                    <span className="font-medium text-gray-900">{costDisplay}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Markup Settings */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Markup</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Overhead %
                </label>
                <input
                  type="number"
                  value={markupSettings.overheadPercentage}
                  onChange={(e) => setMarkupSettings({ ...markupSettings, overheadPercentage: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Profit %
                </label>
                <input
                  type="number"
                  value={markupSettings.profitPercentage}
                  onChange={(e) => setMarkupSettings({ ...markupSettings, profitPercentage: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              {saveStatus === "saved" && (
                <span className="text-sm text-green-600">Saved</span>
              )}
              {saveStatus === "saving" && (
                <span className="text-sm text-blue-600">Saving...</span>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

