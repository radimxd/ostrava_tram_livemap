"use client";

import { useEffect, useState, type ComponentType } from "react";

type TransitMapComponent = ComponentType;

function LoadingView() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink text-slate-100">
      <div className="rounded-lg border border-white/10 bg-panel px-5 py-4 shadow-panel">
        Načítám mapu...
      </div>
    </main>
  );
}

export default function TransitMap() {
  const [MapComponent, setMapComponent] = useState<TransitMapComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    import("@/components/TransitMapLeaflet")
      .then((module) => {
        if (mounted) {
          setMapComponent(() => module.default);
        }
      })
      .catch((importError: unknown) => {
        const message = importError instanceof Error ? importError.message : "Mapový modul se nepodařilo načíst.";

        if (process.env.NODE_ENV === "development") {
          console.debug("[TransitMap] Leaflet import failed:", message);
        }

        if (mounted) {
          setError(message);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink p-4 text-slate-100">
        <div className="max-w-md rounded-lg border border-rose-300/20 bg-panel px-5 py-4 shadow-panel">
          <h1 className="text-lg font-semibold">Mapu se nepodařilo načíst</h1>
          <p className="mt-2 text-sm text-rose-100">{error}</p>
        </div>
      </main>
    );
  }

  if (!MapComponent) {
    return <LoadingView />;
  }

  return <MapComponent />;
}
