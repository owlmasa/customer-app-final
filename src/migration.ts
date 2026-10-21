import { Customer, DayOfWeek, DAYS_OF_WEEK } from './types';

// 旧版（端末保存版）→ クラウド版へのデータ移行用
export const MIGRATION_FORMAT = 'customer-manager-migration';

export interface MigrationData {
  format: typeof MIGRATION_FORMAT;
  formatVersion: 1;
  exportedAt: string;
  customers: Record<string, Customer>;
  schedules: Record<DayOfWeek, string[]>;
}

export const buildMigrationText = (
  customers: Record<string, Customer>,
  schedules: Record<DayOfWeek, string[]>,
): string => {
  const data: MigrationData = {
    format: MIGRATION_FORMAT,
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    customers,
    schedules,
  };
  return JSON.stringify(data);
};

export const parseMigrationText = (text: string): MigrationData => {
  let data: any;
  try {
    data = JSON.parse(text.trim());
  } catch {
    throw new Error('貼り付けた内容を読み取れません。「移行用コピー」でコピーした内容をそのまま貼り付けてください');
  }
  if (!data || data.format !== MIGRATION_FORMAT || typeof data.customers !== 'object' || typeof data.schedules !== 'object') {
    throw new Error('移行用データではありません');
  }
  const schedules = DAYS_OF_WEEK.reduce((acc, day) => {
    const ids: unknown = data.schedules[day];
    acc[day] = Array.isArray(ids) ? ids.map(String).filter(id => data.customers[id]) : [];
    return acc;
  }, {} as Record<DayOfWeek, string[]>);
  return { ...data, schedules };
};
