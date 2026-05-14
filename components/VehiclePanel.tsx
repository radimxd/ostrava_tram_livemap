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
  onFilterChange: (filter: VehicleFilter) => void;
};

const FILTERS: Array<{ value: VehicleFilter; label: string }> = [
  { value: "all", label: "Vše" },
  { value: "tram", label: "Tram" },
  { value: "bus", label: "Bus" },
  { value: "trolleybus", label: "Trolejbus" },
  { value: "unknown", label: "Neznámé" }
];

function sourceBadge(source: VehicleSource | "error") {
  if (source === "mpvnet") {
    return "bg-emerald-500/10 text-emerald-200 ring-emerald-300/25";
  }

  if (source === "demo") {
    return "bg-amber-500/10 text-amber-100 ring-amber-300/25";
  }

  return "bg-rose-500/10 text-rose-100 ring-rose-300/25";
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
  onFilterChange
}: VehiclePanelProps) {
  return (
    <aside className="pointer-events-auto w-[min(92vw,340px)] rounded-md border border-white/10 bg-[#11161d]/95 p-3 text-slate-100 shadow-panel backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-normal">Ostrava Tram Live</h1>
          <div className="mt-1 text-xs text-slate-400">
            {totalCount} vozidel · {tramCount} tramvají
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${sourceBadge(source)}`}>
          {sourceLabel(source)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
        <span className="text-slate-400">Aktualizace</span>
        <span className="flex items-center gap-2 font-medium text-slate-200">
          {loading ? <i className="h-1.5 w-1.5 rounded-full bg-sky-300" /> : null}
          {lastRefresh ? lastRefresh.toLocaleTimeString("cs-CZ") : "čekám"}
        </span>
      </div>

      {loading ? (
        <div className="mt-2 text-xs text-sky-100">Načítám...</div>
      ) : null}

      {error ? (
        <div className="mt-2 rounded border border-amber-300/20 bg-amber-400/10 px-2 py-1.5 text-xs text-amber-100">Demo data</div>
      ) : null}

      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onFilterChange(item.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                filter === item.value
                  ? "bg-slate-100 text-slate-950 ring-slate-100"
                  : "bg-white/5 text-slate-200 ring-white/10 hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-300">
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-tram" />Tram</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-bus" />Bus</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-trolleybus" />Trolejbus</span>
          <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-slate-500" />Neaktivní</span>
        </div>
      </div>
    </aside>
  );
}
