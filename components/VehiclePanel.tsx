"use client";

import type { VehicleSource, VehicleType } from "@/types/vehicle";

export type VehicleFilter = "all" | VehicleType;

type VehiclePanelProps = {
  source: VehicleSource | "error";
  error: string | null;
  loading: boolean;
  totalCount: number;
  tramCount: number;
  lastRefresh: Date | null;
  filter: VehicleFilter;
  refreshSeconds: number;
  onFilterChange: (filter: VehicleFilter) => void;
  onRefreshSecondsChange: (seconds: number) => void;
};

const FILTERS: Array<{ value: VehicleFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "tram", label: "Tram" },
  { value: "bus", label: "Bus" },
  { value: "trolleybus", label: "Trolleybus" },
  { value: "unknown", label: "Unknown" }
];

const REFRESH_OPTIONS = [5, 10, 15, 30];

function sourceBadge(source: VehicleSource | "error") {
  if (source === "mpvnet") {
    return "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30";
  }

  if (source === "demo") {
    return "bg-amber-400/15 text-amber-100 ring-amber-300/30";
  }

  return "bg-rose-400/15 text-rose-100 ring-rose-300/30";
}

function sourceLabel(source: VehicleSource | "error") {
  if (source === "mpvnet") return "MPVnet";
  if (source === "demo") return "demo";
  return "error";
}

export default function VehiclePanel({
  source,
  error,
  loading,
  totalCount,
  tramCount,
  lastRefresh,
  filter,
  refreshSeconds,
  onFilterChange,
  onRefreshSecondsChange
}: VehiclePanelProps) {
  return (
    <aside className="pointer-events-auto w-[min(92vw,380px)] rounded-lg border border-white/10 bg-panel p-4 text-slate-100 shadow-panel backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Ostrava Tram Live</h1>
          <p className="mt-1 text-sm text-slate-300">Živé polohy MHD s plynulým pohybem markerů.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${sourceBadge(source)}`}>
          {sourceLabel(source)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-slate-400">Vozidla</div>
          <div className="mt-1 text-2xl font-semibold">{totalCount}</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-slate-400">Tramvaje</div>
          <div className="mt-1 text-2xl font-semibold text-orange-200">{tramCount}</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-slate-400">Refresh</div>
          <div className="mt-1 text-2xl font-semibold">{refreshSeconds}s</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-400">Poslední aktualizace</span>
        <span className="font-medium">{lastRefresh ? lastRefresh.toLocaleTimeString("cs-CZ") : "čekám..."}</span>
      </div>

      {loading ? (
        <div className="mt-3 rounded-md border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">
          Načítám aktuální pozice...
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-md border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Filtr</div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFilterChange(item.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                filter === item.value
                  ? "bg-white text-slate-950 ring-white"
                  : "bg-white/5 text-slate-200 ring-white/10 hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span>Interval</span>
          <span>{refreshSeconds}s</span>
        </div>
        <input
          aria-label="Refresh interval"
          className="w-full accent-orange-500"
          type="range"
          min={0}
          max={REFRESH_OPTIONS.length - 1}
          step={1}
          value={Math.max(0, REFRESH_OPTIONS.indexOf(refreshSeconds))}
          onChange={(event) => onRefreshSecondsChange(REFRESH_OPTIONS[Number(event.target.value)])}
        />
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          {REFRESH_OPTIONS.map((option) => (
            <span key={option}>{option}s</span>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Legenda</div>
        <div className="grid grid-cols-2 gap-2 text-sm text-slate-200">
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-tram" />Tramvaj</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-bus" />Bus</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-trolleybus" />Trolejbus</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-slate-500" />Stale</span>
        </div>
      </div>
    </aside>
  );
}
