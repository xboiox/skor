"use client";

interface SegmentedOption<T> {
  value: T;
  label: string;
  hint?: string;
}

interface SegmentedProps<T extends string | number> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Big tap targets instead of a dropdown (docs/UI_GUIDELINES.md §5.5). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-semibold">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-2"
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl border px-3 py-2 text-center font-bold ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground"
              }`}
            >
              {option.label}
              {option.hint && (
                <span className={`text-xs font-medium ${isSelected ? "opacity-90" : "text-muted"}`}>
                  {option.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
