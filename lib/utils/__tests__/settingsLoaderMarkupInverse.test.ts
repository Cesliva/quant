import {
  calculateTotalCostWithMarkup,
  solveLaborCostForTargetLineTotal,
  type CompanySettings,
} from "@/lib/utils/settingsLoader";

const minimalCompany: CompanySettings = {
  materialGrades: [],
  laborRates: [{ trade: "General", rate: 50 }],
  coatingTypes: [],
  markupSettings: {
    overheadPercentage: 10,
    profitPercentage: 15,
    materialWasteFactor: 5,
    laborWasteFactor: 5,
    salesTaxRate: 0,
    useTaxRate: 0,
  },
};

describe("solveLaborCostForTargetLineTotal", () => {
  it("inverts calculateTotalCostWithMarkup for labor (round-trip)", () => {
    const materialCost = 100;
    const laborCost = 200;
    const coatingCost = 50;
    const hardwareCost = 25;

    const target = calculateTotalCostWithMarkup(
      materialCost,
      laborCost,
      coatingCost,
      hardwareCost,
      minimalCompany
    );

    const solved = solveLaborCostForTargetLineTotal(
      target,
      materialCost,
      coatingCost,
      hardwareCost,
      minimalCompany
    );

    expect(solved).toBeCloseTo(laborCost, 5);
  });

  it("returns 0 labor when target only covers fixed costs", () => {
    const materialCost = 500;
    const coatingCost = 100;
    const hardwareCost = 50;
    const solved = solveLaborCostForTargetLineTotal(
      0,
      materialCost,
      coatingCost,
      hardwareCost,
      minimalCompany
    );
    expect(solved).toBe(0);
  });
});
