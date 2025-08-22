export type FocusRule = {
  pattern: string;
  type: 'whitelist' | 'blacklist';
};

export type Settings = {
  version: number;
  createdAt: number;
  schedule: WeeklySchedule;
  whitelistPatterns: string[];
  blacklistPatterns: string[];
  strictMode: { enabled: boolean; expiresAt: number | null };
};

export type TimeRange = { start: string; end: string };
export type DaySchedule = { enabled: boolean; ranges: TimeRange[] };
export type WeeklySchedule = {
  mon: DaySchedule;
  tue: DaySchedule;
  wed: DaySchedule;
  thu: DaySchedule;
  fri: DaySchedule;
  sat: DaySchedule;
  sun: DaySchedule;
};
