"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { 
  Plus, 
  Edit, 
  Archive, 
  X, 
  Check,
  Info,
  ChevronDown,
  ChevronUp,
  Trash2
} from "lucide-react";
import { 
  ProposalSeed, 
  ProposalSeedType, 
  ProposalSeedContext 
} from "@/lib/types/proposalSeeds";
import {
  subscribeToProposalSeeds,
  createProposalSeed,
  updateProposalSeed,
  archiveProposalSeed,
  deleteProposalSeed,
} from "@/lib/services/proposalSeeds";
import { useAuth } from "@/lib/hooks/useAuth";
import { EstimatingLine } from "./EstimatingGrid";

interface ProposalSeedsCardProps {
  companyId: string;
  projectId: string;
  selectedLineId?: string | null; // Currently selected line item for context
  lines?: EstimatingLine[]; // For context linking
}

const SEED_TYPES: { value: ProposalSeedType; label: string; color: string }[] = [
  { value: "exclusion", label: "Exclusion", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "inclusion", label: "Inclusion", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "clarification", label: "Clarification", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "assumption", label: "Assumption", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "allowance", label: "Allowance", color: "bg-purple-100 text-purple-700 border-purple-200" },
];

const QUICK_TEMPLATES: Record<ProposalSeedType, string[]> = {
  exclusion: [
    "Exclude field touch-up paint",
    "Exclude permits/engineering",
    "Erection by others",
    "Exclude anchor bolts",
    "Exclude shipping/delivery",
  ],
  inclusion: [
    "Include anchor bolts & templates",
    "Include shop primer only",
    "Include material handling",
    "Include shop drawings",
  ],
  clarification: [
    "Clarify: electrical by others",
    "Clarify: foundation by others",
    "Clarify: concrete by others",
  ],
  assumption: [
    "Assume standard shop primer",
    "Assume AISC tolerances",
    "Assume standard delivery",
  ],
  allowance: [
    "Allowance for field modifications",
    "Allowance for additional material",
  ],
};

export default function ProposalSeedsCard({
  companyId,
  projectId,
  selectedLineId,
  lines = [],
}: ProposalSeedsCardProps) {
  const { user } = useAuth();
  const [seeds, setSeeds] = useState<ProposalSeed[]>([]);
  const [selectedType, setSelectedType] = useState<ProposalSeedType>("exclusion");
  const [inputText, setInputText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [context, setContext] = useState<ProposalSeedContext>({});
  const [showContext, setShowContext] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);

  // Get selected line for context
  const selectedLine = lines.find(l => l.id === selectedLineId);

  // Auto-fill context from selected line
  useEffect(() => {
    if (selectedLine) {
      setContext({
        lineItemId: selectedLine.id,
        drawing: selectedLine.drawingNumber || undefined,
        detail: selectedLine.detailNumber || undefined,
        category: selectedLine.category || undefined,
      });
      setShowContext(true);
    }
  }, [selectedLine, selectedLineId]);

  // Subscribe to seeds
  useEffect(() => {
    if (!companyId || !projectId) return;

    const unsubscribe = subscribeToProposalSeeds(
      companyId,
      projectId,
      (seedsData) => {
        setSeeds(seedsData);
      },
      showArchived
    );

    return () => unsubscribe();
  }, [companyId, projectId, showArchived]);

  // Check for duplicates
  const isDuplicate = (text: string): boolean => {
    return seeds.some(
      s => s.status === "active" && 
      s.text.toLowerCase().trim() === text.toLowerCase().trim()
    );
  };

  const handleSave = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || !user) return;

    // Check for duplicates
    if (isDuplicate(trimmedText)) {
      if (!confirm("A similar seed already exists. Add anyway?")) {
        return;
      }
    }

    try {
      await createProposalSeed(companyId, projectId, {
        projectId,
        type: selectedType,
        text: trimmedText,
        context: showContext ? context : {},
        status: "active",
        createdBy: user.uid,
      });

      setInputText("");
      setContext({});
      setShowContext(false);
      
      // Show toast-like feedback
      const toast = document.createElement("div");
      toast.className = "fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50";
      toast.textContent = `Added ${SEED_TYPES.find(t => t.value === selectedType)?.label || "Seed"}`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 2000);
    } catch (error) {
      console.error("Failed to save entry:", error);
      alert("Failed to save data. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleTemplateClick = (template: string) => {
    setInputText(template);
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  const handleEdit = (seed: ProposalSeed) => {
    setEditingId(seed.id);
    setEditingText(seed.text);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingText.trim()) return;

    try {
      await updateProposalSeed(companyId, projectId, editingId, {
        text: editingText.trim(),
      });
      setEditingId(null);
      setEditingText("");
    } catch (error) {
      console.error("Failed to update entry:", error);
      alert("Failed to update data. Please try again.");
    }
  };

  const handleArchive = async (seedId: string) => {
    if (!confirm("Archive this entry? It will be hidden but can be restored.")) return;

    try {
      await archiveProposalSeed(companyId, projectId, seedId);
    } catch (error) {
      console.error("Failed to archive entry:", error);
      alert("Failed to archive data. Please try again.");
    }
  };

  const activeSeeds = seeds.filter(s => s.status === "active");
  const typeColor = SEED_TYPES.find(t => t.value === selectedType)?.color || "";
  
  // Group seeds by type for organized display
  const seedsByType = activeSeeds.reduce((acc, seed) => {
    if (!acc[seed.type]) {
      acc[seed.type] = [];
    }
    acc[seed.type].push(seed);
    return acc;
  }, {} as Record<ProposalSeedType, ProposalSeed[]>);
  
  const [expandedTypes, setExpandedTypes] = useState<Set<ProposalSeedType>>(new Set());
  
  const toggleType = (type: ProposalSeedType) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleDelete = async (seedId: string) => {
    if (!confirm("Permanently delete this entry? This cannot be undone.")) return;

    try {
      await deleteProposalSeed(companyId, projectId, seedId);
    } catch (error) {
      console.error("Failed to delete entry:", error);
      alert("Failed to delete data. Please try again.");
    }
  };

  return (
      <Card className="p-4">
        <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 tracking-normal">Progressive Inclusions/Exclusions</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Capture inclusions/exclusions as you estimate.
              </p>
            </div>
          </div>
        </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Type Selector and Input Row */}
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          {/* Type Selector */}
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {SEED_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  selectedType === type.value
                    ? `${type.color} border-current`
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
          
          {/* Quick Templates */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              Quick templates <ChevronDown className={`w-3 h-3 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
            </button>
            {showTemplates && (
              <div
                ref={templatesRef}
                className="absolute top-6 left-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-2 max-h-48 overflow-y-auto min-w-[200px]"
              >
                {QUICK_TEMPLATES[selectedType].map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTemplateClick(template)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 rounded transition-colors"
                  >
                    {template}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input - Takes remaining space */}
          <div className="flex-1 w-full lg:w-auto space-y-2">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedType === "exclusion" 
                  ? "Exclude field touch-up paint"
                  : selectedType === "inclusion"
                  ? "Include anchor bolts & templates"
                  : selectedType === "clarification"
                  ? "Clarify: electrical by others"
                  : "Enter text..."
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={1}
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowContext(!showContext)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {showContext ? "Hide" : "Show"} context
              </button>
              <Button
                onClick={handleSave}
                disabled={!inputText.trim()}
                size="sm"
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Context Linking */}
        {showContext && (
          <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
            <div className="font-medium text-gray-700 mb-1">Link to:</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-600">Line Item</label>
                <Input
                  value={context.lineItemId || ""}
                  onChange={(e) => setContext({ ...context, lineItemId: e.target.value || undefined })}
                  placeholder="Auto-filled if row selected"
                  className="text-xs py-1 h-7"
                />
              </div>
              <div>
                <label className="text-gray-600">Drawing #</label>
                <Input
                  value={context.drawing || ""}
                  onChange={(e) => setContext({ ...context, drawing: e.target.value || undefined })}
                  placeholder="e.g., S102C"
                  className="text-xs py-1 h-7"
                />
              </div>
              <div>
                <label className="text-gray-600">Detail #</label>
                <Input
                  value={context.detail || ""}
                  onChange={(e) => setContext({ ...context, detail: e.target.value || undefined })}
                  placeholder="e.g., DTL-7"
                  className="text-xs py-1 h-7"
                />
              </div>
              <div>
                <label className="text-gray-600">Category</label>
                <Input
                  value={context.category || ""}
                  onChange={(e) => setContext({ ...context, category: e.target.value || undefined })}
                  placeholder="e.g., Columns"
                  className="text-xs py-1 h-7"
                />
              </div>
            </div>
          </div>
        )}

        {/* Organized Entries by Type - Dropdown */}
        {activeSeeds.length === 0 ? (
          <div className="text-center py-6 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-sm text-gray-500">No entries yet. Add one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {SEED_TYPES.map((typeInfo) => {
              const typeSeeds = seedsByType[typeInfo.value] || [];
              if (typeSeeds.length === 0) return null;
              
              const isExpanded = expandedTypes.has(typeInfo.value);
              
              return (
                <div key={typeInfo.value} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleType(typeInfo.value)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({typeSeeds.length} {typeSeeds.length === 1 ? 'entry' : 'entries'})
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="p-3 space-y-2 bg-white">
                      {typeSeeds.map((seed) => {
                        const contextStr = [
                          seed.context.lineItemId && `L${seed.context.lineItemId}`,
                          seed.context.drawing,
                          seed.context.detail,
                        ].filter(Boolean).join(" / ");

                        return (
                          <div
                            key={seed.id}
                            className="flex items-start justify-between gap-3 p-2 rounded border border-gray-200 bg-gray-50"
                          >
                            {editingId === seed.id ? (
                              <div className="flex-1 space-y-2">
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-none"
                                  rows={2}
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSaveEdit}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditingText("");
                                    }}
                                    className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300 flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-900">{seed.text}</p>
                                  {contextStr && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Linked: {contextStr}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEdit(seed)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(seed.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

