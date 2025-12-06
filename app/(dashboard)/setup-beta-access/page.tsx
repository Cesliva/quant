"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function SetupBetaAccessPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; config?: any } | null>(null);
  const [currentConfig, setCurrentConfig] = useState<any>(null);

  const loadCurrentConfig = async () => {
    try {
      const response = await fetch("/api/setup-beta-access");
      const data = await response.json();
      setCurrentConfig(data);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  const setupDefault = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/setup-beta-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: false,
          codes: ["BETA2024", "QUANT2024", "STEEL2024"],
          message: "Beta access code is required. Please contact support for access.",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: "Beta access configuration created successfully!",
          config: data.config,
        });
        await loadCurrentConfig();
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to setup beta access",
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || "Failed to setup beta access",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupOpenBeta = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/setup-beta-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          codes: ["VIP2024", "EARLY2024"],
          message: "",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: "Open beta configuration created! Codes are optional.",
          config: data.config,
        });
        await loadCurrentConfig();
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to setup beta access",
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || "Failed to setup beta access",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupPublic = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/setup-beta-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          codes: [],
          message: "",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: "Public signup enabled! No codes required.",
          config: data.config,
        });
        await loadCurrentConfig();
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to setup beta access",
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || "Failed to setup beta access",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load current config on mount
  useEffect(() => {
    loadCurrentConfig();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Setup Beta Access</h1>
        <p className="text-gray-600">
          Configure beta access codes for signup control. This will create the configuration in Firebase.
        </p>
      </div>

      {currentConfig && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {currentConfig.exists ? (
              <div className="space-y-2">
                <p>
                  <strong>Status:</strong>{" "}
                  <span className={currentConfig.config.enabled ? "text-green-600" : "text-orange-600"}>
                    {currentConfig.config.enabled ? "Codes Optional" : "Codes Required"}
                  </span>
                </p>
                <p>
                  <strong>Codes:</strong> {currentConfig.config.codes.length > 0 
                    ? currentConfig.config.codes.join(", ") 
                    : "None (public signup)"}
                </p>
                {currentConfig.config.message && (
                  <p>
                    <strong>Message:</strong> {currentConfig.config.message}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No configuration found. Signups are open to everyone.</p>
            )}
            <Button
              variant="outline"
              onClick={loadCurrentConfig}
              className="mt-4"
            >
              Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Closed Beta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Require beta access codes for all signups. Users must enter a valid code.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Default codes:</strong></p>
              <ul className="list-disc list-inside">
                <li>BETA2024</li>
                <li>QUANT2024</li>
                <li>STEEL2024</li>
              </ul>
            </div>
            <Button
              onClick={setupDefault}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                "Setup Closed Beta"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Beta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Anyone can sign up, but optional codes are available for tracking.
            </p>
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Optional codes:</strong></p>
              <ul className="list-disc list-inside">
                <li>VIP2024</li>
                <li>EARLY2024</li>
              </ul>
            </div>
            <Button
              onClick={setupOpenBeta}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                "Setup Open Beta"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public Signup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              No restrictions. Anyone can sign up without a code.
            </p>
            <div className="text-xs text-gray-500">
              <p>No codes required</p>
            </div>
            <Button
              onClick={setupPublic}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                "Enable Public Signup"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className={`mt-6 ${result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${result.success ? "text-green-800" : "text-red-800"}`}>
                  {result.message}
                </p>
                {result.config && (
                  <div className="mt-3 text-sm text-gray-700">
                    <p><strong>Configuration:</strong></p>
                    <pre className="mt-2 p-3 bg-white rounded border text-xs overflow-auto">
                      {JSON.stringify(result.config, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Choose one of the setup options above</li>
            <li>Share beta codes with your testers (if using closed beta)</li>
            <li>Manage codes in Firebase Console: <code className="bg-gray-100 px-1 rounded">betaAccess/config</code></li>
            <li>Test signup at <code className="bg-gray-100 px-1 rounded">/signup</code></li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

