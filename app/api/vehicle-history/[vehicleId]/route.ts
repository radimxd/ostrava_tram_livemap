import { getVehicleHistory } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = {
  params: Promise<{
    vehicleId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  const { vehicleId } = await params;
  const url = new URL(request.url);
  const minutes = Number(url.searchParams.get("minutes") ?? 60);

  try {
    const history = await getVehicleHistory(decodeURIComponent(vehicleId), minutes);

    return NextResponse.json({
      source: "postgis",
      points: history
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "PostGIS database is unavailable.";

    if (process.env.NODE_ENV === "development") {
      console.debug("[vehicle-history] Failed to load history:", message);
    }

    return NextResponse.json(
      {
        source: "unavailable",
        points: [],
        error: message
      },
      { status: 503 }
    );
  }
}
