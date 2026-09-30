export type TabName = "home" | "calendar" | "track" | "insights" | "settings";
export type ReminderName = "period" | "fertile" | "daily";

export type CycleEntry = {
  id: string;
  startDate: string;
  endDate: string;
  symptoms: string[];
  mood: string;
  flow: string;
  note: string;
};

export type AppData = {
  version: 1;
  onboardingComplete: boolean;
  lastPeriodStart: string | null;
  averageCycleLength: number;
  averagePeriodLength: number;
  entries: CycleEntry[];
  reminders: Record<ReminderName, boolean>;
};

export type CycleSummary = {
  lastPeriodStart: string;
  nextPeriodDate: string;
  nextPeriodEnd: string;
  ovulationDate: string;
  fertileStart: string;
  fertileEnd: string;
  cycleDay: number;
  averageCycleLength: number;
  averagePeriodLength: number;
  cycleLengths: number[];
  cycleStartDates: string[];
};
