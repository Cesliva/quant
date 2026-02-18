"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { BookOpen, Users, Building2, Phone, Mail, ChevronRight } from "lucide-react";
import { getDocRef } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import WidgetTile from "./widgets/WidgetTile";

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

interface QuickContactsWidgetProps {
  companyId: string;
  className?: string;
  condensed?: boolean;
  variant?: "card" | "tile";
}

export default function QuickContactsWidget({
  companyId,
  className,
  condensed = false,
  variant = "card",
}: QuickContactsWidgetProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to contacts in real-time from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsLoading(false);
      return;
    }

    const companyPath = `companies/${companyId}`;
    const companyDocRef = getDocRef(companyPath);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      companyDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const companyData = docSnapshot.data();
          if (companyData && companyData.contacts) {
            const allContacts = companyData.contacts as Contact[];
            // Show top 4 contacts (prioritize contractors/customers, then most recent)
            const prioritized = allContacts
              .sort((a, b) => {
                // Prioritize contractors and customers
                const typePriority = { contractor: 1, customer: 2, vendor: 3, other: 4 };
                const aPriority = typePriority[a.type] || 4;
                const bPriority = typePriority[b.type] || 4;
                if (aPriority !== bPriority) return aPriority - bPriority;
                // Then by name
                return (a.name || "").localeCompare(b.name || "");
              })
              .slice(0, 4);
            setContacts(prioritized);
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

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [companyId]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "contractor":
        return <Building2 className="w-4 h-4 text-blue-600" />;
      case "customer":
        return <Users className="w-4 h-4 text-green-600" />;
      default:
        return <Users className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "contractor":
        return "GC";
      case "customer":
        return "Customer";
      case "vendor":
        return "Vendor";
      default:
        return "Other";
    }
  };

  const renderContent = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <p className={cn("font-bold text-gray-900 tracking-normal", condensed ? "text-base" : "text-lg")}>Quick Contacts</p>
        </div>
      </div>
      <div>
        {contacts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-base font-bold text-gray-900 tracking-normal mb-2">No Contacts Yet</h3>
            <p className="text-sm text-gray-500 mb-6">Add contacts to quickly access project information</p>
            <Link href="/settings">
              <Button variant="outline" size="md" className="w-full border-2">
                <BookOpen className="w-4 h-4 mr-2" />
                Manage Contacts
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className={condensed ? "space-y-2" : "space-y-3"}>
              {contacts.map((contact, index) => {
                if (condensed && index > 1) return null;
                return (
                <div
                  key={contact.id}
                  className={cn(
                    "p-4 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 hover:shadow-md transition-all duration-200",
                    condensed && "py-3"
                  )}
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {getTypeIcon(contact.type)}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base text-gray-900 truncate">
                          {contact.name}
                        </h4>
                        {contact.company && (
                          <p className="text-sm text-gray-600 truncate mt-0.5">{contact.company}</p>
                        )}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold whitespace-nowrap ml-2">
                      {getTypeLabel(contact.type)}
                    </span>
                  </div>
                  <div className="space-y-1.5 mt-3">
                    {contact.phone && (
                      <div className="flex items-center gap-2.5 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span className="truncate">{contact.phone}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2.5 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )})}
            </div>
            {!condensed && (
              <div className="mt-5 pt-5 border-t border-gray-200">
                <Link href="/settings" className="block">
                  <Button
                    variant="outline"
                    size="md"
                    className="w-full flex items-center justify-center gap-2 border-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    View All Contacts
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  if (isLoading) {
    if (variant === "tile") {
      return (
        <WidgetTile size="medium" className={className}>
          <div className="text-center py-4 text-gray-500 text-sm">Loading contacts...</div>
        </WidgetTile>
      );
    }
    return (
      <Card className={cn("border-0 shadow-sm bg-white/80 backdrop-blur-sm", className)}>
        <CardContent>
          <div className="text-center py-4 text-gray-500 text-sm">Loading contacts...</div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "tile") {
    return (
      <WidgetTile size="large" className={className}>
        {renderContent()}
      </WidgetTile>
    );
  }

  return (
    <Card className={cn("border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 bg-white h-full", className)}>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}

