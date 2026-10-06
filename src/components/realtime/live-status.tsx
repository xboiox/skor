import type { StreamStatus } from "@/hooks/use-tournament-stream";

const LABEL: Record<StreamStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

interface LiveStatusProps {
  status: StreamStatus;
}

export function LiveStatus({ status }: LiveStatusProps) {
  const isLive = status === "live";
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm font-bold">
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full ${isLive ? "bg-success" : status === "offline" ? "bg-danger" : "border-muted border-2"}`}
      />
      <span className={isLive ? "text-success" : "text-muted"}>{LABEL[status]}</span>
    </span>
  );
}
