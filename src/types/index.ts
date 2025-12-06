export type DayOfWeek = '月' | '火' | '水' | '木' | '金' | 'その他';

export interface Customer {
  id: string;
  customerNumber: string; // 得意先番号
  name: string; // 顧客名
  address: string; // 住所
  remarks: string; // 備考欄
  priceRevisionDate?: string; // 価格改定日
  locationType?: 'インロケ' | 'アウトロケ'; // ロケーション
  isCorporate?: boolean; // 法人かどうか
  visitFrequency?: '1' | '2' | '3' | '4' | '5' | 'A' | 'B' | 'ゴミ'; // 訪問頻度
}

export interface VisitSchedule {
  dayOfWeek: DayOfWeek;
  customerIds: string[]; // Ordered list of customer IDs
}

export const DAYS_OF_WEEK: DayOfWeek[] = ['月', '火', '水', '木', '金', 'その他'];
