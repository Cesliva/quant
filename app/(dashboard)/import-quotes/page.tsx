"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle, AlertCircle, Download, X, Eye, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createDocument, subscribeToCollection, deleteDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface QuoteDocument {
  id?: string;
  projectName: string;
  projectNumber?: string;
  generalContractor?: string;
  bidDate?: string;
  fileName: string;
  fileSize: number;
  uploadedAt: any;
  uploadedBy?: string;
  notes?: string;
  status?: "draft" | "reviewing" | "quoted" | "archived";
}

import { useCompanyId } from "@/lib/hooks/useCompanyId";

export default function ImportQuotesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const companyId = useCompanyId();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteDocument[]>([]);
  
  const [formData, setFormData] = useState({
    projectName: "",
    projectNumber: "",
    generalContractor: "",
    bidDate: "",
    notes: "",
  });

  // Load existing quotes
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const quotesPath = `companies/${companyId}/quoteDocuments`;
    const unsubscribe = subscribeToCollection<QuoteDocument>(
      quotesPath,
      (data) => {
        const sorted = data.sort((a, b) => {
          const aDate = a.uploadedAt?.toDate?.() || new Date(0);
          const bDate = b.uploadedAt?.toDate?.() || new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
        setQuotes(sorted);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setError("Please select a PDF file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      setError(null);
      setSuccess(null);
      
      // Auto-fill project name from filename if empty
      if (!formData.projectName) {
        const nameWithoutExt = file.name.replace(/\.pdf$/i, "");
        setFormData(prev => ({ ...prev, projectName: nameWithoutExt }));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a PDF file to upload");
      return;
    }

    if (!formData.projectName.trim()) {
      setError("Project name is required");
      return;
    }

    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured. Please set up Firebase credentials.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert PDF to base64 for storage (in production, use Firebase Storage)
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target?.result as string;
          
          // Store quote document metadata in Firestore
          const quoteData: Omit<QuoteDocument, "id"> = {
            projectName: formData.projectName.trim(),
            projectNumber: formData.projectNumber || undefined,
            generalContractor: formData.generalContractor || undefined,
            bidDate: formData.bidDate || undefined,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            uploadedAt: new Date(),
            notes: formData.notes || undefined,
            status: "draft",
          };

          const quotesPath = `companies/${companyId}/quoteDocuments`;
          await createDocument(quotesPath, quoteData);

          // TODO: In production, upload actual PDF to Firebase Storage
          // For now, we're just storing metadata
          // const storageRef = ref(storage, `quotes/${companyId}/${quoteId}/${selectedFile.name}`);
          // await uploadBytes(storageRef, selectedFile);

          setSuccess(`Successfully uploaded "${selectedFile.name}" for project "${formData.projectName}"`);
          
          // Reset form
          setSelectedFile(null);
          setFormData({
            projectName: "",
            projectNumber: "",
            generalContractor: "",
            bidDate: "",
            notes: "",
          });
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (err: any) {
          setError(`Failed to upload: ${err.message}`);
        } finally {
          setIsUploading(false);
        }
      };
      
      reader.onerror = () => {
        setError("Failed to read file");
        setIsUploading(false);
      };
      
      reader.readAsDataURL(selectedFile);
    } catch (err: any) {
      setError(`Failed to upload: ${err.message}`);
      setIsUploading(false);
    }
  };

  const handleDelete = async (quoteId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    if (!isFirebaseConfigured()) {
      setError("Firebase is not configured.");
      return;
    }

    try {
      const quotesPath = `companies/${companyId}/quoteDocuments`;
      await deleteDocument(`${quotesPath}/${quoteId}`);
      setSuccess(`Deleted "${fileName}"`);
    } catch (err: any) {
      setError(`Failed to delete: ${err.message}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (date: any) => {
    if (!date) return "Unknown";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quote Documents</h1>
          <p className="text-gray-600">
            Upload and organize PDF quotes. Enter material pricing, deck, joist, and detailing information manually in the estimating workspace.
          </p>
        </div>

        {/* Upload Section */}
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Upload Quote PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select PDF File
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Choose PDF File
                </Button>
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText className="w-4 h-4" />
                    <span>{selectedFile.name}</span>
                    <span className="text-gray-400">({formatFileSize(selectedFile.size)})</span>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Project Information Form */}
            {selectedFile && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Project Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.projectName}
                      onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                      placeholder="Enter project name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Number
                    </label>
                    <Input
                      value={formData.projectNumber}
                      onChange={(e) => setFormData({ ...formData, projectNumber: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      General Contractor
                    </label>
                    <Input
                      value={formData.generalContractor}
                      onChange={(e) => setFormData({ ...formData, generalContractor: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bid Date
                    </label>
                    <Input
                      type="date"
                      value={formData.bidDate}
                      onChange={(e) => setFormData({ ...formData, bidDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                    placeholder="Any additional notes about this quote..."
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            {selectedFile && (
              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={isUploading || !formData.projectName.trim()}
                className="w-full gap-2"
              >
                <Upload className="w-4 h-4" />
                {isUploading ? "Uploading..." : "Upload Quote"}
              </Button>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Success</p>
                  <p className="text-sm text-green-600">{success}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Uploaded Quotes List */}
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Uploaded Quotes ({quotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quotes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">No quotes uploaded yet</p>
                <p className="text-xs text-gray-400 mt-1">Upload your first PDF quote above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{quote.projectName}</h3>
                            <p className="text-xs text-gray-500">{quote.fileName}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600 ml-8">
                          {quote.projectNumber && (
                            <div>
                              <span className="font-medium">Project #:</span> {quote.projectNumber}
                            </div>
                          )}
                          {quote.generalContractor && (
                            <div>
                              <span className="font-medium">GC:</span> {quote.generalContractor}
                            </div>
                          )}
                          {quote.bidDate && (
                            <div>
                              <span className="font-medium">Bid Date:</span> {new Date(quote.bidDate).toLocaleDateString()}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Size:</span> {formatFileSize(quote.fileSize)}
                          </div>
                        </div>
                        {quote.notes && (
                          <p className="text-xs text-gray-600 mt-2 ml-8 italic">"{quote.notes}"</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2 ml-8">
                          Uploaded {formatDate(quote.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => {
                            // Note: PDF viewing requires Firebase Storage integration
                            // For now, show file information
                            alert(
                              `PDF File: ${quote.fileName}\n` +
                              `Size: ${(quote.fileSize / 1024).toFixed(2)} KB\n\n` +
                              `To enable PDF viewing, please:\n` +
                              `1. Set up Firebase Storage\n` +
                              `2. Upload PDFs to Storage\n` +
                              `3. Store download URLs in Firestore`
                            );
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View PDF (requires Firebase Storage)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(quote.id!, quote.fileName)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs flex-shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Upload PDF Quote</p>
                <p>Upload your project quote PDF for organization and reference.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs flex-shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Enter Project Information</p>
                <p>Fill in project name, number, GC, and bid date to organize your quotes.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xs flex-shrink-0 mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Manual Entry in Estimating</p>
                <p>Go to the Estimating workspace to manually enter material pricing, deck, joist, detailing, and other line items based on the quote PDF.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
