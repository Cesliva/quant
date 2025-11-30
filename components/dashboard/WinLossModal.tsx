"use client";

import { useState, useEffect } from "react";
import { TrendingUp, X, Edit, Trash2, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { 
  subscribeToCollection, 
  createDocument, 
  updateDocument, 
  deleteDocument
} from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface WinLossRecord {
  id?: string;
  projectId?: string;
  projectName: string;
  gcId?: string; // Reference to GC contact ID for exact matching
  projectType?: string; // For project-type win rate calculation
  bidDate: string;
  decisionDate: string;
  bidAmount: number;
  actualCost?: number;
  projectValue?: number;
  margin?: number; // actual margin (for won bids)
  estimatedMargin?: number; // submitted margin (for all bids, won + lost)
  status: "won" | "lost";
  reason?: string;
  competitor?: string;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface WinLossModalProps {
  companyId: string;
  onClose: () => void;
}

interface Project {
  id?: string;
  projectName?: string;
  projectNumber?: string;
  gcId?: string; // Reference to contact ID for exact matching
  projectType?: string; // For project-type win rate calculation
  status?: string;
  archived?: boolean;
}

export default function WinLossModal({ companyId, onClose }: WinLossModalProps) {
  const [records, setRecords] = useState<WinLossRecord[]>([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WinLossRecord | null>(null);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [showCustomProjectInput, setShowCustomProjectInput] = useState(false);
  const [formData, setFormData] = useState<Partial<WinLossRecord>>({
    projectName: "",
    bidDate: "",
    decisionDate: "",
    bidAmount: 0,
    actualCost: 0,
    projectValue: 0,
    margin: 0,
    estimatedMargin: 0,
    status: "won",
    reason: "",
    competitor: "",
    notes: "",
  });

  // Load records from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const recordsPath = `companies/${companyId}/winLossRecords`;
    const unsubscribe = subscribeToCollection<WinLossRecord>(
      recordsPath,
      (data) => {
        const sorted = data.sort((a, b) => 
          new Date(b.decisionDate).getTime() - new Date(a.decisionDate).getTime()
        );
        setRecords(sorted);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Load active projects from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<Project>(
      projectsPath,
      (data) => {
        // Filter for active, non-archived projects
        const active = data.filter(
          (p) => !p.archived && (p.status === "active" || p.status === "Active" || !p.status)
        );
        // Sort by project name
        const sorted = active.sort((a, b) => 
          (a.projectName || "").localeCompare(b.projectName || "")
        );
        setActiveProjects(sorted);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Calculate statistics
  const stats = {
    totalBids: records.length,
    wins: records.filter(r => r.status === "won").length,
    losses: records.filter(r => r.status === "lost").length,
    winRate: records.length > 0 
      ? (records.filter(r => r.status === "won").length / records.length) * 100 
      : 0,
    totalBidValue: records.reduce((sum, r) => sum + (r.bidAmount || 0), 0),
    totalWonValue: records
      .filter(r => r.status === "won")
      .reduce((sum, r) => sum + (r.projectValue || r.bidAmount || 0), 0),
    averageMargin: (() => {
      const wonRecords = records.filter(r => r.status === "won" && r.margin);
      if (wonRecords.length === 0) return 0;
      const totalMargin = wonRecords.reduce((sum, r) => sum + (r.margin || 0), 0);
      return totalMargin / wonRecords.length;
    })(),
    totalProfit: records
      .filter(r => r.status === "won" && r.projectValue && r.actualCost)
      .reduce((sum, r) => sum + ((r.projectValue || 0) - (r.actualCost || 0)), 0),
  };

  // Get last 6 months of data for chart
  const getLast6MonthsData = () => {
    const months: string[] = [];
    const wonData: number[] = [];
    const lostData: number[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      
      months.push(monthLabel);
      
      const monthRecords = records.filter(r => {
        const recordDate = new Date(r.decisionDate);
        return `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}` === monthKey;
      });
      
      wonData.push(monthRecords.filter(r => r.status === "won").length);
      lostData.push(monthRecords.filter(r => r.status === "lost").length);
    }
    
    return { months, wonData, lostData };
  };

  const chartData = getLast6MonthsData();
  const maxValue = Math.max(
    ...chartData.wonData,
    ...chartData.lostData,
    ...chartData.wonData.map((w, i) => w + chartData.lostData[i]),
    1
  );

  const handleAdd = () => {
    setEditingRecord(null);
    setShowCustomProjectInput(false);
    setFormData({
      projectName: "",
      bidDate: "",
      decisionDate: new Date().toISOString().split("T")[0],
      bidAmount: 0,
      actualCost: 0,
      projectValue: 0,
      margin: 0,
      status: "won",
      reason: "",
      competitor: "",
      notes: "",
    });
    setIsFormModalOpen(true);
  };

  const handleEdit = (record: WinLossRecord) => {
    setEditingRecord(record);
    // Check if the project name exists in active projects
    const projectExists = activeProjects.some(p => p.projectName === record.projectName);
    setShowCustomProjectInput(!projectExists);
    setFormData({
      projectName: record.projectName,
      bidDate: record.bidDate,
      decisionDate: record.decisionDate,
      bidAmount: record.bidAmount,
      actualCost: record.actualCost || 0,
      projectValue: record.projectValue || 0,
      margin: record.margin || 0,
      estimatedMargin: record.estimatedMargin || 0,
      status: record.status,
      reason: record.reason || "",
      competitor: record.competitor || "",
      notes: record.notes || "",
    });
    setIsFormModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.projectName || !formData.bidDate || !formData.decisionDate || !formData.bidAmount) {
      alert("Please fill in all required fields (Project Name, Bid Date, Decision Date, Bid Amount)");
      return;
    }

    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured. Please set up Firebase credentials to save records.");
      return;
    }

    try {
      const recordsPath = `companies/${companyId}/winLossRecords`;
      
      let margin = formData.margin || 0;
      if (formData.status === "won" && formData.projectValue && formData.actualCost) {
        margin = ((formData.projectValue - formData.actualCost) / formData.projectValue) * 100;
      }

      // Calculate estimated margin if not provided (for both won and lost bids)
      let estimatedMargin = formData.estimatedMargin || 0;
      if (estimatedMargin === 0 && formData.bidAmount > 0) {
        // If estimated margin not provided, try to calculate from bid amount
        // This is a placeholder - in real scenario, estimator would input this
        // For now, we'll use the margin field if it exists, otherwise leave as 0
        estimatedMargin = formData.margin || 0;
      }

      const recordData: Omit<WinLossRecord, "id"> = {
        projectName: formData.projectName!,
        bidDate: formData.bidDate!,
        decisionDate: formData.decisionDate!,
        bidAmount: formData.bidAmount!,
        actualCost: formData.actualCost || undefined,
        projectValue: formData.projectValue || undefined,
        margin: margin > 0 ? margin : undefined,
        estimatedMargin: estimatedMargin > 0 ? estimatedMargin : undefined,
        status: formData.status!,
        reason: formData.reason || undefined,
        competitor: formData.competitor || undefined,
        notes: formData.notes || undefined,
        updatedAt: new Date(),
      };

      if (editingRecord?.id) {
        await updateDocument(recordsPath, editingRecord.id, recordData);
      } else {
        recordData.createdAt = new Date();
        await createDocument(recordsPath, recordData);
      }

      setIsFormModalOpen(false);
      setEditingRecord(null);
    } catch (error: any) {
      console.error("Failed to save win/loss record:", error);
      alert(`Failed to save record: ${error.message}`);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured.");
      return;
    }

    try {
      const recordsPath = `companies/${companyId}/winLossRecords`;
      await deleteDocument(recordsPath, recordId);
    } catch (error: any) {
      console.error("Failed to delete record:", error);
      alert(`Failed to delete record: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-600" />
              Win/Loss Tracker
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-700">{stats.wins}</div>
              <div className="text-sm text-gray-600">Wins</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-700">{stats.losses}</div>
              <div className="text-sm text-gray-600">Losses</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-700">{stats.winRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Win Rate</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-700">
                {stats.averageMargin > 0 ? `${stats.averageMargin.toFixed(1)}%` : "-"}
              </div>
              <div className="text-sm text-gray-600">Avg Margin</div>
            </div>
          </div>

          {/* Win/Loss Chart */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-gray-700">Last 6 Months</h4>
              <Button variant="primary" size="sm" onClick={handleAdd} className="gap-2">
                <Plus className="w-4 h-4" />
                Log Win/Loss
              </Button>
            </div>
            <div className="relative h-64 bg-gray-50 rounded-lg p-4">
              <div className="flex items-end justify-between h-full gap-2">
                {chartData.months.map((month, index) => {
                  const won = chartData.wonData[index];
                  const lost = chartData.lostData[index];
                  const total = won + lost;
                  const wonHeight = total > 0 ? (won / maxValue) * 100 : 0;
                  const lostHeight = total > 0 ? (lost / maxValue) * 100 : 0;

                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1 h-full">
                      <div className="flex flex-col-reverse items-center gap-0.5 w-full h-full">
                        {lost > 0 && (
                          <div
                            className="w-full bg-red-500 rounded-t transition-all hover:bg-red-600"
                            style={{ height: `${lostHeight}%` }}
                            title={`Lost: ${lost}`}
                          />
                        )}
                        {won > 0 && (
                          <div
                            className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600"
                            style={{ height: `${wonHeight}%` }}
                            title={`Won: ${won}`}
                          />
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-2 text-center">
                        {month.split(" ")[0]}
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {total > 0 ? total : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-gray-600">Won</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-gray-600">Lost</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Bid Value</div>
              <div className="text-xl font-semibold text-gray-900">
                ${stats.totalBidValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Won Value</div>
              <div className="text-xl font-semibold text-green-700">
                ${stats.totalWonValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Total Profit</div>
              <div className="text-xl font-semibold text-blue-700">
                ${stats.totalProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Recent Records */}
          <div>
            <h4 className="text-lg font-semibold text-gray-700 mb-3">All Records</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {records.map((record) => (
                <div
                  key={record.id}
                  className={`p-4 rounded-lg border ${
                    record.status === "won"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-semibold text-gray-900">{record.projectName}</h5>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            record.status === "won"
                              ? "bg-green-200 text-green-800"
                              : "bg-red-200 text-red-800"
                          }`}
                        >
                          {record.status === "won" ? "Won" : "Lost"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Bid:</span> $
                          {record.bidAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </div>
                        {record.status === "won" && record.projectValue && (
                          <div>
                            <span className="font-medium">Value:</span> $
                            {record.projectValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </div>
                        )}
                        {record.status === "won" && record.margin && (
                          <div>
                            <span className="font-medium">Margin:</span> {record.margin.toFixed(1)}%
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Date:</span>{" "}
                          {new Date(record.decisionDate).toLocaleDateString()}
                        </div>
                      </div>
                      {record.reason && (
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Reason:</span> {record.reason}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(record)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(record.id!)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {records.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-lg mb-2">No win/loss records yet</p>
                  <Button variant="primary" onClick={handleAdd} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Log First Record
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add/Edit Form Modal */}
        {isFormModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editingRecord ? "Edit Win/Loss Record" : "Log Win/Loss"}
                  </h3>
                  <button
                    onClick={() => {
                      setIsFormModalOpen(false);
                      setEditingRecord(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Project Name <span className="text-red-500">*</span>
                      </label>
                      {!showCustomProjectInput ? (
                        <div className="relative">
                          <select
                            value={formData.projectName || ""}
                            onChange={(e) => {
                              if (e.target.value === "__custom__") {
                                setShowCustomProjectInput(true);
                                setFormData({ ...formData, projectName: "" });
                              } else {
                                setFormData({ ...formData, projectName: e.target.value });
                              }
                            }}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                            required={!showCustomProjectInput}
                          >
                            <option value="">Select a project...</option>
                            {activeProjects.map((project) => (
                              <option key={project.id} value={project.projectName || ""}>
                                {project.projectName || "Untitled Project"}
                                {project.projectNumber ? ` (${project.projectNumber})` : ""}
                              </option>
                            ))}
                            <option value="__custom__">+ Enter custom project name</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            value={formData.projectName || ""}
                            onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                            placeholder="Enter project name"
                            required
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomProjectInput(false);
                              setFormData({ ...formData, projectName: "" });
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            ← Back to project list
                          </button>
                        </div>
                      )}
                      {activeProjects.length === 0 && !showCustomProjectInput && (
                        <p className="text-xs text-gray-500 mt-1">No active projects found. Select &quot;+ Enter custom project name&quot; to add one.</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.status || "won"}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as "won" | "lost" })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bid Date <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        value={formData.bidDate || ""}
                        onChange={(e) => setFormData({ ...formData, bidDate: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Decision Date <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        value={formData.decisionDate || ""}
                        onChange={(e) => setFormData({ ...formData, decisionDate: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bid Amount ($) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">$</span>
                        <Input
                          type="number"
                          value={formData.bidAmount || 0}
                          onChange={(e) => setFormData({ ...formData, bidAmount: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="pl-8"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Estimated Margin (%)
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={formData.estimatedMargin || 0}
                          onChange={(e) => setFormData({ ...formData, estimatedMargin: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          step="0.1"
                        />
                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Margin submitted with bid (for won & lost bids)</p>
                    </div>

                    {formData.status === "won" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Project Value ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <Input
                              type="number"
                              value={formData.projectValue || 0}
                              onChange={(e) => setFormData({ ...formData, projectValue: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="pl-8"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Final contract value</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Actual Cost ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <Input
                              type="number"
                              value={formData.actualCost || 0}
                              onChange={(e) => setFormData({ ...formData, actualCost: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="pl-8"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Actual project cost</p>
                        </div>

                        {formData.projectValue && formData.actualCost && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Profit Margin (%)
                            </label>
                            <div className="p-3 bg-blue-50 rounded-lg">
                              <div className="text-lg font-semibold text-blue-700">
                                {((formData.projectValue - formData.actualCost) / formData.projectValue * 100).toFixed(2)}%
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                Profit: ${(formData.projectValue - formData.actualCost).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {formData.status === "lost" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Competitor Who Won
                        </label>
                        <Input
                          value={formData.competitor || ""}
                          onChange={(e) => setFormData({ ...formData, competitor: e.target.value })}
                          placeholder="Competitor name"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason
                      </label>
                      <select
                        value={formData.reason || ""}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select reason...</option>
                        {formData.status === "won" ? (
                          <>
                            <option value="Best Price">Best Price</option>
                            <option value="Quality/Reputation">Quality/Reputation</option>
                            <option value="Relationship">Relationship</option>
                            <option value="Schedule">Schedule</option>
                            <option value="Technical Advantage">Technical Advantage</option>
                            <option value="Other">Other</option>
                          </>
                        ) : (
                          <>
                            <option value="Price Too High">Price Too High</option>
                            <option value="Lost to Competitor">Lost to Competitor</option>
                            <option value="Project Cancelled">Project Cancelled</option>
                            <option value="Timing">Timing</option>
                            <option value="Capacity">Capacity</option>
                            <option value="Other">Other</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes || ""}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      placeholder="Additional notes, lessons learned, etc."
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <Button variant="primary" onClick={handleSave} className="flex-1">
                    {editingRecord ? "Save Changes" : "Log Record"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsFormModalOpen(false);
                      setEditingRecord(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

