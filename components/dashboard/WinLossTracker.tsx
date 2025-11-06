"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Plus, DollarSign, Percent, Calendar, X } from "lucide-react";
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
  bidDate: string; // YYYY-MM-DD
  decisionDate: string; // YYYY-MM-DD
  bidAmount: number; // What we bid
  actualCost?: number; // Actual cost if won
  projectValue?: number; // Final project value if won
  margin?: number; // Profit margin percentage
  status: "won" | "lost";
  reason?: string; // Why won/lost
  competitor?: string; // Who won if we lost
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface WinLossTrackerProps {
  companyId: string;
}

export default function WinLossTracker({ companyId }: WinLossTrackerProps) {
  const [records, setRecords] = useState<WinLossRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WinLossRecord | null>(null);
  const [formData, setFormData] = useState<Partial<WinLossRecord>>({
    projectName: "",
    bidDate: "",
    decisionDate: "",
    bidAmount: 0,
    actualCost: 0,
    projectValue: 0,
    margin: 0,
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
        // Sort by decision date, most recent first
        const sorted = data.sort((a, b) => 
          new Date(b.decisionDate).getTime() - new Date(a.decisionDate).getTime()
        );
        setRecords(sorted);
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
    setIsModalOpen(true);
  };

  const handleEdit = (record: WinLossRecord) => {
    setEditingRecord(record);
    setFormData({
      projectName: record.projectName,
      bidDate: record.bidDate,
      decisionDate: record.decisionDate,
      bidAmount: record.bidAmount,
      actualCost: record.actualCost || 0,
      projectValue: record.projectValue || 0,
      margin: record.margin || 0,
      status: record.status,
      reason: record.reason || "",
      competitor: record.competitor || "",
      notes: record.notes || "",
    });
    setIsModalOpen(true);
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
      
      // Calculate margin if won and we have project value and actual cost
      let margin = formData.margin || 0;
      if (formData.status === "won" && formData.projectValue && formData.actualCost) {
        margin = ((formData.projectValue - formData.actualCost) / formData.projectValue) * 100;
      }

      const recordData: Omit<WinLossRecord, "id"> = {
        projectName: formData.projectName!,
        bidDate: formData.bidDate!,
        decisionDate: formData.decisionDate!,
        bidAmount: formData.bidAmount!,
        actualCost: formData.actualCost || undefined,
        projectValue: formData.projectValue || undefined,
        margin: margin > 0 ? margin : undefined,
        status: formData.status!,
        reason: formData.reason || undefined,
        competitor: formData.competitor || undefined,
        notes: formData.notes || undefined,
        updatedAt: new Date(),
      };

      if (editingRecord?.id) {
        await updateDocument(`${recordsPath}/${editingRecord.id}`, recordData);
      } else {
        recordData.createdAt = new Date();
        await createDocument(recordsPath, recordData);
      }

      setIsModalOpen(false);
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
      await deleteDocument(`${recordsPath}/${recordId}`);
    } catch (error: any) {
      console.error("Failed to delete record:", error);
      alert(`Failed to delete record: ${error.message}`);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Win/Loss Tracker
            </CardTitle>
            <Button variant="primary" size="sm" onClick={handleAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              Log Win/Loss
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{stats.wins}</div>
              <div className="text-xs text-gray-600">Wins</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{stats.losses}</div>
              <div className="text-xs text-gray-600">Losses</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{stats.winRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-600">Win Rate</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">
                {stats.averageMargin > 0 ? `${stats.averageMargin.toFixed(1)}%` : "-"}
              </div>
              <div className="text-xs text-gray-600">Avg Margin</div>
            </div>
          </div>

          {/* Win/Loss Chart */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Last 6 Months</h4>
            <div className="relative h-48 bg-gray-50 rounded-lg p-4">
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
                        {/* Lost bar (red) */}
                        {lost > 0 && (
                          <div
                            className="w-full bg-red-500 rounded-t transition-all hover:bg-red-600"
                            style={{ height: `${lostHeight}%` }}
                            title={`Lost: ${lost}`}
                          />
                        )}
                        {/* Won bar (green) */}
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
                      <div className="text-xs font-medium text-gray-900">
                        {total > 0 ? total : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs">
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
              <div className="text-xs text-gray-600 mb-1">Total Bid Value</div>
              <div className="text-lg font-semibold text-gray-900">
                ${stats.totalBidValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Total Won Value</div>
              <div className="text-lg font-semibold text-green-700">
                ${stats.totalWonValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Total Profit</div>
              <div className="text-lg font-semibold text-blue-700">
                ${stats.totalProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Recent Records */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Records</h4>
            <div className="space-y-2">
              {records.slice(0, 5).map((record) => (
                <div
                  key={record.id}
                  className={`p-3 rounded-lg border ${
                    record.status === "won"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
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
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
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
                        <div className="text-xs text-gray-600 mt-1">
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(record.id!)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {records.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No win/loss records yet</p>
                  <Button variant="outline" size="sm" onClick={handleAdd} className="mt-3">
                    Log First Record
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingRecord ? "Edit Win/Loss Record" : "Log Win/Loss"}
                </h3>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
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
                    <Input
                      value={formData.projectName || ""}
                      onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                      placeholder="Enter project name"
                      required
                    />
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
                    setIsModalOpen(false);
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
    </>
  );
}

