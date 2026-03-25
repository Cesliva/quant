/**
 * Direct (pre-markup) material, coating, and hardware costs for an estimating line.
 * Mirrors the logic in EstimatingGrid's calculation effect so compact "total cost" solving stays consistent.
 */

import type { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import type { CompanySettings, ProjectSettings } from "@/lib/utils/settingsLoader";
import {
  getCoatingRate,
  getMaterialRateForGrade,
} from "@/lib/utils/settingsLoader";

export function computeEstimatingLineDirectCosts(
  line: Partial<EstimatingLine>,
  companySettings: CompanySettings,
  projectSettings?: ProjectSettings | null
): { materialCost: number; coatingCost: number; hardwareCost: number } {
  const totalWeight =
    line.materialType === "Material"
      ? line.totalWeight || 0
      : line.plateTotalWeight || 0;

  let materialRate = line.materialRate;
  if (!materialRate) {
    const grade =
      line.materialType === "Material" ? line.grade : line.plateGrade;
    materialRate =
      projectSettings?.materialRate ||
      getMaterialRateForGrade(grade, companySettings);
  }

  let materialCost = 0;
  if (
    line.materialType === "Material" &&
    line.materialPricePerPoundOverride != null &&
    line.materialPricePerPoundOverride > 0
  ) {
    materialCost = totalWeight * line.materialPricePerPoundOverride;
  } else {
    materialCost = totalWeight * (materialRate || 0);
  }

  const hardwareQty = line.hardwareQuantity || 0;
  const hardwareCostPerSet = line.hardwareCostPerSet || 0;
  const hardwareCost = hardwareQty * hardwareCostPerSet;

  const coatingSystem = line.coatingSystem;
  const surfaceArea =
    line.materialType === "Material"
      ? line.totalSurfaceArea || 0
      : line.plateSurfaceArea || 0;

  let coatingCost = 0;
  if (!coatingSystem || coatingSystem === "None" || coatingSystem === "") {
    coatingCost = 0;
  } else if (coatingSystem === "Galvanizing" || coatingSystem === "Galv") {
    let coatingRate = line.coatingRate;
    if (!coatingRate) {
      coatingRate =
        projectSettings?.coatingRate ||
        getCoatingRate(coatingSystem, companySettings);
    }
    coatingCost = totalWeight * (coatingRate || 0);
  } else if (
    coatingSystem === "Paint" ||
    coatingSystem === "Powder Coat" ||
    coatingSystem === "Specialty Coating"
  ) {
    let coatingRate = line.coatingRate;
    if (!coatingRate) {
      coatingRate =
        projectSettings?.coatingRate ||
        getCoatingRate(coatingSystem, companySettings);
    }
    coatingCost = surfaceArea * (coatingRate || 0);
  } else if (
    coatingSystem === "Standard Shop Primer" ||
    coatingSystem === "Zinc Primer"
  ) {
    let coatingRate = line.coatingRate;
    if (!coatingRate) {
      coatingRate =
        projectSettings?.coatingRate ||
        getCoatingRate(coatingSystem, companySettings);
    }
    coatingCost = surfaceArea * (coatingRate || 0);
  } else {
    coatingCost = 0;
  }

  return { materialCost, coatingCost, hardwareCost };
}
