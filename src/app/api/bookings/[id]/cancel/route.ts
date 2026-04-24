import { NextResponse } from "next/server";
import { cancelBooking } from "@/server/bookings/cancel";
import { errorToJson, toAppError } from "@/server/errors";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const booking = await cancelBooking(id, body.reason);
    return NextResponse.json({ data: booking });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(errorToJson(err), { status: err.status });
  }
}
