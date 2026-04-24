import { NextResponse } from "next/server";
import { checkInBooking } from "@/server/bookings/cancel";
import { errorToJson, toAppError } from "@/server/errors";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const booking = await checkInBooking(id);
    return NextResponse.json({ data: booking });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(errorToJson(err), { status: err.status });
  }
}
