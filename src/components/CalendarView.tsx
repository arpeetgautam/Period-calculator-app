import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Flower2 } from "lucide-react";
import { format } from "date-fns";
import { formatDate, monthDays } from "../lib/cycle";
import type { CycleEntry, CycleSummary } from "../types";

type Props = {
  entries: CycleEntry[];
  summary: CycleSummary;
  month: Date;
  today: string;
  selectedDate: string;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: string, entry?: CycleEntry) => void;
};

export function CalendarView({
  entries,
  summary,
  month,
  today,
  selectedDate,
  onMonthChange,
  onSelectDate,
}: Props) {
  const days = useMemo(() => monthDays(month), [month]);
  const selectedEntry = entries.find(
    (entry) => entry.startDate <= selectedDate && entry.endDate >= selectedDate,
  );
  const selectedPrediction =
    selectedDate >= summary.nextPeriodDate &&
    selectedDate <= summary.nextPeriodEnd;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR MONTH, AT A GLANCE</span>
          <h1>Cycle calendar</h1>
          <p>Tap a day to add or update an entry.</p>
        </div>
      </div>
      <section
        className="section-panel calendar-panel"
        aria-label="Period calendar"
      >
        <div className="calendar-header">
          <button
            className="month-arrow"
            type="button"
            aria-label="Previous month"
            onClick={() =>
              onMonthChange(
                new Date(month.getFullYear(), month.getMonth() - 1, 1),
              )
            }
          >
            <ChevronLeft size={19} />
          </button>
          <h2 aria-live="polite">{format(month, "MMMM yyyy")}</h2>
          <button
            className="month-arrow"
            type="button"
            aria-label="Next month"
            onClick={() =>
              onMonthChange(
                new Date(month.getFullYear(), month.getMonth() + 1, 1),
              )
            }
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {days.map(({ date, dateKey, inMonth }) => {
            const actual = entries.some(
              (entry) => dateKey >= entry.startDate && dateKey <= entry.endDate,
            );
            const predicted =
              dateKey >= summary.nextPeriodDate &&
              dateKey <= summary.nextPeriodEnd;
            const fertile =
              dateKey >= summary.fertileStart && dateKey <= summary.fertileEnd;
            const ovulation = dateKey === summary.ovulationDate;
            const todayCell = dateKey === today;
            const active = actual
              ? "day-actual"
              : ovulation
                ? "day-ovulation"
                : fertile
                  ? "day-fertile"
                  : predicted
                    ? "day-predicted"
                    : "";
            return (
              <button
                key={dateKey}
                type="button"
                className={`calendar-day ${!inMonth ? "outside-month" : ""} ${active} ${todayCell ? "day-today" : ""} ${selectedDate === dateKey ? "day-selected" : ""}`}
                aria-label={`${format(date, "EEEE, MMMM d, yyyy")}${actual ? ", period logged" : predicted ? ", predicted period" : fertile ? ", estimated fertile window" : ""}${ovulation ? ", estimated ovulation" : ""}${todayCell ? ", today" : ""}`}
                aria-pressed={selectedDate === dateKey}
                onClick={() =>
                  onSelectDate(
                    dateKey,
                    entries.find(
                      (entry) =>
                        dateKey >= entry.startDate && dateKey <= entry.endDate,
                    ),
                  )
                }
              >
                <span>{format(date, "d")}</span>
                {ovulation && (
                  <Flower2
                    size={10}
                    className="ovulation-mark"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span>
            <i className="legend-swatch swatch-actual" />
            Logged period
          </span>
          <span>
            <i className="legend-swatch swatch-predicted" />
            Predicted
          </span>
          <span>
            <i className="legend-swatch swatch-fertile" />
            Fertile window
          </span>
          <span>
            <i className="legend-swatch swatch-ovulation" />
            Ovulation
          </span>
          <span>
            <i className="legend-swatch swatch-today" />
            Today
          </span>
        </div>
      </section>
      <section className="selected-day-panel">
        <div className="selected-day-copy">
          <span className="eyebrow">SELECTED DAY</span>
          <strong>{formatDate(selectedDate, "EEEE, MMMM d")}</strong>
          <small>
            {selectedEntry
              ? "Period recorded"
              : selectedPrediction
                ? "Predicted period day"
                : selectedDate >= summary.fertileStart &&
                    selectedDate <= summary.fertileEnd
                  ? `Estimated fertile window${selectedDate === summary.ovulationDate ? " · ovulation estimate" : ""}`
                  : "No period entry"}
          </small>
        </div>
        <button
          className="secondary-button selected-day-action"
          type="button"
          onClick={() => onSelectDate(selectedDate, selectedEntry)}
        >
          {selectedEntry ? <Flower2 size={16} /> : <ChevronRight size={17} />}
          {selectedEntry ? "Edit entry" : "Add details"}
        </button>
      </section>
      <div className="privacy-inline">
        <span className="calendar-estimate-dot" />
        <span>
          Predictions use your recent logged cycle starts when available,
          otherwise your cycle-length setting.
        </span>
      </div>
    </div>
  );
}
