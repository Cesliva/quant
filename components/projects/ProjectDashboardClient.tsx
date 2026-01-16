"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  ArrowLeft,
  Edit,
  ClipboardList,
  FileCheck,
  FileEdit,
  FileText,
  TrendingUp,
  Users,
  Building2,
  MapPin,
  Clock,
  Settings,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Scissors,
  Save,
  Plus,
  Trash2,
  Download,
  Archive,
  Info,
  RotateCcw,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getDocument,
  subscribeToCollection,
  updateDocument,
  getDocRef,
  getProjectPath,
  setDocument,
  queryDocuments,
} from "@/lib/firebase/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import ProjectSettingsPanel from "@/components/settings/ProjectSettingsPanel";
import { onSnapshot, where } from "firebase/firestore";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { syncProjectToWinLoss } from "@/lib/utils/syncWinLossRecord";
import { uploadFileToStorage, deleteFileFromStorage } from "@/lib/firebase/storage";
import { logActivity } from "@/lib/utils/activityLogger";
import Input from "@/components/ui/Input";
import { Slider } from "@/components/ui/Slider";
import ProjectBubbleChart from "@/components/estimating/ProjectBubbleChart";
import CategoryComparisonChart from "@/components/estimating/CategoryComparisonChart";
import BidStrategyPanel from "@/components/dashboard/BidStrategyPanel";
import BuyoutQuotesTracker from "@/components/estimating/BuyoutQuotesTracker";
import { useAuth } from "@/lib/hooks/useAuth";
import { createDocument } from "@/lib/firebase/firestore";

interface SpecDivision {
  id: string;
  division: string;
  value: string;
}

interface Contact {
  id: string;
  name: string;
  company?: string;
  type: "customer" | "contractor" | "vendor" | "other";
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
}

interface ProjectFile {
  id: string;
  name: string;
  type: "spec" | "drawing" | "quote";
  fileName: string;
  fileSize: number;
  storagePath: string;
  downloadURL: string;
  uploadedAt: Date | string;
  projectName?: string;
  projectNumber?: string;
  generalContractor?: string;
  bidDate?: string;
  notes?: string;
  status?: "draft" | "reviewing" | "quoted" | "archived";
}

interface Project {
  id?: string;
  projectNumber?: string;
  projectName?: string;
  projectType?: string;
  status?: string;
  owner?: string;
  generalContractor?: string;
  gcContact?: string;
  gcPhone?: string;
  gcEmail?: string;
  estimator?: string;
  location?: string;
  bidDueDate?: string;
  decisionDate?: string;
  deliveryDate?: string;
  projectedStartDate?: string;
  fabHours?: number;
  fabWindowStart?: string;
  fabWindowEnd?: string;
  estimatedValue?: string | number;
  competitionLevel?: string;
  probabilityOfWin?: number;
  notes?: string;
  archived?: boolean;
  createdAt?: any;
  updatedAt?: any;
  specDivisions?: SpecDivision[];
  projectFiles?: ProjectFile[];
}

interface ProjectDashboardClientProps {
  projectId: string;
}

export default function ProjectDashboardClient({ projectId }: ProjectDashboardClientProps) {
  const router = useRouter();
  const companyId = useCompanyId();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimatingStats, setEstimatingStats] = useState({
    totalLines: 0,
    totalWeight: 0,
    totalCost: 0,
    totalLabor: 0,
  });

  // Store the valid companyId when it's ready
  const [validCompanyId, setValidCompanyId] = useState<string | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<"spec" | "drawing" | "quote">("spec");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedOwnerContact, setSelectedOwnerContact] = useState<string>("");
  const [selectedGCContact, setSelectedGCContact] = useState<string>("");
  const [originalProjectNumber, setOriginalProjectNumber] = useState<string>("");
  const [showProjectFiles, setShowProjectFiles] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [estimatingLines, setEstimatingLines] = useState<EstimatingLine[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<"laborHoursPerTon" | "costPerTon">("laborHoursPerTon");
  
  // Adjustable parameters state
  const [showAdjustableParams, setShowAdjustableParams] = useState(true);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showAdjustmentHistory, setShowAdjustmentHistory] = useState(false);
  const [parameters, setParameters] = useState({
    laborEfficiency: {
      weld: 1.0,
      fit: 1.0,
      cut: 1.0,
      drillPunch: 1.0,
      cope: 1.0,
      paint: 1.0,
      handleMove: 1.0,
      prepClean: 1.0,
      unload: 1.0,
      loadShip: 1.0,
      processPlate: 1.0,
    },
    laborRateMultiplier: 1.0,
    materialRateMultiplier: 1.0,
    coatingRateMultiplier: 1.0,
    overheadPercentage: 10.0,
    profitPercentage: 10.0,
    materialWastePercentage: 5.0,
    laborWastePercentage: 5.0,
  });
  const [adjustmentHistory, setAdjustmentHistory] = useState<any[]>([]);
  const { user } = useAuth();

  // Track when companyId becomes valid (not "default")
  useEffect(() => {
    if (companyId && companyId !== "default") {
      setValidCompanyId(companyId);
    }
  }, [companyId]);

  // Timeout to prevent infinite loading if companyId never resolves
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!validCompanyId && loading) {
        console.warn("CompanyId took too long to load, proceeding with current value");
        // If we still have "default" after 5 seconds, try to load anyway
        // This handles edge cases where companyId might actually be "default"
        if (companyId) {
          setValidCompanyId(companyId);
        }
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [validCompanyId, loading, companyId]);

  useEffect(() => {
    // Don't load until we have a valid companyId
    if (!validCompanyId) {
      return;
    }
    
    if (projectId === "new") {
      // New project - initialize with empty state and enable edit mode
      setProject({
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
        projectedStartDate: "",
        fabHours: undefined,
        fabWindowStart: "",
        fabWindowEnd: "",
        estimatedValue: "",
        competitionLevel: "medium",
        probabilityOfWin: 50,
        notes: "",
        archived: false,
        specDivisions: [
          { id: "1", division: "05", value: "" },
          { id: "2", division: "09", value: "" },
        ],
        projectFiles: [],
      });
      setIsEditMode(true);
      setLoading(false);
    } else if (projectId) {
      loadProject();
      const unsubscribe = loadEstimatingStats();
      const unsubscribeProject = subscribeToProject();
      return () => {
        if (unsubscribe) unsubscribe();
        if (unsubscribeProject) unsubscribeProject();
      };
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, validCompanyId]);

  const subscribeToProject = () => {
    if (!isFirebaseConfigured() || !validCompanyId) {
      return () => {};
    }

    try {
      const projectPath = getProjectPath(validCompanyId, projectId);
      const projectDocRef = getDocRef(projectPath);

      return onSnapshot(
        projectDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setProject({ id: snapshot.id, ...snapshot.data() } as Project);
          }
        },
        (error) => {
          console.error("Error subscribing to project:", error);
        }
      );
    } catch (error) {
      console.error("Failed to subscribe to project:", error);
      return () => {};
    }
  };

  const loadEstimatingStats = () => {
    try {
      if (!isFirebaseConfigured() || !validCompanyId) {
        setEstimatingStats({
          totalLines: 0,
          totalWeight: 0,
          totalCost: 0,
          totalLabor: 0,
        });
        return () => {};
      }

      const linesPath = getProjectPath(validCompanyId, projectId, "lines");
      const unsubscribe = subscribeToCollection<EstimatingLine>(linesPath, (lines) => {
        setEstimatingLines(lines);
        const activeLines = lines.filter((line) => line.status !== "Void");
        const stats = {
          totalLines: activeLines.length,
          totalWeight: activeLines.reduce(
            (sum, line) =>
              sum +
              (line.materialType === "Material"
                ? line.totalWeight || 0
                : line.plateTotalWeight || 0),
            0
          ),
          totalCost: activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
          totalLabor: activeLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
        };
        setEstimatingStats(stats);
      });
      return unsubscribe;
    } catch (error) {
      console.error("Failed to load estimating stats:", error);
      setEstimatingStats({
        totalLines: 0,
        totalWeight: 0,
        totalCost: 0,
        totalLabor: 0,
      });
      return () => {};
    }
  };

  const loadProject = async () => {
    try {
      setLoading(true);

      if (!isFirebaseConfigured() || !validCompanyId) {
        setProject(null);
        return;
      }

      const projectPath = getProjectPath(validCompanyId, projectId);
      const projectData = await getDocument<Project>(projectPath);

      if (projectData) {
        setProject({
          ...projectData,
          specDivisions: projectData.specDivisions || [
            { id: "1", division: "05", value: "" },
            { id: "2", division: "09", value: "" },
          ],
          projectFiles: projectData.projectFiles || [],
        });
        setOriginalProjectNumber(projectData.projectNumber || "");
      } else {
        setProject(null);
      }
    } catch (error) {
      console.error("Failed to load project:", error);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  // Load contacts
  useEffect(() => {
    if (!isFirebaseConfigured() || !validCompanyId) return;

    const contactsPath = `companies/${validCompanyId}/contacts`;
    const unsubscribe = subscribeToCollection<Contact>(
      contactsPath,
      (data) => {
        setContacts(data);
      }
    );

    return () => unsubscribe();
  }, [validCompanyId]);

  // Load adjustment history
  useEffect(() => {
    if (!isFirebaseConfigured() || !validCompanyId || !projectId) return;

    const adjustmentsPath = getProjectPath(validCompanyId, projectId, "estimateAdjustments");
    const unsubscribe = subscribeToCollection<any>(adjustmentsPath, (adjustments) => {
      const sorted = adjustments
        .map((adj: any) => ({
          ...adj,
          timestamp: adj.timestamp?.toDate ? adj.timestamp.toDate() : new Date(adj.timestamp || Date.now()),
        }))
        .sort((a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50);
      setAdjustmentHistory(sorted);
    });
    return unsubscribe;
  }, [validCompanyId, projectId]);

  // Handle contact selection for Owner/Client
  const handleOwnerContactSelect = (contactId: string) => {
    setSelectedOwnerContact(contactId);
    if (contactId && project) {
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        setProject({
          ...project,
          owner: contact.name,
        });
        setSaveStatus("unsaved");
      }
    }
  };

  // Handle contact selection for General Contractor
  const handleGCContactSelect = (contactId: string) => {
    setSelectedGCContact(contactId);
    if (contactId && project) {
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        setProject({
          ...project,
          generalContractor: contact.name,
          gcContact: contact.contactPerson || "",
          gcPhone: contact.phone || "",
          gcEmail: contact.email || "",
        });
        setSaveStatus("unsaved");
      }
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!project) return;

    // Validation
    if (!project.projectName || !project.projectNumber) {
      alert("Please fill in required fields: Project Name and Project Number");
      return;
    }

    // Validate project number format
    const projectNumberRegex = /^[A-Za-z0-9\-_]+$/;
    if (!projectNumberRegex.test(project.projectNumber || "")) {
      alert("Project Number can only contain letters, numbers, dashes, and underscores.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      if (!isFirebaseConfigured() || !validCompanyId) {
        throw new Error("Firebase is not configured.");
      }

      const isNewProject = projectId === "new";
      let finalProjectId = projectId;

      // Check for duplicate project number
      if (project.projectNumber) {
        const projectsPath = `companies/${validCompanyId}/projects`;
        const existingProjects = await queryDocuments<{ id: string; projectNumber?: string }>(
          projectsPath,
          [where("projectNumber", "==", project.projectNumber)]
        );

        const duplicates = isNewProject 
          ? existingProjects 
          : existingProjects.filter(p => p.id !== projectId);
        if (duplicates.length > 0) {
          alert(`Project Number "${project.projectNumber}" is already in use. Please choose a different number.`);
          setIsSaving(false);
          setSaveStatus("unsaved");
          return;
        }
      }

      const projectData = {
        ...project,
        estimatedValue: project.estimatedValue ? parseFloat(project.estimatedValue.toString()) : undefined,
        createdAt: isNewProject ? new Date() : project.createdAt,
        updatedAt: new Date(),
      };

      if (isNewProject) {
        // Create new project - generate ID
        const { createDocument } = await import("@/lib/firebase/firestore");
        const projectsPath = `companies/${validCompanyId}/projects`;
        finalProjectId = await createDocument(projectsPath, projectData);
        
        // Redirect to the new project page
        router.push(`/projects/${finalProjectId}`);
      } else {
        // Update existing project
        const projectPath = getProjectPath(validCompanyId, projectId);
        await setDocument(projectPath, projectData, true);

        // Sync to win/loss if needed
        await syncProjectToWinLoss(validCompanyId, projectId, projectData);

        setOriginalProjectNumber(project.projectNumber || "");
        setSaveStatus("saved");
        setIsEditMode(false);

        // Reload to get fresh data
        await loadProject();
      }
    } catch (error: any) {
      console.error("Failed to save project:", error);
      alert(`Failed to save project: ${error.message || "Please try again."}`);
      setSaveStatus("unsaved");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File, type: "spec" | "drawing" | "quote") => {
    if (!isFirebaseConfigured() || !validCompanyId || !project) {
      alert("Firebase is not configured.");
      return;
    }

    setIsUploading(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `projects/${validCompanyId}/${projectId}/${type}s/${timestamp}_${sanitizedFileName}`;

      const downloadURL = await uploadFileToStorage(file, storagePath);

      await logActivity(validCompanyId, projectId, "uploaded_file", {
        fileName: file.name,
        fileType: type,
      });

      const newFile: ProjectFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        type,
        fileName: file.name,
        fileSize: file.size,
        storagePath,
        downloadURL,
        uploadedAt: new Date(),
      };

      setProject({
        ...project,
        projectFiles: [...(project.projectFiles || []), newFile],
      });
      setSaveStatus("unsaved");
    } catch (error: any) {
      console.error("Error uploading file:", error);
      alert(`Failed to upload file: ${error.message || "Please try again."}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file delete
  const handleFileDelete = async (fileId: string) => {
    if (!isFirebaseConfigured() || !validCompanyId || !project) return;

    const file = project.projectFiles?.find(f => f.id === fileId);
    if (!file) return;

    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
      return;
    }

    try {
      await deleteFileFromStorage(file.storagePath);
      await logActivity(validCompanyId, projectId, "deleted_file", {
        fileName: file.name,
      });

      setProject({
        ...project,
        projectFiles: project.projectFiles?.filter(f => f.id !== fileId) || [],
      });
      setSaveStatus("unsaved");
    } catch (error: any) {
      console.error("Error deleting file:", error);
      alert(`Failed to delete file: ${error.message || "Please try again."}`);
      setProject({
        ...project,
        projectFiles: project.projectFiles?.filter(f => f.id !== fileId) || [],
      });
      setSaveStatus("unsaved");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // Handle spec division changes
  const handleAddSpecDivision = () => {
    if (project) {
      const newId = `div-${Date.now()}`;
      setProject({
        ...project,
        specDivisions: [
          ...(project.specDivisions || []),
          { id: newId, division: "", value: "" },
        ],
      });
      setSaveStatus("unsaved");
    }
  };

  const handleRemoveSpecDivision = (id: string) => {
    if (project && project.specDivisions && project.specDivisions.length > 1) {
      setProject({
        ...project,
        specDivisions: project.specDivisions.filter((div) => div.id !== id),
      });
      setSaveStatus("unsaved");
    }
  };

  const handleSpecDivisionChange = (id: string, field: "division" | "value", value: string) => {
    if (project) {
      setProject({
        ...project,
        specDivisions: (project.specDivisions || []).map((div) =>
          div.id === id ? { ...div, [field]: value } : div
        ),
      });
      setSaveStatus("unsaved");
    }
  };

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case "draft":
        return {
          label: "Draft",
          color: "bg-gray-100 text-gray-800 border-gray-300",
          icon: Edit,
        };
      case "active":
        return {
          label: "Active",
          color: "bg-blue-100 text-blue-800 border-blue-300",
          icon: Clock,
        };
      case "submitted":
        return {
          label: "Submitted",
          color: "bg-yellow-100 text-yellow-800 border-yellow-300",
          icon: AlertCircle,
        };
      case "won":
        return {
          label: "Won",
          color: "bg-green-100 text-green-800 border-green-300",
          icon: CheckCircle2,
        };
      case "lost":
        return {
          label: "Lost",
          color: "bg-red-100 text-red-800 border-red-300",
          icon: XCircle,
        };
      default:
        return {
          label: "Draft",
          color: "bg-gray-100 text-gray-800 border-gray-300",
          icon: Edit,
        };
    }
  };

  const getDaysUntilBid = (bidDate?: string) => {
    if (!bidDate) return null;
    const today = new Date();
    const bid = new Date(bidDate);
    const diffTime = bid.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatCurrency = (value?: string | number) => {
    if (!value) return "$0.00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calculate totals with adjustable parameters
  const calculatedTotals = useMemo(() => {
    const activeLines = estimatingLines.filter((line) => line.status !== "Void");
    
    let weight = 0;
    let surfaceArea = 0;
    let laborHours = 0;
    let materialCost = 0;
    let laborCost = 0;
    let coatingCost = 0;
    let hardwareCost = 0;

    activeLines.forEach((line) => {
      const lineWeight = line.materialType === "Material" 
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);
      weight += lineWeight;

      const lineSurfaceArea = line.materialType === "Material"
        ? (line.totalSurfaceArea || 0)
        : (line.plateSurfaceArea || 0);
      surfaceArea += lineSurfaceArea;

      const baseMaterialCost = line.materialCost || 0;
      materialCost += baseMaterialCost * parameters.materialRateMultiplier;

      const baseCoatingCost = line.coatingCost || 0;
      coatingCost += baseCoatingCost * parameters.coatingRateMultiplier;

      hardwareCost += line.hardwareCost || 0;

      const baseLaborHours = line.totalLabor || 0;
      
      let adjustedLaborHours = 0;
      let hasBreakdown = false;
      const laborFields = [
        { field: 'laborUnload', multiplier: parameters.laborEfficiency.unload },
        { field: 'laborCut', multiplier: parameters.laborEfficiency.cut },
        { field: 'laborCope', multiplier: parameters.laborEfficiency.cope },
        { field: 'laborProcessPlate', multiplier: parameters.laborEfficiency.processPlate },
        { field: 'laborDrillPunch', multiplier: parameters.laborEfficiency.drillPunch },
        { field: 'laborFit', multiplier: parameters.laborEfficiency.fit },
        { field: 'laborWeld', multiplier: parameters.laborEfficiency.weld },
        { field: 'laborPrepClean', multiplier: parameters.laborEfficiency.prepClean },
        { field: 'laborPaint', multiplier: parameters.laborEfficiency.paint },
        { field: 'laborHandleMove', multiplier: parameters.laborEfficiency.handleMove },
        { field: 'laborLoadShip', multiplier: parameters.laborEfficiency.loadShip },
      ];
      
      laborFields.forEach(({ field, multiplier }) => {
        const hours = (line as any)[field] || 0;
        if (hours > 0) hasBreakdown = true;
        adjustedLaborHours += hours * multiplier;
      });

      if (!hasBreakdown && baseLaborHours > 0) {
        const avgEfficiency = Object.values(parameters.laborEfficiency).reduce((a, b) => a + b, 0) / Object.values(parameters.laborEfficiency).length;
        adjustedLaborHours = baseLaborHours * avgEfficiency;
      }

      laborHours += Math.max(0, adjustedLaborHours);

      const laborRate = line.laborRate || 0;
      laborCost += adjustedLaborHours * laborRate * parameters.laborRateMultiplier;
    });

    const directCost = materialCost + laborCost + coatingCost + hardwareCost;
    const materialWaste = directCost * (parameters.materialWastePercentage / 100);
    const laborWaste = laborCost * (parameters.laborWastePercentage / 100);
    const costBeforeOverhead = directCost + materialWaste + laborWaste;
    const overhead = costBeforeOverhead * (parameters.overheadPercentage / 100);
    const costBeforeProfit = costBeforeOverhead + overhead;
    const profit = costBeforeProfit * (parameters.profitPercentage / 100);
    const totalWithMarkup = costBeforeProfit + profit;

    const tons = weight / 2000;
    const costPerTon = tons > 0 ? totalWithMarkup / tons : 0;
    const hoursPerTon = tons > 0 ? laborHours / tons : 0;

    return {
      weight,
      surfaceArea,
      laborHours,
      materialCost,
      laborCost,
      coatingCost,
      hardwareCost,
      directCost,
      materialWaste,
      laborWaste,
      overhead,
      profit,
      totalWithMarkup,
      costPerTon,
      hoursPerTon,
    };
  }, [estimatingLines, parameters]);

  // Update parameter with logging
  const updateParameter = useCallback((
    path: string,
    value: number,
    reason?: string
  ) => {
    setParameters((prev) => {
      const keys = path.split(".");
      const oldValue = keys.reduce((obj: any, key) => obj?.[key], prev) as number;
      
      const newParams = { ...prev };
      let current: any = newParams;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      // Log adjustment
      if (user && isFirebaseConfigured()) {
        const logEntry = {
          id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          userId: user.uid,
          userName: user.displayName || user.email || "Unknown",
          parameter: path,
          oldValue,
          newValue: value,
          reason,
          impact: {
            costChange: calculatedTotals.totalWithMarkup - (calculatedTotals.totalWithMarkup / (value / oldValue)),
            hoursChange: calculatedTotals.laborHours - (calculatedTotals.laborHours / (value / oldValue)),
            costPerTonChange: calculatedTotals.costPerTon - (calculatedTotals.costPerTon / (value / oldValue)),
          },
        };
        setAdjustmentHistory((prev) => [logEntry, ...prev.slice(0, 49)]);
        
        // Save to Firestore
        const logPath = getProjectPath(validCompanyId || companyId, projectId, "estimateAdjustments");
        createDocument(logPath, {
          ...logEntry,
          timestamp: logEntry.timestamp.toISOString(),
        }).catch(console.error);
      }

      return newParams;
    });
  }, [user, validCompanyId, companyId, projectId, calculatedTotals]);

  // Reset parameters
  const resetParameters = useCallback(() => {
    if (confirm("Reset all adjustments to defaults? This cannot be undone.")) {
      setParameters({
        laborEfficiency: {
          weld: 1.0,
          fit: 1.0,
          cut: 1.0,
          drillPunch: 1.0,
          cope: 1.0,
          paint: 1.0,
          handleMove: 1.0,
          prepClean: 1.0,
          unload: 1.0,
          loadShip: 1.0,
          processPlate: 1.0,
        },
        laborRateMultiplier: 1.0,
        materialRateMultiplier: 1.0,
        coatingRateMultiplier: 1.0,
        overheadPercentage: 10.0,
        profitPercentage: 10.0,
        materialWastePercentage: 5.0,
        laborWastePercentage: 5.0,
      });
    }
  }, []);

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 1) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Not Found</h1>
        <p className="text-gray-600 mb-6">The project you're looking for doesn't exist.</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Company Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;
  const daysUntilBid = getDaysUntilBid(project.bidDueDate);
  const isUrgent = daysUntilBid !== null && daysUntilBid <= 7 && daysUntilBid >= 0;

  const quickActions = [
    {
      name: "Structural Steel Estimate",
      href: `/projects/${projectId}/estimating`,
      icon: ClipboardList,
      description: "Build your estimate",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    // {
    //   name: "Misc Metals AI",
    //   href: `/misc-metals?projectId=${projectId}`,
    //   icon: Package,
    //   aiIcon: Sparkles,
    //   description: "AI-powered misc metals estimation",
    //   color: "bg-indigo-500 hover:bg-indigo-600",
    // }, // Removed - will be in a later version
    {
      name: "Material Nesting & Cutting List",
      href: `/projects/${projectId}/material-nesting`,
      icon: Scissors,
      description: "Optimize material into stock lengths",
      color: "bg-teal-500 hover:bg-teal-600",
    },
    {
      name: "Estimate Reports",
      href: `/projects/${projectId}/reports`,
      icon: FileText,
      description: "Finalize estimate before proposal",
      color: "bg-amber-500 hover:bg-amber-600",
    },
    {
      name: "AI Spec Review",
      href: `/spec-review?projectId=${projectId}`,
      icon: FileCheck,
      aiIcon: Sparkles,
      description: "AI compliance check",
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      name: "AI Generated Proposal",
      href: `/proposal?projectId=${projectId}`,
      icon: FileEdit,
      aiIcon: Sparkles,
      description: "AI-generated proposal",
      color: "bg-green-500 hover:bg-green-600",
    },
  ];

  const secondaryActions: any[] = [];

  return (
    <>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 md:mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">{project.projectName || "Untitled Project"}</h1>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${statusConfig.color}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {statusConfig.label}
            </span>
          </div>
          <p className="text-slate-500">
            {project.projectNumber && <span className="font-mono mr-3">{project.projectNumber}</span>}
            {project.owner && (
              <span className="flex items-center gap-1.5 inline-flex mr-3">
                <Users className="w-4 h-4" />
                {project.owner}
              </span>
            )}
            {project.generalContractor && (
              <span className="flex items-center gap-1.5 inline-flex mr-3">
                <Building2 className="w-4 h-4" />
                {project.generalContractor}
              </span>
            )}
            {project.location && (
              <span className="flex items-center gap-1.5 inline-flex">
                <MapPin className="w-4 h-4" />
                {project.location}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isEditMode ? (
            <>
              {saveStatus === "saved" && (
                <span className="text-sm text-green-600 font-medium">Saved</span>
              )}
              {saveStatus === "saving" && (
                <span className="text-sm text-blue-600 font-medium">Saving...</span>
              )}
              {saveStatus === "unsaved" && (
                <span className="text-sm text-orange-600 font-medium">Unsaved changes</span>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-blue-700 transition-all duration-200"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={() => {
                  if (saveStatus === "unsaved" && !confirm("Discard unsaved changes?")) {
                    return;
                  }
                  setIsEditMode(false);
                  // Reload to reset any unsaved changes
                  loadProject();
                  }}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 text-sm font-medium"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => setShowProjectSettings(true)}
                  className="px-5 py-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Project Settings
                </Button>
                {project.archived ? (
                  <Button
                    onClick={async () => {
                      const activeCompanyId = validCompanyId || companyId;
                      if (confirm("Restore this project? It will appear in your active projects list.")) {
                        try {
                          const projectPath = getProjectPath(activeCompanyId, projectId);
                          const currentProject = await getDocument<Project>(projectPath);

                          await updateDocument(`companies/${activeCompanyId}/projects`, projectId, {
                            ...currentProject,
                            archived: false,
                          });
                          alert("Project restored successfully!");
                        } catch (error: any) {
                          console.error("Failed to restore project:", error);
                          alert(`Failed to restore project: ${error?.message || "Please try again."}`);
                        }
                      }
                    }}
                    className="px-5 py-2.5 rounded-2xl border border-green-200/80 bg-white text-green-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-green-50 hover:border-green-300 transition-all duration-200"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                ) : (
                  <Button
                    onClick={async () => {
                      const activeCompanyId = validCompanyId || companyId;
                      if (
                        confirm(
                          "Archive this project? It will be hidden from your active projects but can be restored later."
                        )
                      ) {
                        try {
                          const projectPath = getProjectPath(activeCompanyId, projectId);
                          const currentProject = await getDocument<Project>(projectPath);

                          if (!currentProject) {
                            if (project) {
                              const { setDocument } = await import("@/lib/firebase/firestore");
                              const dataToSave = {
                                ...project,
                                archived: true,
                              };
                              await setDocument(projectPath, dataToSave, true);
                            } else {
                              alert(
                                "Project document not found in Firestore and no local project data available. Cannot archive."
                              );
                              return;
                            }
                          } else {
                            const { setDocument } = await import("@/lib/firebase/firestore");
                            const dataToSave = {
                              ...currentProject,
                              archived: true,
                            };
                            await setDocument(projectPath, dataToSave, true);
                          }

                          await new Promise((resolve) => setTimeout(resolve, 1000));
                          router.push("/");
                        } catch (error: any) {
                          console.error("Failed to archive project:", error);
                          alert(`Failed to archive project: ${error?.message || "Please try again."}`);
                        }
                      }
                    }}
                    className="px-5 py-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archive
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Project Settings Modal */}
        {showProjectSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowProjectSettings(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Project Settings</h2>
                <Button
                  onClick={() => setShowProjectSettings(false)}
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-slate-700"
                >
                  <XCircle className="w-5 h-5" />
                </Button>
        </div>
              <div className="p-6">
                {showProjectSettings && (
                  <ProjectSettingsPanel 
                    key={`settings-${projectId}`}
                    companyId={validCompanyId || companyId} 
                    projectId={projectId} 
                    compact={false} 
                    forceExpanded={true} 
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Mode Form Sections */}
        {isEditMode && project && (
          <div className="space-y-6 mb-6">
            {/* Basic Information */}
            <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900 tracking-tight mb-1">Basic Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={project.projectNumber || ""}
                      onChange={(e) =>
                        setProject({ ...project, projectNumber: e.target.value.toUpperCase() })
                      }
                      placeholder="PROJ-2024-001"
                      required
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Status
                    </label>
                    <select
                      value={project.status || "draft"}
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
                      value={project.projectName || ""}
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
                      value={project.projectType || ""}
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
                      value={project.location || ""}
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
                      value={project.estimator || ""}
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
            <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900 tracking-tight mb-1 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Client & Contractor Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Owner/Client
                    </label>
                    <div className="space-y-2">
                      <select
                        value={selectedOwnerContact}
                        onChange={(e) => handleOwnerContactSelect(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Select from address book...</option>
                        {contacts
                          .filter(c => c.type === "customer" || c.type === "other")
                          .map(contact => (
                            <option key={contact.id} value={contact.id}>
                              {contact.name}
                            </option>
                          ))}
                      </select>
                      <Input
                        value={project.owner || ""}
                        onChange={(e) => {
                          setProject({ ...project, owner: e.target.value });
                          setSelectedOwnerContact("");
                        }}
                        placeholder="Or enter owner/client name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      General Contractor <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      <select
                        value={selectedGCContact}
                        onChange={(e) => handleGCContactSelect(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Select from address book...</option>
                        {contacts
                          .filter(c => c.type === "contractor" || c.type === "other")
                          .map(contact => (
                            <option key={contact.id} value={contact.id}>
                              {contact.name}
                            </option>
                          ))}
                      </select>
                      <Input
                        value={project.generalContractor || ""}
                        onChange={(e) => {
                          setProject({ ...project, generalContractor: e.target.value });
                          setSelectedGCContact("");
                        }}
                        placeholder="Or enter GC name"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GC Contact Person
                    </label>
                    <Input
                      value={project.gcContact || ""}
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
                      value={project.gcPhone || ""}
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
                      value={project.gcEmail || ""}
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
            <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900 tracking-tight mb-1">Dates & Deadlines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bid Due Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={project.bidDueDate || ""}
                      onChange={(e) =>
                        setProject({ ...project, bidDueDate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Decision Date
                    </label>
                    <Input
                      type="date"
                      value={project.decisionDate || ""}
                      onChange={(e) =>
                        setProject({ ...project, decisionDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Date
                    </label>
                    <Input
                      type="date"
                      value={project.deliveryDate || ""}
                      onChange={(e) =>
                        setProject({ ...project, deliveryDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Projected Shop Start
                    </label>
                    <Input
                      type="date"
                      value={project.projectedStartDate || ""}
                      onChange={(e) =>
                        setProject({ ...project, projectedStartDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fabrication Hours
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={project.fabHours ?? ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setProject({ ...project, fabHours: isNaN(value) ? undefined : value });
                      }}
                      placeholder="e.g., 1200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fab Window Start
                    </label>
                    <Input
                      type="date"
                      value={project.fabWindowStart || ""}
                      onChange={(e) =>
                        setProject({ ...project, fabWindowStart: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fab Window End
                    </label>
                    <Input
                      type="date"
                      value={project.fabWindowEnd || ""}
                      onChange={(e) =>
                        setProject({ ...project, fabWindowEnd: e.target.value })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Details */}
            <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1)]">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900 tracking-tight mb-1">Project Details</CardTitle>
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
                        value={project.estimatedValue || ""}
                        onChange={(e) =>
                          setProject({ ...project, estimatedValue: e.target.value })
                        }
                        placeholder="0.00"
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Competition Level
                    </label>
                    <select
                      value={project.competitionLevel || "medium"}
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
                      Probability of Win: {project.probabilityOfWin || 0}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={project.probabilityOfWin || 0}
                      onChange={(e) =>
                        setProject({
                          ...project,
                          probabilityOfWin: parseInt(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes & Description
                    </label>
                    <textarea
                      value={project.notes || ""}
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
          </div>
        )}

        {/* Top Row - Primary Cards (Company Dashboard Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          {/* Project Status */}
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsEditMode(!isEditMode);
            }}
            className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50 bg-blue-500"
          >
            <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Project Status</p>
            <p className="text-4xl md:text-5xl font-semibold leading-none mb-2 capitalize">
              {project.status || "Draft"}
            </p>
            <p className="text-sm opacity-85">Click to edit project</p>
          </Link>

          {/* Estimate Total */}
          <Link
            href={`/projects/${projectId}/estimating`}
            className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50 bg-emerald-500"
          >
            <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Estimate Total</p>
            <p className="text-4xl md:text-5xl font-semibold leading-none mb-2">
              {formatCurrency(estimatingStats.totalCost).replace("$", "$").split(".")[0]}
            </p>
            <p className="text-sm opacity-85">{estimatingStats.totalLines} line items</p>
          </Link>

          {/* Total Man Hours */}
          <Link
            href={`/projects/${projectId}/estimating`}
            className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50 bg-orange-500"
          >
            <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Total Man Hours</p>
            <p className="text-4xl md:text-5xl font-semibold leading-none mb-2">
              {estimatingStats.totalLabor.toLocaleString()}
            </p>
            <p className="text-sm opacity-85">
              {estimatingStats.totalWeight > 0 
                ? `${(estimatingStats.totalLabor / (estimatingStats.totalWeight / 2000)).toFixed(1)} MH/T`
                : "No weight"}
            </p>
          </Link>

          {/* Days Until Bid */}
          <div className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] transition-all duration-300 bg-purple-500">
            <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Days Until Bid</p>
            <p className="text-4xl md:text-5xl font-semibold leading-none mb-2">
              {daysUntilBid !== null 
                ? daysUntilBid < 0 
                  ? `${Math.abs(daysUntilBid)}`
                  : daysUntilBid === 0
                  ? "0"
                  : daysUntilBid
                : "—"}
            </p>
            <p className="text-sm opacity-85">
              {daysUntilBid !== null 
                ? daysUntilBid < 0 
                  ? "days overdue"
                  : daysUntilBid === 0
                  ? "Due today!"
                  : "days remaining"
                : "No bid date"}
            </p>
          </div>
        </div>


        {/* Quick Actions - Minimalist */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                const AiIcon = (action as any).aiIcon;
                return (
                  <Link key={action.name} href={action.href}>
                    <div className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer group">
                      <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform relative`}>
                        <Icon className="w-5 h-5 text-white" />
                        {AiIcon && (
                          <AiIcon className="w-3 h-3 text-yellow-300 absolute -top-0.5 -right-0.5 drop-shadow-lg" />
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                        {action.name}
                      </h3>
                    </div>
                  </Link>
                );
              })}
              <div
                onClick={() => setShowProjectFiles(!showProjectFiles)}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center mb-2 group-hover:scale-105 transition-transform relative">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                  Project Files
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Project Files Section - Expandable from Quick Actions */}
        {showProjectFiles && (
          <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Project Files</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    Upload specifications, drawings, and quotes
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProjectFiles(false)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload File
              </label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={uploadType === "spec" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setUploadType("spec")}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Specification
                </Button>
                <Button
                  type="button"
                  variant={uploadType === "drawing" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setUploadType("drawing")}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Drawing
                </Button>
                <Button
                  type="button"
                  variant={uploadType === "quote" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setUploadType("quote")}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Quote
                </Button>
              </div>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.dwg,.dxf,.txt"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && project) {
                    handleFileUpload(file, uploadType);
                  }
                  e.target.value = "";
                }}
                disabled={isUploading || !project}
              />
              <p className="text-xs text-gray-500 mt-2">
                Supported formats: PDF, DOC, DOCX, DWG, DXF, TXT
              </p>
            </div>
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Uploading file...
              </div>
            )}
          </div>

          {/* Files List */}
          {project && project.projectFiles && project.projectFiles.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Uploaded Files ({project.projectFiles.length})
              </h3>
              <div className="space-y-2">
                {project.projectFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            file.type === "spec" 
                              ? "bg-blue-100 text-blue-700" 
                              : file.type === "drawing"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {file.type === "spec" ? "Spec" : file.type === "drawing" ? "Drawing" : "Quote"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatFileSize(file.fileSize)} • {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={file.downloadURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleFileDelete(file.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project && (!project.projectFiles || project.projectFiles.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No files uploaded yet</p>
              <p className="text-xs mt-1">Upload specifications, drawings, and quotes to get started</p>
            </div>
          )}
            </CardContent>
          </Card>
        )}

        {/* Historical Comparison Charts */}
        {estimatingLines.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProjectBubbleChart 
                lines={estimatingLines} 
                companyId={validCompanyId || companyId}
                projectName={project?.projectName || ""}
                currentProjectId={projectId}
                selectedMetric={selectedMetric}
                onMetricChange={setSelectedMetric}
              />
              <div className="space-y-6">
                <CategoryComparisonChart
                  lines={estimatingLines}
                  companyId={validCompanyId || companyId}
                  currentProjectId={projectId}
                  selectedMetric={selectedMetric}
                />
                
                {/* Buyout Quotes Tracker */}
                <BuyoutQuotesTracker 
                  companyId={validCompanyId || companyId} 
                  projectId={projectId} 
                />
              </div>
            </div>

            {/* Bid Strategy Panel */}
            <BidStrategyPanel
              lines={estimatingLines}
              project={project}
              estimatingStats={{
                totalCost: calculatedTotals.totalWithMarkup,
                totalLabor: calculatedTotals.laborHours,
                totalWeight: calculatedTotals.weight,
              }}
              companyId={validCompanyId || companyId}
              projectId={projectId}
            />

            {/* Adjustable Parameters are now integrated into Bid Strategy Panel above */}

            {/* Cost Breakdown */}
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
                    Cost Breakdown
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                  >
                    {showCostBreakdown ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              {showCostBreakdown && (
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-xs text-slate-600 mb-1">Direct Cost</div>
                      <div className="text-xl font-semibold text-slate-900 tabular-nums">
                        {formatMoney(calculatedTotals.directCost)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-xs text-slate-600 mb-1">Material Waste</div>
                      <div className="text-xl font-semibold text-slate-900 tabular-nums">
                        {formatMoney(calculatedTotals.materialWaste)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-xs text-slate-600 mb-1">Labor Waste</div>
                      <div className="text-xl font-semibold text-slate-900 tabular-nums">
                        {formatMoney(calculatedTotals.laborWaste)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-xs text-slate-600 mb-1">Overhead</div>
                      <div className="text-xl font-semibold text-slate-900 tabular-nums">
                        {formatMoney(calculatedTotals.overhead)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-xs text-slate-600 mb-1">Profit</div>
                      <div className="text-xl font-semibold text-slate-900 tabular-nums">
                        {formatMoney(calculatedTotals.profit)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-xs text-slate-600 mb-1">Total w/ Markup</div>
                      <div className="text-xl font-semibold text-slate-900 tabular-nums">
                        {formatMoney(calculatedTotals.totalWithMarkup)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Adjustment History */}
            {adjustmentHistory.length > 0 && (
              <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight mb-1 flex items-center gap-2">
                      <History className="w-6 h-6 text-slate-900" />
                      Adjustment History ({adjustmentHistory.length})
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdjustmentHistory(!showAdjustmentHistory)}
                    >
                      {showAdjustmentHistory ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {showAdjustmentHistory && (
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {adjustmentHistory.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">
                              {log.userName} adjusted {log.parameter}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {new Date(log.timestamp).toLocaleString()}
                              {log.reason && ` • ${log.reason}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-900">
                              {formatNumber(log.oldValue, 2)} → {formatNumber(log.newValue, 2)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {log.impact.costChange >= 0 ? "+" : ""}
                              {formatMoney(log.impact.costChange)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}
          </>
        )}
    </>
  );
}

