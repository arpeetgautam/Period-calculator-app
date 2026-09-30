import type { AppData, CycleEntry } from "../types";

const STORAGE_KEY = "bloom-cycle-data";

export const emptyAppData: AppData = {
  version: 1,
  onboardingComplete: false,
  lastPeriodStart: null,
  averageCycleLength: 28,
  averagePeriodLength: 5,
  entries: [],
  reminders: { period: false, fertile: false, daily: false },
};

function isCycleEntry(value: unknown): value is CycleEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<CycleEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.startDate === "string" &&
    typeof entry.endDate === "string" &&
    Array.isArray(entry.symptoms) &&
    typeof entry.mood === "string" &&
    typeof entry.flow === "string" &&
    typeof entry.note === "string"
  );
}

export function loadAppData(): {
  data: AppData;
  warning: string;
  canWrite: boolean;
} {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { data: emptyAppData, warning: "", canWrite: true };
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid data");
    const candidate = parsed as Partial<AppData>;
    if (
      candidate.version !== 1 ||
      !Array.isArray(candidate.entries) ||
      !candidate.entries.every(isCycleEntry)
    )
      throw new Error("Invalid data");
    if (
      !Number.isInteger(candidate.averageCycleLength) ||
      (candidate.averageCycleLength ?? 0) < 15 ||
      (candidate.averageCycleLength ?? 0) > 60
    )
      throw new Error("Invalid data");
    if (
      !Number.isInteger(candidate.averagePeriodLength) ||
      (candidate.averagePeriodLength ?? 0) < 1 ||
      (candidate.averagePeriodLength ?? 0) > 15
    )
      throw new Error("Invalid data");
    return {
      data: {
        ...emptyAppData,
        ...candidate,
        entries: [...candidate.entries].sort((a, b) =>
          b.startDate.localeCompare(a.startDate),
        ),
        reminders: { ...emptyAppData.reminders, ...candidate.reminders },
      },
      warning: "",
      canWrite: true,
    };
  } catch {
    return {
      data: emptyAppData,
      warning:
        "Saved data could not be read. It has not been overwritten; changes cannot be saved.",
      canWrite: false,
    };
  }
}

export function saveAppData(data: AppData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
