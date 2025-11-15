"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Save, Settings2, ChevronDown, ChevronUp, AlertTriangle, Plus, Trash2, Users, Building2, MapPin, Phone, Mail } from "lucide-react";
import { 
  loadProjectSettings, 
  saveProjectSettings, 
  loadCompanySettings,
  type ProjectSettings,
  type CompanySettings
} from "@/lib/utils/settingsLoader";
import { getDocument, updateDocument, setDocument, createDocument, queryDocuments } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface ProjectSettingsPanelProps {
  companyId: string;
  projectId: string;
  compact?: boolean;
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
  estimatedValue?: string | number;
  competitionLevel?: string;
  probabilityOfWin?: number;
  notes?: string;
}

interface LaborRate {
  id: string;
  trade: string;
  rate: number;
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

interface BidEvent {
  id?: string;
  date: string;
  projectName: string;
  projectId?: string;
  generalContractor: string;
  notes?: string;
  status: "draft" | "active" | "submitted" | "won" | "lost";
  estimatedValue?: number;
  createdAt?: any;
  updatedAt?: any;
}

export default function ProjectSettingsPanel({ companyId, projectId, compact = false }: ProjectSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed by default
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("unsaved");
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  // Project data
  const [project, setProject] = useState<Project>({
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
  });

  // Project-specific rate overrides
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>({
    materialRate: undefined,
    laborRate: undefined,
    coatingRate: undefined,
    overheadPercentage: undefined,
    profitPercentage: undefined,
  });

  // Local state for rate inputs (to allow typing decimals like .001)
  const [materialRateInput, setMaterialRateInput] = useState<string>("");
  const [laborRateInput, setLaborRateInput] = useState<string>("");
  const [coatingRateInput, setCoatingRateInput] = useState<string>("");
  
  // Track which inputs are currently focused to avoid syncing while typing
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Project-specific labor rates (can override company defaults)
  const [projectLaborRates, setProjectLaborRates] = useState<LaborRate[]>([]);

  // Company contacts for dropdown
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedOwnerContact, setSelectedOwnerContact] = useState<string>("");
  const [selectedGCContact, setSelectedGCContact] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [companyId, projectId]);

  // Sync input values when projectSettings loads (but not while user is typing)
  useEffect(() => {
    if (focusedInput !== "materialRate") {
      setMaterialRateInput(projectSettings.materialRate !== undefined && projectSettings.materialRate !== 0 ? projectSettings.materialRate.toString() : "");
    }
    if (focusedInput !== "laborRate") {
      setLaborRateInput(projectSettings.laborRate !== undefined && projectSettings.laborRate !== 0 ? projectSettings.laborRate.toString() : "");
    }
    if (focusedInput !== "coatingRate") {
      setCoatingRateInput(projectSettings.coatingRate !== undefined && projectSettings.coatingRate !== 0 ? projectSettings.coatingRate.toString() : "");
    }
  }, [projectSettings.materialRate, projectSettings.laborRate, projectSettings.coatingRate, focusedInput]);

  const loadContacts = async (currentProject: Project) => {
    if (!isFirebaseConfigured()) return;

    try {
      const companyPath = `companies/${companyId}`;
      const companyDoc = await getDocument(companyPath);
      if (companyDoc && companyDoc.contacts) {
        const loadedContacts = companyDoc.contacts as Contact[];
        setContacts(loadedContacts);
        
        // Set selected contacts if they match existing project data
        if (currentProject.owner) {
          const ownerMatch = loadedContacts.find(
            c => c.name.toLowerCase() === currentProject.owner.toLowerCase()
          );
          if (ownerMatch) {
            setSelectedOwnerContact(ownerMatch.id);
          }
        }
        if (currentProject.generalContractor) {
          const gcMatch = loadedContacts.find(
            c => c.name.toLowerCase() === currentProject.generalContractor.toLowerCase()
          );
          if (gcMatch) {
            setSelectedGCContact(gcMatch.id);
          }
        }
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load company settings to show defaults
      const company = await loadCompanySettings(companyId);
      setCompanySettings(company);

      // Load project settings
      const settings = await loadProjectSettings(companyId, projectId);
      setProjectSettings(settings);

      // Load project-specific labor rates if they exist, otherwise use company defaults
      if (settings.laborRates && settings.laborRates.length > 0) {
        // Use project-specific labor rates
        setProjectLaborRates(
          settings.laborRates.map((rate, index) => ({
            id: index.toString(),
            trade: rate.trade,
            rate: rate.rate,
          }))
        );
      } else if (company.laborRates && company.laborRates.length > 0) {
        // Use company defaults as starting point
        setProjectLaborRates(
          company.laborRates.map((rate, index) => ({
            id: index.toString(),
            trade: rate.trade,
            rate: rate.rate,
          }))
        );
      }

      // Load project data
      const projectPath = getProjectPath(companyId, projectId);
      const projectData = await getDocument<Project>(projectPath);
      if (projectData) {
        setProject(projectData);
        // Load contacts after project data is loaded so we can match them
        await loadContacts(projectData);
      } else {
        // Even if no project data, still load contacts for dropdown
        await loadContacts(project);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("saving");
    
    try {
      // Check if we should save contacts to address book
      let shouldSaveOwner = false;
      let shouldSaveGC = false;
      
      if (project.owner && !selectedOwnerContact) {
        // Owner was manually entered, check if it exists in contacts
        const ownerExists = contacts.some(c => c.name.toLowerCase() === project.owner.toLowerCase());
        if (!ownerExists) {
          shouldSaveOwner = confirm(`Would you like to save "${project.owner}" to your company address book?`);
        }
      }
      
      if (project.generalContractor && !selectedGCContact) {
        // GC was manually entered, check if it exists in contacts
        const gcExists = contacts.some(c => c.name.toLowerCase() === project.generalContractor.toLowerCase());
        if (!gcExists) {
          shouldSaveGC = confirm(`Would you like to save "${project.generalContractor}" to your company address book?`);
        }
      }

      // Save contacts to address book if requested
      if (shouldSaveOwner || shouldSaveGC) {
        try {
          const companyPath = `companies/${companyId}`;
          const companyDoc = await getDocument(companyPath);
          const existingContacts = (companyDoc?.contacts as Contact[]) || [];
          
          // Check for duplicates
          if (shouldSaveOwner) {
            const duplicate = existingContacts.find(
              c => c.name.toLowerCase() === project.owner.toLowerCase()
            );
            if (duplicate) {
              alert(`Contact "${project.owner}" already exists in your company address book.`);
              setIsSaving(false);
              setSaveStatus("unsaved");
              return;
            }
          }
          
          if (shouldSaveGC) {
            const duplicate = existingContacts.find(
              c => c.name.toLowerCase() === project.generalContractor.toLowerCase()
            );
            if (duplicate) {
              alert(`Contact "${project.generalContractor}" already exists in your company address book.`);
              setIsSaving(false);
              setSaveStatus("unsaved");
              return;
            }
          }
          
          const updatedContacts = [...existingContacts];

          if (shouldSaveOwner) {
            const newOwnerContact: Contact = {
              id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: project.owner,
              type: "customer",
            };
            updatedContacts.push(newOwnerContact);
          }

          if (shouldSaveGC) {
            const newGCContact: Contact = {
              id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: project.generalContractor,
              type: "contractor",
              contactPerson: project.gcContact || "",
              phone: project.gcPhone || "",
              email: project.gcEmail || "",
            };
            updatedContacts.push(newGCContact);
          }

          if (companyDoc) {
            await updateDocument("companies", companyId, {
              contacts: updatedContacts,
            });
          } else {
            await setDocument(companyPath, {
              contacts: updatedContacts,
            }, true);
          }
          
          // Update local contacts state
          setContacts(updatedContacts);
        } catch (error) {
          console.error("Error saving contacts:", error);
          // Don't block project save if contact save fails
        }
      }

      // Clean project data - remove undefined values and ensure proper types
      // IMPORTANT: Load existing project to preserve fields like 'archived' that might not be in local state
      const projectPath = `companies/${companyId}/projects`;
      const fullProjectPath = `${projectPath}/${projectId}`;
      const existingProjectData = await getDocument(fullProjectPath);
      
      const projectDataToSave: any = {
        ...(existingProjectData || {}), // Start with existing data to preserve all fields
        ...project, // Override with current form data
        estimatedValue: project.estimatedValue ? (typeof project.estimatedValue === 'string' ? parseFloat(project.estimatedValue) : project.estimatedValue) : undefined,
        probabilityOfWin: project.probabilityOfWin ?? 50,
        competitionLevel: project.competitionLevel || "medium",
        status: project.status || "draft",
        // Explicitly set archived: preserve if exists, otherwise default to false
        archived: existingProjectData?.archived === true ? true : false,
      };
      
      // Remove only undefined values (keep empty strings for text fields)
      Object.keys(projectDataToSave).forEach(key => {
        if (projectDataToSave[key] === undefined) {
          delete projectDataToSave[key];
        }
      });

      // Save project data - check if document exists first
      if (existingProjectData) {
        // Document exists, update it
        await updateDocument(projectPath, projectId, projectDataToSave);
      } else {
        // Document doesn't exist, create it
        await createDocument(projectPath, {
          ...projectDataToSave,
          id: projectId,
        });
      }

      // Save project settings (rate overrides and project labor rates)
      // Filter out labor rates with empty trade names
      const validLaborRates = projectLaborRates
        .filter(rate => rate.trade && rate.trade.trim() !== "")
        .map(({ id, ...rest }) => rest);
      
      const settingsToSave: ProjectSettings = {
        ...projectSettings,
        laborRates: validLaborRates.length > 0 ? validLaborRates : undefined,
      };
      
      // Remove undefined values from settings
      Object.keys(settingsToSave).forEach(key => {
        if (settingsToSave[key as keyof ProjectSettings] === undefined) {
          delete settingsToSave[key as keyof ProjectSettings];
        }
      });
      
      await saveProjectSettings(companyId, projectId, settingsToSave);

      // Auto-create/update bid event if bidDueDate is set
      if (project.bidDueDate && project.bidDueDate.trim() !== "") {
        try {
          const bidEventsPath = `companies/${companyId}/bidEvents`;
          
          // Check if a bid event already exists for this project
          const existingBidEvents = await queryDocuments<BidEvent>(bidEventsPath);
          const existingEvent = existingBidEvents.find(e => e.projectId === projectId);
          
          const bidEventData: Omit<BidEvent, "id"> = {
            date: project.bidDueDate,
            projectName: project.projectName || "Untitled Project",
            projectId: projectId,
            generalContractor: project.generalContractor || "",
            notes: project.notes || "",
            status: (project.status || "draft") as "draft" | "active" | "submitted" | "won" | "lost",
            estimatedValue: project.estimatedValue ? (typeof project.estimatedValue === 'string' ? parseFloat(project.estimatedValue) : project.estimatedValue) : undefined,
            updatedAt: new Date(),
          };
          
          if (existingEvent?.id) {
            // Update existing bid event
            await updateDocument(bidEventsPath, existingEvent.id, bidEventData);
          } else {
            // Create new bid event
            bidEventData.createdAt = new Date();
            await createDocument(bidEventsPath, bidEventData);
          }
        } catch (error) {
          console.error("Failed to create/update bid event:", error);
          // Don't block project save if bid event creation fails
        }
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("unsaved"), 3000);
    } catch (error: any) {
      console.error("Failed to save project settings:", error);
      const errorMessage = error?.message || error?.toString() || "Unknown error occurred";
      alert(`Failed to save settings: ${errorMessage}. Please check the console for more details.`);
      setSaveStatus("unsaved");
    } finally {
      setIsSaving(false);
    }
  };

  const addLaborRate = () => {
    const newRate: LaborRate = {
      id: Date.now().toString(),
      trade: "",
      rate: 0,
    };
    setProjectLaborRates([...projectLaborRates, newRate]);
  };

  const removeLaborRate = (id: string) => {
    setProjectLaborRates(projectLaborRates.filter((rate) => rate.id !== id));
  };

  const updateLaborRate = (id: string, field: keyof LaborRate, value: string | number) => {
    setProjectLaborRates(
      projectLaborRates.map((rate) =>
        rate.id === id ? { ...rate, [field]: value } : rate
      )
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-amber-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Project Settings
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Warning Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-1">
                  Project-Specific Overrides
                </h3>
                <p className="text-xs text-amber-800">
                  Settings entered here will override company defaults for this project only. Leave fields blank to use company defaults.
                </p>
              </div>
            </div>
          </div>

          {/* Project Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Project Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Project Number
                </label>
                <Input
                  value={project.projectNumber || ""}
                  onChange={(e) => setProject({ ...project, projectNumber: e.target.value })}
                  placeholder="PROJ-2024-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <Input
                  value={project.projectName || ""}
                  onChange={(e) => setProject({ ...project, projectName: e.target.value })}
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Project Type
                </label>
                <select
                  value={project.projectType || ""}
                  onChange={(e) => setProject({ ...project, projectType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Estimator
                </label>
                <Input
                  value={project.estimator || ""}
                  onChange={(e) => setProject({ ...project, estimator: e.target.value })}
                  placeholder="Enter estimator name"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Location/Address
                </label>
                <Input
                  value={project.location || ""}
                  onChange={(e) => setProject({ ...project, location: e.target.value })}
                  placeholder="Project location or address"
                />
              </div>
            </div>
          </div>

          {/* Customer & Contractor Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Customer & Contractor Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Owner/Client
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedOwnerContact}
                    onChange={(e) => {
                      const contactId = e.target.value;
                      setSelectedOwnerContact(contactId);
                      if (contactId) {
                        const contact = contacts.find(c => c.id === contactId);
                        if (contact) {
                          // Build address string from contact
                          const addressParts = [
                            contact.address,
                            contact.city,
                            contact.state,
                            contact.zip
                          ].filter(Boolean);
                          const fullAddress = addressParts.length > 0 
                            ? addressParts.join(", ")
                            : "";
                          
                          setProject({
                            ...project,
                            owner: contact.name,
                            // Update location if contact has address and project location is empty
                            location: project.location || fullAddress,
                          });
                        }
                      } else {
                        setProject({ ...project, owner: "" });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      setSelectedOwnerContact(""); // Clear selection when manually typing
                    }}
                    placeholder="Or enter manually"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">End customer (separate from GC)</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  General Contractor
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedGCContact}
                    onChange={(e) => {
                      const contactId = e.target.value;
                      setSelectedGCContact(contactId);
                      if (contactId) {
                        const contact = contacts.find(c => c.id === contactId);
                        if (contact) {
                          // Build address string from contact
                          const addressParts = [
                            contact.address,
                            contact.city,
                            contact.state,
                            contact.zip
                          ].filter(Boolean);
                          const fullAddress = addressParts.length > 0 
                            ? addressParts.join(", ")
                            : "";
                          
                          setProject({
                            ...project,
                            generalContractor: contact.name,
                            gcContact: contact.contactPerson || "",
                            gcPhone: contact.phone || "",
                            gcEmail: contact.email || "",
                            // Update location if contact has address and project location is empty
                            location: project.location || fullAddress,
                          });
                        }
                      } else {
                        setProject({
                          ...project,
                          generalContractor: "",
                          gcContact: "",
                          gcPhone: "",
                          gcEmail: "",
                        });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      setSelectedGCContact(""); // Clear selection when manually typing
                    }}
                    placeholder="Or enter manually"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  GC Contact Person
                </label>
                <Input
                  value={project.gcContact || ""}
                  onChange={(e) => setProject({ ...project, gcContact: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  GC Phone
                </label>
                <Input
                  type="tel"
                  value={project.gcPhone || ""}
                  onChange={(e) => setProject({ ...project, gcPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  GC Email
                </label>
                <Input
                  type="email"
                  value={project.gcEmail || ""}
                  onChange={(e) => setProject({ ...project, gcEmail: e.target.value })}
                  placeholder="contact@example.com"
                />
              </div>
            </div>
          </div>

          {/* Dates & Deadlines */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Dates & Deadlines</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Bid Due Date
                </label>
                <Input
                  type="date"
                  value={project.bidDueDate || ""}
                  onChange={(e) => setProject({ ...project, bidDueDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Decision Date
                </label>
                <Input
                  type="date"
                  value={project.decisionDate || ""}
                  onChange={(e) => setProject({ ...project, decisionDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Delivery Date
                </label>
                <Input
                  type="date"
                  value={project.deliveryDate || ""}
                  onChange={(e) => setProject({ ...project, deliveryDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Project Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Estimated Value
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                  <Input
                    type="number"
                    value={project.estimatedValue || ""}
                    onChange={(e) => setProject({ ...project, estimatedValue: e.target.value })}
                    placeholder="0.00"
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Competition Level
                </label>
                <select
                  value={project.competitionLevel || "medium"}
                  onChange={(e) => setProject({ ...project, competitionLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Probability of Win: {project.probabilityOfWin || 0}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={project.probabilityOfWin || 50}
                  onChange={(e) => setProject({ ...project, probabilityOfWin: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes & Description
                </label>
                <textarea
                  value={project.notes || ""}
                  onChange={(e) => setProject({ ...project, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="Important project details, special requirements, notes..."
                />
              </div>
            </div>
          </div>

          {/* Rate Overrides */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Rate Overrides</h3>
            <p className="text-xs text-gray-600 mb-4">
              Override company defaults for this project. Leave blank to use company defaults.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Material Rate ($/lb)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={projectSettings.materialRate !== undefined && projectSettings.materialRate !== 0 
                    ? projectSettings.materialRate.toString() 
                    : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty, numbers, decimal points, and very small decimals like .001
                    // Pattern: optional negative, optional leading digits, decimal point, and trailing digits
                    // Also allow partial input like "0." or ".0" or ".001"
                    if (value === "" || value === "." || /^-?(\d+\.?\d*|\.\d*)$/.test(value)) {
                      if (value === "" || value === ".") {
                        setProjectSettings({ 
                          ...projectSettings, 
                          materialRate: undefined 
                        });
                      } else {
                        const numValue = parseFloat(value);
                        // Only update if it's a valid number or still being typed (like "0." or ".001")
                        if (!isNaN(numValue) || value.endsWith(".") || /^\.\d*$/.test(value)) {
                          setProjectSettings({ 
                            ...projectSettings, 
                            materialRate: isNaN(numValue) ? undefined : numValue
                          });
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // Ensure valid number on blur
                    const value = e.target.value.trim();
                    if (value === "" || value === ".") {
                      setProjectSettings({ 
                        ...projectSettings, 
                        materialRate: undefined 
                      });
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        setProjectSettings({ 
                          ...projectSettings, 
                          materialRate: numValue 
                        });
                      } else {
                        // Invalid input, clear it
                        setProjectSettings({ 
                          ...projectSettings, 
                          materialRate: undefined 
                        });
                      }
                    }
                  }}
                  placeholder={companySettings?.materialGrades?.[0] ? `Default: $${companySettings.materialGrades[0].costPerPound}/lb` : "Company default"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Labor Rate ($/hr)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={projectSettings.laborRate !== undefined && projectSettings.laborRate !== 0 
                    ? projectSettings.laborRate.toString() 
                    : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty, numbers, decimal points, and very small decimals like .001
                    // Pattern: optional negative, optional leading digits, decimal point, and trailing digits
                    // Also allow partial input like "0." or ".0" or ".001"
                    if (value === "" || value === "." || /^-?(\d+\.?\d*|\.\d*)$/.test(value)) {
                      if (value === "" || value === ".") {
                        setProjectSettings({ 
                          ...projectSettings, 
                          laborRate: undefined 
                        });
                      } else {
                        const numValue = parseFloat(value);
                        // Only update if it's a valid number or still being typed (like "0." or ".001")
                        if (!isNaN(numValue) || value.endsWith(".") || /^\.\d*$/.test(value)) {
                          setProjectSettings({ 
                            ...projectSettings, 
                            laborRate: isNaN(numValue) ? undefined : numValue
                          });
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // Ensure valid number on blur
                    const value = e.target.value.trim();
                    if (value === "" || value === ".") {
                      setProjectSettings({ 
                        ...projectSettings, 
                        laborRate: undefined 
                      });
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        setProjectSettings({ 
                          ...projectSettings, 
                          laborRate: numValue 
                        });
                      } else {
                        // Invalid input, clear it
                        setProjectSettings({ 
                          ...projectSettings, 
                          laborRate: undefined 
                        });
                      }
                    }
                  }}
                  placeholder={companySettings?.laborRates?.[0] ? `Default: $${companySettings.laborRates[0].rate}/hr` : "Company default"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Coating Rate ($/SF)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={coatingRateInput}
                  onFocus={() => setFocusedInput("coatingRate")}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow any input while typing - validate on blur
                    // Only allow numbers, decimal point, and minus sign
                    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                      setCoatingRateInput(value);
                    }
                  }}
                  onBlur={(e) => {
                    setFocusedInput(null);
                    // Convert to number on blur
                    const value = e.target.value.trim();
                    if (value === "" || value === "." || value === "-" || value === "-.") {
                      setCoatingRateInput("");
                      setProjectSettings({ 
                        ...projectSettings, 
                        coatingRate: undefined 
                      });
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        setProjectSettings({ 
                          ...projectSettings, 
                          coatingRate: numValue 
                        });
                        // Update input to show formatted value
                        setCoatingRateInput(numValue.toString());
                      } else {
                        // Invalid input, reset to last valid value
                        setCoatingRateInput(projectSettings.coatingRate !== undefined ? projectSettings.coatingRate.toString() : "");
                      }
                    }
                  }}
                  placeholder={companySettings?.coatingTypes?.[0] ? `Default: $${companySettings.coatingTypes[0].costPerSF}/SF` : "Company default"}
                />
              </div>
            </div>
          </div>

          {/* Project-Specific Labor Rates */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Project-Specific Labor Rates</h3>
              <Button variant="outline" size="sm" onClick={addLaborRate}>
                <Plus className="w-4 h-4 mr-1" />
                Add Rate
              </Button>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              Override company labor rates for this project. These rates will override company defaults.
            </p>
            <div className="space-y-3">
              {projectLaborRates.map((rate) => (
                <div key={rate.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Trade
                      </label>
                      <Input
                        value={rate.trade}
                        onChange={(e) => updateLaborRate(rate.id, "trade", e.target.value)}
                        placeholder="e.g., Fabricator, Welder"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Rate ($/hr)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={rate.rate}
                        onChange={(e) => updateLaborRate(rate.id, "rate", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeLaborRate(rate.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {projectLaborRates.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  No project-specific labor rates. Company defaults will be used.
                </p>
              )}
            </div>
          </div>

          {/* Markup Overrides */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Markup Overrides</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Overhead Percentage
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={projectSettings.overheadPercentage || ""}
                  onChange={(e) => setProjectSettings({ 
                    ...projectSettings, 
                    overheadPercentage: e.target.value ? parseFloat(e.target.value) : undefined 
                  })}
                  placeholder={companySettings?.markupSettings ? `Default: ${companySettings.markupSettings.overheadPercentage}%` : "Company default"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Profit Percentage
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={projectSettings.profitPercentage || ""}
                  onChange={(e) => setProjectSettings({ 
                    ...projectSettings, 
                    profitPercentage: e.target.value ? parseFloat(e.target.value) : undefined 
                  })}
                  placeholder={companySettings?.markupSettings ? `Default: ${companySettings.markupSettings.profitPercentage}%` : "Company default"}
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              {saveStatus === "saved" && (
                <span className="text-sm text-green-600">Saved</span>
              )}
              {saveStatus === "saving" && (
                <span className="text-sm text-blue-600">Saving...</span>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save All Settings"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
