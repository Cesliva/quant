/**
 * Unit tests for display lines rollup logic.
 * Ensures expanded/editing line stays visible when typing or changing dropdowns.
 */

import type { EstimatingLine } from "@/components/estimating/EstimatingGrid";

function getDisplayLines(
  allDisplayLines: EstimatingLine[],
  showAllLines: boolean,
  expandedLineId: string | null,
  editingId: string | null
): EstimatingLine[] {
  if (showAllLines || allDisplayLines.length <= 5) {
    return allDisplayLines;
  }
  const slice = allDisplayLines.slice(-5);
  const activeLineId = expandedLineId || editingId;
  if (activeLineId && !slice.some((l) => l.id === activeLineId)) {
    const activeLine = allDisplayLines.find((l) => l.id === activeLineId);
    if (activeLine) {
      const indexOf = (l: EstimatingLine) => allDisplayLines.findIndex((x) => x.id === l.id);
      const withActive = [...slice.slice(0, 4), activeLine];
      return withActive.sort((a, b) => indexOf(a) - indexOf(b));
    }
  }
  return slice;
}

function makeLine(id: string, lineId: string): EstimatingLine {
  return {
    id,
    lineId,
    drawingNumber: "",
    detailNumber: "",
    itemDescription: "",
    category: "Beams",
    subCategory: "",
    materialType: "Material",
  };
}

describe("displayLines rollup logic", () => {
  it("returns all lines when showAllLines is true", () => {
    const lines = [1, 2, 3, 4, 5, 6, 7].map((i) => makeLine(`id${i}`, `L${i}`));
    const result = getDisplayLines(lines, true, "id3", null);
    expect(result).toHaveLength(7);
    expect(result).toEqual(lines);
  });

  it("returns all lines when 5 or fewer", () => {
    const lines = [1, 2, 3].map((i) => makeLine(`id${i}`, `L${i}`));
    const result = getDisplayLines(lines, false, null, null);
    expect(result).toHaveLength(3);
  });

  it("returns last 5 when no expanded/editing line", () => {
    const lines = [1, 2, 3, 4, 5, 6, 7].map((i) => makeLine(`id${i}`, `L${i}`));
    const result = getDisplayLines(lines, false, null, null);
    expect(result).toHaveLength(5);
    expect(result.map((l) => l.id)).toEqual(["id3", "id4", "id5", "id6", "id7"]);
  });

  it("includes expanded line when it is in last 5", () => {
    const lines = [1, 2, 3, 4, 5, 6, 7].map((i) => makeLine(`id${i}`, `L${i}`));
    const result = getDisplayLines(lines, false, "id6", null);
    expect(result).toHaveLength(5);
    expect(result.some((l) => l.id === "id6")).toBe(true);
  });

  it("includes expanded line when it is NOT in last 5 (critical for no glitch)", () => {
    const lines = [1, 2, 3, 4, 5, 6, 7].map((i) => makeLine(`id${i}`, `L${i}`));
    const result = getDisplayLines(lines, false, "id2", null);
    expect(result).toHaveLength(5);
    expect(result.some((l) => l.id === "id2")).toBe(true);
    expect(result.map((l) => l.id)).toContain("id2");
  });

  it("includes editing line when not expanded (editingId fallback)", () => {
    const lines = [1, 2, 3, 4, 5, 6, 7].map((i) => makeLine(`id${i}`, `L${i}`));
    const result = getDisplayLines(lines, false, null, "id1");
    expect(result).toHaveLength(5);
    expect(result.some((l) => l.id === "id1")).toBe(true);
  });

  it("preserves order when including expanded line from outside slice", () => {
    const lines = [1, 2, 3, 4, 5, 6, 7].map((i) => makeLine(`id${i}`, `L${i}`));
    const result = getDisplayLines(lines, false, "id2", null);
    const indexOf = (id: string) => result.findIndex((l) => l.id === id);
    expect(indexOf("id2")).toBeLessThan(indexOf("id6"));
  });
});
