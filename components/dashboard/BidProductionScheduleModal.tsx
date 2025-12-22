"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Info,
  Trash2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  deleteDocument,
} from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { loadCompanySettings, type CompanySettings } from "@/lib/utils/settingsLoader";

type DailyOverrides = Record<string, number>;

interface BidEvent {
  id?: string;
  date: string;
  projectName: string;
  projectId?: string;
  generalContractor: string;
  bidTime?: string; // Time in HH:mm format
  notes?: string;
  status: "draft" | "active" | "submitted" | "won" | "lost";
  estimatedValue?: number;
  createdAt?: any;
  updatedAt?: any;
}

interface ProjectScheduleEntry {
  id?: string;
  projectName?: string;
  status?: string;
  archived?: boolean;
  fabHours?: number;
  fabWindowStart?: string;
  fabWindowEnd?: string;
  projectedStartDate?: string;
  decisionDate?: string;
  remainingShopHours?: number;
  estimatedShopHoursTotal?: number;
  fabDailyOverrides?: DailyOverrides;
}

interface ProductionEntry {
  id?: string;
  projectName: string;
  startDate: string;
  endDate?: string;
  totalHours: number;
  overrides?: DailyOverrides;
  createdAt?: any;
  updatedAt?: any;
}

interface ProductionLoad {
  id: string;
  key: string;
  name: string;
  source: "project" | "manual";
  startDate: string;
  endDate?: string;
  totalHours: number;
  overrides?: DailyOverrides;
  collectionPath: string;
  overrideField: "fabDailyOverrides" | "overrides";
  canDelete: boolean;
}

interface BidProductionScheduleModalProps {
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  asPage?: boolean; // If true, renders as a full page instead of modal
}

interface DailyTotalsEntry {
  total: number;
  loads: Array<{ loadKey: string; name: string; hours: number }>;
}

const formatDate = (date: Date) => date.toISOString().split("T")[0];
const formatShortLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });

// Normalize time to 24-hour format (HH:mm)
const normalizeTimeTo24Hour = (time: string): string => {
  if (!time) return "";
  // If already in HH:mm format, return as is
  if (/^\d{2}:\d{2}$/.test(time)) {
    return time;
  }
  // If in HH:mm:ss format, extract HH:mm
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return time.substring(0, 5);
  }
  // Try to parse and convert if needed
  try {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const m = parseInt(minutes || "0", 10);
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return time;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DEFAULT_WORKING_DAYS = ["mon", "tue", "wed", "thu", "fri"];

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addWeeks = (date: Date, weeks: number) => addDays(date, weeks * 7);

const parseDateOrNull = (value?: string) => {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts.map((p) => Number(p));
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      const local = new Date(y, m - 1, d, 0, 0, 0, 0);
      if (!Number.isNaN(local.getTime())) {
        return local;
      }
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDateRange = (start: Date, end: Date) => {
  const range: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endClone = new Date(end);
  endClone.setHours(0, 0, 0, 0);
  while (cursor <= endClone) {
    range.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return range;
};

export default function BidProductionScheduleModal({
  companyId,
  isOpen,
  onClose,
  asPage = false,
}: BidProductionScheduleModalProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<BidEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<BidEvent | null>(null);
  const [bidForm, setBidForm] = useState<Partial<BidEvent>>({
    date: "",
    projectName: "",
    generalContractor: "",
    bidTime: "",
    notes: "",
    status: "active",
    estimatedValue: 0,
  });
  const [projects, setProjects] = useState<ProjectScheduleEntry[]>([]);
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [isSavingBid, setIsSavingBid] = useState(false);
  const [isSavingProduction, setIsSavingProduction] = useState(false);
  const [productionForm, setProductionForm] = useState({
    projectName: "",
    startDate: formatDate(new Date()),
    endDate: "",
    totalHours: "",
  });
  const [dailyEdits, setDailyEdits] = useState<Record<string, string>>({});
  const [updatingOverrideKey, setUpdatingOverrideKey] = useState<string | null>(null);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const productionEntriesPath = `companies/${companyId}/productionEntries`;
  const projectsPath = `companies/${companyId}/projects`;

  const startOfCurrentWeek = getStartOfWeek(today);

  useEffect(() => {
    if (!isOpen) return;
    loadCompanySettings(companyId).then(setCompanySettings);
  }, [companyId, isOpen]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !isOpen) return;
    const eventsPath = `companies/${companyId}/bidEvents`;
    const unsubscribe = subscribeToCollection<BidEvent>(eventsPath, (data) => {
      setEvents(data || []);
    });
    return () => unsubscribe();
  }, [companyId, isOpen]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !isOpen) return;
    const unsubscribe = subscribeToCollection<ProjectScheduleEntry>(projectsPath, (data) => {
      setProjects(data || []);
    });
    return () => unsubscribe();
  }, [companyId, isOpen, projectsPath]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !isOpen) return;
    const unsubscribe = subscribeToCollection<ProductionEntry>(
      productionEntriesPath,
      (data) => setProductionEntries(data || [])
    );
    return () => unsubscribe();
  }, [companyId, isOpen, productionEntriesPath]);

  useEffect(() => {
    if (!isOpen) return;
    const defaultDate = formatDate(today);
    setSelectedDate((prev) => prev || defaultDate);
    // Initialize bidForm.date if empty when modal opens
    setBidForm((prev) => ({ ...prev, date: prev.date || defaultDate }));
  }, [isOpen, today]);

  useEffect(() => {
    setDailyEdits({});
  }, [selectedDate, isOpen]);

  const weeklyCapacitySetting = companySettings?.shopCapacityHoursPerWeek ?? 0;
  const configuredDailyCapacity = companySettings?.shopCapacityHoursPerDay ?? null;
  const weeksToForecast = companySettings?.backlogForecastWeeks ?? 24;
  const underUtilizedThreshold = companySettings?.underUtilizedThreshold ?? 0.7;
  const workingDays = companySettings?.workingDays?.length
    ? companySettings.workingDays
    : DEFAULT_WORKING_DAYS;
  const workingDaysCount = workingDays.length || 5;
  const derivedDailyCapacity =
    weeklyCapacitySetting > 0 && workingDaysCount > 0
      ? weeklyCapacitySetting / workingDaysCount
      : 0;
  const inferredDailyCapacity =
    configuredDailyCapacity && configuredDailyCapacity > 0
      ? configuredDailyCapacity
      : derivedDailyCapacity;
  const effectiveDailyCapacity = inferredDailyCapacity > 0 ? inferredDailyCapacity : 8;
  const weeklyCapacity =
    weeklyCapacitySetting ||
    (effectiveDailyCapacity > 0 ? effectiveDailyCapacity * workingDaysCount : 0);
  const workingDaysKey = workingDays.join(",");
  const workingDaysSet = useMemo(
    () => new Set(workingDays.map((day) => day.toLowerCase())),
    [workingDaysKey]
  );
  const holidays = companySettings?.holidays?.filter((date) => !!date) ?? [];
  const holidaysKey = holidays.join(",");
  const holidaySet = useMemo(() => new Set(holidays), [holidaysKey]);
  const isWorkingDayDate = useMemo(
    () => (date: Date) => {
      const dayKey = DAY_KEYS[date.getDay()];
      const dateKey = formatDate(date);
      return workingDaysSet.has(dayKey) && !holidaySet.has(dateKey);
    },
    [workingDaysSet, holidaySet]
  );

  const backlogProjects = useMemo(() => {
    return projects.filter((project) => {
      if (project.archived) return false;
      const status = project.status?.toLowerCase();
      const hours = getFabHours(project);
      if (hours <= 0) return false;
      return status === "awarded" || status === "in_progress";
    });
  }, [projects]);

  const projectLoads = useMemo<ProductionLoad[]>(() => {
    return backlogProjects
      .map<ProductionLoad | null>((project) => {
        const totalHours = getFabHours(project);
        const start =
          project.fabWindowStart ||
          project.projectedStartDate ||
          project.decisionDate ||
          undefined;
        if (!project.id || !start || totalHours <= 0) {
          return null;
        }
        return {
          id: project.id,
          key: `project-${project.id}`,
          name: project.projectName || "Untitled Project",
          source: "project",
          startDate: start,
          endDate: project.fabWindowEnd || undefined,
          totalHours,
          overrides: project.fabDailyOverrides || {},
          collectionPath: projectsPath,
          overrideField: "fabDailyOverrides",
          canDelete: false,
        };
      })
      .filter(Boolean) as ProductionLoad[];
  }, [backlogProjects, projectsPath]);

  const manualLoads = useMemo<ProductionLoad[]>(() => {
    return productionEntries
      .map<ProductionLoad | null>((entry) => {
        if (!entry.id || !entry.startDate || entry.totalHours <= 0) {
          return null;
        }
        return {
          id: entry.id,
          key: `manual-${entry.id}`,
          name: entry.projectName,
          source: "manual",
          startDate: entry.startDate,
          endDate: entry.endDate || undefined,
          totalHours: entry.totalHours,
          overrides: entry.overrides || {},
          collectionPath: productionEntriesPath,
          overrideField: "overrides",
          canDelete: true,
        };
      })
      .filter(Boolean) as ProductionLoad[];
  }, [productionEntries, productionEntriesPath]);

  const productionLoads = useMemo(
    () => [...projectLoads, ...manualLoads],
    [projectLoads, manualLoads]
  );

  const { loadSchedules, dailyTotals } = useMemo(() => {
    const scheduleMap: Record<string, Record<string, number>> = {};
    const totals: Record<string, DailyTotalsEntry> = {};

    productionLoads.forEach((load) => {
      if (!load.startDate || load.totalHours <= 0) return;
      const schedule = buildDailyAllocation(load, effectiveDailyCapacity, isWorkingDayDate);
      scheduleMap[load.key] = schedule;

      Object.entries(schedule).forEach(([dateKey, hours]) => {
        if (!totals[dateKey]) {
          totals[dateKey] = { total: 0, loads: [] };
        }
        totals[dateKey].total += hours;
        totals[dateKey].loads.push({
          loadKey: load.key,
          name: load.name,
          hours,
        });
      });
    });

    return { loadSchedules: scheduleMap, dailyTotals: totals };
  }, [productionLoads, effectiveDailyCapacity, workingDaysKey, holidaysKey]);

  const weeklySummaries = useMemo(() => {
    const summaries: Array<{
      weekIndex: number;
      startDate: Date;
      usedHours: number;
      capacityHours: number;
    }> = [];

    for (let i = 0; i < weeksToForecast; i++) {
      const weekStart = addWeeks(startOfCurrentWeek, i);
      const weekEnd = addDays(weekStart, 6);
      let used = 0;
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const dayKey = formatDate(date);
      if (!isWorkingDayDate(date)) continue;
      used += dailyTotals[dayKey]?.total ?? 0;
    }
      summaries.push({
        weekIndex: i,
        startDate: weekStart,
        usedHours: used,
        capacityHours: weeklyCapacity,
      });
    }

    return summaries;
  }, [dailyTotals, startOfCurrentWeek, weeksToForecast, weeklyCapacity]);

  const selectedWeekKey = selectedDate
    ? formatDate(getStartOfWeek(new Date(selectedDate)))
    : null;

  const selectedWeekDates = selectedWeekKey
    ? getDateRange(new Date(selectedWeekKey), addDays(new Date(selectedWeekKey), 6))
    : [];

  const selectedWeekLoads = useMemo(() => {
    if (!selectedWeekKey) return [];
    return productionLoads
      .map((load) => {
        const schedule = loadSchedules[load.key] || {};
        const rows = selectedWeekDates.map((date) => {
          const key = formatDate(date);
          const working = isWorkingDayDate(date);
          const hours = working ? schedule[key] : undefined;
          return {
            date,
            dateKey: key,
            hours,
            isWorkingDay: working,
          };
        });
        const hasHours = rows.some((row) => row.hours !== undefined);
        if (!hasHours) {
          return null;
        }
        return { load, rows };
      })
      .filter(Boolean) as Array<{
        load: ProductionLoad;
        rows: Array<{
          date: Date;
          dateKey: string;
          hours?: number;
          isWorkingDay: boolean;
          isActive: boolean;
        }>;
      }>;
  }, [
    productionLoads,
    loadSchedules,
    selectedWeekKey,
    selectedWeekDates,
    workingDaysKey,
    holidaysKey,
  ]);

  const gapWeeksCurrent = weeklySummaries.filter(
    (week) =>
      week.capacityHours > 0 &&
      week.weekIndex <= 3 &&
      week.usedHours / week.capacityHours < underUtilizedThreshold
  );
  const gapWeeksFuture = weeklySummaries.filter(
    (week) =>
      week.capacityHours > 0 &&
      week.weekIndex > 3 &&
      week.usedHours / week.capacityHours < underUtilizedThreshold
  );
  const overloadWeeks = weeklySummaries.filter(
    (week) => week.capacityHours > 0 && week.usedHours > week.capacityHours
  );

  const getEventsForDate = (date: string) => events.filter((event) => event.date === date);

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    // Also update bidForm.date when date is clicked from calendar
    setBidForm({ ...bidForm, date: date });
  };

  const handleAddProductionEntry = async () => {
    if (
      !productionForm.projectName.trim() ||
      !productionForm.startDate ||
      !productionForm.totalHours
    ) {
      alert("Please enter project name, start date, and total hours.");
      return;
    }

    const totalHours = parseFloat(productionForm.totalHours);
    if (isNaN(totalHours) || totalHours <= 0) {
      alert("Total hours must be greater than zero.");
      return;
    }

    const startDateObj = parseDateOrNull(productionForm.startDate);
    if (!startDateObj) {
      alert("Please provide a valid start date.");
      return;
    }

    if (
      productionForm.endDate &&
      new Date(productionForm.endDate) < new Date(productionForm.startDate)
    ) {
      alert("End date cannot be before start date.");
      return;
    }

    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured.");
      return;
    }

    try {
      setIsSavingProduction(true);

      if (productionForm.endDate) {
        const endDateObj = parseDateOrNull(productionForm.endDate);
        if (endDateObj) {
          const workingDatesInRange = getWorkingDatesBetween(
            startDateObj,
            endDateObj,
            isWorkingDayDate
          );
          if (workingDatesInRange.length === 0) {
            alert("No working days exist between the selected start and end dates.");
            setIsSavingProduction(false);
            return;
          }
          const maxCapacity =
            effectiveDailyCapacity > 0
              ? workingDatesInRange.length * effectiveDailyCapacity
              : null;
          if (maxCapacity !== null && totalHours > maxCapacity) {
            alert(
              `Heads up: ${totalHours.toLocaleString()} hrs exceeds the available capacity (${maxCapacity.toLocaleString()} hrs) between these dates. The load will overbook those days.`
            );
          }
        }
      }

      await createDocument(productionEntriesPath, {
        projectName: productionForm.projectName.trim(),
        startDate: productionForm.startDate,
        endDate: productionForm.endDate || null,
        totalHours,
        overrides: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setProductionForm({
        projectName: "",
        startDate: selectedDate || productionForm.startDate,
        endDate: "",
        totalHours: "",
      });
    } catch (error) {
      console.error("Failed to add production entry:", error);
      alert("Failed to add production entry. Please try again.");
    } finally {
      setIsSavingProduction(false);
    }
  };

  const handleDeleteProductionEntry = async (load: ProductionLoad) => {
    if (!load.canDelete) return;
    if (!confirm(`Delete ${load.name}?`)) return;
    try {
      await deleteDocument(load.collectionPath, load.id);
    } catch (error) {
      console.error("Failed to delete production entry:", error);
      alert("Failed to delete production entry.");
    }
  };

  const getDailyCellColor = (date: Date, hours: number) => {
    if (!isWorkingDayDate(date)) {
      return "bg-gray-50 border-gray-200 text-gray-400";
    }
    if (effectiveDailyCapacity <= 0) return "";
    if (hours > effectiveDailyCapacity + 0.01) return "bg-red-100 border-red-400";
    if (Math.abs(hours - effectiveDailyCapacity) < 0.01 && hours > 0) {
      return "bg-amber-100 border-amber-300";
    }
    if (hours > 0) return "bg-green-50 border-green-300";
    return "";
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const rows = [];
    rows.push(
      <div key="headers" className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>
    );

    let currentDay = 1;
    for (let i = 0; i < 6; i++) {
      const week = [];
      for (let j = 0; j < 7; j++) {
        if (i === 0 && j < startingDayOfWeek) {
          week.push(<div key={`empty-${i}-${j}`} className="aspect-square" />);
          continue;
        }
        if (currentDay > daysInMonth) {
          week.push(<div key={`empty-${i}-${j}`} className="aspect-square" />);
          continue;
        }

        const date = new Date(year, month, currentDay);
        const dateStr = formatDate(date);
        const isToday = dateStr === formatDate(today);
        const isSelected = selectedDate === dateStr;
        const isWorking = isWorkingDayDate(date);
        const totalHours = isWorking ? dailyTotals[dateStr]?.total ?? 0 : 0;
        const colorClass = getDailyCellColor(date, totalHours);

        week.push(
          <button
            key={dateStr}
            onClick={() => handleDateClick(dateStr)}
            className={`aspect-square border rounded-lg p-1 text-sm transition-colors ${
              isToday ? "bg-blue-100 border-blue-400 font-semibold" : "border-gray-200"
            } ${isSelected ? "ring-2 ring-blue-500" : ""} ${colorClass}`}
          >
            <div className="text-gray-900">{currentDay}</div>
            {isWorking ? (
              totalHours > 0 && (
                <div className="text-[10px] text-gray-600 mt-1">
                  {Math.round(totalHours)} hrs
                </div>
              )
            ) : (
              <div className="text-[10px] text-gray-400 mt-1">Off</div>
            )}
            {getEventsForDate(dateStr).length > 0 && (
              <div className="text-[10px] text-gray-500 mt-1 space-y-0.5">
                {getEventsForDate(dateStr).slice(0, 2).map((event, idx) => (
                  <div key={idx} className="truncate">
                    {event.projectName}
                    {event.bidTime && <span className="text-[9px]"> @ {normalizeTimeTo24Hour(event.bidTime)}</span>}
                  </div>
                ))}
                {getEventsForDate(dateStr).length > 2 && (
                  <div className="text-[9px] text-gray-400">
                    +{getEventsForDate(dateStr).length - 2} more
                  </div>
                )}
              </div>
            )}
          </button>
        );
        currentDay++;
      }
      rows.push(
        <div key={`week-${i}`} className="grid grid-cols-7 gap-1">
          {week}
        </div>
      );
    }

    return rows;
  };

  const handleBidSave = async () => {
    // Use selectedDate if bidForm.date is empty (when date is selected from calendar)
    const dateValue = bidForm.date || selectedDate || "";
    const projectName = (bidForm.projectName || "").trim();
    const generalContractor = (bidForm.generalContractor || "").trim();
    
    if (!dateValue || !projectName || !generalContractor) {
      alert("Please fill in Date, Project Name, and General Contractor");
      return;
    }

    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured.");
      return;
    }

    try {
      setIsSavingBid(true);
      const eventsPath = `companies/${companyId}/bidEvents`;
      const payload: Omit<BidEvent, "id"> = {
        date: dateValue,
        projectName: projectName,
        generalContractor: generalContractor,
        bidTime: bidForm.bidTime || "",
        notes: bidForm.notes || "",
        status: bidForm.status || "active",
        estimatedValue: bidForm.estimatedValue || 0,
        updatedAt: new Date(),
      };

      if (editingEvent?.id) {
        await updateDocument(eventsPath, editingEvent.id, payload);
      } else {
        payload.createdAt = new Date();
        await createDocument(eventsPath, payload);
      }

      setEditingEvent(null);
      setBidForm({
        date: selectedDate || formatDate(today),
        projectName: "",
        generalContractor: "",
        bidTime: "",
        notes: "",
        status: "active",
        estimatedValue: 0,
      });
    } catch (error) {
      console.error("Failed to save bid event:", error);
      alert("Failed to save bid. Please try again.");
    } finally {
      setIsSavingBid(false);
    }
  };

  const handleBidDelete = async () => {
    if (!editingEvent?.id) return;
    if (!confirm("Delete this bid entry?")) return;
    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured.");
      return;
    }

    try {
      const eventsPath = `companies/${companyId}/bidEvents`;
      await deleteDocument(eventsPath, editingEvent.id);
      setEditingEvent(null);
      setBidForm({
        date: selectedDate || formatDate(today),
        projectName: "",
        generalContractor: "",
        bidTime: "",
        notes: "",
        status: "active",
        estimatedValue: 0,
      });
    } catch (error) {
      console.error("Failed to delete bid event:", error);
      alert("Failed to delete bid.");
    }
  };

  const handleDailyOverrideBlur = async (
    load: ProductionLoad,
    dateKey: string,
    rawValue: string
  ) => {
    const editKey = `${load.key}-${dateKey}`;
    const trimmed = rawValue.trim();
    const nextOverrides: DailyOverrides = { ...(load.overrides || {}) };

    if (trimmed === "") {
      delete nextOverrides[dateKey];
    } else {
      const hours = parseFloat(trimmed);
      if (isNaN(hours) || hours < 0) {
        delete nextOverrides[dateKey];
      } else {
        nextOverrides[dateKey] = hours;
      }
    }

    setDailyEdits((prev) => {
      const next = { ...prev };
      delete next[editKey];
      return next;
    });

    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured.");
      return;
    }

    try {
      setUpdatingOverrideKey(editKey);
      await updateDocument(load.collectionPath, load.id, {
        [load.overrideField]:
          Object.keys(nextOverrides).length > 0 ? nextOverrides : null,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to update daily hours:", error);
      alert("Failed to update daily hours. Please try again.");
    } finally {
      setUpdatingOverrideKey(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={asPage ? "min-h-screen bg-white" : "fixed inset-0 z-50 flex"}>
      {!asPage && (
        <>
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        </>
      )}
      <div className={asPage ? "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" : "relative w-full max-w-6xl h-full ml-auto bg-white shadow-2xl flex flex-col"}>
        <div className={`flex items-center justify-between ${asPage ? "px-0 py-6 mb-6" : "px-6 py-4"} border-b border-gray-200`}>
          <div>
            {!asPage && <p className="text-sm uppercase text-gray-500 tracking-wide">Executive Insight</p>}
            <h2 className={`${asPage ? "text-4xl" : "text-2xl"} font-semibold text-gray-900`}>Bid & Production Schedule</h2>
            <p className="text-xs text-gray-500">
              Visualize awarded work against capacity to spot gaps or overloads before bidding.
            </p>
          </div>
          {!asPage && (
            <Button variant="ghost" onClick={onClose} className="text-gray-500 hover:text-gray-800">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-gray-500 mb-1">Weekly Capacity</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {weeklyCapacity > 0 ? weeklyCapacity.toLocaleString() : "Unset"} hrs
                </p>
                <p className="text-xs text-gray-500">Configured in Company Settings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-gray-500 mb-1">This Month</p>
                <p className="text-2xl font-semibold text-gray-900">{gapWeeksCurrent.length}</p>
                <p className="text-xs text-gray-500">Under-loaded weeks ready for aggressive bids</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-gray-500 mb-1">Overbooked Weeks</p>
                <p className="text-2xl font-semibold text-gray-900">{overloadWeeks.length}</p>
                <p className="text-xs text-gray-500">Consider protecting margin or shifting work</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Production Schedule
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, -1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const now = new Date();
                    setCurrentDate(now);
                    setSelectedDate(formatDate(now));
                  }}>
                    Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </CardHeader>
            <CardContent>
              {inferredDailyCapacity <= 0 && (
                <div className="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-xs flex gap-2">
                  <Info className="w-4 h-4 mt-0.5" />
                  Set a daily or weekly capacity in Company Settings to unlock color-coded load warnings.
                </div>
              )}
              <div className="space-y-1">{renderCalendar()}</div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border border-red-400 bg-red-100"></div>
                    <span>Over capacity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border border-amber-400 bg-amber-100"></div>
                    <span>At capacity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border border-green-300 bg-green-50"></div>
                    <span>Available capacity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border border-gray-200 bg-gray-50"></div>
                    <span>Non-working</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border border-blue-400 bg-blue-100"></div>
                    <span>Today</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Shop Load •{" "}
                  {selectedWeekKey
                    ? `${formatShortLabel(new Date(selectedWeekKey))} – ${formatShortLabel(
                        addDays(new Date(selectedWeekKey), 6)
                      )}`
                    : "Select a week"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    Add Awarded Workload
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">
                        Project Name
                      </label>
                      <Input
                        value={productionForm.projectName}
                        onChange={(e) =>
                          setProductionForm({ ...productionForm, projectName: e.target.value })
                        }
                        placeholder="e.g., Tower A Structural Steel"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">
                        Total Hours
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={productionForm.totalHours}
                        onChange={(e) =>
                          setProductionForm({ ...productionForm, totalHours: e.target.value })
                        }
                        placeholder="1200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">
                        Start Date
                      </label>
                      <Input
                        type="date"
                        value={productionForm.startDate}
                        onChange={(e) =>
                          setProductionForm({ ...productionForm, startDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">
                        End Date (optional)
                      </label>
                      <Input
                        type="date"
                        value={productionForm.endDate}
                        onChange={(e) =>
                          setProductionForm({ ...productionForm, endDate: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddProductionEntry}
                      disabled={isSavingProduction}
                    >
                      {isSavingProduction ? "Saving..." : "Add Shop Load"}
                    </Button>
                  </div>
                </div>

                {!selectedWeekKey ? (
                  <p className="text-sm text-gray-500">
                    Select a date in the calendar to evaluate shop load for that week.
                  </p>
                ) : selectedWeekLoads.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No awarded work scheduled this week. Great window for aggressive bids.
                  </p>
                ) : (
                  selectedWeekLoads.map(({ load, rows }) => (
                    <div key={load.key} className="border border-gray-200 rounded-lg p-3 bg-white space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{load.name}</p>
                          <p className="text-xs text-gray-500">
                            {load.source === "project" ? "Project" : "Manual Entry"} •{" "}
                            {load.totalHours.toLocaleString()} hrs total
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {updatingOverrideKey?.startsWith(load.key) && (
                            <span className="text-xs text-blue-600">Saving…</span>
                          )}
                          {load.canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-gray-400 hover:text-red-600"
                              onClick={() => handleDeleteProductionEntry(load)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-xs">
                        {rows.map((row) => {
                          if (!row.isWorkingDay) {
                            return (
                              <div
                                key={row.dateKey}
                                className="text-center py-3 border border-dashed border-gray-200 rounded bg-gray-50 text-gray-400"
                              >
                                <div>{row.date.toLocaleDateString("en-US", { weekday: "short" })}</div>
                                <div className="text-[11px]">Non-working</div>
                              </div>
                            );
                          }
                          const editKey = `${load.key}-${row.dateKey}`;
                          const inputValue =
                            dailyEdits[editKey] ??
                            (row.hours !== undefined
                              ? Number(row.hours.toFixed(1)).toString()
                              : "");
                          return (
                            <div key={row.dateKey}>
                              <label className="text-[11px] text-gray-500 block mb-1">
                                {row.date.toLocaleDateString("en-US", { weekday: "short" })}
                              </label>
                              <Input
                                type="number"
                                step="0.1"
                                value={inputValue}
                                placeholder="0"
                                onChange={(e) =>
                                  setDailyEdits((prev) => ({
                                    ...prev,
                                    [editKey]: e.target.value,
                                  }))
                                }
                                onBlur={(e) =>
                                  handleDailyOverrideBlur(load, row.dateKey, e.target.value)
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-1">
                <CardTitle className="text-base">
                  Bids on {selectedDate || "Select a date"}
                </CardTitle>
                <p className="text-xs text-gray-500">Bids update independently from production.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {selectedDate &&
                  getEventsForDate(selectedDate).length > 0 ? (
                    getEventsForDate(selectedDate).map((event) => (
                      <div
                        key={event.id}
                        className="border border-gray-200 rounded-lg p-3 flex items-start justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {event.projectName}
                            {event.bidTime && (
                              <span className="ml-2 text-xs font-normal text-gray-500">
                                @ {normalizeTimeTo24Hour(event.bidTime)}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{event.generalContractor}</p>
                          {event.notes && (
                            <p className="text-xs text-gray-400 mt-1">{event.notes}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingEvent(event);
                            setBidForm({
                              date: event.date,
                              projectName: event.projectName,
                              generalContractor: event.generalContractor,
                              bidTime: normalizeTimeTo24Hour(event.bidTime || ""),
                              notes: event.notes || "",
                              status: event.status,
                              estimatedValue: event.estimatedValue || 0,
                            });
                          }}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      {selectedDate ? "No bids logged for this date." : "Select a date to view bids."}
                    </p>
                  )}
                </div>

                <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {editingEvent ? "Edit Bid" : "Add Bid"}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">
                        Date
                      </label>
                      <Input
                        type="date"
                        value={bidForm.date || selectedDate || ""}
                        onChange={(e) => setBidForm({ ...bidForm, date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">
                        Bid Time (24hr)
                      </label>
                      <Input
                        type="time"
                        step="60"
                        value={normalizeTimeTo24Hour(bidForm.bidTime || "")}
                        onChange={(e) => {
                          // Ensure 24-hour format (HH:mm)
                          const timeValue = normalizeTimeTo24Hour(e.target.value);
                          setBidForm({ ...bidForm, bidTime: timeValue });
                        }}
                        placeholder="HH:mm"
                        className="[&::-webkit-calendar-picker-indicator]:hidden"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">
                        Status
                      </label>
                      <select
                        value={bidForm.status || "active"}
                        onChange={(e) =>
                          setBidForm({ ...bidForm, status: e.target.value as BidEvent["status"] })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="submitted">Submitted</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">
                        Project Name
                      </label>
                      <Input
                        value={bidForm.projectName || ""}
                        onChange={(e) => setBidForm({ ...bidForm, projectName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 block mb-1">
                        General Contractor
                      </label>
                      <Input
                        value={bidForm.generalContractor || ""}
                        onChange={(e) =>
                          setBidForm({ ...bidForm, generalContractor: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1">Notes</label>
                    <textarea
                      value={bidForm.notes || ""}
                      onChange={(e) => setBidForm({ ...bidForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {editingEvent && (
                      <Button variant="ghost" size="sm" onClick={handleBidDelete}>
                        Delete
                      </Button>
                    )}
                    <Button variant="primary" size="sm" onClick={handleBidSave} disabled={isSavingBid}>
                      {isSavingBid ? "Saving..." : editingEvent ? "Update Bid" : "Add Bid"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Capacity Utilization Timeline
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Visual overview of shop capacity vs. scheduled work over time
              </p>
            </CardHeader>
            <CardContent>
              {weeklySummaries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No capacity data available. Configure shop capacity in Company Settings.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Interactive Timeline Chart */}
                  <div 
                    className="relative" 
                    style={{ height: "300px" }}
                    onMouseLeave={() => setHoveredWeek(null)}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percent = (x / rect.width) * 100;
                      const weekIndex = Math.round((percent / 100) * (weeklySummaries.length - 1));
                      const clampedIndex = Math.max(0, Math.min(weekIndex, weeklySummaries.length - 1));
                      setHoveredWeek(weeklySummaries[clampedIndex]?.weekIndex ?? null);
                    }}
                  >
                    {/* Tooltip */}
                    {hoveredWeek !== null && (() => {
                      const week = weeklySummaries.find(w => w.weekIndex === hoveredWeek);
                      if (!week) return null;
                      const utilization = week.capacityHours > 0 
                        ? (week.usedHours / week.capacityHours) * 100 
                        : 0;
                      const xPercent = weeklySummaries.length > 1 
                        ? (hoveredWeek / (weeklySummaries.length - 1)) * 100 
                        : 50;
                      return (
                        <div 
                          className="absolute top-2 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none whitespace-nowrap"
                          style={{ left: `${xPercent}%`, transform: "translateX(-50%)" }}
                        >
                          <div className="font-semibold mb-1">
                            {formatShortLabel(week.startDate)} – {formatShortLabel(addDays(week.startDate, 6))}
                          </div>
                          <div className="space-y-1">
                            <div>Used: {week.usedHours.toLocaleString()} hrs</div>
                            <div>Capacity: {week.capacityHours.toLocaleString()} hrs</div>
                            <div className="font-semibold">Utilization: {Math.round(utilization)}%</div>
                          </div>
                        </div>
                      );
                    })()}
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                      {/* Grid lines */}
                      {[0, 25, 50, 75, 100, 125, 150].map((percent) => {
                        const y = 100 - (percent / 150) * 100;
                        return (
                          <line
                            key={`grid-${percent}`}
                            x1="0"
                            y1={y}
                            x2="100"
                            y2={y}
                            stroke="#e5e7eb"
                            strokeWidth="0.3"
                          />
                        );
                      })}
                      
                      {/* Capacity line (100%) */}
                      <line
                        x1="0"
                        y1={100 - (100 / 150) * 100}
                        x2="100"
                        y2={100 - (100 / 150) * 100}
                        stroke="#f59e0b"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                      />
                      
                      {/* Bars for each week */}
                      {weeklySummaries.map((week, index) => {
                        const x = weeklySummaries.length > 1 
                          ? (index / (weeklySummaries.length - 1)) * 100 
                          : 50;
                        const utilization = week.capacityHours > 0 
                          ? (week.usedHours / week.capacityHours) * 100 
                          : 0;
                        const barHeight = Math.min((utilization / 150) * 100, 100);
                        const barY = 100 - barHeight;
                        
                        // Color based on utilization
                        let barColor = "#10b981"; // Green - good
                        if (utilization < underUtilizedThreshold * 100) {
                          barColor = "#f59e0b"; // Amber - under-utilized
                        } else if (utilization > 100) {
                          barColor = "#ef4444"; // Red - overbooked
                        }
                        
                        const isHovered = hoveredWeek === week.weekIndex;
                        
                        return (
                          <g key={`week-${week.weekIndex}`}>
                            {/* Bar */}
                            <rect
                              x={x - 1}
                              y={barY}
                              width="2"
                              height={barHeight}
                              fill={barColor}
                              opacity={isHovered ? "1" : "0.8"}
                              className="pointer-events-none"
                            />
                            {/* Hover indicator line */}
                            {isHovered && (
                              <line
                                x1={x}
                                y1="0"
                                x2={x}
                                y2="100"
                                stroke="#3b82f6"
                                strokeWidth="0.4"
                                strokeDasharray="2,2"
                                className="pointer-events-none"
                              />
                            )}
                          </g>
                        );
                      })}
                      
                      {/* Y-axis labels */}
                      {[0, 50, 100, 150].map((percent) => {
                        const y = 100 - (percent / 150) * 100;
                        return (
                          <text
                            key={`y-label-${percent}`}
                            x="-1"
                            y={y + 1}
                            fontSize="2.5"
                            fill="#6b7280"
                            textAnchor="end"
                          >
                            {percent}%
                          </text>
                        );
                      })}
                    </svg>
                    
                    {/* X-axis labels (weeks) */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-600" style={{ height: "60px", paddingTop: "4px" }}>
                      {weeklySummaries.filter((_, i) => i % Math.ceil(weeklySummaries.length / 8) === 0 || i === weeklySummaries.length - 1).map((week, idx, arr) => {
                        const index = idx === arr.length - 1 
                          ? weeklySummaries.length - 1 
                          : idx * Math.ceil(weeklySummaries.length / 8);
                        return (
                          <div key={`x-label-${index}`} className="flex flex-col items-center">
                            <div className="text-center font-medium" style={{ fontSize: "9px", transform: "rotate(-45deg)", transformOrigin: "top center", marginTop: "8px" }}>
                              {formatShortLabel(week.startDate)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Y-axis label */}
                    <div className="absolute left-0 top-0 text-xs font-semibold text-gray-700" style={{ transform: "rotate(-90deg)", transformOrigin: "center", left: "-40px", top: "50%" }}>
                      Utilization %
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-amber-500"></div>
                      <span>Under-utilized (&lt;{Math.round(underUtilizedThreshold * 100)}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500"></div>
                      <span>Good ({Math.round(underUtilizedThreshold * 100)}% - 100%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-500"></div>
                      <span>Overbooked (&gt;100%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-0.5 h-4 bg-amber-500" style={{ borderStyle: "dashed" }}></div>
                      <span>100% Capacity</span>
                    </div>
                  </div>
                  
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-2xl font-semibold text-amber-600">{gapWeeksCurrent.length + gapWeeksFuture.length}</div>
                      <div className="text-xs text-gray-500">Under-utilized weeks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-semibold text-green-600">
                        {weeklySummaries.filter(w => {
                          const util = w.capacityHours > 0 ? (w.usedHours / w.capacityHours) * 100 : 0;
                          return util >= underUtilizedThreshold * 100 && util <= 100;
                        }).length}
                      </div>
                      <div className="text-xs text-gray-500">Optimal weeks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-semibold text-red-600">{overloadWeeks.length}</div>
                      <div className="text-xs text-gray-500">Overbooked weeks</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getFabHours(project: ProjectScheduleEntry) {
  if (typeof project.fabHours === "number" && project.fabHours > 0) {
    return project.fabHours;
  }
  if (typeof project.remainingShopHours === "number" && project.remainingShopHours > 0) {
    return project.remainingShopHours;
  }
  if (
    typeof project.estimatedShopHoursTotal === "number" &&
    project.estimatedShopHoursTotal > 0
  ) {
    return project.estimatedShopHoursTotal;
  }
  return 0;
}

function getWorkingDatesBetween(
  start: Date,
  end: Date,
  isWorkingDay: (date: Date) => boolean
) {
  const dates: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  while (cursor <= endDate) {
    if (isWorkingDay(cursor)) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function findNextWorkingDate(
  start: Date,
  isWorkingDay: (date: Date) => boolean,
  maxLookahead = 730
) {
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < maxLookahead; i++) {
    if (isWorkingDay(cursor)) {
      return new Date(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

function buildDailyAllocation(
  load: ProductionLoad,
  dailyCapacity: number,
  isWorkingDay: (date: Date) => boolean
) {
  const capacity = dailyCapacity > 0 ? dailyCapacity : 8;
  const overrides = load.overrides || {};
  const schedule: Record<string, number> = {};

  const start = parseDateOrNull(load.startDate);
  if (!start) return schedule;

  let remaining = load.totalHours;
  if (remaining <= 0) {
    return schedule;
  }

  if (load.endDate) {
    const end = parseDateOrNull(load.endDate) ?? start;
    let workingDates = getWorkingDatesBetween(start, end, isWorkingDay);
    if (workingDates.length === 0) {
      const nextWorking = findNextWorkingDate(start, isWorkingDay);
      if (!nextWorking) {
        return schedule;
      }
      workingDates = [nextWorking];
    }
    const dayKeys = workingDates.map((date) => formatDate(date));

    const overrideValues = dayKeys.map((key) =>
      overrides[key] !== undefined ? Math.max(0, overrides[key]) : undefined
    );
    const futureOverrideDemand = new Array(dayKeys.length).fill(0);
    let running = 0;
    for (let i = dayKeys.length - 1; i >= 0; i--) {
      const overrideVal = Math.max(0, overrideValues[i] ?? 0);
      running += overrideVal;
      futureOverrideDemand[i] = running - overrideVal;
    }
    const autoDaysRemaining = new Array(dayKeys.length).fill(0);
    let autoCount = 0;
    for (let i = dayKeys.length - 1; i >= 0; i--) {
      if (overrideValues[i] === undefined) {
        autoCount += 1;
        autoDaysRemaining[i] = autoCount;
      } else {
        autoDaysRemaining[i] = autoCount;
      }
    }

    for (let i = 0; i < dayKeys.length; i++) {
      const key = dayKeys[i];
      const overrideVal = overrideValues[i];
      if (overrideVal !== undefined) {
        const hours = Math.min(Math.max(overrideVal, 0), Math.max(remaining, 0));
        schedule[key] = hours;
        remaining -= hours;
      } else {
        const futureDemand = Math.min(futureOverrideDemand[i], Math.max(remaining, 0));
        const autoDays = autoDaysRemaining[i] > 0 ? autoDaysRemaining[i] : 1;
        const hoursAvailable = Math.max(0, remaining - futureDemand);
        const hours = hoursAvailable / autoDays;
        schedule[key] = hours;
        remaining -= hours;
      }
    }

    if (remaining < -0.01) {
      const lastKey = dayKeys[dayKeys.length - 1];
      schedule[lastKey] = Math.max(0, schedule[lastKey] + remaining);
    }
  } else {
    const overridesMap = new Map(
      Object.entries(overrides).filter(([key]) => {
        const date = parseDateOrNull(key);
        return date ? isWorkingDay(date) : false;
      })
    );
    const pendingOverrideKeys = new Set(overridesMap.keys());
    let cursor = new Date(start);
    let safety = 0;

    while ((remaining > 0 || pendingOverrideKeys.size > 0) && safety < 5000) {
      const key = formatDate(cursor);
      if (!isWorkingDay(cursor)) {
        pendingOverrideKeys.delete(key);
        cursor = addDays(cursor, 1);
        safety++;
        continue;
      }
      const overrideVal = overridesMap.get(key);
      let hours: number;
      if (overrideVal !== undefined) {
        hours = Math.min(Math.max(overrideVal, 0), Math.max(remaining, 0));
        pendingOverrideKeys.delete(key);
      } else {
        hours = Math.min(capacity, Math.max(remaining, 0));
      }
      schedule[key] = hours;
      remaining -= hours;
      if (remaining <= 0 && pendingOverrideKeys.size === 0) {
        break;
      }
      cursor = addDays(cursor, 1);
      safety++;
    }
  }

  return schedule;
}

