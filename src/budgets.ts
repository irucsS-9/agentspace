/** Hard caps (lines). Matched against memory-bank paths by suffix/glob intent. */
export interface Budget {
  /** Match function over a workspace-relative path. */
  match: (path: string) => boolean;
  cap: number;
  label: string;
}

export const SIZE_BUDGETS: Budget[] = [
  { label: "log.md", cap: 500, match: (p) => p === "memory-bank/log.md" },
  {
    label: "01-active/currentWork.md",
    cap: 150,
    match: (p) => p === "memory-bank/01-active/currentWork.md",
  },
  {
    label: "00-core/*.md",
    cap: 800,
    match: (p) => /^memory-bank\/00-core\/.+\.md$/.test(p),
  },
  {
    label: "04-business/*.md",
    cap: 800,
    match: (p) => /^memory-bank\/04-business\/.+\.md$/.test(p),
  },
];

export const STALE_DAYS = 30;
