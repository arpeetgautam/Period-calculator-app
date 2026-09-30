import { useEffect, useState } from "react";
import { Droplets, Trash2, X } from "lucide-react";
import type { CycleEntry } from "../types";

export type PeriodEntryDraft = Omit<CycleEntry, "id">;
const symptomOptions = [
  "Cramps",
  "Headache",
  "Bloating",
  "Breast tenderness",
  "Acne",
];

type Props = {
  draft: PeriodEntryDraft;
  isEditing: boolean;
  error: string;
  onClose: () => void;
  onSave: (draft: PeriodEntryDraft) => void;
  onDelete?: () => void;
};

export function PeriodEntryDialog({
  draft: initialDraft,
  isEditing,
  error,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState(initialDraft);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  function update<K extends keyof PeriodEntryDraft>(
    key: K,
    value: PeriodEntryDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function toggleSymptom(symptom: string) {
    update(
      "symptoms",
      draft.symptoms.includes(symptom)
        ? draft.symptoms.filter((item) => item !== symptom)
        : [...draft.symptoms, symptom],
    );
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="entry-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-dialog-title"
      >
        <header className="dialog-header">
          <span className="dialog-title-icon">
            <Droplets size={19} />
          </span>
          <div>
            <span className="eyebrow">YOUR PERSONAL LOG</span>
            <h2 id="entry-dialog-title">
              {isEditing ? "Edit period entry" : "Log a period"}
            </h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft);
          }}
        >
          <div className="dialog-fields">
            <label className="form-field">
              <span className="field-label">First day</span>
              <input
                className="form-input"
                type="date"
                max={draft.endDate || undefined}
                value={draft.startDate}
                onChange={(event) => update("startDate", event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span className="field-label">Last day</span>
              <input
                className="form-input"
                type="date"
                min={draft.startDate || undefined}
                value={draft.endDate}
                onChange={(event) => update("endDate", event.target.value)}
                required
              />
            </label>
          </div>
          <fieldset className="dialog-fieldset">
            <legend>
              Symptoms <span>optional</span>
            </legend>
            <div className="symptom-options">
              {symptomOptions.map((symptom) => (
                <button
                  className={`symptom-chip ${draft.symptoms.includes(symptom) ? "symptom-selected" : ""}`}
                  type="button"
                  key={symptom}
                  aria-pressed={draft.symptoms.includes(symptom)}
                  onClick={() => toggleSymptom(symptom)}
                >
                  {draft.symptoms.includes(symptom) && (
                    <span aria-hidden="true">✓</span>
                  )}
                  {symptom}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="dialog-fields">
            <label className="form-field">
              <span className="field-label">Flow intensity</span>
              <select
                className="form-input"
                value={draft.flow}
                onChange={(event) => update("flow", event.target.value)}
              >
                <option value="">Not noted</option>
                <option>Light</option>
                <option>Medium</option>
                <option>Heavy</option>
              </select>
            </label>
            <label className="form-field">
              <span className="field-label">Mood</span>
              <select
                className="form-input"
                value={draft.mood}
                onChange={(event) => update("mood", event.target.value)}
              >
                <option value="">Not noted</option>
                <option>Calm</option>
                <option>Happy</option>
                <option>Low</option>
                <option>Anxious</option>
                <option>Irritable</option>
                <option>Mixed</option>
              </select>
            </label>
          </div>
          <label className="form-field note-field">
            <span className="field-label">
              A note to yourself <span>optional</span>
            </span>
            <textarea
              className="form-input note-input"
              rows={3}
              maxLength={500}
              placeholder="Anything you would like to remember…"
              value={draft.note}
              onChange={(event) => update("note", event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {onDelete && (
              <button
                className="delete-icon-button"
                type="button"
                aria-label="Delete period entry"
                onClick={() => {
                  if (window.confirm("Delete this period entry?")) onDelete();
                }}
              >
                <Trash2 size={17} />
                <span>Delete</span>
              </button>
            )}
            <button className="primary-button dialog-save" type="submit">
              Save entry
            </button>
          </div>
        </form>
        <p className="dialog-private">
          <span className="privacy-lock-dot" /> Stored on this device only
        </p>
      </section>
    </div>
  );
}
