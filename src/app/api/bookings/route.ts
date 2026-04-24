import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createBooking } from "@/server/bookings/create";
import { createBookingSchema } from "@/server/bookings/schemas";
import { AppErrors, errorToJson, toAppError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = createBookingSchema.parse(json);
    const booking = await createBooking(input);
    return NextResponse.json({ data: booking }, { status: 201 });
  } catch (e) {
    if (e instanceof ZodError) {
      const err = AppErrors.validation(e.flatten().fieldErrors);
      return NextResponse.json(errorToJson(err), { status: err.status });
    }
    const err = toAppError(e);
    return NextResponse.json(errorToJson(err), { status: err.status });
  }
}
