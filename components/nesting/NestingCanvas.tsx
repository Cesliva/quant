"use client";

import { useRef, useEffect } from "react";
import { Maximize2, RotateCw } from "lucide-react";

interface NestItem {
  id: string;
  itemDescription: string;
  materialType: "Rolled" | "Plate";
  thickness?: number;
  width?: number;
  length?: number;
  qty?: number;
  shapeType?: string;
  sizeDesignation?: string;
  lengthFt?: number;
  position?: { x: number; y: number };
  rotation?: number;
}

interface NestingCanvasProps {
  stockSize: string; // e.g., "48x96"
  items: NestItem[];
  materialType: "Plate" | "Rolled";
}

export default function NestingCanvas({ stockSize, items, materialType }: NestingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Parse stock size
    const [stockWidth, stockLength] = stockSize.split("x").map(Number);
    const scale = Math.min(400 / stockWidth, 300 / stockLength); // Scale to fit canvas
    const canvasWidth = stockWidth * scale;
    const canvasHeight = stockLength * scale;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw stock outline
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

    // Draw stock fill
    ctx.fillStyle = "#eff6ff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw items
    items.forEach((item, index) => {
      if (materialType === "Plate" && item.width && item.length) {
        const itemWidth = item.width * scale;
        const itemLength = item.length * scale;
        const x = (item.position?.x || 0) * scale;
        const y = (item.position?.y || 0) * scale;

        // Draw item rectangle
        ctx.fillStyle = index % 2 === 0 ? "#10b981" : "#3b82f6";
        ctx.fillRect(x, y, itemWidth, itemLength);
        
        ctx.strokeStyle = "#1e40af";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, itemWidth, itemLength);

        // Draw item label
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px sans-serif";
        ctx.fillText(
          `${item.width}"×${item.length}"`,
          x + 2,
          y + 12
        );
      }
    });

    // Draw grid lines for reference
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= stockWidth; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i * scale, 0);
      ctx.lineTo(i * scale, canvasHeight);
      ctx.stroke();
    }
    for (let i = 0; i <= stockLength; i += 12) {
      ctx.beginPath();
      ctx.moveTo(0, i * scale);
      ctx.lineTo(canvasWidth, i * scale);
      ctx.stroke();
    }
  }, [stockSize, items, materialType]);

  const [stockWidth, stockLength] = stockSize.split("x").map(Number);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Nesting Layout</h4>
        <div className="text-xs text-gray-500">
          {stockWidth}" × {stockLength}"
        </div>
      </div>
      <div className="border-2 border-blue-200 rounded-lg p-2 bg-white">
        <canvas
          ref={canvasRef}
          className="w-full max-w-full border border-gray-200 rounded"
          style={{ maxHeight: "300px" }}
        />
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Item</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
          <span>Stock</span>
        </div>
      </div>
    </div>
  );
}

