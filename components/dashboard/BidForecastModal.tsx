"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { X, Calendar, Building2, TrendingUp, Filter, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Bid, BidType, BidStatus } from "@/lib/bids/types";
import { computeBidProbability, computeExpectedAward, calculateBidForecast } from "@/lib/bids/forecast";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface BidForecastModalProps {
  bids: Bid[];
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "ALL" | "PUBLIC" | "PRIVATE";
type DateHorizon = 30 | 60 | 90 | 180 | null;

interface Project {
  id: string;
  projectName?: string;
}

export default function BidForecastModal({ bids, isOpen, onClose }: BidForecastModalProps) {
  const companyId = useCompanyId();
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [activeOnly, setActiveOnly] = useState<boolean>(true);
  const [dateHorizon, setDateHorizon] = useState<DateHorizon>(90);
  const [sortBy, setSortBy] = useState<"expectedAward" | "bidDueDate" | "bidAmount">("expectedAward");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [projects, setProjects] = useState<Project[]>([]);

  // Load projects when modal opens
  useEffect(() => {
    if (!isOpen || !isFirebaseConfigured() || !companyId) {
      setProjects([]);
      return;
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<Project>(
      projectsPath,
      (loadedProjects) => {
        setProjects(loadedProjects);
      }
    );

    return () => unsubscribe();
  }, [isOpen, companyId]);

  // Create a mapping from bid to project ID
  const getProjectIdForBid = (bid: Bid): string | null => {
    // First, check if bid has explicit projectId
    if (bid.projectId) {
      return bid.projectId;
    }

    // Otherwise, try to match by project name
    const matchingProject = projects.find(
      (p) => p.projectName?.toLowerCase().trim() === bid.projectName.toLowerCase().trim()
    );
    
    return matchingProject?.id || null;
  };

  // Calculate forecast totals
  const forecastTotals = useMemo(() => {
    return calculateBidForecast(bids, undefined, {
      activeOnly,
      dateHorizonDays: dateHorizon ?? undefined,
    });
  }, [bids, activeOnly, dateHorizon]);

  // Filter and sort bids
  const filteredBids = useMemo(() => {
    let filtered = [...bids];

    // Apply active filter
    if (activeOnly) {
      filtered = filtered.filter(b => b.status === "ACTIVE");
    }

    // Apply date horizon
    if (dateHorizon) {
      const horizonDate = new Date();
      horizonDate.setDate(horizonDate.getDate() + dateHorizon);
      filtered = filtered.filter(b => {
        const dueDate = new Date(b.bidDueDate);
        return dueDate <= horizonDate;
      });
    }

    // Apply tab filter
    if (activeTab === "PUBLIC") {
      filtered = filtered.filter(b => b.bidType === "PUBLIC");
    } else if (activeTab === "PRIVATE") {
      filtered = filtered.filter(b => b.bidType === "PRIVATE");
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      if (sortBy === "expectedAward") {
        aValue = computeExpectedAward(a);
        bValue = computeExpectedAward(b);
      } else if (sortBy === "bidDueDate") {
        aValue = new Date(a.bidDueDate).getTime();
        bValue = new Date(b.bidDueDate).getTime();
      } else {
        aValue = a.bidAmount;
        bValue = b.bidAmount;
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [bids, activeTab, activeOnly, dateHorizon, sortBy, sortDirection]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntilDue = (dateString: string) => {
    const dueDate = new Date(dateString);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStageLabel = (stage?: string) => {
    if (!stage) return "-";
    return stage
      .split("_")
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bid Forecast</h2>
            <p className="text-sm text-gray-600 mt-1">
              Expected awarded value from active bids (probability-based)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Tabs */}
        <div className="p-6 border-b border-gray-200 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "ALL"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All ({filteredBids.length})
            </button>
            <button
              onClick={() => setActiveTab("PUBLIC")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "PUBLIC"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Public ({bids.filter(b => b.bidType === "PUBLIC" && (activeOnly ? b.status === "ACTIVE" : true)).length})
            </button>
            <button
              onClick={() => setActiveTab("PRIVATE")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "PRIVATE"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Private ({bids.filter(b => b.bidType === "PRIVATE" && (activeOnly ? b.status === "ACTIVE" : true)).length})
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Active only</span>
            </label>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">Date horizon:</span>
              <select
                value={dateHorizon ?? ""}
                onChange={(e) => setDateHorizon(e.target.value ? Number(e.target.value) as DateHorizon : null)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All dates</option>
                <option value="30">Next 30 days</option>
                <option value="60">Next 60 days</option>
                <option value="90">Next 90 days</option>
                <option value="180">Next 180 days</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="expectedAward">Expected Award</option>
                <option value="bidDueDate">Bid Due Date</option>
                <option value="bidAmount">Bid Amount</option>
              </select>
              <button
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title={sortDirection === "asc" ? "Ascending" : "Descending"}
              >
                <TrendingUp className={`w-4 h-4 ${sortDirection === "desc" ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="flex gap-4 pt-2 border-t border-gray-200">
            <div>
              <span className="text-xs text-gray-500">Total Forecast</span>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(forecastTotals.total)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Public</span>
              <p className="text-lg font-semibold text-blue-600">{formatCurrency(forecastTotals.publicTotal)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Private</span>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(forecastTotals.privateTotal)}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bid Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Project</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Stage</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Bid Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Probability</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Expected Award</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBids.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No bids match the current filters
                  </td>
                </tr>
              ) : (
                filteredBids.map((bid) => {
                  const probability = computeBidProbability(bid);
                  const expectedAward = computeExpectedAward(bid);
                  const daysUntil = getDaysUntilDue(bid.bidDueDate);

                  return (
                    <tr key={bid.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-gray-900">{formatDate(bid.bidDueDate)}</div>
                            <div className="text-xs text-gray-500">
                              {daysUntil > 0 ? `${daysUntil} days` : daysUntil === 0 ? "Today" : `${Math.abs(daysUntil)} days ago`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {(() => {
                          const projectId = getProjectIdForBid(bid);
                          if (projectId) {
                            return (
                              <Link
                                href={`/projects/${projectId}/estimating`}
                                className="font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5 group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onClose(); // Close modal when navigating
                                }}
                              >
                                {bid.projectName}
                                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                            );
                          }
                          return (
                            <span className="font-medium text-gray-900">{bid.projectName}</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{bid.clientName || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            bid.bidType === "PUBLIC"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {bid.bidType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {bid.bidType === "PRIVATE" ? getStageLabel(bid.stage) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(bid.bidAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="font-medium text-gray-900">{(probability * 100).toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                        {formatCurrency(expectedAward)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            bid.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : bid.status === "AWARDED"
                              ? "bg-blue-100 text-blue-700"
                              : bid.status === "LOST"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {bid.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

