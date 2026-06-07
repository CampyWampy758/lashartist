import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { TIME_SLOTS } from "../data/constants.js";
import { supabase, supabaseEnabled } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");
const AVAILABILITY_FILE = path.join(DATA_DIR, "availability.json");

function defaultWeeklySchedule() {
  const schedule = {};
  for (let day = 0; day <= 6; day += 1) {
    schedule[day] = TIME_SLOTS.map((time) => ({
      time,
      available: day >= 2 && day <= 6,
    }));
  }
  return schedule;
}

function scheduleFromRows(rows) {
  const defaults = defaultWeeklySchedule();
  const schedule = {};

  for (let day = 0; day <= 6; day += 1) {
    schedule[day] = TIME_SLOTS.map((time) => {
      const row = rows.find((r) => r.day_of_week === day && r.time_slot === time);
      if (row) {
        return { time, available: Boolean(row.is_available) };
      }
      const fallback = defaults[day].find((s) => s.time === time);
      return { time, available: fallback?.available ?? false };
    });
  }

  return schedule;
}

async function readAvailabilityFile() {
  try {
    const raw = await fs.readFile(AVAILABILITY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schedule: parsed.schedule || null,
      blockedDates: Array.isArray(parsed.blockedDates) ? parsed.blockedDates : [],
    };
  } catch {
    return { schedule: null, blockedDates: [] };
  }
}

async function writeAvailabilityFile(schedule, blockedDates) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    AVAILABILITY_FILE,
    JSON.stringify({ schedule, blockedDates }, null, 2),
    "utf8"
  );
}

async function readScheduleFromSupabase() {
  const { data, error } = await supabase
    .from("availability_slots")
    .select("day_of_week, time_slot, is_available")
    .order("day_of_week")
    .order("time_slot");

  if (error) throw error;
  return scheduleFromRows(data || []);
}

async function writeScheduleToSupabase(updates) {
  const rows = updates.map(({ dayOfWeek, timeSlot, isAvailable }) => ({
    day_of_week: dayOfWeek,
    time_slot: timeSlot,
    is_available: isAvailable,
  }));

  const { error } = await supabase
    .from("availability_slots")
    .upsert(rows, { onConflict: "day_of_week,time_slot" });

  if (error) throw error;
}

export async function getWeeklySchedule() {
  if (supabaseEnabled) {
    try {
      return await readScheduleFromSupabase();
    } catch (err) {
      console.error("Supabase availability read failed, using local file:", err.message);
    }
  }

  const file = await readAvailabilityFile();
  if (file.schedule) return file.schedule;

  return defaultWeeklySchedule();
}

export async function updateWeeklySchedule(updates) {
  const schedule = await getWeeklySchedule();

  for (const { dayOfWeek, timeSlot, isAvailable } of updates) {
    if (schedule[dayOfWeek]) {
      const slot = schedule[dayOfWeek].find((s) => s.time === timeSlot);
      if (slot) slot.available = isAvailable;
    }
  }

  const blockedDates = await getBlockedDates();
  await writeAvailabilityFile(schedule, blockedDates);

  if (supabaseEnabled) {
    try {
      await writeScheduleToSupabase(updates);
    } catch (err) {
      console.error("Supabase availability save failed (saved locally):", err.message);
    }
  }

  return schedule;
}

export async function getBlockedDates() {
  if (supabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from("blocked_dates")
        .select("id, date, reason")
        .order("date");

      if (error) throw error;

      const blockedDates = data.map((row) => ({
        id: row.id,
        date: row.date,
        reason: row.reason || "",
      }));

      const schedule = await getWeeklySchedule();
      await writeAvailabilityFile(schedule, blockedDates);
      return blockedDates;
    } catch (err) {
      console.error("Supabase blocked dates read failed, using local file:", err.message);
    }
  }

  const file = await readAvailabilityFile();
  return file.blockedDates;
}

export async function addBlockedDate(date, reason = "") {
  const blockedDates = await getBlockedDates();
  const existing = blockedDates.find((b) => b.date === date);
  if (existing) return existing;

  if (supabaseEnabled) {
    const { data, error } = await supabase
      .from("blocked_dates")
      .insert({ date, reason })
      .select()
      .single();

    if (error) throw error;

    const blocked = { id: data.id, date: data.date, reason: data.reason || "" };
    const schedule = await getWeeklySchedule();
    await writeAvailabilityFile(schedule, [...blockedDates, blocked]);
    return blocked;
  }

  const blocked = {
    id: `local-${Date.now()}`,
    date,
    reason: reason || "",
  };
  const schedule = await getWeeklySchedule();
  await writeAvailabilityFile(schedule, [...blockedDates, blocked]);
  return blocked;
}

export async function removeBlockedDate(id) {
  const blockedDates = await getBlockedDates();
  const nextBlocked = blockedDates.filter((b) => b.id !== id);

  if (supabaseEnabled) {
    const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
    if (error) throw error;
  }

  const schedule = await getWeeklySchedule();
  await writeAvailabilityFile(schedule, nextBlocked);
}

export function dayOfWeekFromDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).getDay();
}

export async function getAvailableSlotsForDate(date, bookedTimes = []) {
  const schedule = await getWeeklySchedule();
  const blocked = await getBlockedDates();
  const dow = dayOfWeekFromDate(date);

  if (blocked.some((b) => b.date === date)) {
    return TIME_SLOTS.map((time) => ({ time, available: false }));
  }

  const daySlots = schedule[dow] || [];
  return TIME_SLOTS.map((time) => {
    const adminSlot = daySlots.find((s) => s.time === time);
    const adminAvailable = adminSlot ? adminSlot.available : false;
    const notBooked = !bookedTimes.includes(time);
    return { time, available: adminAvailable && notBooked };
  });
}

export async function isSlotAdminAvailable(date, time) {
  const slots = await getAvailableSlotsForDate(date);
  const slot = slots.find((s) => s.time === time);
  return slot?.available ?? false;
}
