"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { AlertCircle, CheckCircle2, Loader2, Info, Eye, EyeOff, Trash2 } from "lucide-react";
import { loadCompanySettings, saveCompanySettings } from "@/lib/utils/settingsLoader";

export default function SeedDataPage() {
  const companyId = useCompanyId();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSampleData, setShowSampleData] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    projectsCreated?: number;
    linesCreated?: number;
    projectsDeleted?: number;
    linesDeleted?: number;
    errors?: string[];
  } | null>(null);

  // Load the showSampleData setting
  useEffect(() => {
    const loadSetting = async () => {
      if (!companyId || companyId === "default") return;
      try {
        const settings = await loadCompanySettings(companyId);
        setShowSampleData(settings.showSampleData !== false); // Default to true if not set
      } catch (error) {
        console.error("Failed to load sample data setting:", error);
      }
    };
    loadSetting();
  }, [companyId]);

  // Save the toggle setting
  const handleToggleChange = async (value: boolean) => {
    if (!companyId || companyId === "default") return;
    
    setSavingToggle(true);
    try {
      const settings = await loadCompanySettings(companyId);
      await saveCompanySettings(companyId, {
        ...settings,
        showSampleData: value,
      });
      setShowSampleData(value);
    } catch (error) {
      console.error("Failed to save sample data setting:", error);
      alert("Failed to save setting. Please try again.");
    } finally {
      setSavingToggle(false);
    }
  };

  const handleSeedData = async () => {
    if (!companyId || companyId === "default") {
      alert("Please ensure you're logged in and have a valid company ID.");
      return;
    }

    if (!confirm(
      "This will create sample data for an $8M fab shop mid-year scenario.\n\n" +
      "This includes:\n" +
      "• 12 projects (won, active, lost)\n" +
      "• Hundreds of estimating lines\n" +
      "• Realistic steel fabrication data\n\n" +
      "Continue?"
    )) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/seed-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          ...data,
        });
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to seed data",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to seed data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSampleData = async () => {
    if (!companyId || companyId === "default") {
      alert("Please ensure you're logged in and have a valid company ID.");
      return;
    }

    if (!confirm(
      "⚠️ DELETE ALL SAMPLE DATA?\n\n" +
      "This will permanently remove:\n" +
      "• All sample projects\n" +
      "• All estimating lines in those projects\n\n" +
      "This action cannot be undone. Continue?"
    )) {
      return;
    }

    setDeleting(true);
    setResult(null);

    try {
      const response = await fetch("/api/seed-data", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          ...data,
        });
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to delete sample data",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete sample data",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sample Data Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage sample data visibility and generate test data for training
        </p>
      </div>

      {/* Toggle for showing/hiding sample data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Sample Data Visibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">
                Show Sample Data in Projects & Dashboard
              </label>
              <p className="text-sm text-gray-500 mt-1">
                Toggle this to show or hide sample data projects throughout Quant. When hidden, sample data projects won't appear in your project list, dashboard, or analytics.
              </p>
            </div>
            <div className="ml-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSampleData}
                  onChange={(e) => handleToggleChange(e.target.checked)}
                  disabled={savingToggle || !companyId || companyId === "default"}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">
                  {showSampleData ? (
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      Visible
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <EyeOff className="w-4 h-4" />
                      Hidden
                    </span>
                  )}
                </span>
              </label>
            </div>
          </div>
          {savingToggle && (
            <div className="text-sm text-blue-600">Saving...</div>
          )}
        </CardContent>
      </Card>

      {/* Helper Notes */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Info className="w-5 h-5" />
            How to Use Sample Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-blue-800">
          <div>
            <h4 className="font-semibold mb-1">Where to Find Sample Data:</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Projects Page:</strong> Sample projects appear in your project list (if visibility is enabled)</li>
              <li><strong>Company Dashboard:</strong> Sample data is included in pipeline value, win rates, and analytics</li>
              <li><strong>Cost Trends:</strong> Sample projects contribute to the streamgraph and trend analysis</li>
              <li><strong>Reports:</strong> Sample data can be included in exports and reports</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-1">What Sample Data Includes:</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>12 realistic projects in various states (won, active, lost)</li>
              <li>Hundreds of estimating lines with proper calculations</li>
              <li>Historical data spanning 6 months</li>
              <li>Realistic steel fabrication details (columns, beams, plates, misc metals)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Training & Testing:</h4>
            <p className="ml-2">
              Use sample data to explore Quant features, train new team members, or test workflows without affecting your real projects. 
              You can toggle visibility on/off anytime using the control above.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mid-Year $8M Fabrication Shop Scenario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">What will be created:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
              <li><strong>12 Projects</strong> in various states:
                <ul className="list-circle list-inside ml-4 mt-1 space-y-0.5">
                  <li>3 Won projects (completed or in production) - ~$2.5M</li>
                  <li>5 Active bids (in estimating) - ~$3.5M</li>
                  <li>3 Won but not started - ~$1.2M</li>
                  <li>2 Lost projects (for win/loss analysis) - ~$800K</li>
                </ul>
              </li>
              <li><strong>Hundreds of estimating lines</strong> with realistic:
                <ul className="list-circle list-inside ml-4 mt-1 space-y-0.5">
                  <li>Columns, Beams, Plates, Misc Metals</li>
                  <li>Material costs, labor hours, coating systems</li>
                  <li>Proper weight calculations and cost breakdowns</li>
                </ul>
              </li>
              <li><strong>Historical data</strong> spanning the past 6 months</li>
              <li><strong>Realistic project types:</strong> Commercial, Industrial, Infrastructure, Healthcare, etc.</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <strong>Note:</strong> This will create new projects and estimating lines in your database.
                The data is designed to test all Quant features including dashboards, analytics, trends, and reports.
                All sample projects are marked with <code className="bg-yellow-100 px-1 rounded">isSampleData: true</code> and can be hidden using the toggle above.
              </div>
            </div>
          </div>

          {result && (
            <div
              className={`rounded-lg p-4 border ${
                result.success
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div
                    className={`font-semibold ${
                      result.success ? "text-green-900" : "text-red-900"
                    }`}
                  >
                    {result.success ? "Success!" : "Error"}
                  </div>
                  <div
                    className={`text-sm mt-1 ${
                      result.success ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {result.message}
                  </div>
                  {result.success && (result.projectsCreated || result.linesCreated) && (
                    <div className="text-sm text-green-700 mt-2">
                      <div>Projects created: {result.projectsCreated}</div>
                      <div>Estimating lines created: {result.linesCreated}</div>
                    </div>
                  )}
                  {result.success && (result.projectsDeleted !== undefined || result.linesDeleted !== undefined) && (
                    <div className="text-sm text-green-700 mt-2">
                      <div>Projects deleted: {result.projectsDeleted}</div>
                      <div>Estimating lines deleted: {result.linesDeleted}</div>
                    </div>
                  )}
                  {result.errors && result.errors.length > 0 && (
                    <div className="text-sm text-red-700 mt-2">
                      <div className="font-semibold">Errors:</div>
                      <ul className="list-disc list-inside ml-2">
                        {result.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleSeedData}
              disabled={loading || deleting || !companyId || companyId === "default"}
              variant="primary"
              className="min-w-[200px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Seeding Data...
                </>
              ) : (
                "Generate Sample Data"
              )}
            </Button>
            
            <Button
              onClick={handleDeleteSampleData}
              disabled={loading || deleting || !companyId || companyId === "default"}
              variant="outline"
              className="min-w-[200px] border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Sample Data
                </>
              )}
            </Button>
          </div>

          {(!companyId || companyId === "default") && (
            <div className="text-sm text-gray-500">
              Please ensure you're logged in and have a valid company ID.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

