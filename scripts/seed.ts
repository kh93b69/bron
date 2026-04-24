/**
 * Seed тестовых данных для локального Supabase.
 *
 * Запуск:
 *   pnpm supabase start
 *   pnpm seed
 *
 * Создаёт: owner-юзера (owner@cyberbook.local), клуб "Demo Arena", 3 зоны,
 * 40 ПК и одну демо-бронь.
 *
 * Требования env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (локальные defaults ниже).
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // Дефолтный service-role для локального supabase (см. supabase start logs)
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.local";

const OWNER_EMAIL = "owner@cyberbook.local";
const PLAYER_EMAIL = "player@cyberbook.local";

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Owner + player
  const owner = await ensureUser(supabase, OWNER_EMAIL);
  const player = await ensureUser(supabase, PLAYER_EMAIL);

  // 2. Club (idempotent by slug)
  const slug = "demo";
  let { data: club } = await supabase.from("clubs").select("*").eq("slug", slug).maybeSingle();
  if (!club) {
    const { data: created } = await supabase
      .from("clubs")
      .insert({
        slug,
        name: "Demo Arena",
        city: "Алматы",
        address: "ул. Абая, 150",
        contact_phone: "+77011112233",
        open_time: "12:00",
        close_time: "04:00",
        description: "Тестовый клуб для разработки CyberBook",
      })
      .select("*")
      .single();
    club = created!;
    await supabase
      .from("club_members")
      .insert({ club_id: club.id, user_id: owner.id, role: "owner" });
    await supabase.from("club_maps").insert({ club_id: club.id });
    await supabase.from("users").update({ role: "club_admin" }).eq("id", owner.id);
  }

  // 3. Zones
  const zonesDef = [
    { name: "VIP", color: "#F59E0B", price_per_hour: 2500, sort_order: 0 },
    { name: "Bootcamp", color: "#6366F1", price_per_hour: 2000, sort_order: 1 },
    { name: "General", color: "#10B981", price_per_hour: 1200, sort_order: 2 },
  ];
  const zoneIds: Record<string, string> = {};
  for (const z of zonesDef) {
    const { data: existing } = await supabase
      .from("zones")
      .select("id")
      .eq("club_id", club.id)
      .eq("name", z.name)
      .maybeSingle();
    if (existing) {
      zoneIds[z.name] = existing.id;
    } else {
      const { data } = await supabase
        .from("zones")
        .insert({ club_id: club.id, ...z })
        .select("id")
        .single();
      zoneIds[z.name] = data!.id;
    }
  }

  // 4. Stations (8 VIP + 12 Bootcamp + 20 General = 40)
  const stationsDef: Array<{ name: string; zone: string; x: number; y: number }> = [];
  for (let i = 1; i <= 8; i++) stationsDef.push({ name: `VIP-${i}`, zone: "VIP", x: 1 + i, y: 1 });
  for (let i = 1; i <= 12; i++) {
    stationsDef.push({ name: `BC-${i}`, zone: "Bootcamp", x: 1 + ((i - 1) % 6), y: 4 + Math.floor((i - 1) / 6) });
  }
  for (let i = 1; i <= 20; i++) {
    stationsDef.push({ name: `G-${i}`, zone: "General", x: 1 + ((i - 1) % 10), y: 8 + Math.floor((i - 1) / 10) });
  }

  for (const s of stationsDef) {
    await supabase
      .from("stations")
      .upsert(
        {
          club_id: club.id,
          name: s.name,
          zone_id: zoneIds[s.zone]!,
          position_x: s.x,
          position_y: s.y,
          specs: { cpu: "i5-13400F", gpu: "RTX 4060", monitor_hz: 165 },
        },
        { onConflict: "club_id,name" },
      );
  }

  // 5. Демо-бронь на сегодня
  const starts = new Date();
  starts.setHours(starts.getHours() + 2, 0, 0, 0);
  const ends = new Date(starts);
  ends.setHours(ends.getHours() + 2);

  const { data: station } = await supabase
    .from("stations")
    .select("id")
    .eq("club_id", club.id)
    .eq("name", "VIP-1")
    .single();

  const { data: existingBooking } = await supabase
    .from("bookings")
    .select("id")
    .eq("club_id", club.id)
    .eq("user_id", player.id)
    .gte("starts_at", starts.toISOString())
    .limit(1)
    .maybeSingle();

  if (!existingBooking && station) {
    // Обходим RLS через service_key — поэтому напрямую INSERT, не RPC.
    const code = `CB-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const { data: b } = await supabase
      .from("bookings")
      .insert({
        booking_code: code,
        user_id: player.id,
        club_id: club.id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: "confirmed",
        total_amount: 5000,
      })
      .select("id")
      .single();
    if (b) {
      await supabase.from("booking_stations").insert({
        booking_id: b.id,
        station_id: station.id,
        price_amount: 5000,
      });
    }
  }

  console.log("✅ Seed completed");
  console.log(`   Club:    http://localhost:3000/c/${slug}`);
  console.log(`   Owner:   ${OWNER_EMAIL}  (войти через /login → код придёт в Inbucket: http://127.0.0.1:54324)`);
  console.log(`   Player:  ${PLAYER_EMAIL}`);
}

async function ensureUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string; email: string }> {
  const {
    data: { users },
  } = await (supabase as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = users?.find((u: any) => u.email === email);
  if (existing) return { id: existing.id, email };

  const { data, error } = await (supabase as any).auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email };
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
