"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { CheckCircle2, XCircle, AlertCircle, Package, Plus } from "lucide-react";
import { subscribeToCollection, getDocument, getProjectPath, setDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface BuyoutQuote {
  id: string;
  name: string;
  status: "received" | "pending" | "not_received";
  quoteAmount?: number;
  vendor?: string;
  receivedDate?: string;
  dueDate?: string;
  notes?: string;
  isCritical: boolean;
}

interface BuyoutQuotesTrackerProps {
  companyId: string;
  projectId: string;
}

const CRITICAL_BUYOUTS = [
  { id: "metal_deck", name: "Metal Deck", isCritical: true },
  { id: "joist", name: "Joist", isCritical: true },
  { id: "brb", name: "BRB's (Buckling Restrained Braces)", isCritical: true },
  { id: "steel_detailing", name: "Steel Detailing", isCritical: true },
  { id: "erection", name: "Erection", isCritical: true },
  { id: "bolting", name: "Bolting", isCritical: true },
  { id: "welding_inspection", name: "Welding Inspection", isCritical: true },
  { id: "grating", name: "Grating", isCritical: true },
  { id: "engineering", name: "Engineering", isCritical: true },
];

export default function BuyoutQuotesTracker({ companyId, projectId }: BuyoutQuotesTrackerProps) {
  const [quotes, setQuotes] = useState<BuyoutQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuote, setNewQuote] = useState<Partial<BuyoutQuote>>({});

  // Load quotes from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || !projectId) {
      setLoading(false);
      return;
    }

    const loadQuotes = async () => {
      try {
        const projectPath = getProjectPath(companyId, projectId);
        const projectData = await getDocument<any>(projectPath);
        
        if (projectData?.buyoutQuotes && Array.isArray(projectData.buyoutQuotes)) {
          setQuotes(projectData.buyoutQuotes);
        } else {
          // Initialize with critical buyouts
          const initialQuotes: BuyoutQuote[] = CRITICAL_BUYOUTS.map(item => ({
            ...item,
            status: "pending" as const,
          }));
          setQuotes(initialQuotes);
        }
      } catch (error) {
        console.error("Failed to load buyout quotes:", error);
        // Initialize with defaults on error
        const initialQuotes: BuyoutQuote[] = CRITICAL_BUYOUTS.map(item => ({
          ...item,
          status: "pending" as const,
        }));
        setQuotes(initialQuotes);
      } finally {
        setLoading(false);
      }
    };

    loadQuotes();
  }, [companyId, projectId]);

  // Save quotes to Firestore
  const saveQuotes = async (updatedQuotes: BuyoutQuote[]) => {
    if (!isFirebaseConfigured() || !companyId || !projectId) return;

    try {
      const projectPath = getProjectPath(companyId, projectId);
      await setDocument(projectPath, { buyoutQuotes: updatedQuotes }, true);
    } catch (error) {
      console.error("Failed to save buyout quotes:", error);
    }
  };

  const updateQuote = (id: string, updates: Partial<BuyoutQuote>) => {
    const updatedQuotes = quotes.map(q => 
      q.id === id ? { ...q, ...updates } : q
    );
    setQuotes(updatedQuotes);
    saveQuotes(updatedQuotes);
  };

  const addCustomQuote = () => {
    if (!newQuote.name) return;
    
    const customQuote: BuyoutQuote = {
      id: `custom_${Date.now()}`,
      name: newQuote.name,
      status: "pending",
      isCritical: false,
      ...newQuote,
    };
    
    const updatedQuotes = [...quotes, customQuote];
    setQuotes(updatedQuotes);
    saveQuotes(updatedQuotes);
    setNewQuote({});
  };

  const removeQuote = (id: string) => {
    const updatedQuotes = quotes.filter(q => q.id !== id);
    setQuotes(updatedQuotes);
    saveQuotes(updatedQuotes);
  };

  const formatCurrency = (value?: number) => {
    if (!value) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const receivedCount = quotes.filter(q => q.status === "received").length;
  const pendingCount = quotes.filter(q => q.status === "pending").length;
  const notReceivedCount = quotes.filter(q => q.status === "not_received").length;
  const criticalPending = quotes.filter(q => q.isCritical && q.status === "pending").length;

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-slate-900" />
            <CardTitle className="text-xl font-extrabold text-gray-900 tracking-normal">
              Buyout Quotes Tracker
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              {receivedCount} Received
            </span>
            <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              {pendingCount} Pending
            </span>
            {criticalPending > 0 && (
              <span className="px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 font-semibold">
                {criticalPending} Critical Pending
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className={`p-3 rounded-lg border transition-colors ${
                quote.status === "received"
                  ? "bg-emerald-50 border-emerald-200"
                  : quote.status === "pending"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"
              } ${quote.isCritical ? "ring-1 ring-slate-300" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {quote.status === "received" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : quote.status === "pending" ? (
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                    <span className={`text-sm font-semibold text-slate-900 ${quote.isCritical ? "font-bold" : ""}`}>
                      {quote.name}
                      {quote.isCritical && (
                        <span className="ml-1 text-xs text-red-600">(Critical)</span>
                      )}
                    </span>
                  </div>
                  
                  {editingId === quote.id ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={quote.status}
                          onChange={(e) => updateQuote(quote.id, { status: e.target.value as any })}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="received">Received</option>
                          <option value="not_received">Not Received</option>
                        </select>
                      </div>
                      <Input
                        type="number"
                        placeholder="Quote Amount"
                        value={quote.quoteAmount || ""}
                        onChange={(e) => updateQuote(quote.id, { 
                          quoteAmount: e.target.value ? parseFloat(e.target.value) : undefined 
                        })}
                        className="text-xs"
                      />
                      <Input
                        type="text"
                        placeholder="Vendor"
                        value={quote.vendor || ""}
                        onChange={(e) => updateQuote(quote.id, { vendor: e.target.value })}
                        className="text-xs"
                      />
                      <Input
                        type="date"
                        placeholder="Received Date"
                        value={quote.receivedDate || ""}
                        onChange={(e) => updateQuote(quote.id, { receivedDate: e.target.value })}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          className="text-xs"
                        >
                          Done
                        </Button>
                        {!quote.isCritical && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeQuote(quote.id)}
                            className="text-xs text-red-600"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1">
                      {quote.quoteAmount && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Amount:</span> {formatCurrency(quote.quoteAmount)}
                        </div>
                      )}
                      {quote.vendor && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Vendor:</span> {quote.vendor}
                        </div>
                      )}
                      {quote.receivedDate && (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium">Received:</span> {new Date(quote.receivedDate).toLocaleDateString()}
                        </div>
                      )}
                      <button
                        onClick={() => setEditingId(quote.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Custom Quote */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Add custom buyout item..."
              value={newQuote.name || ""}
              onChange={(e) => setNewQuote({ ...newQuote, name: e.target.value })}
              className="text-xs flex-1"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  addCustomQuote();
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addCustomQuote}
              className="text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

