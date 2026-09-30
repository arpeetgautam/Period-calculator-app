import {
  addDays as addCalendarDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { AppData, CycleSummary } from "../types";

export function getTodayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function addDays(dateKey: string, amount: number): string {
  return format(addCalendarDays(parseISO(dateKey), amount), "yyyy-MM-dd");
}

export function differenceInDays(later: string, earlier: string): number {
  return differenceInCalendarDays(parseISO(later), parseISO(earlier));
}

export function formatDate(dateKey: string, pattern: string): string {
  return format(parseISO(dateKey), pattern);
}

export function monthDays(
  month: Date,
): { date: Date; dateKey: string; inMonth: boolean }[] {
  const first = startOfMonth(month);
  const dates = eachDayOfInterval({
    start: startOfWeek(first),
    end: endOfWeek(endOfMonth(month)),
  });
  return dates.map((date) => ({
    date,
    dateKey: format(date, "yyyy-MM-dd"),
    inMonth: isSameMonth(date, month),
  }));
}

export function getCycleSummary(data: AppData, today: string): CycleSummary {
  const chronological = [...data.entries].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  const cycleLengths = chronological
    .slice(1)
    .map((entry, index) =>
      differenceInDays(entry.startDate, chronological[index].startDate),
    );
  const recentLengths = cycleLengths.slice(-6);
  const averageCycleLength = recentLengths.length
    ? Math.round(
        recentLengths.reduce((sum, length) => sum + length, 0) /
          recentLengths.length,
      )
    : data.averageCycleLength;
  const periodLengths = chronological
    .slice(-6)
    .map((entry) => differenceInDays(entry.endDate, entry.startDate) + 1);
  const averagePeriodLength = periodLengths.length
    ? Math.max(
        1,
        Math.round(
          periodLengths.reduce((sum, length) => sum + length, 0) /
            periodLengths.length,
        ),
      )
    : data.averagePeriodLength;
  const lastPeriodStart =
    data.entries[0]?.startDate ?? data.lastPeriodStart ?? today;
  const nextPeriodDate = addDays(lastPeriodStart, averageCycleLength);
  const ovulationDate = addDays(nextPeriodDate, -14);

  return {
    lastPeriodStart,
    nextPeriodDate,
    nextPeriodEnd: addDays(nextPeriodDate, averagePeriodLength - 1),
    ovulationDate,
    fertileStart: addDays(ovulationDate, -5),
    fertileEnd: addDays(ovulationDate, 1),
    cycleDay: Math.max(1, differenceInDays(today, lastPeriodStart) + 1),
    averageCycleLength,
    averagePeriodLength,
    cycleLengths: recentLengths,
    cycleStartDates: chronological
      .slice(1)
      .map((entry) => entry.startDate)
      .slice(-6),
  };
}
