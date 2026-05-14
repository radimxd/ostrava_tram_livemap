"use client";

import VehicleMarker, { type DisplayVehicle } from "@/components/VehicleMarker";
import VehiclePanel, { type VehicleFilter } from "@/components/VehiclePanel";
import type {
  RoutePoint,
  Vehicle,
  VehicleHistoryResponse,
  VehicleRouteResponse,
  VehicleSource,
  VehiclesResponse
} from "@/types/vehicle";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";

const OSTRAVA_CENTER: [number, number] = [49.8209, 18.2625];
const STALE_TTL_MS = 30000;
const TRAIL_TTL_MS = 30 * 60 * 1000;
const DEFAULT_REFRESH_SECONDS = Number(process.env.NEXT_PUBLIC_DEFAULT_REFRESH_SECONDS ?? 10);
const ANIMATION_DURATION_MULTIPLIER = 1.15;

type VehicleAnimation = {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  startAt: number;
  durationMs: number;
  vehicle: Vehicle;
  bearing: number | null;
  lastSeenAt: number;
  stale: boolean;
};

type TrailPoint = {
  lat: number;
  lng: number;
  timestamp: number;
};

type SelectedRouteState = {
  vehicleId: string;
  route: RoutePoint[];
  stops: RoutePoint[];
  source: VehicleRouteResponse["source"];
  geometryAvailable: boolean;
  error: string | null;
};

function getTrailPointKey(point: RoutePoint | TrailPoint, index: number): string {
  const label = "timestamp" in point ? point.timestamp : point.name ?? "trail";
  return `${label}-${point.lat}-${point.lng}-${index}`;
}

export function calculateBearing(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const startLat = (fromLat * Math.PI) / 180;
  const endLat = (toLat * Math.PI) / 180;
  const deltaLng = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);

  return (Math.atan2(y, x) * 180) / Math.PI;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earthRadius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function splitRouteAtVehicle(route: RoutePoint[], vehicle: DisplayVehicle | null) {
  if (!vehicle || route.length < 2) {
    return { past: [], future: route };
  }

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  route.forEach((point, index) => {
    const distance = distanceMeters(vehicle, point);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  const currentPoint: RoutePoint = {
    lat: vehicle.lat,
    lng: vehicle.lng,
    name: "Aktuální poloha",
    stop: false
  };

  return {
    past: [...route.slice(0, closestIndex + 1), currentPoint],
    future: [currentPoint, ...route.slice(closestIndex + 1)]
  };
}

function toDisplayVehicle(animation: VehicleAnimation, now: number): DisplayVehicle {
  const progress = animation.durationMs === 0 ? 1 : Math.min(1, (now - animation.startAt) / animation.durationMs);
  const linearProgress = Math.max(0, progress);

  return {
    ...animation.vehicle,
    lat: animation.fromLat + (animation.toLat - animation.fromLat) * linearProgress,
    lng: animation.fromLng + (animation.toLng - animation.fromLng) * linearProgress,
    bearing: animation.bearing,
    stale: animation.stale,
    lastSeenAt: animation.lastSeenAt
  };
}

export default function TransitMap() {
  const [vehicles, setVehicles] = useState<DisplayVehicle[]>([]);
  const [source, setSource] = useState<VehicleSource | "error">("demo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VehicleFilter>("all");
  const [refreshSeconds, setRefreshSeconds] = useState(
    [5, 10, 15, 30].includes(DEFAULT_REFRESH_SECONDS) ? DEFAULT_REFRESH_SECONDS : 10
  );
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<SelectedRouteState | null>(null);
  const [persistedTrail, setPersistedTrail] = useState<RoutePoint[]>([]);
  const [historySource, setHistorySource] = useState<VehicleHistoryResponse["source"] | "session">("session");
  const [routeLoading, setRouteLoading] = useState(false);
  const [trailVersion, setTrailVersion] = useState(0);

  const animationsRef = useRef<Map<string, VehicleAnimation>>(new Map());
  const vehiclesRef = useRef<DisplayVehicle[]>([]);
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  const applyIncomingVehicles = useCallback((incoming: Vehicle[]) => {
    const now = Date.now();
    const durationMs = Math.round(refreshSeconds * 1000 * ANIMATION_DURATION_MULTIPLIER);
    const currentById = new Map(vehiclesRef.current.map((vehicle) => [vehicle.id, vehicle]));
    const incomingIds = new Set(incoming.map((vehicle) => vehicle.id));
    const nextAnimations = new Map<string, VehicleAnimation>();

    for (const vehicle of incoming) {
      const current = currentById.get(vehicle.id);
      const moved = current
        ? Math.abs(current.lat - vehicle.lat) > 0.000001 || Math.abs(current.lng - vehicle.lng) > 0.000001
        : false;

      nextAnimations.set(vehicle.id, {
        fromLat: current?.lat ?? vehicle.lat,
        fromLng: current?.lng ?? vehicle.lng,
        toLat: vehicle.lat,
        toLng: vehicle.lng,
        startAt: now,
        durationMs,
        vehicle,
        bearing: current && moved ? calculateBearing(current.lat, current.lng, vehicle.lat, vehicle.lng) : current?.bearing ?? null,
        lastSeenAt: now,
        stale: false
      });

      const trail = trailsRef.current.get(vehicle.id) ?? [];
      const previous = trail[trail.length - 1];
      const shouldAppend =
        !previous ||
        now - previous.timestamp > 1000 ||
        distanceMeters(previous, { lat: vehicle.lat, lng: vehicle.lng }) > 4;
      const freshTrail = trail.filter((point) => now - point.timestamp <= TRAIL_TTL_MS);

      if (shouldAppend) {
        freshTrail.push({ lat: vehicle.lat, lng: vehicle.lng, timestamp: now });
      }

      trailsRef.current.set(vehicle.id, freshTrail);
    }

    for (const current of vehiclesRef.current) {
      if (incomingIds.has(current.id) || now - current.lastSeenAt > STALE_TTL_MS) {
        continue;
      }

      nextAnimations.set(current.id, {
        fromLat: current.lat,
        fromLng: current.lng,
        toLat: current.lat,
        toLng: current.lng,
        startAt: now,
        durationMs: 0,
        vehicle: current,
        bearing: current.bearing,
        lastSeenAt: current.lastSeenAt,
        stale: true
      });
    }

    animationsRef.current = nextAnimations;
    setVehicles(Array.from(nextAnimations.values()).map((animation) => toDisplayVehicle(animation, now)));
    setTrailVersion((version) => version + 1);
  }, [refreshSeconds]);

  const selectVehicle = useCallback(async (vehicle: DisplayVehicle) => {
    setSelectedVehicleId(vehicle.id);
    setSelectedRoute(null);
    setPersistedTrail([]);
    setHistorySource("session");

    void fetch(`/api/vehicle-history/${encodeURIComponent(vehicle.id)}?minutes=180`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as VehicleHistoryResponse;

        if (response.ok && data.points.length > 0) {
          setPersistedTrail(data.points);
          setHistorySource(data.source);
        }
      })
      .catch((historyError) => {
        if (process.env.NODE_ENV === "development") {
          console.debug("[TransitMap] Vehicle history lookup failed:", historyError);
        }
      });

    if (!vehicle.routeRequest) {
      setSelectedRoute({
        vehicleId: vehicle.id,
        route: [],
        stops: [],
        source: "unavailable",
        geometryAvailable: false,
        error: "Tohle vozidlo neobsahuje metadata spoje pro načtení plánované trasy."
      });
      return;
    }

    setRouteLoading(true);

    try {
      const response = await fetch("/api/vehicle-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(vehicle.routeRequest)
      });
      const data = (await response.json()) as VehicleRouteResponse;

      if (!response.ok || data.route.length < 2) {
        throw new Error(data.error ?? `Route API responded with HTTP ${response.status}`);
      }

      setSelectedRoute({
        vehicleId: vehicle.id,
        route: data.route,
        stops: data.stops,
        source: data.source,
        geometryAvailable: data.geometryAvailable,
        error: data.error ?? null
      });
    } catch (routeError) {
      const message = routeError instanceof Error ? routeError.message : "Nepodařilo se načíst trasu.";

      if (process.env.NODE_ENV === "development") {
        console.debug("[TransitMap] Route lookup failed:", message);
      }

      setSelectedRoute({
        vehicleId: vehicle.id,
        route: [],
        stops: [],
        source: "unavailable",
        geometryAvailable: false,
        error: message
      });
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/vehicles", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`API responded with HTTP ${response.status}`);
      }

      const data = (await response.json()) as VehiclesResponse;
      setSource(data.source);
      setError(data.error ?? null);
      setLastRefresh(new Date());
      applyIncomingVehicles(data.vehicles);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Neznámá chyba načítání.";

      if (process.env.NODE_ENV === "development") {
        console.debug("[TransitMap] Vehicle API failed:", message);
      }

      setSource("error");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [applyIncomingVehicles]);

  useEffect(() => {
    void fetchVehicles();
    const interval = window.setInterval(() => {
      void fetchVehicles();
    }, refreshSeconds * 1000);

    return () => window.clearInterval(interval);
  }, [fetchVehicles, refreshSeconds]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const activeAnimations = new Map<string, VehicleAnimation>();
      const nextVehicles: DisplayVehicle[] = [];

      for (const [id, animation] of animationsRef.current.entries()) {
        if (now - animation.lastSeenAt > STALE_TTL_MS) {
          continue;
        }

        activeAnimations.set(id, animation);
        nextVehicles.push(toDisplayVehicle(animation, now));
      }

      animationsRef.current = activeAnimations;
      setVehicles(nextVehicles);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const filteredVehicles = useMemo(() => {
    if (filter === "all") {
      return vehicles;
    }

    return vehicles.filter((vehicle) => vehicle.type === filter);
  }, [filter, vehicles]);

  const tramCount = useMemo(() => vehicles.filter((vehicle) => vehicle.type === "tram").length, [vehicles]);
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles]
  );
  const selectedTrail = useMemo(() => {
    if (!selectedVehicleId) {
      return [];
    }

    if (persistedTrail.length > 0) {
      return persistedTrail;
    }

    return trailsRef.current.get(selectedVehicleId) ?? [];
  }, [persistedTrail, selectedVehicleId, trailVersion]);
  const selectedTrailPositions = useMemo(
    () => selectedTrail.map((point) => [point.lat, point.lng] as [number, number]),
    [selectedTrail]
  );
  const selectedRouteSplit = useMemo(
    () => splitRouteAtVehicle(selectedRoute?.geometryAvailable ? selectedRoute.route : [], selectedVehicle),
    [selectedRoute, selectedVehicle]
  );
  const selectedRoutePastPositions = useMemo(
    () => selectedRouteSplit.past.map((point) => [point.lat, point.lng] as [number, number]),
    [selectedRouteSplit]
  );
  const selectedRouteFuturePositions = useMemo(
    () => selectedRouteSplit.future.map((point) => [point.lat, point.lng] as [number, number]),
    [selectedRouteSplit]
  );

  return (
    <main className="relative h-screen w-screen bg-ink">
      <MapContainer center={OSTRAVA_CENTER} zoom={13} minZoom={10} maxZoom={18} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {selectedRoutePastPositions.length > 1 ? (
          <Polyline
            positions={selectedRoutePastPositions}
            pathOptions={{ color: "#94a3b8", weight: 5, opacity: 0.55 }}
          />
        ) : null}
        {selectedRouteFuturePositions.length > 1 ? (
          <Polyline
            positions={selectedRouteFuturePositions}
            pathOptions={{ color: "#f97316", weight: 5, opacity: 0.92, dashArray: "10 10" }}
          />
        ) : null}
        {selectedTrailPositions.length > 1 ? (
          <Polyline
            positions={selectedTrailPositions}
            pathOptions={{ color: "#38bdf8", weight: 3, opacity: 0.72 }}
          />
        ) : null}
        {selectedTrail.map((point, index) => (
          <CircleMarker
            key={getTrailPointKey(point, index)}
            center={[point.lat, point.lng]}
            radius={3}
            pathOptions={{ color: "#7dd3fc", fillColor: "#38bdf8", fillOpacity: 0.8, weight: 1 }}
          />
        ))}
        {(selectedRoute?.stops ?? []).map((stop, index) => (
          <CircleMarker
            key={`${stop.name ?? "stop"}-${index}`}
            center={[stop.lat, stop.lng]}
            radius={4}
            pathOptions={{ color: "#fed7aa", fillColor: "#f97316", fillOpacity: 0.9, weight: 2 }}
          >
            {stop.name ? <Tooltip>{stop.name}</Tooltip> : null}
          </CircleMarker>
        ))}
        {filteredVehicles.map((vehicle) => (
          <VehicleMarker
            key={vehicle.id}
            vehicle={vehicle}
            selected={vehicle.id === selectedVehicleId}
            onSelect={selectVehicle}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-[1000] sm:left-4 sm:right-auto sm:top-4">
        <VehiclePanel
          source={source}
          error={error}
          loading={loading}
          totalCount={vehicles.length}
          tramCount={tramCount}
          lastRefresh={lastRefresh}
          filter={filter}
          refreshSeconds={refreshSeconds}
          onFilterChange={setFilter}
          onRefreshSecondsChange={setRefreshSeconds}
        />
      </div>

      {selectedVehicle ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[1000] sm:bottom-4 sm:left-4 sm:right-auto">
          <div className="pointer-events-auto w-[min(92vw,380px)] rounded-lg border border-white/10 bg-panel p-4 text-sm text-slate-100 shadow-panel backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Vybrané vozidlo</div>
                <div className="mt-1 text-lg font-semibold">
                  Linka {selectedVehicle.line ?? "?"} · {selectedVehicle.destination ?? "neznámý směr"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedVehicleId(null);
                  setSelectedRoute(null);
                  setPersistedTrail([]);
                  setHistorySource("session");
                }}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/15 hover:bg-white/15"
              >
                Zavřít
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-md bg-white/5 p-2">
                <div className="text-xs text-slate-400">GPS stopa</div>
                <div className="font-semibold">{selectedTrail.length} bodů</div>
              </div>
              <div className="rounded-md bg-white/5 p-2">
                <div className="text-xs text-slate-400">Trasa</div>
                <div className="font-semibold">{selectedRoute?.geometryAvailable ? `${selectedRoute.route.length} bodů` : "jen zastávky"}</div>
              </div>
              <div className="rounded-md bg-white/5 p-2">
                <div className="text-xs text-slate-400">Zastávky</div>
                <div className="font-semibold">{selectedRoute?.stops.length ?? 0}</div>
              </div>
            </div>

            <div className="mt-3 space-y-1 text-xs text-slate-300">
              <div className="flex items-center gap-2"><i className="h-1 w-8 rounded bg-sky-400" />{historySource === "postgis" ? "historie z PostGIS" : "pozorovaná GPS stopa v této session"}</div>
              <div className="flex items-center gap-2"><i className="h-1 w-8 rounded bg-slate-400" />plánovaná trasa za vozidlem</div>
              <div className="flex items-center gap-2"><i className="h-1 w-8 rounded border border-orange-300 bg-orange-500" />kam spoj pojede dál</div>
            </div>

            {routeLoading ? (
              <div className="mt-3 rounded-md border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-sky-100">
                Načítám geometrii trasy z MPVnet...
              </div>
            ) : null}

            {selectedRoute?.error ? (
              <div className="mt-3 rounded-md border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-amber-100">
                {selectedRoute.error}
              </div>
            ) : null}

            {selectedRoute?.stops.length ? (
              <div className="mt-3 rounded-md border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Zastávky na trase</div>
                <div className="max-h-28 space-y-1 overflow-y-auto pr-1 text-xs text-slate-200">
                  {selectedRoute.stops.slice(0, 12).map((stop, index) => (
                    <div key={`${stop.name ?? "stop"}-${index}`} className="flex gap-2">
                      <span className="w-5 shrink-0 text-slate-500">{index + 1}.</span>
                      <span className="truncate">{stop.name ?? "Neznámá zastávka"}</span>
                    </div>
                  ))}
                  {selectedRoute.stops.length > 12 ? (
                    <div className="text-slate-400">+ {selectedRoute.stops.length - 12} dalších zastávek</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
