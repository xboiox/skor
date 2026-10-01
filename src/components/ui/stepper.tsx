"use client";

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const buttonClass =
    "flex size-12 items-center justify-center rounded-xl border border-border bg-surface text-2xl font-bold disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className={buttonClass}
        >
          −
        </button>
        <output aria-live="polite" className="tabular w-8 text-center text-2xl font-extrabold">
          {value}
        </output>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className={buttonClass}
        >
          +
        </button>
      </div>
    </div>
  );
}
