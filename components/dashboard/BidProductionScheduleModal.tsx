"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  // First 2 shop load cards expanded by default; rest rolled up to condense scrolling
  const [expandedLoadKeys, setExpandedLoadKeys] = useState<Set<string>>(new Set());

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

  // Generate color palette for projects
  const projectColors = useMemo(() => {
    const colors = [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
      "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#6366f1",
      "#14b8a6", "#f43f5e", "#a855f7", "#22c55e", "#eab308",
      "#06b6d4", "#f472b6", "#64748b", "#0ea5e9", "#a3e635"
    ];
    const colorMap = new Map<string, string>();
    productionLoads.forEach((load, index) => {
      colorMap.set(load.key, colors[index % colors.length]);
    });
    return colorMap;
  }, [productionLoads]);

  const weeklySummaries = useMemo(() => {
    const summaries: Array<{
      weekIndex: number;
      startDate: Date;
      usedHours: number;
      capacityHours: number;
      projectBreakdown: Array<{ projectKey: string; projectName: string; hours: number }>;
    }> = [];

    for (let i = 0; i < weeksToForecast; i++) {
      const weekStart = addWeeks(startOfCurrentWeek, i);
      let used = 0;
      const projectHoursMap = new Map<string, number>();
      
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d);
        const dayKey = formatDate(date);
        if (!isWorkingDayDate(date)) continue;
        
        const dayData = dailyTotals[dayKey];
        if (dayData) {
          used += dayData.total;
          // Aggregate project hours for this week
          dayData.loads.forEach((load) => {
            const current = projectHoursMap.get(load.loadKey) || 0;
            projectHoursMap.set(load.loadKey, current + load.hours);
          });
        }
      }
      
      // Convert map to array and get project names
      const projectBreakdown = Array.from(projectHoursMap.entries())
        .map(([loadKey, hours]) => {
          const load = productionLoads.find(l => l.key === loadKey);
          return {
            projectKey: loadKey,
            projectName: load?.name || "Unknown",
            hours,
          };
        })
        .filter(p => p.hours > 0)
        .sort((a, b) => b.hours - a.hours); // Sort by hours descending
      
      summaries.push({
        weekIndex: i,
        startDate: weekStart,
        usedHours: used,
        capacityHours: weeklyCapacity,
        projectBreakdown,
      });
    }

    return summaries;
  }, [dailyTotals, startOfCurrentWeek, weeksToForecast, weeklyCapacity, productionLoads]);

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

  // Keep first 2 shop load keys expanded when week loads change
  const selectedWeekLoadKeys = useMemo(
    () => selectedWeekLoads.map(({ load }) => load.key),
    [selectedWeekLoads]
  );
  // Effective expanded set: first 2 by default; use state only if it has keys in the current week's list
  const effectiveExpandedKeys = useMemo(() => {
    const firstTwo = new Set(selectedWeekLoadKeys.slice(0, 2));
    if (expandedLoadKeys.size === 0) return firstTwo;
    const inCurrentWeek = [...expandedLoadKeys].filter((k) => selectedWeekLoadKeys.includes(k));
    if (inCurrentWeek.length === 0) return firstTwo;
    return new Set(inCurrentWeek);
  }, [expandedLoadKeys, selectedWeekLoadKeys]);
  // When the week's load list changes, reset to exactly first 2 expanded
  useEffect(() => {
    setExpandedLoadKeys(new Set(selectedWeekLoadKeys.slice(0, 2)));
  }, [selectedWeekLoadKeys.join(",")]);

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
    <div data-ui-version="apple-hig" className={asPage ? "min-h-screen bg-gray-100" : "fixed inset-0 z-50 flex"}>
      {!asPage && (
        <>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        </>
      )}
      <div className={asPage ? "w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8" : "relative w-full max-w-6xl h-full ml-auto bg-gray-100 shadow-2xl flex flex-col"}>
        {/* Apple-style Header */}
        <div className={`flex items-center justify-between ${asPage ? "px-0 py-8 mb-4" : "px-8 py-6"}`}>
          <div>
            {!asPage && <p className="text-sm font-medium text-gray-500 tracking-wide mb-1">Executive Insight</p>}
            <h2 className={`${asPage ? "text-[34px]" : "text-[28px]"} font-semibold text-gray-900 tracking-tight`}>Bid & Production Schedule</h2>
            <p className="text-[15px] text-gray-500 mt-1">
              Visualize awarded work against capacity to spot gaps or overloads.
            </p>
          </div>
          {!asPage && (
            <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-2">
              <X className="w-6 h-6" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-0 pb-8 space-y-6">
          {/* Apple-style KPI Cards with subtle shadows */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <p className="text-[13px] font-medium text-gray-500 uppercase tracking-wide">Weekly Capacity</p>
              <p className="text-[32px] font-semibold text-gray-900 mt-1 tracking-tight">
                {weeklyCapacity > 0 ? weeklyCapacity.toLocaleString() : "—"}
              </p>
              <p className="text-[13px] text-gray-400 mt-1">hours available</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <p className="text-[13px] font-medium text-gray-500 uppercase tracking-wide">Under-loaded</p>
              <p className="text-[32px] font-semibold text-amber-500 mt-1 tracking-tight">{gapWeeksCurrent.length}</p>
              <p className="text-[13px] text-gray-400 mt-1">weeks this month</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <p className="text-[13px] font-medium text-gray-500 uppercase tracking-wide">Overbooked</p>
              <p className="text-[32px] font-semibold text-red-500 mt-1 tracking-tight">{overloadWeeks.length}</p>
              <p className="text-[13px] text-gray-400 mt-1">weeks need attention</p>
            </div>
          </div>

          {/* Apple-style Calendar Card */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-[20px] font-semibold text-gray-900 tracking-tight">Production Schedule</h3>
                <p className="text-[15px] text-gray-500 mt-0.5">
                  {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentDate(addMonths(currentDate, -1))}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    const now = new Date();
                    setCurrentDate(now);
                    setSelectedDate(formatDate(now));
                  }}
                  className="px-4 py-1.5 rounded-full text-[13px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Today
                </button>
                <button 
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-6 pb-6">
              {inferredDailyCapacity <= 0 && (
                <div className="mb-4 p-4 rounded-xl bg-amber-50/80 text-amber-700 text-[13px] flex gap-3 items-start">
                  <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>Set daily or weekly capacity in Company Settings to enable load warnings.</span>
                </div>
              )}
              <div className="space-y-1">{renderCalendar()}</div>
              {/* Apple-style Legend */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap items-center gap-5 text-[13px] text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md bg-red-100 border border-red-200"></div>
                    <span>Over capacity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-200"></div>
                    <span>At capacity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md bg-green-50 border border-green-200"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md bg-gray-100 border border-gray-200"></div>
                    <span>Non-working</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-md bg-blue-100 border border-blue-200"></div>
                    <span>Today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Apple-style Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Shop Load Card */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-[17px] font-semibold text-gray-900">
                  Shop Load
                  {selectedWeekKey && (
                    <span className="font-normal text-gray-500">
                      {" "}• {formatShortLabel(new Date(selectedWeekKey))} – {formatShortLabel(addDays(new Date(selectedWeekKey), 6))}
                    </span>
                  )}
                </h3>
              </div>
              <div className="p-6 space-y-5">
                {/* Apple-style Form Section */}
                <div className="rounded-xl bg-gray-50/80 p-5">
                  <p className="text-[15px] font-semibold text-gray-900 mb-4">
                    Add Awarded Workload
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[13px] font-medium text-gray-600 block mb-2">
                        Project Name
                      </label>
                      <input
                        value={productionForm.projectName}
                        onChange={(e) =>
                          setProductionForm({ ...productionForm, projectName: e.target.value })
                        }
                        placeholder="e.g., Tower A Structural Steel"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="text-[13px] font-medium text-gray-600 block mb-2">
                        Total Hours
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={productionForm.totalHours}
                        onChange={(e) =>
                          setProductionForm({ ...productionForm, totalHours: e.target.value })
                        }
                        placeholder="1200"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="text-[13px] font-medium text-gray-600 block mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={productionForm.startDate}
                        onChange={(e) =>
                          setProductionForm({ ...productionForm, startDate: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="text-[13px] font-medium text-gray-600 block mb-2">
                        End Date <span className="text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="date"
                        value={productionForm.endDate}
                        onChange={(e) =>
                          setProductionForm({ ...productionForm, endDate: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleAddProductionEntry}
                      disabled={isSavingProduction}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-[15px] font-medium rounded-xl transition-colors"
                    >
                      {isSavingProduction ? "Saving..." : "Add Shop Load"}
                    </button>
                  </div>
                </div>

                {!selectedWeekKey ? (
                  <p className="text-[15px] text-gray-500 py-4 text-center">
                    Select a date in the calendar to view shop load for that week.
                  </p>
                ) : selectedWeekLoads.length === 0 ? (
                  <p className="text-[15px] text-gray-500 py-4 text-center">
                    No awarded work scheduled. Great window for aggressive bids.
                  </p>
                ) : (
                  <>
                    {/* Apple-style Project Pills */}
                    <div className="flex flex-wrap gap-3">
                      {selectedWeekLoads.slice(0, 2).map(({ load }) => (
                        <button
                          key={load.key}
                          onClick={() => setExpandedLoadKeys((prev) => new Set(prev).add(load.key))}
                          className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left min-w-0 flex-1"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-medium text-gray-900 truncate">{load.name}</p>
                            <p className="text-[13px] text-gray-500">{load.totalHours.toLocaleString()} hrs</p>
                          </div>
                          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </button>
                      ))}
                    </div>

                    {/* Apple-style Capacity Chart */}
                    <div className="mt-5 rounded-xl bg-gray-50/80 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-[15px] font-semibold text-gray-900">Capacity Timeline</h4>
                          <p className="text-[13px] text-gray-500 mt-0.5">Shop utilization over time</p>
                        </div>
                      </div>
                      {weeklySummaries.length === 0 ? (
                        <p className="text-[15px] text-gray-500 text-center py-8">
                          Configure shop capacity in Settings to view chart.
                        </p>
                      ) : (
                        <div className="space-y-5">
                          {/* Chart Container */}
                          <div
                            className="relative bg-white rounded-xl p-4"
                            style={{ height: "220px" }}
                            onMouseLeave={() => setHoveredWeek(null)}
                            onMouseMove={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left - 40; // Account for Y-axis padding
                              const width = rect.width - 56;
                              if (width > 0 && weeklySummaries.length > 0) {
                                const percent = Math.max(0, Math.min(100, (x / width) * 100));
                                const weekIndex = Math.round((percent / 100) * (weeklySummaries.length - 1));
                                const clampedIndex = Math.max(0, Math.min(weekIndex, weeklySummaries.length - 1));
                                const week = weeklySummaries[clampedIndex];
                                setHoveredWeek(week?.weekIndex ?? null);
                              }
                            }}
                          >
                            {/* Apple-style Tooltip */}
                            {hoveredWeek !== null && (() => {
                              const week = weeklySummaries.find((w) => w.weekIndex === hoveredWeek);
                              if (!week) return null;
                              const utilization = week.capacityHours > 0 ? (week.usedHours / week.capacityHours) * 100 : 0;
                              const weekIndex = weeklySummaries.findIndex((w) => w.weekIndex === hoveredWeek);
                              const xPercent = weeklySummaries.length > 1 && weekIndex >= 0 ? (weekIndex / Math.max(1, weeklySummaries.length - 1)) * 100 : 50;
                              return (
                                <div
                                  className="absolute top-3 bg-gray-900/95 backdrop-blur-sm text-white rounded-xl px-4 py-3 shadow-xl z-50 pointer-events-none"
                                  style={{ left: `calc(40px + ${Math.min(Math.max(5, xPercent), 85)}% * 0.85)`, transform: "translateX(-50%)" }}
                                >
                                  <div className="text-[13px] font-semibold mb-2">
                                    {formatShortLabel(week.startDate)} – {formatShortLabel(addDays(week.startDate, 6))}
                                  </div>
                                  <div className="space-y-1 text-[13px]">
                                    <div className="flex justify-between gap-4">
                                      <span className="text-gray-400">Used</span>
                                      <span className="font-medium">{week.usedHours.toLocaleString()} hrs</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span className="text-gray-400">Capacity</span>
                                      <span className="font-medium">{week.capacityHours.toLocaleString()} hrs</span>
                                    </div>
                                    <div className="flex justify-between gap-4 pt-1 border-t border-gray-700">
                                      <span className="text-gray-400">Utilization</span>
                                      <span className="font-semibold text-blue-400">{Math.round(utilization)}%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            
                            {/* Y-axis labels */}
                            <div className="absolute left-0 top-4 bottom-8 w-10 flex flex-col justify-between text-right pr-2">
                              {[150, 100, 50, 0].map((percent) => (
                                <span key={percent} className="text-[11px] font-medium text-gray-500">{percent}%</span>
                              ))}
                            </div>
                            
                            {/* Chart SVG */}
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute left-10 right-4 top-4 bottom-8">
                              {/* Grid lines - lighter, more Apple-like */}
                              {[0, 50, 100, 150].map((percent) => {
                                const y = 100 - (percent / 150) * 100;
                                return <line key={`grid-${percent}`} x1="0" y1={y} x2="100" y2={y} stroke="#f3f4f6" strokeWidth="0.5" />;
                              })}
                              {/* 100% capacity line */}
                              <line x1="0" y1={100 - (100 / 150) * 100} x2="100" y2={100 - (100 / 150) * 100} stroke="#fbbf24" strokeWidth="0.8" strokeDasharray="3,3" />
                              
                              {/* Bars - wider, more prominent */}
                              {weeklySummaries.map((week, index) => {
                                const x = weeklySummaries.length > 1 ? (index / Math.max(1, weeklySummaries.length - 1)) * 100 : 50;
                                const utilization = week.capacityHours > 0 ? (week.usedHours / week.capacityHours) * 100 : 0;
                                const totalBarHeight = Math.min((utilization / 150) * 100, 100);
                                const barY = 100 - totalBarHeight;
                                const isHovered = hoveredWeek === week.weekIndex;
                                const barWidth = isHovered ? 4.5 : 3.5;
                                const barX = x - barWidth / 2;
                                let currentY = barY;
                                return (
                                  <g key={`week-${week.weekIndex}`}>
                                    {week.projectBreakdown.map((project) => {
                                      const projectUtilization = week.capacityHours > 0 ? (project.hours / week.capacityHours) * 100 : 0;
                                      const segmentHeight = (projectUtilization / 150) * 100;
                                      const segmentY = currentY;
                                      currentY += segmentHeight;
                                      const projectColor = projectColors.get(project.projectKey) || "#94a3b8";
                                      return (
                                        <rect
                                          key={`project-${project.projectKey}`}
                                          x={barX}
                                          y={segmentY}
                                          width={barWidth}
                                          height={Math.max(segmentHeight, 0.5)}
                                          fill={projectColor}
                                          opacity={isHovered ? "1" : "0.85"}
                                          rx="0.5"
                                          className="pointer-events-none transition-opacity"
                                        />
                                      );
                                    })}
                                    {isHovered && (
                                      <line x1={x} y1="0" x2={x} y2="100" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2,2" className="pointer-events-none" />
                                    )}
                                  </g>
                                );
                              })}
                            </svg>
                            
                            {/* X-axis labels */}
                            <div className="absolute left-10 right-4 bottom-0 flex justify-between">
                              {weeklySummaries.filter((_, i) => i % Math.ceil(weeklySummaries.length / 6) === 0 || i === weeklySummaries.length - 1).map((week, idx, arr) => {
                                const index = idx === arr.length - 1 ? weeklySummaries.length - 1 : idx * Math.ceil(weeklySummaries.length / 6);
                                return (
                                  <span key={`x-${index}`} className="text-[11px] font-medium text-gray-500 whitespace-nowrap">
                                    {week.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Apple-style Summary Stats */}
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-white rounded-xl">
                              <div className="text-[24px] font-semibold text-amber-500 tracking-tight">{gapWeeksCurrent.length + gapWeeksFuture.length}</div>
                              <div className="text-[13px] font-medium text-gray-600 mt-1">Under-utilized</div>
                            </div>
                            <div className="text-center p-4 bg-white rounded-xl">
                              <div className="text-[24px] font-semibold text-green-500 tracking-tight">
                                {weeklySummaries.filter((w) => {
                                  const util = w.capacityHours > 0 ? (w.usedHours / w.capacityHours) * 100 : 0;
                                  return util >= underUtilizedThreshold * 100 && util <= 100;
                                }).length}
                              </div>
                              <div className="text-[13px] font-medium text-gray-600 mt-1">Optimal</div>
                            </div>
                            <div className="text-center p-4 bg-white rounded-xl">
                              <div className="text-[24px] font-semibold text-red-500 tracking-tight">{overloadWeeks.length}</div>
                              <div className="text-[13px] font-medium text-gray-600 mt-1">Overbooked</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Apple-style Remaining Shop Load Cards */}
                    {selectedWeekLoads.map(({ load, rows }, index) => {
                      if (index < 2 && !effectiveExpandedKeys.has(load.key)) return null;
                      const isExpanded = effectiveExpandedKeys.has(load.key);
                      const canCollapse = index >= 2;
                    if (!isExpanded) {
                      return (
                        <button
                          key={load.key}
                          onClick={() => setExpandedLoadKeys((prev) => new Set(prev).add(load.key))}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
                        >
                          <div className="min-w-0">
                            <p className="text-[15px] font-medium text-gray-900 truncate">{load.name}</p>
                            <p className="text-[13px] text-gray-500">
                              {load.source === "project" ? "Project" : "Manual"} • {load.totalHours.toLocaleString()} hrs
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {load.canDelete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteProductionEntry(load); }}
                                className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          </div>
                        </button>
                      );
                    }
                    return (
                      <div key={load.key} className="rounded-xl bg-white border border-gray-200/60 shadow-sm p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[15px] font-semibold text-gray-900">{load.name}</p>
                            <p className="text-[13px] text-gray-500">
                              {load.source === "project" ? "Project" : "Manual"} • {load.totalHours.toLocaleString()} hrs
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {updatingOverrideKey?.startsWith(load.key) && (
                              <span className="text-[13px] text-blue-600">Saving…</span>
                            )}
                            {canCollapse && (
                              <button
                                onClick={() =>
                                  setExpandedLoadKeys((prev) => {
                                    const next = new Set(prev);
                                    next.delete(load.key);
                                    return next;
                                  })
                                }
                                className="flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <ChevronUp className="w-4 h-4" />
                                Collapse
                              </button>
                            )}
                            {load.canDelete && (
                              <button
                                onClick={() => handleDeleteProductionEntry(load)}
                                className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Apple-style Day Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                          {rows.map((row) => {
                            if (!row.isWorkingDay) {
                              return (
                                <div
                                  key={row.dateKey}
                                  className="text-center py-4 rounded-xl bg-gray-50 text-gray-400"
                                >
                                  <div className="text-[13px] font-medium">{row.date.toLocaleDateString("en-US", { weekday: "short" })}</div>
                                  <div className="text-[11px] mt-1">Off</div>
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
                              <div key={row.dateKey} className="space-y-2">
                                <label className="text-[13px] font-medium text-gray-600 block text-center">
                                  {row.date.toLocaleDateString("en-US", { weekday: "short" })}
                                </label>
                                <input
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
                                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[15px] text-gray-900 text-center placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  </>
                )}
              </div>
            </div>

            {/* Apple-style Bids Card */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-[17px] font-semibold text-gray-900">
                  Bids
                  {selectedDate && (
                    <span className="font-normal text-gray-500">
                      {" "}• {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </h3>
                <p className="text-[13px] text-gray-500 mt-0.5">Manage bid deadlines and submissions</p>
              </div>
              <div className="p-6 space-y-5">
                {/* Existing Bids List */}
                <div className="space-y-3">
                  {selectedDate &&
                  getEventsForDate(selectedDate).length > 0 ? (
                    getEventsForDate(selectedDate).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium text-gray-900">
                            {event.projectName}
                            {event.bidTime && (
                              <span className="ml-2 text-[13px] font-normal text-gray-500">
                                @ {normalizeTimeTo24Hour(event.bidTime)}
                              </span>
                            )}
                          </p>
                          <p className="text-[13px] text-gray-500 mt-0.5">{event.generalContractor}</p>
                          {event.notes && (
                            <p className="text-[13px] text-gray-400 mt-1">{event.notes}</p>
                          )}
                        </div>
                        <button
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
                          className="px-3 py-1.5 text-[13px] font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-[15px] text-gray-500 text-center py-4">
                      {selectedDate ? "No bids for this date." : "Select a date to view bids."}
                    </p>
                  )}
                </div>

                {/* Apple-style Bid Form */}
                <div className="rounded-xl bg-gray-50/80 p-5 space-y-4">
                  <p className="text-[15px] font-semibold text-gray-900">
                    {editingEvent ? "Edit Bid" : "Add New Bid"}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[13px] font-medium text-gray-600 block mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        value={bidForm.date || selectedDate || ""}
                        onChange={(e) => setBidForm({ ...bidForm, date: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="text-[13px] font-medium text-gray-600 block mb-2">
                        Bid Time
                      </label>
                      <input
                        type="time"
                        step="60"
                        value={normalizeTimeTo24Hour(bidForm.bidTime || "")}
                        onChange={(e) => {
                          const timeValue = normalizeTimeTo24Hour(e.target.value);
                          setBidForm({ ...bidForm, bidTime: timeValue });
                        }}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-gray-600 block mb-2">
                      Status
                    </label>
                    <select
                      value={bidForm.status || "active"}
                      onChange={(e) =>
                        setBidForm({ ...bidForm, status: e.target.value as BidEvent["status"] })
                      }
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow appearance-none"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="submitted">Submitted</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[13px] font-medium text-gray-600 block mb-2">
                        Project Name
                      </label>
                      <input
                        value={bidForm.projectName || ""}
                        onChange={(e) => setBidForm({ ...bidForm, projectName: e.target.value })}
                        placeholder="Enter project name"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="text-[13px] font-medium text-gray-600 block mb-2">
                        General Contractor
                      </label>
                      <input
                        value={bidForm.generalContractor || ""}
                        onChange={(e) =>
                          setBidForm({ ...bidForm, generalContractor: e.target.value })
                        }
                        placeholder="Enter GC name"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-gray-600 block mb-2">Notes</label>
                    <textarea
                      value={bidForm.notes || ""}
                      onChange={(e) => setBidForm({ ...bidForm, notes: e.target.value })}
                      placeholder="Add any notes..."
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    {editingEvent && (
                      <button
                        onClick={handleBidDelete}
                        className="px-4 py-2.5 text-[15px] font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={handleBidSave}
                      disabled={isSavingBid}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-[15px] font-medium rounded-xl transition-colors"
                    >
                      {isSavingBid ? "Saving..." : editingEvent ? "Update Bid" : "Add Bid"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

