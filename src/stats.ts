import { Customer, DayOfWeek, DAYS_OF_WEEK, Maker, MAKERS, NEW_PRODUCTS, sanitizeProducts } from './types';

// 月〜金のみ対象（「その他」は含めない）
export const WEEKDAYS: DayOfWeek[] = ['月', '火', '水', '木', '金'];

export const rate = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

export interface MakerResult {
  maker: Maker;
  total: number; // 全台数
  switched: number; // 新商品を1つでも入れている台数
  rate: number;
  products: { product: string; count: number; rate: number }[];
}

export interface WeekStats {
  makers: MakerResult[];
  total: number;
  switched: number;
  rate: number;
  unassigned: number; // メーカー未選択の台数
  dayCounts: Record<DayOfWeek, number>;
}

// 月〜金の全台数での集計（同じ得意先番号は1台）
export const computeWeekStats = (
  customers: Record<string, Customer>,
  schedules: Partial<Record<DayOfWeek, string[]>>,
): WeekStats => {
  const groups = new Map<string, Customer[]>();
  WEEKDAYS.forEach(day => {
    (schedules[day] || []).forEach(id => {
      const c = customers[id];
      if (!c) return;
      const key = String(c.customerNumber || '').trim() || c.id;
      const list = groups.get(key) || [];
      list.push(c);
      groups.set(key, list);
    });
  });

  const makers: MakerResult[] = MAKERS.map(maker => ({
    maker,
    total: 0,
    switched: 0,
    rate: 0,
    products: NEW_PRODUCTS[maker].map(product => ({ product, count: 0, rate: 0 })),
  }));
  const byMaker = Object.fromEntries(makers.map(m => [m.maker, m])) as Record<Maker, MakerResult>;
  let unassigned = 0;

  groups.forEach(list => {
    const m = list.find(c => c.maker)?.maker;
    if (!m || !byMaker[m]) {
      unassigned += 1;
      return;
    }
    const r = byMaker[m];
    r.total += 1;
    // 複製先のどれかで入っていればOK
    const products = new Set(list.filter(c => c.maker === m).flatMap(c => sanitizeProducts(m, c.newProducts)));
    if (products.size > 0) r.switched += 1;
    r.products.forEach(p => {
      if (products.has(p.product)) p.count += 1;
    });
  });

  makers.forEach(m => {
    m.rate = rate(m.switched, m.total);
    m.products.forEach(p => (p.rate = rate(p.count, m.total)));
  });

  const total = makers.reduce((a, m) => a + m.total, 0);
  const switched = makers.reduce((a, m) => a + m.switched, 0);
  const dayCounts = DAYS_OF_WEEK.reduce(
    (acc, day) => ({ ...acc, [day]: (schedules[day] || []).filter(id => customers[id]).length }),
    {} as Record<DayOfWeek, number>,
  );

  return { makers, total, switched, rate: rate(switched, total), unassigned, dayCounts };
};

// 複数担当者の合計
export const mergeStats = (list: WeekStats[]): WeekStats => {
  const makers: MakerResult[] = MAKERS.map(maker => {
    const parts = list.map(s => s.makers.find(m => m.maker === maker)!);
    const total = parts.reduce((a, m) => a + m.total, 0);
    const switched = parts.reduce((a, m) => a + m.switched, 0);
    const products = NEW_PRODUCTS[maker].map(product => {
      const count = parts.reduce((a, m) => a + (m.products.find(p => p.product === product)?.count || 0), 0);
      return { product, count, rate: rate(count, total) };
    });
    return { maker, total, switched, rate: rate(switched, total), products };
  });
  const total = makers.reduce((a, m) => a + m.total, 0);
  const switched = makers.reduce((a, m) => a + m.switched, 0);
  const dayCounts = DAYS_OF_WEEK.reduce(
    (acc, day) => ({ ...acc, [day]: list.reduce((a, s) => a + s.dayCounts[day], 0) }),
    {} as Record<DayOfWeek, number>,
  );
  return {
    makers,
    total,
    switched,
    rate: rate(switched, total),
    unassigned: list.reduce((a, s) => a + s.unassigned, 0),
    dayCounts,
  };
};
