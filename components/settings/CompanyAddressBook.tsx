"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Save, BookOpen, ChevronDown, ChevronUp, AlertTriangle, Plus, Trash2, Users, Building2, MapPin, Phone, Mail, Edit } from "lucide-react";
import { getDocument, updateDocument, setDocument, getDocRef } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { onSnapshot } from "firebase/firestore";

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

interface CompanyAddressBookProps {
  companyId: string;
  compact?: boolean;
}

export default function CompanyAddressBook({ companyId, compact = false }: CompanyAddressBookProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed by default
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("unsaved");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Load contacts from Firestore with real-time updates
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const companyPath = `companies/${companyId}`;
      const companyDocRef = getDocRef(companyPath);
      
      const unsubscribe = onSnapshot(
        companyDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data && data.contacts) {
              setContacts(data.contacts as Contact[]);
            } else {
              setContacts([]);
            }
          } else {
            setContacts([]);
          }
          setIsLoading(false);
        },
        (error) => {
          console.error("Error loading contacts:", error);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up contacts subscription:", error);
      setIsLoading(false);
    }
  }, [companyId]);

  const handleSave = async () => {
    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured. Please set up your Firebase credentials.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      // Ensure all contacts have proper IDs (replace temp IDs)
      const savedContacts = contacts.map(contact => ({
        ...contact,
        id: contact.id.startsWith("temp-") ? `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : contact.id
      }));

      const companyPath = `companies/${companyId}`;
      
      // Check if company document exists
      const companyDoc = await getDocument(companyPath);
      
      if (companyDoc) {
        // Document exists, update it
        await updateDocument("companies", companyId, {
          contacts: savedContacts,
        });
      } else {
        // Document doesn't exist, create it with contacts
        await setDocument(companyPath, {
          contacts: savedContacts,
        }, true);
      }

      setContacts(savedContacts);
      setSaveStatus("saved");
      setIsAddingNew(false);
      setEditingContact(null);
      
      setTimeout(() => {
        setSaveStatus("unsaved");
      }, 2000);
    } catch (error: any) {
      console.error("Error saving contacts:", error);
      alert(`Failed to save contacts: ${error.message || "Please try again."}`);
      setSaveStatus("unsaved");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNew = () => {
    setEditingContact({
      id: `temp-${Date.now()}`,
      name: "",
      type: "customer",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      notes: "",
    });
    setIsAddingNew(true);
    setSaveStatus("unsaved");
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact({ ...contact });
    setIsAddingNew(false);
    setSaveStatus("unsaved");
  };

  const handleDelete = (contactId: string) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      setContacts(contacts.filter(c => c.id !== contactId));
      setSaveStatus("unsaved");
      if (editingContact?.id === contactId) {
        setEditingContact(null);
        setIsAddingNew(false);
      }
    }
  };

  const handleContactChange = (field: keyof Contact, value: string) => {
    if (!editingContact) return;

    const updated = { ...editingContact, [field]: value };
    setEditingContact(updated);

    // Update in contacts array if it exists
    const index = contacts.findIndex(c => c.id === editingContact.id);
    if (index >= 0) {
      const updatedContacts = [...contacts];
      updatedContacts[index] = updated;
      setContacts(updatedContacts);
    } else if (isAddingNew) {
      // New contact being added, add to array
      setContacts([...contacts, updated]);
    }

    setSaveStatus("unsaved");
  };

  const handleCancelEdit = () => {
    if (isAddingNew) {
      // Remove temporary contact from list
      setContacts(contacts.filter(c => !c.id.startsWith("temp-")));
    }
    setEditingContact(null);
    setIsAddingNew(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading address book...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Company Address Book
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
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Company Contacts
                </h3>
                <p className="text-xs text-blue-800">
                  Manage your customer, contractor, and vendor contacts. These contacts can be quickly loaded into project settings to auto-populate customer information.
                </p>
              </div>
            </div>
          </div>

          {/* Add New Button */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contacts ({contacts.length})
            </h3>
            <Button variant="outline" size="sm" onClick={handleAddNew}>
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>

          {/* Contact List */}
          {contacts.length === 0 && !editingContact && (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No contacts yet. Add your first contact to get started.</p>
            </div>
          )}

          {/* Contact Cards */}
          <div className="space-y-4">
            {contacts.map((contact) => (
              <div key={contact.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                {editingContact?.id === contact.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Contact Name *
                        </label>
                        <Input
                          value={editingContact.name || ""}
                          onChange={(e) => handleContactChange("name", e.target.value)}
                          placeholder="Company or individual name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Type *
                        </label>
                        <select
                          value={editingContact.type || "customer"}
                          onChange={(e) => handleContactChange("type", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="customer">Customer</option>
                          <option value="contractor">Contractor</option>
                          <option value="vendor">Vendor</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Contact Person
                        </label>
                        <Input
                          value={editingContact.contactPerson || ""}
                          onChange={(e) => handleContactChange("contactPerson", e.target.value)}
                          placeholder="Primary contact name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          Phone
                        </label>
                        <Input
                          value={editingContact.phone || ""}
                          onChange={(e) => handleContactChange("phone", e.target.value)}
                          placeholder="Phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          Email
                        </label>
                        <Input
                          type="email"
                          value={editingContact.email || ""}
                          onChange={(e) => handleContactChange("email", e.target.value)}
                          placeholder="email@company.com"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          Street Address
                        </label>
                        <Input
                          value={editingContact.address || ""}
                          onChange={(e) => handleContactChange("address", e.target.value)}
                          placeholder="123 Main St"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <Input
                          value={editingContact.city || ""}
                          onChange={(e) => handleContactChange("city", e.target.value)}
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          State
                        </label>
                        <Input
                          value={editingContact.state || ""}
                          onChange={(e) => handleContactChange("state", e.target.value)}
                          placeholder="State"
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          ZIP Code
                        </label>
                        <Input
                          value={editingContact.zip || ""}
                          onChange={(e) => handleContactChange("zip", e.target.value)}
                          placeholder="12345"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={editingContact.notes || ""}
                          onChange={(e) => handleContactChange("notes", e.target.value)}
                          placeholder="Additional notes about this contact..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving || !editingContact.name}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? "Saving..." : "Save Contact"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">{contact.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            contact.type === "customer" ? "bg-blue-100 text-blue-800" :
                            contact.type === "contractor" ? "bg-green-100 text-green-800" :
                            contact.type === "vendor" ? "bg-purple-100 text-purple-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}
                          </span>
                        </div>
                        {contact.contactPerson && (
                          <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {contact.contactPerson}
                          </p>
                        )}
                        {contact.phone && (
                          <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {contact.phone}
                          </p>
                        )}
                        {contact.email && (
                          <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {contact.email}
                          </p>
                        )}
                        {(contact.address || contact.city || contact.state || contact.zip) && (
                          <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {[contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {contact.notes && (
                          <p className="text-sm text-gray-500 mt-2 italic">{contact.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(contact)} className="flex items-center gap-1">
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(contact.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* New Contact Form */}
            {isAddingNew && editingContact && !contacts.find(c => c.id === editingContact.id) && (
              <div className="border-2 border-blue-300 border-dashed rounded-lg p-4 bg-blue-50">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Contact
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Contact Name *
                      </label>
                      <Input
                        value={editingContact.name || ""}
                        onChange={(e) => handleContactChange("name", e.target.value)}
                        placeholder="Company or individual name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Type *
                      </label>
                      <select
                        value={editingContact.type || "customer"}
                        onChange={(e) => handleContactChange("type", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="customer">Customer</option>
                        <option value="contractor">Contractor</option>
                        <option value="vendor">Vendor</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Contact Person
                      </label>
                      <Input
                        value={editingContact.contactPerson || ""}
                        onChange={(e) => handleContactChange("contactPerson", e.target.value)}
                        placeholder="Primary contact name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        Phone
                      </label>
                      <Input
                        value={editingContact.phone || ""}
                        onChange={(e) => handleContactChange("phone", e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </label>
                      <Input
                        type="email"
                        value={editingContact.email || ""}
                        onChange={(e) => handleContactChange("email", e.target.value)}
                        placeholder="contact@example.com"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        Street Address
                      </label>
                      <Input
                        value={editingContact.address || ""}
                        onChange={(e) => handleContactChange("address", e.target.value)}
                        placeholder="123 Main St"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <Input
                        value={editingContact.city || ""}
                        onChange={(e) => handleContactChange("city", e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <Input
                        value={editingContact.state || ""}
                        onChange={(e) => handleContactChange("state", e.target.value)}
                        placeholder="State"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        ZIP Code
                      </label>
                      <Input
                        value={editingContact.zip || ""}
                        onChange={(e) => handleContactChange("zip", e.target.value)}
                        placeholder="12345"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={editingContact.notes || ""}
                        onChange={(e) => handleContactChange("notes", e.target.value)}
                        placeholder="Additional notes about this contact..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving || !editingContact.name}>
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? "Saving..." : "Save Contact"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save All Button */}
          {saveStatus !== "saved" && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div>
                {saveStatus === "saving" && (
                  <span className="text-sm text-blue-600">Saving...</span>
                )}
                {saveStatus === "unsaved" && (
                  <span className="text-sm text-amber-600">Unsaved changes</span>
                )}
              </div>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save All Changes"}
              </Button>
            </div>
          )}
          {saveStatus === "saved" && (
            <div className="pt-4 border-t border-gray-200">
              <span className="text-sm text-green-600">All changes saved</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

