"use client";

import { FieldError } from "@/components/ui/field-error";
import { Segmented } from "@/components/ui/segmented";
import { Stepper } from "@/components/ui/stepper";
import { INPUT_CLASS } from "@/components/ui/styles";
import {
  MAX_COURTS,
  MIN_COURTS,
  RALLY_POINT_OPTIONS,
  TENNIS_GAMES_MAX,
  TENNIS_GAMES_MIN,
  TENNIS_GAMES_PRESETS,
} from "@/lib/validation/tournament";
import type { FormState } from "./form-state";

interface FormatStepProps {
  state: FormState;
  errors: Record<string, string>;
  onChange: (patch: Partial<FormState>) => void;
}

export function FormatStep({ state, errors, onChange }: FormatStepProps) {
  const isCustomGames = !TENNIS_GAMES_PRESETS.some((preset) => preset === state.tennisGames);

  return (
    <div className="flex flex-col gap-6">
      <Segmented
        label="Match type"
        value={state.matchType}
        onChange={(matchType) => onChange({ matchType })}
        options={[
          { value: "americano", label: "Americano", hint: "Rotate partners" },
          { value: "mexicano", label: "Mexicano", hint: "Pair by standings" },
        ]}
      />

      <Stepper
        label="Courts"
        value={state.courts}
        min={MIN_COURTS}
        max={MAX_COURTS}
        onChange={(courts) => onChange({ courts })}
      />

      <Segmented
        label="Scoring"
        value={state.scoringType}
        onChange={(scoringType) => onChange({ scoringType })}
        options={[
          { value: "rally", label: "Rally points", hint: "Every rally scores" },
          { value: "tennis", label: "Tennis", hint: "15 · 30 · 40" },
        ]}
      />

      {state.scoringType === "rally" ? (
        <Segmented
          label="Points per match"
          value={state.totalPoints}
          onChange={(totalPoints) => onChange({ totalPoints })}
          options={RALLY_POINT_OPTIONS.map((points) => ({ value: points, label: String(points) }))}
        />
      ) : (
        <>
          <Segmented
            label="Match length"
            value={state.tennisMode}
            onChange={(tennisMode) => onChange({ tennisMode })}
            options={[
              { value: "first_to", label: "First to X games" },
              { value: "total_of", label: "Total of X games" },
            ]}
          />
          <div className="flex flex-col gap-2">
            <Segmented
              label="X (games)"
              value={isCustomGames ? "custom" : state.tennisGames}
              onChange={(choice) =>
                onChange({ tennisGames: choice === "custom" ? TENNIS_GAMES_MAX : choice })
              }
              options={[
                ...TENNIS_GAMES_PRESETS.map((games) => ({
                  value: games as number | "custom",
                  label: String(games),
                })),
                { value: "custom", label: "Custom" },
              ]}
            />
            {isCustomGames && (
              <label className="flex flex-col gap-1.5">
                <span className="text-muted text-sm">
                  Games ({TENNIS_GAMES_MIN}–{TENNIS_GAMES_MAX})
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={TENNIS_GAMES_MIN}
                  max={TENNIS_GAMES_MAX}
                  value={Number.isNaN(state.tennisGames) ? "" : state.tennisGames}
                  onChange={(e) => onChange({ tennisGames: e.currentTarget.valueAsNumber })}
                  className={INPUT_CLASS}
                />
              </label>
            )}
            <FieldError message={errors["scoring.games"]} />
          </div>
          <Segmented
            label="At 40-40"
            value={state.deuce}
            onChange={(deuce) => onChange({ deuce })}
            options={[
              { value: "golden_point", label: "Golden point", hint: "Next point wins" },
              { value: "advantage", label: "Advantage", hint: "Win by two" },
            ]}
          />
        </>
      )}
    </div>
  );
}
