"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Match, Team } from "@/lib/pairing/types";

// Library types are loose; cast dynamic imports to permissive component types.
const SingleEliminationBracket = dynamic(
  () =>
    import("@g-loot/react-tournament-brackets").then(
      (m) => m.SingleEliminationBracket as unknown as ComponentType<Record<string, unknown>>,
    ),
  { ssr: false },
) as unknown as ComponentType<Record<string, unknown>>;

const DoubleEliminationBracket = dynamic(
  () =>
    import("@g-loot/react-tournament-brackets").then(
      (m) => m.DoubleEliminationBracket as unknown as ComponentType<Record<string, unknown>>,
    ),
  { ssr: false },
) as unknown as ComponentType<Record<string, unknown>>;

const SVGViewer = dynamic(
  () =>
    import("@g-loot/react-tournament-brackets").then(
      (m) => m.SVGViewer as unknown as ComponentType<Record<string, unknown>>,
    ),
  { ssr: false },
) as unknown as ComponentType<Record<string, unknown>>;

export interface BracketViewProps {
  matches: Match[];
  teams: Team[];
  variant: "single" | "double";
  onMatchClick?: (matchId: string) => void;
  /** When set, renders a small ⚖️ link on each match card → referee page. */
  refereeBaseHref?: string;
  /** Optional team-id → member display names. Shown under each team name. */
  membersByTeam?: Record<string, string[]>;
  width?: number;
  height?: number;
}

// Approximate sizes for layout calculation. The g-loot lib uses ~270x70 per
// match card with vertical spacing. Bumped to 110 to fit a tiny member-names
// subline under each team name.
const MATCH_HEIGHT = 110;
const ROUND_WIDTH = 320;
const PADDING = 80;
const CARD_WIDTH = 240;
const CARD_HEIGHT = 96;

function calcSize(matches: { round: number }[]): {
  width: number;
  height: number;
} {
  if (matches.length === 0) return { width: 800, height: 400 };
  const rounds = new Map<number, number>();
  for (const m of matches) {
    rounds.set(m.round, (rounds.get(m.round) ?? 0) + 1);
  }
  const roundCount = rounds.size;
  const maxMatchesInRound = Math.max(...rounds.values());
  const width = Math.max(800, roundCount * ROUND_WIDTH + PADDING);
  // First round determines vertical span; subsequent rounds fit within it.
  const height = Math.max(420, maxMatchesInRound * MATCH_HEIGHT * 2 + PADDING);
  return { width, height };
}

export function BracketView({
  matches,
  teams,
  variant,
  onMatchClick,
  refereeBaseHref,
  membersByTeam,
  width: widthProp,
  height: heightProp,
}: BracketViewProps) {
  const teamById = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  // Lookup teamA/teamB by matchId so CustomMatch can resolve members regardless
  // of whether the bracket lib propagates participant.id to topParty.id.
  const teamsByMatchId = useMemo(() => {
    const m = new Map<string, { a: string | null; b: string | null }>();
    for (const x of matches) {
      m.set(x.id, { a: x.teamA, b: x.teamB });
    }
    return m;
  }, [matches]);

  const matchComponentFactory = (props: BracketMatchProps) => (
    <CustomMatch
      {...props}
      onClick={onMatchClick}
      refereeBaseHref={refereeBaseHref}
      membersByTeam={membersByTeam}
      teamsByMatchId={teamsByMatchId}
    />
  );

  if (variant === "single") {
    // Accept main OR plate as the single-elim tree (caller pre-filters by series)
    const main = matches.filter(
      (m) => m.bracket === "main" || m.bracket === "plate",
    );
    if (main.length === 0) {
      return <BracketEmpty />;
    }
    const transformed = main.map((m) => transformMatch(m, teamById));
    const { width, height } = {
      width: widthProp ?? calcSize(main).width,
      height: heightProp ?? calcSize(main).height,
    };
    const svgWrapperFactory = ({ children, ...props }: SVGWrapperProps) => (
      <SVGViewer {...{ width, height, ...props }}>{children}</SVGViewer>
    );
    return (
      <div className="overflow-auto rounded-lg border bg-background">
        <SingleEliminationBracket
          {...{
            matches: transformed,
            matchComponent: matchComponentFactory,
            svgWrapper: svgWrapperFactory,
          }}
        />
      </div>
    );
  }

  const winners = matches.filter((m) => m.bracket === "winners");
  const losers = matches.filter((m) => m.bracket === "losers");
  const gf = matches.filter((m) => m.bracket === "grand_final");
  if (winners.length === 0 && losers.length === 0 && gf.length === 0) {
    return <BracketEmpty />;
  }
  const transformed = {
    upper: [...winners, ...gf].map((m) => transformMatch(m, teamById)),
    lower: losers.map((m) => transformMatch(m, teamById)),
  };
  const allDoubleElim = [...winners, ...gf, ...losers];
  const sizeDE = calcSize(allDoubleElim);
  const widthDE = widthProp ?? Math.max(sizeDE.width, 1100);
  // Double elim has WB on top, LB on bottom — needs more vertical space
  const heightDE = heightProp ?? Math.max(sizeDE.height + 300, 700);
  const svgWrapperFactoryDE = ({ children, ...props }: SVGWrapperProps) => (
    <SVGViewer
      {...{ width: widthDE, height: heightDE, ...props }}
    >
      {children}
    </SVGViewer>
  );
  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <DoubleEliminationBracket
        {...{
          matches: transformed,
          matchComponent: matchComponentFactory,
          svgWrapper: svgWrapperFactoryDE,
        }}
      />
    </div>
  );
}

function BracketEmpty() {
  return (
    <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
      Sơ đồ thi đấu chính chưa được tạo.
      <br />
      Hãy bốc thăm chia bảng (group format) hoặc bấm <strong>Tạo bảng đấu</strong> để sinh sơ đồ.
    </div>
  );
}

interface SVGWrapperProps {
  children: React.ReactNode;
  [k: string]: unknown;
}

interface BracketMatchProps {
  match: { id: string; state: string };
  topParty: {
    id?: string;
    name?: string;
    isWinner?: boolean;
    resultText?: string | number;
  };
  bottomParty: {
    id?: string;
    name?: string;
    isWinner?: boolean;
    resultText?: string | number;
  };
  topWon?: boolean;
  bottomWon?: boolean;
  x?: number;
  y?: number;
}

function CustomMatch({
  match,
  topParty,
  bottomParty,
  topWon,
  bottomWon,
  onClick,
  refereeBaseHref,
  membersByTeam,
  teamsByMatchId,
}: BracketMatchProps & {
  onClick?: (id: string) => void;
  refereeBaseHref?: string;
  membersByTeam?: Record<string, string[]>;
  teamsByMatchId?: Map<string, { a: string | null; b: string | null }>;
}) {
  const hasTeams =
    !!topParty.name && !!bottomParty.name && topParty.name !== "TBD" && bottomParty.name !== "TBD";
  const teams = teamsByMatchId?.get(match.id);
  const aTeamId = topParty.id ?? teams?.a ?? null;
  const bTeamId = bottomParty.id ?? teams?.b ?? null;
  const aMembers = aTeamId ? membersByTeam?.[aTeamId] ?? [] : [];
  const bMembers = bTeamId ? membersByTeam?.[bTeamId] ?? [] : [];
  return (
    <g style={{ cursor: "pointer" }}>
      <foreignObject x={0} y={0} width={CARD_WIDTH} height={CARD_HEIGHT}>
        <div className="relative rounded-md border bg-card p-1 text-[11px] hover:border-primary transition-colors">
          <div
            onClick={() => onClick?.(match.id)}
            className={`flex justify-between gap-2 px-2 py-0.5 ${
              topWon ? "font-bold text-primary" : ""
            }`}
          >
            <span className="flex flex-1 flex-col truncate">
              <span className="truncate font-medium">
                {topParty.name ?? "—"}
              </span>
              {aMembers.length > 0 && (
                <span className="truncate text-[9px] leading-tight text-muted-foreground">
                  {aMembers.join(" · ")}
                </span>
              )}
            </span>
            <span className="self-start">{topParty.resultText ?? "-"}</span>
          </div>
          <div className="border-t" />
          <div
            onClick={() => onClick?.(match.id)}
            className={`flex justify-between gap-2 px-2 py-0.5 ${
              bottomWon ? "font-bold text-primary" : ""
            }`}
          >
            <span className="flex flex-1 flex-col truncate">
              <span className="truncate font-medium">
                {bottomParty.name ?? "—"}
              </span>
              {bMembers.length > 0 && (
                <span className="truncate text-[9px] leading-tight text-muted-foreground">
                  {bMembers.join(" · ")}
                </span>
              )}
            </span>
            <span className="self-start">{bottomParty.resultText ?? "-"}</span>
          </div>
          {refereeBaseHref && hasTeams && (
            <a
              href={`${refereeBaseHref}/${match.id}`}
              onClick={(e) => e.stopPropagation()}
              className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              title="Mở chế độ trọng tài"
              aria-label="Trọng tài"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M14.5 12.5 4 23l-3-3L11.5 9.5" />
                <path d="M16 3 7 12l5 5 9-9" />
              </svg>
            </a>
          )}
        </div>
      </foreignObject>
    </g>
  );
}

function transformMatch(m: Match, teamById: Map<string, Team>) {
  const teamA = m.teamA ? teamById.get(m.teamA) : undefined;
  const teamB = m.teamB ? teamById.get(m.teamB) : undefined;
  return {
    id: m.id,
    name: `R${m.round} M${m.matchNumber}`,
    nextMatchId: m.nextWinId ?? null,
    nextLooserMatchId: m.nextLossId ?? null,
    tournamentRoundText: `Vòng ${m.round}`,
    startTime: "",
    state:
      m.status === "completed"
        ? "DONE"
        : m.status === "live"
          ? "RUNNING"
          : "SCHEDULED",
    participants: [
      {
        id: m.teamA ?? `${m.id}_a`,
        name: teamA?.name ?? "TBD",
        isWinner: m.winner !== null && m.winner === m.teamA,
        resultText: m.status === "completed" ? String(m.scoreA) : "",
      },
      {
        id: m.teamB ?? `${m.id}_b`,
        name: teamB?.name ?? "TBD",
        isWinner: m.winner !== null && m.winner === m.teamB,
        resultText: m.status === "completed" ? String(m.scoreB) : "",
      },
    ],
  };
}
