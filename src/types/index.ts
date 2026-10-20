export type DayOfWeek = '月' | '火' | '水' | '木' | '金' | 'その他';

export interface Customer {
  id: string;
  customerNumber: string; // 得意先番号
  name: string; // 顧客名
  address: string; // 住所
  remarks: string; // 備考欄
  maker?: Maker; // メーカー
  newProducts?: string[]; // 投入済みの新商品（選択メーカーの商品名）
  locationType?: 'インロケ' | 'アウトロケ'; // ロケーション
  isCorporate?: boolean; // 法人かどうか
  isTrashCollection?: boolean; // ゴミ回収
  visitFrequency?: '1' | '2' | '3' | '4' | '5' | 'A' | 'B' | 'ゴミ'; // 訪問頻度
}

export interface VisitSchedule {
  dayOfWeek: DayOfWeek;
  customerIds: string[]; // Ordered list of customer IDs
}

export const DAYS_OF_WEEK: DayOfWeek[] = ['月', '火', '水', '木', '金', 'その他'];

export type Maker = 'SF' | 'AS' | 'KR' | 'PK';

export const MAKERS: Maker[] = ['SF', 'AS', 'KR', 'PK'];

// メーカーごとの新商品
export const NEW_PRODUCTS: Record<Maker, string[]> = {
  SF: ['コンポタ', 'ココア', 'ゴディバ', 'CBミルクティー', '500P焙じ茶'],
  AS: ['コンポタ', 'ココア', 'おしるこ', 'ホットレモン'],
  KR: ['コンポタ', 'ココア', 'ホットレモン'],
  PK: ['コンポタ'],
};

// メーカーの商品に含まれるものだけ残す
export const sanitizeProducts = (maker: Maker | undefined, products: string[] | undefined): string[] => {
  if (!maker || !products) return [];
  return NEW_PRODUCTS[maker].filter(p => products.includes(p));
};

