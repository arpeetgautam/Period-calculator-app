import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  Bell,
  BookOpen,
  CalendarDays,
  ChartColumn,
  ChevronRight,
  CircleHelp,
  Download,
  Droplets,
  Flower2,
  Heart,
  House,
  Info,
  LockKeyhole,
  NotebookPen,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  differenceInDays,
  formatDate,
  getCycleSummary,
  getTodayKey,
} from "./lib/cycle";
import { loadAppData, saveAppData } from "./lib/storage";
import type {
  AppData,
  CycleEntry,
  CycleSummary,
  ReminderName,
  TabName,
} from "./types";
import { CalendarView } from "./components/CalendarView";
import {
  PeriodEntryDialog,
  type PeriodEntryDraft,
} from "./components/PeriodEntryDialog";
import "./theme.css";

const navigation = [
  { id: "home", label: "Home", icon: House },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "track", label: "Track", icon: NotebookPen },
  { id: "insights", label: "Insights", icon: ChartColumn },
  { id: "settings", label: "Settings", icon: BookOpen },
] satisfies { id: TabName; label: string; icon: typeof House }[];
const reminderDetails: {
  id: ReminderName;
  title: string;
  description: string;
}[] = [
  {
    id: "period",
    title: "Upcoming period",
    description: "A heads-up two days before your estimate.",
  },
  {
    id: "fertile",
    title: "Fertile window",
    description: "A reminder when your estimated window begins.",
  },
  {
    id: "daily",
    title: "Daily check-in",
    description: "A nudge to log how you are feeling.",
  },
];

export default function CycleApp() {
  const [saved, setSaved] = useState(() => loadAppData());
  const { data, warning: initialWarning, canWrite } = saved;
  const dataRef = useRef(data);
  const [tab, setTab] = useState<TabName>("home");
  const [today, setToday] = useState(getTodayKey());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [dialog, setDialog] = useState<{
    draft: PeriodEntryDraft;
    entryId?: string;
  } | null>(null);
  const [onboardingDate, setOnboardingDate] = useState("");
  const [onboardingCycle, setOnboardingCycle] = useState("28");
  const [onboardingPeriod, setOnboardingPeriod] = useState("5");
  const [onboardingError, setOnboardingError] = useState("");
  const [formError, setFormError] = useState("");
  const [storageMessage, setStorageMessage] = useState(initialWarning);
  const [permissionMessage, setPermissionMessage] = useState("");
  const summary = useMemo(() => getCycleSummary(data, today), [data, today]);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(getTodayKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      !data.onboardingComplete ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    const untilPeriod = differenceInDays(summary.nextPeriodDate, today);
    const untilFertile = differenceInDays(summary.fertileStart, today);
    const inPeriod = data.entries.some(
      (entry) => entry.startDate <= today && entry.endDate >= today,
    );
    const fired = readNotifiedKeys();
    const notices: { key: string; title: string; body: string }[] = [];
    if (data.reminders.period && untilPeriod === 2)
      notices.push({
        key: `period-${summary.nextPeriodDate}`,
        title: "A little heads-up",
        body: `Your next period is estimated around ${formatDate(summary.nextPeriodDate, "MMM d")}.`,
      });
    if (data.reminders.fertile && untilFertile === 0)
      notices.push({
        key: `fertile-${summary.fertileStart}`,
        title: "Your cycle note",
        body: "Your estimated fertile window begins today.",
      });
    if (data.reminders.daily && !inPeriod && new Date().getHours() >= 20)
      notices.push({
        key: `daily-${today}`,
        title: "A moment for you?",
        body: "Take a moment to note how you are feeling today.",
      });
    for (const notice of notices) {
      if (fired.includes(notice.key)) continue;
      try {
        new Notification(notice.title, { body: notice.body, tag: notice.key });
        window.localStorage.setItem(
          "bloom-notices",
          JSON.stringify([...fired, notice.key]),
        );
      } catch (error) {
        console.warn("A cycle reminder could not be shown.", error);
      }
    }
  }, [data, summary, today]);

  function updateData(updater: (current: AppData) => AppData) {
    const nextData = updater(dataRef.current);
    dataRef.current = nextData;
    setSaved((current) => ({ ...current, data: nextData }));
    if (!canWrite) return;
    try {
      saveAppData(nextData);
      setStorageMessage("");
    } catch {
      setStorageMessage(
        "Your browser could not save this update. Check your device storage settings.",
      );
    }
  }
  function finishOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cycle = Number(onboardingCycle);
    const period = Number(onboardingPeriod);
    if (!onboardingDate || onboardingDate > today)
      return setOnboardingError(
        "Choose a last period start date that is today or earlier.",
      );
    if (!Number.isInteger(cycle) || cycle < 15 || cycle > 60)
      return setOnboardingError("Cycle length must be between 15 and 60 days.");
    if (!Number.isInteger(period) || period < 1 || period > 15)
      return setOnboardingError("Period length must be between 1 and 15 days.");
    updateData((current) => ({
      ...current,
      onboardingComplete: true,
      lastPeriodStart: onboardingDate,
      averageCycleLength: cycle,
      averagePeriodLength: period,
    }));
    setOnboardingError("");
  }
  function openEntry(date: string, entry?: CycleEntry) {
    setSelectedDate(date);
    setFormError("");
    setDialog({
      entryId: entry?.id,
      draft: entry
        ? { ...entry }
        : {
            startDate: date,
            endDate: date,
            symptoms: [],
            mood: "",
            flow: "",
            note: "",
          },
    });
  }
  function saveEntry(draft: PeriodEntryDraft, entryId?: string) {
    if (!draft.startDate || !draft.endDate)
      return setFormError("Add both the first and last day of your period.");
    if (draft.startDate > today || draft.endDate > today)
      return setFormError("Actual period dates cannot be in the future.");
    const duration = differenceInDays(draft.endDate, draft.startDate) + 1;
    if (duration < 1 || duration > 15)
      return setFormError("A recorded period must last between 1 and 15 days.");
    if (
      data.entries.some(
        (entry) =>
          entry.id !== entryId &&
          entry.startDate <= draft.endDate &&
          entry.endDate >= draft.startDate,
      )
    )
      return setFormError(
        "These dates overlap another period entry. Edit that entry or choose different dates.",
      );
    const entry: CycleEntry = { ...draft, id: entryId ?? crypto.randomUUID() };
    updateData((current) => ({
      ...current,
      lastPeriodStart: entry.startDate,
      entries: [
        ...current.entries.filter((item) => item.id !== entry.id),
        entry,
      ].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    }));
    setDialog(null);
    setFormError("");
    setTab("track");
  }
  function deleteEntry(entryId: string) {
    const remaining = data.entries.filter((entry) => entry.id !== entryId);
    updateData((current) => ({
      ...current,
      entries: remaining,
      lastPeriodStart: remaining[0]?.startDate ?? current.lastPeriodStart,
    }));
    setDialog(null);
  }
  async function toggleReminder(id: ReminderName, enabled: boolean) {
    if (enabled) {
      if (!("Notification" in window)) {
        setPermissionMessage(
          "This browser does not support notifications. The tracker works without them.",
        );
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setPermissionMessage(
            "Notifications are off in your browser settings. Your cycle data stays on this device.",
          );
          return;
        }
      } catch {
        setPermissionMessage("Your browser could not enable notifications.");
        return;
      }
      setPermissionMessage("");
    }
    updateData((current) => ({
      ...current,
      reminders: { ...current.reminders, [id]: enabled },
    }));
  }
  function downloadData() {
    const file = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = `bloom-cycle-data-${today}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  function deleteAllData() {
    if (
      !window.confirm(
        "Delete all period entries, notes, and cycle settings from this device? This cannot be undone.",
      )
    )
      return;
    try {
      window.localStorage.removeItem("bloom-cycle-data");
      window.localStorage.removeItem("bloom-notices");
      const resetData = loadAppData().data;
      dataRef.current = resetData;
      setSaved({ data: resetData, warning: "", canWrite: true });
      setTab("home");
      setStorageMessage("");
    } catch {
      setStorageMessage(
        "This browser would not delete the saved data. Check your device storage settings.",
      );
    }
  }
  function editLastPeriod() {
    if (data.entries[0]) {
      openEntry(data.entries[0].startDate, data.entries[0]);
      return;
    }
    setOnboardingDate(data.lastPeriodStart ?? today);
    setOnboardingCycle(String(data.averageCycleLength));
    setOnboardingPeriod(String(data.averagePeriodLength));
    updateData((current) => ({ ...current, onboardingComplete: false }));
  }

  if (!data.onboardingComplete)
    return (
      <main className="onboarding-shell">
        <section className="onboarding-panel" aria-labelledby="welcome-title">
          <div className="brand-lockup">
            <span className="brand-mark">
              <Flower2 size={22} />
            </span>
            <span>bloom</span>
          </div>
          <div className="onboarding-copy">
            <span className="eyebrow">A LITTLE MORE IN TUNE</span>
            <h1 id="welcome-title">
              Your cycle,
              <br />
              on your terms.
            </h1>
            <p>
              A private, low-pressure place to understand your cycle, one day at
              a time.
            </p>
          </div>
          <form
            className="onboarding-form"
            onSubmit={finishOnboarding}
            noValidate
          >
            <label className="field-label" htmlFor="last-period">
              When did your last period start?
            </label>
            <input
              id="last-period"
              className="form-input"
              type="date"
              max={today}
              required
              value={onboardingDate}
              onChange={(event) => setOnboardingDate(event.target.value)}
            />
            <div className="form-grid">
              <label className="form-field">
                <span className="field-label">Cycle length</span>
                <span className="input-with-unit">
                  <input
                    className="form-input"
                    type="number"
                    min="15"
                    max="60"
                    step="1"
                    inputMode="numeric"
                    value={onboardingCycle}
                    onChange={(event) => setOnboardingCycle(event.target.value)}
                  />
                  <span>days</span>
                </span>
              </label>
              <label className="form-field">
                <span className="field-label">Period length</span>
                <span className="input-with-unit">
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="15"
                    step="1"
                    inputMode="numeric"
                    value={onboardingPeriod}
                    onChange={(event) =>
                      setOnboardingPeriod(event.target.value)
                    }
                  />
                  <span>days</span>
                </span>
              </label>
            </div>
            {onboardingError && (
              <p className="form-error" role="alert">
                {onboardingError}
              </p>
            )}
            <button className="primary-button onboarding-submit" type="submit">
              See my cycle <ChevronRight size={18} />
            </button>
            <p className="privacy-footnote">
              <LockKeyhole size={15} /> Your data stays in this browser, on this
              device.
            </p>
          </form>
          <p className="disclaimer-inline">
            Your cycle can vary. These calendar-based estimates are not medical
            predictions or contraception.
          </p>
        </section>
      </main>
    );

  const page =
    tab === "home" ? (
      <HomeView
        data={data}
        summary={summary}
        today={today}
        onLog={() => openEntry(today)}
        onCalendar={() => setTab("calendar")}
      />
    ) : tab === "calendar" ? (
      <CalendarView
        entries={data.entries}
        summary={summary}
        month={calendarMonth}
        today={today}
        selectedDate={selectedDate}
        onMonthChange={setCalendarMonth}
        onSelectDate={(date, entry) => openEntry(date, entry)}
      />
    ) : tab === "track" ? (
      <TrackView
        entries={data.entries}
        onLog={() => openEntry(today)}
        onEdit={(entry) => openEntry(entry.startDate, entry)}
      />
    ) : tab === "insights" ? (
      <InsightsView summary={summary} entries={data.entries} />
    ) : (
      <SettingsView
        data={data}
        onCycleLength={(value) =>
          updateData((current) => ({ ...current, averageCycleLength: value }))
        }
        onPeriodLength={(value) =>
          updateData((current) => ({ ...current, averagePeriodLength: value }))
        }
        onReminder={toggleReminder}
        onExport={downloadData}
        onDelete={deleteAllData}
        onEditLastPeriod={editLastPeriod}
        permissionMessage={permissionMessage}
      />
    );

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand-lockup brand-button"
          type="button"
          onClick={() => setTab("home")}
          aria-label="Bloom home"
        >
          <span className="brand-mark">
            <Flower2 size={19} />
          </span>
          <span>bloom</span>
        </button>
        <p className="topbar-date">{formatDate(today, "EEEE, MMMM d")}</p>
        <button
          className="topbar-icon"
          type="button"
          aria-label="Settings"
          onClick={() => setTab("settings")}
        >
          <CircleHelp size={19} />
        </button>
      </header>
      <main className="main-content" key={tab}>
        {storageMessage && (
          <div className="storage-alert" role="status">
            <Info size={17} />
            <span>{storageMessage}</span>
            <button
              aria-label="Dismiss message"
              type="button"
              onClick={() => setStorageMessage("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {page}
        <p className="disclaimer">
          Period and fertile-window dates are estimates. Menstrual cycles can
          vary, and this app should not be used as a method of contraception or
          for medical diagnosis.
        </p>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${tab === id ? "is-active" : ""}`}
            type="button"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={19} strokeWidth={tab === id ? 2.25 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {dialog && (
        <PeriodEntryDialog
          draft={dialog.draft}
          isEditing={Boolean(dialog.entryId)}
          error={formError}
          onClose={() => {
            setDialog(null);
            setFormError("");
          }}
          onSave={(draft) => saveEntry(draft, dialog.entryId)}
          onDelete={
            dialog.entryId ? () => deleteEntry(dialog.entryId!) : undefined
          }
        />
      )}
    </div>
  );
}

function HomeView({
  data,
  summary,
  today,
  onLog,
  onCalendar,
}: {
  data: AppData;
  summary: CycleSummary;
  today: string;
  onLog: () => void;
  onCalendar: () => void;
}) {
  const until = differenceInDays(summary.nextPeriodDate, today);
  const countdown =
    until > 0
      ? `in ${until} ${until === 1 ? "day" : "days"}`
      : until === 0
        ? "expected today"
        : `${Math.abs(until)} ${Math.abs(until) === 1 ? "day" : "days"} past the estimate`;
  const progress = Math.min(
    100,
    Math.max(5, (summary.cycleDay / summary.averageCycleLength) * 100),
  );
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{formatDate(today, "EEEE, MMMM d")}</span>
          <h1>Good to have you here.</h1>
          <p>Your cycle, at a glance.</p>
        </div>
        <button
          className="secondary-button log-desktop"
          type="button"
          onClick={onLog}
        >
          <Plus size={17} /> Log period
        </button>
      </div>
      <section className="hero-card" aria-label="Next period estimate">
        <div className="hero-card-copy">
          <span className="hero-kicker">
            <Flower2 size={15} /> YOUR CYCLE
          </span>
          <h2>
            Your next period
            <br />
            is <strong>{countdown}</strong>
          </h2>
          <p>
            Estimated start · {formatDate(summary.nextPeriodDate, "MMMM d")}
          </p>
          <button className="hero-link" type="button" onClick={onCalendar}>
            View calendar <ChevronRight size={15} />
          </button>
        </div>
        <div className="cycle-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring-one" />
          <div className="orbit-ring orbit-ring-two" />
          <div className="orbit-core">
            <span>DAY</span>
            <strong>{summary.cycleDay}</strong>
          </div>
          <span className="orbit-dot" />
          <span className="orbit-flower">
            <Flower2 size={23} />
          </span>
        </div>
        <span className="hero-note">
          <Info size={14} /> An estimate, not a promise
        </span>
      </section>
      <section className="stat-grid" aria-label="Cycle details">
        <article className="stat-card">
          <span className="stat-icon stat-icon-rose">
            <CalendarDays size={18} />
          </span>
          <span className="stat-label">NEXT PERIOD</span>
          <strong>{formatDate(summary.nextPeriodDate, "MMM d")}</strong>
          <span className="stat-foot">
            through {formatDate(summary.nextPeriodEnd, "MMM d")}
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-icon-lilac">
            <Activity size={18} />
          </span>
          <span className="stat-label">CYCLE DAY</span>
          <strong>Day {summary.cycleDay}</strong>
          <span className="stat-foot">
            of about {summary.averageCycleLength} days
          </span>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-icon-peach">
            <Flower2 size={18} />
          </span>
          <span className="stat-label">FERTILE WINDOW</span>
          <strong>
            {formatDate(summary.fertileStart, "MMM d")}–
            {formatDate(summary.fertileEnd, "d")}
          </strong>
          <span className="stat-foot">
            Estimated ovulation {formatDate(summary.ovulationDate, "MMM d")}
          </span>
        </article>
      </section>
      <section className="home-lower">
        <div className="section-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">WHERE YOU ARE</span>
              <h2>This cycle</h2>
            </div>
            <button className="text-button" type="button" onClick={onCalendar}>
              Open calendar <ChevronRight size={15} />
            </button>
          </div>
          <div className="cycle-progress">
            <div className="progress-labels">
              <span>Period</span>
              <span>Today · day {summary.cycleDay}</span>
              <span>Next period</span>
            </div>
            <div className="progress-track">
              <span
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
              <span
                className="progress-marker"
                style={{ left: `${progress}%` }}
              />
            </div>
            <div className="progress-dates">
              <span>{formatDate(summary.lastPeriodStart, "MMM d")}</span>
              <span>{formatDate(summary.nextPeriodDate, "MMM d")}</span>
            </div>
          </div>
          <div className="estimate-callout">
            <Info size={17} />
            <p>
              Calendar-based estimates can shift from cycle to cycle. Your
              logged dates help make future estimates more personal.
            </p>
          </div>
        </div>
        <div className="section-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">A SMALL CHECK-IN</span>
              <h2>How are you feeling?</h2>
            </div>
            <span className="mood-sparkle">
              <Heart size={18} />
            </span>
          </div>
          <p className="panel-subtitle">
            A note to yourself can be useful later. Only share what feels right.
          </p>
          <button className="quick-log-button" type="button" onClick={onLog}>
            <span className="quick-log-icon">
              <Plus size={18} />
            </span>
            <span>
              <strong>Log a period and symptoms</strong>
              <small>Notes stay private on this device</small>
            </span>
            <ChevronRight className="quick-chevron" size={18} />
          </button>
          <p className="cycle-source">
            {data.entries.length >= 2
              ? "Using your recent logged cycles"
              : "Using your cycle-length estimate"}
          </p>
        </div>
      </section>
    </div>
  );
}

function TrackView({
  entries,
  onLog,
  onEdit,
}: {
  entries: CycleEntry[];
  onLog: () => void;
  onEdit: (entry: CycleEntry) => void;
}) {
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL RECORD</span>
          <h1>Track your cycle</h1>
          <p>Period dates, symptoms, and notes. Just for you.</p>
        </div>
        <button
          className="secondary-button log-desktop"
          type="button"
          onClick={onLog}
        >
          <Plus size={17} /> Log period
        </button>
      </div>
      <section className="section-panel track-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">PERIOD HISTORY</span>
            <h2>Your entries</h2>
          </div>
          <span className="entry-count">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        {entries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Droplets size={23} />
            </span>
            <h3>A fresh start</h3>
            <p>
              Your past periods will appear here. Adding an entry helps you see
              patterns over time.
            </p>
            <button className="primary-button" type="button" onClick={onLog}>
              <Plus size={17} /> Log your first period
            </button>
          </div>
        ) : (
          <div className="entry-list">
            {entries.map((entry, index) => (
              <button
                className="entry-row"
                type="button"
                key={entry.id}
                onClick={() => onEdit(entry)}
              >
                <span
                  className={`entry-date-icon ${index === 0 ? "entry-date-current" : ""}`}
                >
                  <Droplets size={18} />
                </span>
                <span className="entry-main">
                  <strong>
                    {formatDate(entry.startDate, "MMM d")} –{" "}
                    {formatDate(entry.endDate, "MMM d, yyyy")}
                  </strong>
                  <small>
                    {differenceInDays(entry.endDate, entry.startDate) + 1} days
                    {entry.flow ? ` · ${entry.flow.toLowerCase()} flow` : ""}
                    {entry.mood ? ` · ${entry.mood}` : ""}
                  </small>
                  {entry.symptoms.length > 0 && (
                    <small className="entry-symptoms">
                      {entry.symptoms.join(" · ")}
                    </small>
                  )}
                  {entry.note && (
                    <small className="entry-note">“{entry.note}”</small>
                  )}
                </span>
                <ChevronRight size={17} className="entry-chevron" />
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="privacy-inline">
        <ShieldCheck size={18} />
        <span>
          <strong>Your entries are yours.</strong> Stored in this browser and
          never sent to an account or server.
        </span>
      </div>
    </div>
  );
}

function InsightsView({
  summary,
  entries,
}: {
  summary: CycleSummary;
  entries: CycleEntry[];
}) {
  const durations = entries.map(
    (entry) => differenceInDays(entry.endDate, entry.startDate) + 1,
  );
  const periodAverage = durations.length
    ? Math.round(
        durations.reduce((sum, value) => sum + value, 0) / durations.length,
      )
    : summary.averagePeriodLength;
  const recent = summary.cycleLengths.slice(-6);
  const min = recent.length ? Math.min(...recent) : null;
  const max = recent.length ? Math.max(...recent) : null;
  const variation = recent.length > 1 ? max! - min! : null;
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">A GENTLE LOOK BACK</span>
          <h1>Your cycle, over time.</h1>
          <p>Patterns from the dates you have recorded.</p>
        </div>
      </div>
      <section className="insight-stats">
        <article className="insight-stat">
          <span className="insight-icon insight-icon-rose">
            <Activity size={18} />
          </span>
          <span className="stat-label">AVERAGE CYCLE</span>
          <strong>
            {summary.averageCycleLength}
            <small> days</small>
          </strong>
          <span className="stat-foot">
            {summary.cycleLengths.length
              ? "From recent logged starts"
              : "Your current estimate"}
          </span>
        </article>
        <article className="insight-stat">
          <span className="insight-icon insight-icon-peach">
            <Droplets size={18} />
          </span>
          <span className="stat-label">AVERAGE PERIOD</span>
          <strong>
            {periodAverage}
            <small> days</small>
          </strong>
          <span className="stat-foot">
            {durations.length ? "From logged periods" : "Your current estimate"}
          </span>
        </article>
        <article className="insight-stat">
          <span className="insight-icon insight-icon-lilac">
            <ChartColumn size={18} />
          </span>
          <span className="stat-label">RECENT RANGE</span>
          <strong>
            {min && max ? `${min}–${max}` : "—"}
            <small>{min ? " days" : ""}</small>
          </strong>
          <span className="stat-foot">Shortest to longest cycle</span>
        </article>
      </section>
      <section className="section-panel regularity-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">CYCLE LENGTHS</span>
            <h2>A little perspective</h2>
          </div>
          <span className="chart-unit">DAYS</span>
        </div>
        {recent.length < 2 ? (
          <div className="insight-empty">
            <span className="empty-icon">
              <ChartColumn size={22} />
            </span>
            <div>
              <strong>Your pattern is taking shape</strong>
              <p>
                Log at least two periods to compare the time between cycle
                starts.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div
              className="bar-chart"
              role="img"
              aria-label={`Cycle lengths in days: ${recent.map((value) => `${value} days`).join(", ")}`}
            >
              <div className="chart-grid-lines">
                <span>{Math.ceil((max ?? 35) / 5) * 5}</span>
                <span>{Math.floor((min ?? 20) / 5) * 5}</span>
              </div>
              {recent.map((length, index) => (
                <div className="chart-column" key={`${length}-${index}`}>
                  <strong>{length}</strong>
                  <span
                    className="chart-bar"
                    style={{
                      height: `${Math.max(24, Math.min(100, (length / Math.max(max ?? 35, 1)) * 100))}%`,
                    }}
                  />
                  <small>
                    {formatDate(
                      summary.cycleStartDates[index] ?? summary.lastPeriodStart,
                      "MMM d",
                    )}
                  </small>
                </div>
              ))}
            </div>
            <div className="regularity-note">
              <span
                className={`regularity-dot ${variation !== null && variation <= 7 ? "regularity-calm" : ""}`}
              />
              <p>
                Your recent cycles have varied by about {variation}{" "}
                {variation === 1 ? "day" : "days"}. Variation is common. This is
                a calendar summary, not a medical assessment.
              </p>
            </div>
          </>
        )}
      </section>
      <section className="section-panel history-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">RECENT CYCLES</span>
            <h2>From your history</h2>
          </div>
          <span className="entry-count">{entries.length} logged</span>
        </div>
        {entries.length === 0 ? (
          <p className="history-empty">
            Your cycle history will build as you add period dates.
          </p>
        ) : (
          <div className="history-list">
            {entries.slice(0, 8).map((entry, index) => {
              const later = entries[index - 1];
              const length = later
                ? differenceInDays(later.startDate, entry.startDate)
                : null;
              return (
                <div className="history-row" key={entry.id}>
                  <span className="history-marker" />
                  <span className="history-date">
                    {formatDate(entry.startDate, "MMM d, yyyy")}
                  </span>
                  <span className="history-duration">
                    Period ·{" "}
                    {differenceInDays(entry.endDate, entry.startDate) + 1} days
                  </span>
                  <span className="history-length">
                    {length ? `${length} day cycle` : "Latest"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <div className="privacy-inline">
        <Info size={17} />
        <span>
          Cycle lengths naturally vary. These insights are descriptive only, not
          a diagnosis or health assessment.
        </span>
      </div>
    </div>
  );
}

function SettingsView({
  data,
  onCycleLength,
  onPeriodLength,
  onReminder,
  onExport,
  onDelete,
  onEditLastPeriod,
  permissionMessage,
}: {
  data: AppData;
  onCycleLength: (value: number) => void;
  onPeriodLength: (value: number) => void;
  onReminder: (id: ReminderName, enabled: boolean) => void;
  onExport: () => void;
  onDelete: () => void;
  onEditLastPeriod: () => void;
  permissionMessage: string;
}) {
  const [cycleInput, setCycleInput] = useState(String(data.averageCycleLength));
  const [periodInput, setPeriodInput] = useState(
    String(data.averagePeriodLength),
  );
  function updateSetting(
    raw: string,
    min: number,
    max: number,
    update: (value: number) => void,
    reset: (value: string) => void,
  ) {
    const value = Number(raw);
    if (Number.isInteger(value) && value >= min && value <= max) update(value);
    else reset(String(min));
  }
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SPACE, YOUR WAY</span>
          <h1>Settings & privacy</h1>
          <p>Keep your estimates and reminders feeling right for you.</p>
        </div>
      </div>
      <section className="section-panel settings-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">CYCLE BASELINE</span>
            <h2>Your usual cycle</h2>
          </div>
          <span className="settings-icon">
            <Activity size={18} />
          </span>
        </div>
        <p className="settings-description">
          When there is not enough history, we use these averages for estimates.
        </p>
        <div className="settings-field-row">
          <label htmlFor="setting-cycle">Average cycle length</label>
          <span className="settings-control">
            <input
              id="setting-cycle"
              type="number"
              min="15"
              max="60"
              value={cycleInput}
              onChange={(event) => setCycleInput(event.target.value)}
              onBlur={() =>
                updateSetting(cycleInput, 15, 60, onCycleLength, setCycleInput)
              }
              onKeyDown={(event) =>
                event.key === "Enter" &&
                updateSetting(cycleInput, 15, 60, onCycleLength, setCycleInput)
              }
            />
            <span>days</span>
          </span>
        </div>
        <div className="settings-field-row">
          <label htmlFor="setting-period">Average period length</label>
          <span className="settings-control">
            <input
              id="setting-period"
              type="number"
              min="1"
              max="15"
              value={periodInput}
              onChange={(event) => setPeriodInput(event.target.value)}
              onBlur={() =>
                updateSetting(
                  periodInput,
                  1,
                  15,
                  onPeriodLength,
                  setPeriodInput,
                )
              }
              onKeyDown={(event) =>
                event.key === "Enter" &&
                updateSetting(
                  periodInput,
                  1,
                  15,
                  onPeriodLength,
                  setPeriodInput,
                )
              }
            />
            <span>days</span>
          </span>
        </div>
        <p className="settings-hint">
          Cycle lengths can vary. You can update these any time.
        </p>
        <button
          className="quiet-button baseline-edit"
          type="button"
          onClick={onEditLastPeriod}
        >
          Edit last period date
        </button>
      </section>
      <section className="section-panel reminders-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">OPTIONAL</span>
            <h2>Reminders</h2>
          </div>
          <span className="settings-icon">
            <Bell size={18} />
          </span>
        </div>
        <p className="settings-description">
          Browser notifications are checked when you open Bloom. They may not
          appear while the app is closed.
        </p>
        {reminderDetails.map((reminder) => (
          <label className="reminder-row" key={reminder.id}>
            <span className="reminder-copy">
              <strong>{reminder.title}</strong>
              <small>{reminder.description}</small>
            </span>
            <span className="toggle-wrap">
              <input
                className="toggle-input"
                type="checkbox"
                checked={data.reminders[reminder.id]}
                onChange={(event) =>
                  onReminder(reminder.id, event.target.checked)
                }
                aria-label={`${reminder.title} reminders`}
              />
              <span className="toggle-track" />
            </span>
          </label>
        ))}
        {permissionMessage && (
          <p className="form-hint" role="status">
            {permissionMessage}
          </p>
        )}
      </section>
      <section className="section-panel privacy-panel">
        <div className="section-title">
          <div>
            <span className="eyebrow">BUILT FOR PRIVACY</span>
            <h2>Your data stays yours.</h2>
          </div>
          <span className="settings-icon">
            <ShieldCheck size={19} />
          </span>
        </div>
        <p className="privacy-body">
          Bloom does not need your name, an account, or a health profile. Your
          period dates, symptoms, settings, and notes are saved only in this
          browser's local storage on this device. They are not sent to a server.
          Anyone with access to this browser profile may be able to see them.
        </p>
        <button className="secondary-button" type="button" onClick={onExport}>
          <Download size={16} /> Export my data
        </button>
      </section>
      <section className="section-panel disclaimer-panel">
        <Info size={17} />
        <div>
          <strong>A note about estimates</strong>
          <p>
            Period and fertile-window dates are estimates. Menstrual cycles can
            vary, and this app should not be used as a method of contraception
            or for medical diagnosis.
          </p>
        </div>
      </section>
      <section className="danger-zone">
        <div>
          <strong>Delete all your data</strong>
          <p>
            Remove every period entry, note, and setting saved in this browser.
          </p>
        </div>
        <button className="delete-button" type="button" onClick={onDelete}>
          <Trash2 size={16} /> Delete data
        </button>
      </section>
    </div>
  );
}

function readNotifiedKeys(): string[] {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem("bloom-notices") ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
