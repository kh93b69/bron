import { z } from "zod";

export const createBookingSchema = z
  .object({
    club_id: z.string().uuid(),
    station_ids: z.array(z.string().uuid()).min(1).max(10),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), {
    message: "ends_at must be after starts_at",
    path: ["ends_at"],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().max(200).optional(),
});
