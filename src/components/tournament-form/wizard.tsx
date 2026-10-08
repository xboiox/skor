"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FieldError } from "@/components/ui/field-error";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/components/ui/styles";
import { useHydrated } from "@/hooks/use-hydrated";
import { apiRequest } from "@/lib/api-client";
import { CreatedScreen, type CreatedTournament } from "./created-screen";
import {
  browserStorage,
  clearDraft,
  parseDraft,
  readDraftSnapshot,
  saveDraft,
} from "./draft-storage";
import { FormatStep } from "./format-step";
import { initialFormState, stepErrors, STEPS, toCreateInput, type FormState } from "./form-state";
import { PlayersStep } from "./players-step";
import { ReviewStep } from "./review-step";

interface WizardProps {
  today: string;
  isSignedIn: boolean;
}

const LAST_STEP = STEPS.length - 1;
const noSubscription = () => () => {};

export function CreateTournamentWizard({ today, isSignedIn }: WizardProps) {
  const [state, setState] = useState<FormState>(() => initialFormState(today));
  const [step, setStep] = useState(0);
  const [shownStep, setShownStep] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedTournament | null>(null);
  const isHydrated = useHydrated();
  // Restore the form after a detour to log in ("Log in to keep it"). The stored draft is read as an
  // external store: null during SSR/hydration (HTML matches), then applied once in render.
  const draftSnapshot = useSyncExternalStore(noSubscription, readDraftSnapshot, () => null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  if (isHydrated && !isDraftLoaded) {
    const draft = parseDraft(draftSnapshot);
    if (draft) {
      setState(draft.state);
      setStep(draft.step);
    }
    setIsDraftLoaded(true);
  }

  useEffect(() => {
    const storage = browserStorage();
    if (isDraftLoaded && !created && storage) saveDraft(storage, state, step);
  }, [isDraftLoaded, created, state, step]);

  const errors = shownStep === step ? stepErrors(state, step) : {};
  const update = (patch: Partial<FormState>) => setState((current) => ({ ...current, ...patch }));

  async function next() {
    if (Object.keys(stepErrors(state, step)).length > 0) {
      setShownStep(step);
      return;
    }
    setShownStep(null);
    if (step < LAST_STEP) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    const result = await apiRequest<CreatedTournament>("/api/tournaments", {
      method: "POST",
      body: toCreateInput(state),
    });
    setIsSubmitting(false);
    if (result.success) {
      const storage = browserStorage();
      if (storage) clearDraft(storage);
      setCreated(result.data);
    } else setSubmitError(result.error.message);
  }

  if (created) return <CreatedScreen name={state.name.trim()} created={created} />;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6">
        <div>
          <p className="text-muted text-sm font-semibold">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">New tournament</h1>
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">Tournament name</span>
              <input
                value={state.name}
                maxLength={100}
                onChange={(e) => update({ name: e.currentTarget.value })}
                placeholder="Friday Americano"
                className={INPUT_CLASS}
              />
              <FieldError message={errors.name} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-semibold">Date</span>
              <input
                type="date"
                value={state.date}
                onChange={(e) => update({ date: e.currentTarget.value })}
                className={INPUT_CLASS}
              />
              <FieldError message={errors.date} />
            </label>
          </div>
        )}
        {step === 1 && <FormatStep state={state} errors={errors} onChange={update} />}
        {step === 2 && (
          <PlayersStep
            state={state}
            error={errors.players}
            onChange={(players) => update({ players })}
          />
        )}
        {step === LAST_STEP && <ReviewStep state={state} errors={errors} isSignedIn={isSignedIn} />}

        <FieldError message={submitError ?? undefined} />
      </div>

      <div className="pb-safe border-border bg-background/95 sticky bottom-0 -mx-4 mt-6 flex gap-3 border-t px-4 pt-3 backdrop-blur">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className={`${SECONDARY_BUTTON_CLASS} w-28`}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={isSubmitting || !isHydrated}
          className={PRIMARY_BUTTON_CLASS}
        >
          {step < LAST_STEP ? "Next" : isSubmitting ? "Creating…" : "Create tournament"}
        </button>
      </div>
    </div>
  );
}
