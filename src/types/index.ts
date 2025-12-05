export type DayOfWeek = '月' | '火' | '水' | '木' | '金';

export interface Customer {
  id: string;
  customerNumber: string; // 得意先番号
  name: string; // 顧客名
  address: string; // 住所
  remarks: string; // 備考欄
}

export interface VisitSchedule {
  dayOfWeek: DayOfWeek;
  customerIds: string[]; // Ordered list of customer IDs
}

export const DAYS_OF_WEEK: DayOfWeek[] = ['月', '火', '水', '木', '金'];
