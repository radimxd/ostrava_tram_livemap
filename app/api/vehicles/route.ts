import { saveVehiclePositions } from "@/lib/db";
import { fetchMpvnetVehicles, getDemoVehicles } from "@/lib/mpvnet";
import type { VehiclesResponse } from "@/types/vehicle";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const vehicles = await fetchMpvnetVehicles();
    await savePositionsSafely(vehicles, "mpvnet");

    return NextResponse.json<VehiclesResponse>({
      source: "mpvnet",
      vehicles
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MPVnet fetch error";

    if (process.env.NODE_ENV === "development") {
      console.debug("[vehicles] Falling back to demo data:", message);
    }

    const vehicles = getDemoVehicles();
    await savePositionsSafely(vehicles, "demo");

    return NextResponse.json<VehiclesResponse>({
      source: "demo",
      vehicles,
      error: message
    });
  }
}

async function savePositionsSafely(
  vehicles: Parameters<typeof saveVehiclePositions>[0],
  source: Parameters<typeof saveVehiclePositions>[1]
) {
  try {
    await saveVehiclePositions(vehicles, source);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      const message = error instanceof Error ? error.message : "Unknown database write error";
      console.debug("[vehicles] Skipping PostGIS persistence:", message);
    }
  }
}
