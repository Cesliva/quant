"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { getDocument, setDocument, updateDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { Save, CheckCircle, AlertCircle } from "lucide-react";
import { useCompanyId } from "@/lib/hooks/useCompanyId";

export default function ProjectDefaultsPage() {
  const companyId = useCompanyId();
  const [defaults, setDefaults] = useState({
    stockRounding: "",
    defaultGrade: "",
    coatingOptions: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("unsaved");

  useEffect(() => {
    if (companyId) {
      loadDefaults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadDefaults = async () => {
    if (!isFirebaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const companyPath = `companies/${companyId}`;
      const companyDoc = await getDocument(companyPath);
      
      if (companyDoc && companyDoc.projectDefaults) {
        setDefaults({
          stockRounding: companyDoc.projectDefaults.stockRounding || "",
          defaultGrade: companyDoc.projectDefaults.defaultGrade || "",
          coatingOptions: companyDoc.projectDefaults.coatingOptions || "",
        });
      }
    } catch (error) {
      console.error("Error loading project defaults:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured. Please set up your Firebase credentials.");
      return;
    }

    if (!companyId) {
      alert("Company ID is missing. Please refresh the page and try again.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const companyPath = `companies/${companyId}`;
      
      // Prepare project defaults - remove empty strings, keep undefined for fields to clear
      const projectDefaults: {
        stockRounding?: string;
        defaultGrade?: string;
        coatingOptions?: string;
      } = {};
      
      if (defaults.stockRounding.trim()) {
        projectDefaults.stockRounding = defaults.stockRounding.trim();
      }
      if (defaults.defaultGrade.trim()) {
        projectDefaults.defaultGrade = defaults.defaultGrade.trim();
      }
      if (defaults.coatingOptions.trim()) {
        projectDefaults.coatingOptions = defaults.coatingOptions.trim();
      }

      // Check if company document exists
      const companyDoc = await getDocument(companyPath);
      
      if (companyDoc) {
        // Document exists, update it - updateDocument uses updateDoc which merges fields
        await updateDocument("companies", companyId, {
          projectDefaults: Object.keys(projectDefaults).length > 0 ? projectDefaults : {},
        });
      } else {
        // Document doesn't exist, create it with merge: true to preserve any future fields
        await setDocument(companyPath, {
          projectDefaults: Object.keys(projectDefaults).length > 0 ? projectDefaults : {},
        }, true);
      }

      setSaveStatus("saved");
      setTimeout(() => {
        setSaveStatus("unsaved");
      }, 3000);
    } catch (error: any) {
      console.error("Error saving project defaults:", error);
      alert(`Failed to save project defaults: ${error.message || "Please try again."}`);
      setSaveStatus("unsaved");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Project Defaults</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Project Defaults</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Default Project Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Rounding
              </label>
              <Input
                value={defaults.stockRounding}
                onChange={(e) => {
                  setDefaults({ ...defaults, stockRounding: e.target.value });
                  setSaveStatus("unsaved");
                }}
                placeholder="e.g., 0.125"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Grade
              </label>
              <Input
                value={defaults.defaultGrade}
                onChange={(e) => {
                  setDefaults({ ...defaults, defaultGrade: e.target.value });
                  setSaveStatus("unsaved");
                }}
                placeholder="e.g., A36, A572"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coating Options (comma-separated)
              </label>
              <Input
                value={defaults.coatingOptions}
                onChange={(e) => {
                  setDefaults({ ...defaults, coatingOptions: e.target.value });
                  setSaveStatus("unsaved");
                }}
                placeholder="Galvanized, Paint, None"
              />
            </div>
            
            <div className="pt-4 flex items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Defaults"}
              </Button>
              {saveStatus === "saved" && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Saved</span>
                </div>
              )}
              {saveStatus === "saving" && (
                <div className="flex items-center gap-2 text-blue-600">
                  <AlertCircle className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Saving...</span>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

