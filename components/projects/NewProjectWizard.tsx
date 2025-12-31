"use client";

/**
 * New Project Wizard
 * 
 * A guided 4-5 step wizard for creating new projects in Quant.
 * Desktop-first design, responsive down to iPad.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { loadCompanySettings } from "@/lib/utils/settingsLoader";
import { 
  generateProjectNumber, 
  getProjectNumberingSettings,
  incrementProjectSequence 
} from "@/lib/utils/projectNumbering";
import { createDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import Step1Basics from "./wizard/Step1Basics";
import Step2Parties from "./wizard/Step2Parties";
import Step3Scope from "./wizard/Step3Scope";
import Step4Defaults from "./wizard/Step4Defaults";
import Step5Review from "./wizard/Step5Review";

export interface WizardState {
  // Step 1: Basics (Required)
  projectName: string;
  projectNumber: string;
  projectNumberSource: "auto" | "manual";
  projectType: string;
  location: string;
  bidDueDate: string;

  // Step 2: Parties (Optional)
  gc: string;
  owner: string;
  architectEngineer: string;

  // Step 3: Scope (Optional)
  scope: {
    structural: boolean;
    miscMetals: boolean;
    stairsRails: boolean;
    buyouts: boolean;
    finishes: boolean;
    erection: boolean;
  };

  // Step 4: Defaults (Optional)
  complexity: string;
  competitiveLevel: string;
  notes: string;
}

const INITIAL_STATE: WizardState = {
  projectName: "",
  projectNumber: "",
  projectNumberSource: "auto",
  projectType: "",
  location: "",
  bidDueDate: "",
  gc: "",
  owner: "",
  architectEngineer: "",
  scope: {
    structural: false,
    miscMetals: false,
    stairsRails: false,
    buyouts: false,
    finishes: false,
    erection: false,
  },
  complexity: "",
  competitiveLevel: "",
  notes: "",
};

const STEPS = [
  { id: 1, name: "Basics", required: true },
  { id: 2, name: "Parties", required: false },
  { id: 3, name: "Scope", required: false },
  { id: 4, name: "Defaults", required: false },
  { id: 5, name: "Review", required: false },
];

export default function NewProjectWizard() {
  const router = useRouter();
  const companyId = useCompanyId();
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [autoProjectNumber, setAutoProjectNumber] = useState("");

  // Load company settings and generate project number
  useEffect(() => {
    const loadSettings = async () => {
      if (!companyId || !isFirebaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        const numberingSettings = await getProjectNumberingSettings(companyId);
        const generatedNumber = generateProjectNumber(numberingSettings);
        setAutoProjectNumber(generatedNumber);
        setWizardState(prev => ({
          ...prev,
          projectNumber: generatedNumber,
          projectNumberSource: "auto",
        }));
      } catch (error) {
        console.error("Failed to load project numbering settings:", error);
        // Fallback to simple number
        const fallback = `Q-${new Date().getFullYear()}-001`;
        setAutoProjectNumber(fallback);
        setWizardState(prev => ({
          ...prev,
          projectNumber: fallback,
          projectNumberSource: "auto",
        }));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [companyId]);

  const updateWizardState = (updates: Partial<WizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
    // Clear errors when user makes changes
    if (Object.keys(errors).length > 0) {
      setErrors({});
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!wizardState.projectName.trim()) {
        newErrors.projectName = "Project name is required";
      }
      if (!wizardState.projectNumber.trim()) {
        newErrors.projectNumber = "Project number is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep(1)) {
      return;
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleCreateProject = async () => {
    // Final validation
    if (!validateStep(1)) {
      setCurrentStep(1);
      return;
    }

    setCreating(true);
    setErrors({});

    try {
      if (!isFirebaseConfigured() || !companyId) {
        throw new Error("Firebase not configured or company ID missing");
      }

      // Prepare project data
      const projectData: any = {
        projectName: wizardState.projectName.trim(),
        projectNumber: wizardState.projectNumber.trim(),
        projectType: wizardState.projectType || undefined,
        location: wizardState.location || undefined,
        bidDueDate: wizardState.bidDueDate || undefined,
        status: "draft",
        // Parties
        generalContractor: wizardState.gc || undefined,
        owner: wizardState.owner || undefined,
        architectEngineer: wizardState.architectEngineer || undefined,
        // Scope
        scope: Object.values(wizardState.scope).some(v => v) ? wizardState.scope : undefined,
        // Defaults
        complexity: wizardState.complexity || undefined,
        competitionLevel: wizardState.competitiveLevel || undefined,
        notes: wizardState.notes || undefined,
      };

      // Remove undefined values
      Object.keys(projectData).forEach(key => {
        if (projectData[key] === undefined) {
          delete projectData[key];
        }
      });

      // Create project in Firestore
      const projectsPath = `companies/${companyId}/projects`;
      const projectId = await createDocument(projectsPath, projectData);

      // Increment project sequence if auto-generated
      if (wizardState.projectNumberSource === "auto") {
        try {
          await incrementProjectSequence(companyId);
        } catch (error) {
          console.warn("Failed to increment project sequence:", error);
          // Non-critical error, continue
        }
      }

      // Navigate to project dashboard
      router.push(`/projects/${projectId}`);
    } catch (error: any) {
      console.error("Failed to create project:", error);
      setErrors({ 
        _general: error.message || "Failed to create project. Please try again." 
      });
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wizard...</p>
        </div>
      </div>
    );
  }

  const canProceed = currentStep === 1 
    ? wizardState.projectName.trim().length > 0 && wizardState.projectNumber.trim().length > 0
    : true;

  const isLastStep = currentStep === STEPS.length;
  const isFirstStep = currentStep === 1;
  const currentStepData = STEPS[currentStep - 1];
  const canSkip = !currentStepData.required && !isLastStep;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 mb-2">
            New Project
          </h1>
          <p className="text-slate-600">
            Create a new project in Quant. Only Step 1 is required.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                      currentStep === step.id
                        ? "bg-blue-600 text-white shadow-lg scale-110"
                        : currentStep > step.id
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      currentStep === step.id
                        ? "text-blue-600"
                        : currentStep > step.id
                        ? "text-green-600"
                        : "text-gray-500"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-2 transition-all duration-300 ${
                      currentStep > step.id ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Card */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm min-h-[500px]">
          <CardContent className="p-6 md:p-8">
            {/* General Error */}
            {errors._general && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 text-sm">{errors._general}</p>
              </div>
            )}

            {/* Step Content */}
            <div className="mb-8 min-h-[400px]">
              {currentStep === 1 && (
                <Step1Basics
                  state={wizardState}
                  errors={errors}
                  autoProjectNumber={autoProjectNumber}
                  onUpdate={updateWizardState}
                />
              )}
              {currentStep === 2 && (
                <Step2Parties
                  state={wizardState}
                  onUpdate={updateWizardState}
                />
              )}
              {currentStep === 3 && (
                <Step3Scope
                  state={wizardState}
                  onUpdate={updateWizardState}
                />
              )}
              {currentStep === 4 && (
                <Step4Defaults
                  state={wizardState}
                  onUpdate={updateWizardState}
                />
              )}
              {currentStep === 5 && (
                <Step5Review state={wizardState} />
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="flex items-center gap-3">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleBack}
                    disabled={creating}
                    className="min-w-[100px]"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                {canSkip && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleSkip}
                    disabled={creating}
                    className="min-w-[120px]"
                  >
                    Skip for now
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {isLastStep ? (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleCreateProject}
                    disabled={creating || !canProceed}
                    className="min-w-[160px]"
                  >
                    {creating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        Create Project
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleNext}
                    disabled={!canProceed || creating}
                    className="min-w-[100px]"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

