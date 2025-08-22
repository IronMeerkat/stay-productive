export type FocusRule = {
  pattern: string;
  type: 'whitelist' | 'blacklist';
};

export type Settings = {
  whitelistPatterns: string[];
  blacklistPatterns: string[];
  strictModeUntil?: number | null;
  activeSchedule?: { days: number[]; start: string; end: string } | null;
};
