"use client";

import { useState } from "react";
import type { LeaderboardRow } from "@/domain/leaderboard";
import type { HistoryEntry } from "@/server/tournaments/standings";

interface LeaderboardTableProps {
  rows: readonly LeaderboardRow[];
  usesAverage: boolean;
  histories: Readonly<Record<string, readonly HistoryEntry[]>>;
  meId: string | null;
}

const LABEL_TEXT = { withdrawn: "Withdrawn", substitute: "Sub" } as const;
const AVG_DIGITS = 1;

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * Narrow screens show #, Player, P, Won, Diff; wider screens add Lost and Avg.
 * Tapping a row reveals the details and the player's matches (docs/UI_GUIDELINES.md §5.4).
 */
export function LeaderboardTable({ rows, usesAverage, histories, meId }: LeaderboardTableProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const grid =
    "grid grid-cols-[2.5rem_1fr_2rem_3rem_3rem] items-center gap-2 sm:grid-cols-[2.5rem_1fr_2.5rem_3.5rem_3.5rem_3.5rem_3.5rem]";
  const wide = "hidden sm:block text-right";

  return (
    <div className="flex flex-col gap-2">
      <div
        role="row"
        className={`${grid} text-muted px-3 text-xs font-bold tracking-wide uppercase`}
      >
        <span role="columnheader">#</span>
        <span role="columnheader">Player</span>
        <span role="columnheader" className="text-right" title="Played">
          P
        </span>
        <span role="columnheader" className="text-right">
          {usesAverage ? "Avg" : "Won"}
        </span>
        <span role="columnheader" className="text-right">
          Diff
        </span>
        <span role="columnheader" className={wide}>
          {usesAverage ? "Won" : "Avg"}
        </span>
        <span role="columnheader" className={wide}>
          Lost
        </span>
      </div>

      <ol className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const isOpen = openId === row.playerId;
          const isMe = row.playerId === meId;
          const avg = row.avgWon.toFixed(AVG_DIGITS);
          const history = histories[row.playerId] ?? [];
          return (
            <li
              key={row.playerId}
              className={`bg-surface rounded-xl border ${isMe ? "border-primary border-2" : "border-border"} ${
                row.isProvisional ? "opacity-75" : ""
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? null : row.playerId)}
                className={`${grid} tabular min-h-14 w-full px-3 py-2 text-left`}
              >
                <span className="text-lg font-extrabold">
                  {row.rank}
                  {row.isSharedRank && <span aria-label=" shared">=</span>}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-bold">
                    {row.name}
                    {isMe && <span className="text-primary ml-1.5 text-xs">You</span>}
                  </span>
                  <span className="text-muted flex gap-1.5 text-xs">
                    {row.label && (
                      <span className="border-border rounded border px-1">
                        {LABEL_TEXT[row.label]}
                      </span>
                    )}
                    {row.isProvisional && (
                      <span title="Includes results not yet approved">⏱ live</span>
                    )}
                  </span>
                </span>
                <span className="text-right">{row.played}</span>
                <span className="text-right text-lg font-extrabold">
                  {usesAverage ? avg : row.pointsWon}
                </span>
                <span className="text-right font-semibold">{signed(row.diff)}</span>
                <span className={wide}>{usesAverage ? row.pointsWon : avg}</span>
                <span className={wide}>{row.pointsLost}</span>
              </button>

              {isOpen && (
                <div className="border-border border-t px-3 py-3 text-sm">
                  <p className="tabular text-muted">
                    Won {row.pointsWon} · Lost {row.pointsLost} · Diff {signed(row.diff)} · Avg{" "}
                    {avg}
                  </p>
                  {history.length === 0 ? (
                    <p className="text-muted mt-2">No matches played yet.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {history.map((h) => (
                        <li key={h.round} className="flex justify-between gap-3">
                          <span>
                            <span className="font-semibold">R{h.round}</span> with {h.partner} vs{" "}
                            {h.opponents}
                          </span>
                          <span className="tabular shrink-0 font-bold">
                            {h.scored}–{h.conceded}
                            {h.status !== "approved" && <span className="text-muted"> ⏱</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
