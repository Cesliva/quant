import type { CompanySettings } from "@/lib/utils/settingsLoader";
import type { BacklogGap } from "@/lib/types/executiveDashboard";

export interface ShopLoadProjectInput {
  id: string;
  projectName?: string;
  status?: string;
  archived?: boolean;
  remainingShopHours?: number;
  estimatedShopHoursTotal?: number;
  scheduledStartDate?: string;
  projectedStartDate?: string;
  priority?: number;
}

export interface ShopLoadOptions {
  shiftMultiplier?: number;
  weeks?: number;
  startDate?: Date;
}

export interface ShopLoadBucketProject {
  id: string;
  name?: string;
  hours: number;
  status?: string;
  type: "committed" | "pending";
}

export interface ShopLoadBucket {
  weekIndex: number;
  startDate: Date;
  endDate: Date;
  capacityHours: number;
  usedHours: number;
  projects: ShopLoadBucketProject[];
}

export interface ShopLoadRecommendation {
  weekIndex: number;
  startDate: Date;
  endDate: Date;
  availableHours: number;
  suggestedMinHours: number;
  suggestedMaxHours: number;
}

export interface ShopLoadSummary {
  totalCommittedHours: number;
  totalPendingHours: number;
  totalRemainingHours: number;
  backlogMonths: number;
  weeklyCapacity: number;
  buckets: ShopLoadBucket[];
  gaps: BacklogGap[];
  overloads: ShopLoadBucket[];
  recommendations: ShopLoadRecommendation[];
  scenario: {
    shiftMultiplier: number;
    weeks: number;
  };
}

interface BuildShopLoadInput {
  projects: ShopLoadProjectInput[];
  companySettings: CompanySettings;
  pendingBids?: ShopLoadProjectInput[];
  options?: ShopLoadOptions;
  threshold?: number;
}

const WEEKS_PER_MONTH = 4.345;

const cloneDate = (date: Date) => new Date(date.getTime());

const getStartOfWeek = (date: Date): Date => {
  const cloned = cloneDate(date);
  const day = cloned.getDay();
  const diff = cloned.getDate() - day + (day === 0 ? -6 : 1); // start Monday, treat Sunday as last day
  cloned.setDate(diff);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
};

const addWeeks = (date: Date, weeks: number): Date => {
  const cloned = cloneDate(date);
  cloned.setDate(cloned.getDate() + weeks * 7);
  return cloned;
};

const parseDateOrNull = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const projectRemainingHours = (project: ShopLoadProjectInput): number => {
  return project.remainingShopHours ?? project.estimatedShopHoursTotal ?? 0;
};

export function buildShopLoadForecast({
  projects,
  companySettings,
  pendingBids = [],
  options,
  threshold,
}: BuildShopLoadInput): ShopLoadSummary {
  const scenarioShift = options?.shiftMultiplier ?? 1;
  const weeksToForecast =
    options?.weeks ?? companySettings.backlogForecastWeeks ?? 24;
  const weeklyCapacityBase = companySettings.shopCapacityHoursPerWeek ?? 0;
  const weeklyCapacity = Math.max(0, weeklyCapacityBase * scenarioShift);

  const startDate = options?.startDate
    ? getStartOfWeek(options.startDate)
    : getStartOfWeek(new Date());

  const buckets: ShopLoadBucket[] = [];
  for (let i = 0; i < weeksToForecast; i++) {
    const weekStart = getStartOfWeek(addWeeks(startDate, i));
    const weekEnd = addWeeks(weekStart, 1);
    weekEnd.setDate(weekEnd.getDate() - 1);
    weekEnd.setHours(23, 59, 59, 999);

    buckets.push({
      weekIndex: i,
      startDate: weekStart,
      endDate: weekEnd,
      capacityHours: weeklyCapacity,
      usedHours: 0,
      projects: [],
    });
  }

  const sortedProjects = [...projects]
    .filter((project) => !project.archived)
    .sort((a, b) => {
      const aDate = parseDateOrNull(a.projectedStartDate ?? a.scheduledStartDate);
      const bDate = parseDateOrNull(b.projectedStartDate ?? b.scheduledStartDate);
      if (aDate && bDate) {
        return aDate.getTime() - bDate.getTime();
      }
      if (aDate) return -1;
      if (bDate) return 1;
      if (a.priority !== undefined && b.priority !== undefined) {
        return a.priority - b.priority;
      }
      return (a.projectName || "").localeCompare(b.projectName || "");
    });

  const pendingProjects = pendingBids
    .filter((project) => !project.archived)
    .map((project) => ({
      ...project,
      priority: project.priority ?? 999,
    }));

  const allocateProjectsToBuckets = (
    list: ShopLoadProjectInput[],
    type: "committed" | "pending"
  ) => {
    for (const project of list) {
      let remaining = projectRemainingHours(project);
      if (remaining <= 0) continue;

      const startIndex = (() => {
        const scheduled = parseDateOrNull(
          project.projectedStartDate ?? project.scheduledStartDate
        );
        if (!scheduled) return 0;
        const diffMs = getStartOfWeek(scheduled).getTime() - startDate.getTime();
        const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        return Math.max(0, diffWeeks);
      })();

      for (let i = startIndex; i < buckets.length && remaining > 0; i++) {
        const bucket = buckets[i];
        const available = Math.max(0, bucket.capacityHours - bucket.usedHours);
        if (available <= 0) continue;

        const allocation = Math.min(available, remaining);
        bucket.usedHours += allocation;

        const existing = bucket.projects.find(
          (p) => p.id === project.id && p.type === type
        );
        if (existing) {
          existing.hours += allocation;
        } else {
          bucket.projects.push({
            id: project.id,
            name: project.projectName,
            status: project.status,
            hours: allocation,
            type,
          });
        }

        remaining -= allocation;
      }
    }
  };

  allocateProjectsToBuckets(sortedProjects, "committed");
  if (pendingProjects.length > 0) {
    allocateProjectsToBuckets(pendingProjects, "pending");
  }

  const totalCommittedHours = sortedProjects.reduce(
    (sum, project) => sum + projectRemainingHours(project),
    0
  );
  const totalPendingHours = pendingProjects.reduce(
    (sum, project) => sum + projectRemainingHours(project),
    0
  );
  const totalRemainingHours = totalCommittedHours + totalPendingHours;

  const monthlyCapacity = weeklyCapacity * WEEKS_PER_MONTH;
  const backlogMonths =
    monthlyCapacity > 0 ? totalCommittedHours / monthlyCapacity : 0;

  const underUtilizedThreshold =
    threshold ?? companySettings.underUtilizedThreshold ?? 0.7;

  const gaps: BacklogGap[] = [];
  const overloads: ShopLoadBucket[] = [];

  for (const bucket of buckets) {
    if (bucket.capacityHours <= 0) continue;
    const utilization = bucket.usedHours / bucket.capacityHours;
    if (utilization < underUtilizedThreshold) {
      gaps.push({
        startDate: bucket.startDate,
        endDate: bucket.endDate,
        usedHours: bucket.usedHours,
        capacityHours: bucket.capacityHours,
        utilization,
      });
    } else if (utilization > 1) {
      overloads.push(bucket);
    }
  }

  const recommendations: ShopLoadRecommendation[] = gaps.map((gap) => {
    const availableHours = gap.capacityHours - gap.usedHours;
    return {
      weekIndex: buckets.findIndex(
        (bucket) => bucket.startDate.getTime() === gap.startDate.getTime()
      ),
      startDate: gap.startDate,
      endDate: gap.endDate,
      availableHours,
      suggestedMinHours: Math.max(0, availableHours * 0.6),
      suggestedMaxHours: availableHours,
    };
  });

  return {
    totalCommittedHours,
    totalPendingHours,
    totalRemainingHours,
    backlogMonths,
    weeklyCapacity,
    buckets,
    gaps,
    overloads,
    recommendations,
    scenario: {
      shiftMultiplier: scenarioShift,
      weeks: weeksToForecast,
    },
  };
}

