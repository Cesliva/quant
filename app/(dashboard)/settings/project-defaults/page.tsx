"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ProjectDefaultsPage() {
  const [defaults, setDefaults] = useState({
    stockRounding: "",
    defaultGrade: "",
    coatingOptions: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save to Firestore
    console.log("Saving project defaults:", defaults);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Project Defaults</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Default Project Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Rounding
              </label>
              <Input
                value={defaults.stockRounding}
                onChange={(e) =>
                  setDefaults({ ...defaults, stockRounding: e.target.value })
                }
                placeholder="e.g., 0.125"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Grade
              </label>
              <Input
                value={defaults.defaultGrade}
                onChange={(e) =>
                  setDefaults({ ...defaults, defaultGrade: e.target.value })
                }
                placeholder="e.g., A36, A572"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coating Options (comma-separated)
              </label>
              <Input
                value={defaults.coatingOptions}
                onChange={(e) =>
                  setDefaults({ ...defaults, coatingOptions: e.target.value })
                }
                placeholder="Galvanized, Paint, None"
              />
            </div>
            
            <div className="pt-4">
              <Button type="submit">Save Defaults</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

