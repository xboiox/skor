export type TournamentLinks = {
  readonly admin: string | null;
  readonly player: string | null;
  readonly public: string;
};

export function tournamentLinks(
  appUrl: string,
  slug: string,
  tokens: { readonly admin: string | null; readonly player: string | null },
): TournamentLinks {
  const base = `${appUrl.replace(/\/+$/, "")}/t/${slug}`;
  const enter = (role: "admin" | "player", token: string | null) =>
    token ? `${base}/enter/${role}?k=${encodeURIComponent(token)}` : null;
  return {
    admin: enter("admin", tokens.admin),
    player: enter("player", tokens.player),
    public: base,
  };
}
