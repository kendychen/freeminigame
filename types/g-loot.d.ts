declare module "@g-loot/react-tournament-brackets" {
  import type { ComponentType } from "react";
  export const SingleEliminationBracket: ComponentType<Record<string, unknown>>;
  export const DoubleEliminationBracket: ComponentType<Record<string, unknown>>;
  export const SVGViewer: ComponentType<Record<string, unknown>>;
  export const Match: ComponentType<Record<string, unknown>>;
  export const MATCH_STATES: {
    DONE: string;
    PLAYED: string;
    RUNNING: string;
    SCHEDULED: string;
    NO_SHOW: string;
    NO_PARTY: string;
    WALK_OVER: string;
  };
  // Re-export anything else permissively
  export const createTheme: (opts: Record<string, unknown>) => unknown;
}
