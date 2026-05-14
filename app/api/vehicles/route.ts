import { collectVehiclePositions } from "@/lib/vehicle-collector";
import type { VehiclesResponse } from "@/types/vehicle";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await collectVehiclePositions();

  return NextResponse.json<VehiclesResponse>({
    source: result.source,
    vehicles: result.vehicles,
    error: result.error
  });
}
