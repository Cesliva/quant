"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
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

interface BidEvent {
  id?: string;
  date: string; // YYYY-MM-DD format
  projectName: string;
  projectId?: string;
  generalContractor: string;
  notes?: string;
  status: "draft" | "active" | "submitted" | "won" | "lost";
  estimatedValue?: number;
  createdAt?: any;
  updatedAt?: any;
}

interface BidCalendarProps {
  companyId: string;
}

export default function BidCalendar({ companyId }: BidCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<BidEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BidEvent | null>(null);
  const [formData, setFormData] = useState<Partial<BidEvent>>({
    date: "",
    projectName: "",
    generalContractor: "",
    notes: "",
    status: "active",
    estimatedValue: 0,
  });

  // Load events from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const eventsPath = `companies/${companyId}/bidEvents`;
    const unsubscribe = subscribeToCollection<BidEvent>(
      eventsPath,
      (data) => {
        setEvents(data);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Get events for a specific date
  const getEventsForDate = (date: string) => {
    return events.filter(event => event.date === date);
  };

  // Check if date has events
  const hasEvents = (date: string) => {
    return getEventsForDate(date).length > 0;
  };

  // Get urgent events (within 7 days)
  const isUrgent = (date: string) => {
    const eventDate = new Date(date);
    const today = new Date();
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  // Format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get date string for a day in the calendar
  const getDateString = (day: number): string => {
    return formatDate(new Date(year, month, day));
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle date click
  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    const dateEvents = getEventsForDate(date);
    if (dateEvents.length > 0) {
      // If events exist, show the first one for editing
      setEditingEvent(dateEvents[0]);
      setFormData({
        date: dateEvents[0].date,
        projectName: dateEvents[0].projectName,
        generalContractor: dateEvents[0].generalContractor,
        notes: dateEvents[0].notes || "",
        status: dateEvents[0].status,
        estimatedValue: dateEvents[0].estimatedValue || 0,
      });
    } else {
      // New event
      setEditingEvent(null);
      setFormData({
        date,
        projectName: "",
        generalContractor: "",
        notes: "",
        status: "active",
        estimatedValue: 0,
      });
    }
    setIsModalOpen(true);
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.date || !formData.projectName || !formData.generalContractor) {
      alert("Please fill in all required fields (Date, Project Name, General Contractor)");
      return;
    }

    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured. Please set up Firebase credentials to save bids.");
      return;
    }

    try {
      const eventsPath = `companies/${companyId}/bidEvents`;
      const eventData: Omit<BidEvent, "id"> = {
        date: formData.date!,
        projectName: formData.projectName!,
        generalContractor: formData.generalContractor!,
        notes: formData.notes || "",
        status: formData.status || "active",
        estimatedValue: formData.estimatedValue || 0,
        updatedAt: new Date(),
      };

      if (editingEvent?.id) {
        // Update existing
        await updateDocument(`${eventsPath}/${editingEvent.id}`, eventData);
      } else {
        // Create new
        eventData.createdAt = new Date();
        await createDocument(eventsPath, eventData);
      }

      setIsModalOpen(false);
      setEditingEvent(null);
      setFormData({
        date: "",
        projectName: "",
        generalContractor: "",
        notes: "",
        status: "active",
        estimatedValue: 0,
      });
    } catch (error: any) {
      console.error("Failed to save bid event:", error);
      alert(`Failed to save bid: ${error.message}`);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!editingEvent?.id) return;

    if (!confirm("Are you sure you want to delete this bid event?")) return;

    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured.");
      return;
    }

    try {
      const eventsPath = `companies/${companyId}/bidEvents`;
      await deleteDocument(`${eventsPath}/${editingEvent.id}`);
      setIsModalOpen(false);
      setEditingEvent(null);
    } catch (error: any) {
      console.error("Failed to delete bid event:", error);
      alert(`Failed to delete bid: ${error.message}`);
    }
  };

  // Render calendar grid
  const renderCalendarDays = () => {
    const days = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Day headers
    days.push(
      <div key="headers" className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>
    );

    // Calendar days
    const rows = [];
    let currentDay = 1;

    for (let i = 0; i < 6; i++) {
      const week = [];
      for (let j = 0; j < 7; j++) {
        if (i === 0 && j < startingDayOfWeek) {
          // Empty cells before first day
          week.push(<div key={`empty-${j}`} className="aspect-square"></div>);
        } else if (currentDay > daysInMonth) {
          // Empty cells after last day
          week.push(<div key={`empty-${i}-${j}`} className="aspect-square"></div>);
        } else {
          const dateStr = getDateString(currentDay);
          const dateEvents = getEventsForDate(dateStr);
          const urgent = isUrgent(dateStr);
          const isToday = dateStr === formatDate(new Date());
          const isSelected = selectedDate === dateStr;

          week.push(
            <button
              key={currentDay}
              onClick={() => handleDateClick(dateStr)}
              className={`
                aspect-square border border-gray-200 rounded-lg p-1 text-sm
                hover:bg-blue-50 hover:border-blue-300 transition-colors
                ${isToday ? "bg-blue-100 border-blue-400 font-semibold" : ""}
                ${isSelected ? "ring-2 ring-blue-500" : ""}
                ${hasEvents(dateStr) ? "bg-green-50 border-green-300" : ""}
                ${urgent && hasEvents(dateStr) ? "bg-orange-50 border-orange-400" : ""}
              `}
            >
              <div className="text-gray-900">{currentDay}</div>
              {dateEvents.length > 0 && (
                <div className="text-xs mt-1">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                      urgent ? "bg-orange-500" : "bg-green-500"
                    }`}></div>
                    <span className="text-gray-700 truncate">
                      {dateEvents[0].projectName}
                    </span>
                  </div>
                  {dateEvents.length > 1 && (
                    <div className="text-gray-500 text-xs mt-0.5">
                      +{dateEvents.length - 1} more
                    </div>
                  )}
                </div>
              )}
            </button>
          );
          currentDay++;
        }
      }
      rows.push(
        <div key={`week-${i}`} className="grid grid-cols-7 gap-1">
          {week}
        </div>
      );
    }

    days.push(...rows);
    return days;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Bid Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {monthNames[month]} {year}
            </h3>
          </div>

          <div className="space-y-1">
            {renderCalendarDays()}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Has Bids</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>Urgent (≤7 days)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border-2 border-blue-400 bg-blue-100"></div>
                <span>Today</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal for Add/Edit Bid */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingEvent ? "Edit Bid" : "Add Bid"}
                </h3>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingEvent(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formData.date || ""}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

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
                    General Contractor <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.generalContractor || ""}
                    onChange={(e) => setFormData({ ...formData, generalContractor: e.target.value })}
                    placeholder="Enter GC name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || "active"}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="submitted">Submitted</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Value ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <Input
                      type="number"
                      value={formData.estimatedValue || 0}
                      onChange={(e) => setFormData({ ...formData, estimatedValue: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="pl-8"
                    />
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
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  className="flex-1"
                >
                  {editingEvent ? "Save Changes" : "Add Bid"}
                </Button>
                {editingEvent && (
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingEvent(null);
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

