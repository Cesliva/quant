"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";

interface SpecDivision {
  id: string;
  division: string;
  value: string;
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [project, setProject] = useState({
    projectNumber: "",
    projectName: "",
    projectType: "",
    status: "draft",
    owner: "",
    generalContractor: "",
    gcContact: "",
    gcPhone: "",
    gcEmail: "",
    estimator: "",
    location: "",
    bidDueDate: "",
    decisionDate: "",
    deliveryDate: "",
    estimatedValue: "",
    competitionLevel: "medium",
    probabilityOfWin: 50,
    notes: "",
    specDivisions: [
      { id: "1", division: "05", value: "" },
      { id: "2", division: "09", value: "" },
    ] as SpecDivision[],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("unsaved");

  useEffect(() => {
    // TODO: Load project from Firestore
    // For now, set default values
    if (projectId && projectId !== "new") {
      // Load existing project
    }
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus("saving");
    
    try {
      // TODO: Save to Firestore
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      console.log("Saving project:", project);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("unsaved"), 3000);
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("Failed to save project. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSpecDivision = () => {
    const newDivision: SpecDivision = {
      id: Date.now().toString(),
      division: "",
      value: "",
    };
    setProject({
      ...project,
      specDivisions: [...project.specDivisions, newDivision],
    });
  };

  const handleRemoveSpecDivision = (id: string) => {
    if (project.specDivisions.length > 1) {
      setProject({
        ...project,
        specDivisions: project.specDivisions.filter((div) => div.id !== id),
      });
    }
  };

  const handleSpecDivisionChange = (id: string, field: "division" | "value", value: string) => {
    setProject({
      ...project,
      specDivisions: project.specDivisions.map((div) =>
        div.id === id ? { ...div, [field]: value } : div
      ),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "active": return "bg-blue-100 text-blue-800";
      case "submitted": return "bg-yellow-100 text-yellow-800";
      case "won": return "bg-green-100 text-green-800";
      case "lost": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Details</h1>
            {projectId && projectId !== "new" && (
              <p className="text-sm text-gray-500 mt-1">Project ID: {projectId}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "saved" && (
            <span className="text-sm text-green-600">Saved</span>
          )}
          {saveStatus === "saving" && (
            <span className="text-sm text-blue-600">Saving...</span>
          )}
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Project"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Number <span className="text-red-500">*</span>
                </label>
                <Input
                  value={project.projectNumber}
                  onChange={(e) =>
                    setProject({ ...project, projectNumber: e.target.value })
                  }
                  placeholder="PROJ-2024-001"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Unique project identifier</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Status
                </label>
                <select
                  value={project.status}
                  onChange={(e) =>
                    setProject({ ...project, status: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="submitted">Submitted</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={project.projectName}
                  onChange={(e) =>
                    setProject({ ...project, projectName: e.target.value })
                  }
                  placeholder="Enter project name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Type
                </label>
                <select
                  value={project.projectType}
                  onChange={(e) =>
                    setProject({ ...project, projectType: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type...</option>
                  <option value="structural">Structural Steel</option>
                  <option value="misc">Miscellaneous Metals</option>
                  <option value="stairs">Stairs & Railings</option>
                  <option value="bridge">Bridge Work</option>
                  <option value="plate">Plate Work</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location/Address
                </label>
                <Input
                  value={project.location}
                  onChange={(e) =>
                    setProject({ ...project, location: e.target.value })
                  }
                  placeholder="Project location or address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimator <span className="text-red-500">*</span>
                </label>
                <Input
                  value={project.estimator}
                  onChange={(e) =>
                    setProject({ ...project, estimator: e.target.value })
                  }
                  placeholder="Enter estimator name"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client & Contractor Information */}
        <Card>
          <CardHeader>
            <CardTitle>Client & Contractor Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner/Client
                </label>
                <Input
                  value={project.owner}
                  onChange={(e) =>
                    setProject({ ...project, owner: e.target.value })
                  }
                  placeholder="End customer or owner"
                />
                <p className="text-xs text-gray-500 mt-1">End customer (separate from GC)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  General Contractor <span className="text-red-500">*</span>
                </label>
                <Input
                  value={project.generalContractor}
                  onChange={(e) =>
                    setProject({ ...project, generalContractor: e.target.value })
                  }
                  placeholder="Enter GC name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GC Contact Person
                </label>
                <Input
                  value={project.gcContact}
                  onChange={(e) =>
                    setProject({ ...project, gcContact: e.target.value })
                  }
                  placeholder="Contact name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GC Phone
                </label>
                <Input
                  type="tel"
                  value={project.gcPhone}
                  onChange={(e) =>
                    setProject({ ...project, gcPhone: e.target.value })
                  }
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GC Email
                </label>
                <Input
                  type="email"
                  value={project.gcEmail}
                  onChange={(e) =>
                    setProject({ ...project, gcEmail: e.target.value })
                  }
                  placeholder="contact@example.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dates & Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle>Dates & Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bid Due Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={project.bidDueDate}
                  onChange={(e) =>
                    setProject({ ...project, bidDueDate: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-gray-500 mt-1">When bid is due</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Decision Date
                </label>
                <Input
                  type="date"
                  value={project.decisionDate}
                  onChange={(e) =>
                    setProject({ ...project, decisionDate: e.target.value })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">Expected award date</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Date
                </label>
                <Input
                  type="date"
                  value={project.deliveryDate}
                  onChange={(e) =>
                    setProject({ ...project, deliveryDate: e.target.value })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">When project needs to be completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Value
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <Input
                    type="number"
                    value={project.estimatedValue}
                    onChange={(e) =>
                      setProject({ ...project, estimatedValue: e.target.value })
                    }
                    placeholder="0.00"
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Estimated project value</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Competition Level
                </label>
                <select
                  value={project.competitionLevel}
                  onChange={(e) =>
                    setProject({ ...project, competitionLevel: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Probability of Win: {project.probabilityOfWin}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={project.probabilityOfWin}
                  onChange={(e) =>
                    setProject({
                      ...project,
                      probabilityOfWin: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Win probability estimate</p>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes & Description
                </label>
                <textarea
                  value={project.notes}
                  onChange={(e) =>
                    setProject({ ...project, notes: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={4}
                  placeholder="Important project details, special requirements, notes..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Specifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Specifications</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSpecDivision}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Division
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {project.specDivisions.map((spec, index) => (
                <div key={spec.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Spec Division {spec.division || "(number)"}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={spec.division}
                        onChange={(e) =>
                          handleSpecDivisionChange(spec.id, "division", e.target.value)
                        }
                        placeholder="05"
                        className="w-20"
                      />
                      <Input
                        value={spec.value}
                        onChange={(e) =>
                          handleSpecDivisionChange(spec.id, "value", e.target.value)
                        }
                        placeholder="Enter specification details"
                      />
                    </div>
                  </div>
                  {project.specDivisions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSpecDivision(spec.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove division"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Add specification divisions as needed (e.g., 05, 09, 06, etc.)
            </p>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

