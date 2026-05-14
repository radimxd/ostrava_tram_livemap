import { fetchMpvnetRoute } from "@/lib/mpvnet";
import type { VehicleRouteRequest, VehicleRouteResponse } from "@/types/vehicle";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isRouteRequest(value: unknown): value is VehicleRouteRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<VehicleRouteRequest>;
  return (
    typeof candidate.num1 === "string" &&
    candidate.num1.length > 0 &&
    typeof candidate.num2 === "string" &&
    candidate.num2.length > 0 &&
    typeof candidate.cat === "number" &&
    Number.isFinite(candidate.cat)
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;

    if (!isRouteRequest(body)) {
      return NextResponse.json<VehicleRouteResponse>(
        {
          source: "unavailable",
          route: [],
          stops: [],
          geometryAvailable: false,
          error: "Vehicle does not include enough route metadata for MPVnet route lookup."
        },
        { status: 400 }
      );
    }

    const result = await fetchMpvnetRoute(body);

    return NextResponse.json<VehicleRouteResponse>({
      source: "mpvnet",
      route: result.route,
      stops: result.stops,
      geometryAvailable: result.geometryAvailable,
      error: result.geometryAvailable
        ? undefined
        : "MPVnet vrátil jen pořadí zastávek, ne přesnou geometrii trasy. Čára mezi zastávkami je schválně skrytá, aby nevedla přes domy, trávu nebo chodníky."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MPVnet route error";

    if (process.env.NODE_ENV === "development") {
      console.debug("[vehicle-route] Route lookup failed:", message);
    }

    return NextResponse.json<VehicleRouteResponse>(
      {
        source: "unavailable",
        route: [],
        stops: [],
        geometryAvailable: false,
        error: message
      },
      { status: 502 }
    );
  }
}
