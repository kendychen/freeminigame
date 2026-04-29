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
  width?: number;
  height?: number;
}

export function BracketView({
  matches,
  teams,
  variant,
  onMatchClick,
  width = 1200,
  height = 600,
}: BracketViewProps) {
  const teamById = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  const matchComponentFactory = (props: BracketMatchProps) => (
    <CustomMatch {...props} onClick={onMatchClick} />
  );

  const svgWrapperFactory = ({ children, ...props }: SVGWrapperProps) => (
    <SVGViewer {...{ width, height, ...props }}>{children}</SVGViewer>
  );

  if (variant === "single") {
    const main = matches.filter((m) => m.bracket === "main");
    const transformed = main.map((m) => transformMatch(m, teamById));
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
  const transformed = {
    upper: [...winners, ...gf].map((m) => transformMatch(m, teamById)),
    lower: losers.map((m) => transformMatch(m, teamById)),
  };
  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <DoubleEliminationBracket
        {...{
          matches: transformed,
          matchComponent: matchComponentFactory,
          svgWrapper: svgWrapperFactory,
        }}
      />
    </div>
  );
}

interface SVGWrapperProps {
  children: React.ReactNode;
  [k: string]: unknown;
}

interface BracketMatchProps {
  match: { id: string; state: string };
  topParty: { name?: string; isWinner?: boolean; resultText?: string | number };
  bottomParty: { name?: string; isWinner?: boolean; resultText?: string | number };
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
}: BracketMatchProps & { onClick?: (id: string) => void }) {
  return (
    <g onClick={() => onClick?.(match.id)} style={{ cursor: "pointer" }}>
      <foreignObject x={0} y={0} width={220} height={70}>
        <div className="rounded-md border bg-card p-1 text-xs hover:border-primary transition-colors">
          <div
            className={`flex justify-between gap-2 px-2 py-1 ${
              topWon ? "font-bold text-primary" : ""
            }`}
          >
            <span className="truncate">{topParty.name ?? "—"}</span>
            <span>{topParty.resultText ?? "-"}</span>
          </div>
          <div className="border-t" />
          <div
            className={`flex justify-between gap-2 px-2 py-1 ${
              bottomWon ? "font-bold text-primary" : ""
            }`}
          >
            <span className="truncate">{bottomParty.name ?? "—"}</span>
            <span>{bottomParty.resultText ?? "-"}</span>
          </div>
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
