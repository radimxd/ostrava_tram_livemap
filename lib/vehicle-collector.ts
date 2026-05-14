import { saveVehiclePositions } from "@/lib/db";
import { fetchMpvnetVehicles, getDemoVehicles } from "@/lib/mpvnet";
import type { Vehicle, VehicleSource } from "@/types/vehicle";

export type VehicleCollectionResult = {
  source: VehicleSource;
  vehicles: Vehicle[];
  saved: number;
  persisted: boolean;
  error?: string;
};

export async function collectVehiclePositions(): Promise<VehicleCollectionResult> {
  try {
    const vehicles = await fetchMpvnetVehicles();
    const persisted = await savePositionsSafely(vehicles, "mpvnet");

    return {
      source: "mpvnet",
      vehicles,
      saved: persisted ? vehicles.length : 0,
      persisted
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MPVnet fetch error";

    if (process.env.NODE_ENV === "development") {
      console.debug("[collector] Falling back to demo data:", message);
    }

    const vehicles = getDemoVehicles();
    const persisted = await savePositionsSafely(vehicles, "demo");

    return {
      source: "demo",
      vehicles,
      saved: persisted ? vehicles.length : 0,
      persisted,
      error: message
    };
  }
}

async function savePositionsSafely(vehicles: Vehicle[], source: VehicleSource): Promise<boolean> {
  try {
    await saveVehiclePositions(vehicles, source);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const message = error instanceof Error ? error.message : "Unknown database write error";
      console.debug("[collector] Skipping PostGIS persistence:", message);
    }

    return false;
  }
}
