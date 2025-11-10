import { NextResponse } from "next/server";
export const revalidate = 10;
export async function GET() {
  const vehicles = [
    { id: "EQB-1", lat: 55.6761, lng: 12.5683, status: "idle" },
    { id: "SPRINTER-1", lat: 55.6840, lng: 12.5770, status: "on-trip" },
  ];
  return NextResponse.json({ vehicles, ts: Date.now() });
}
