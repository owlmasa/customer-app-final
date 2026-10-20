import React, { useMemo, useState } from 'react';
import { Customer, DayOfWeek, Maker, MAKERS, sanitizeProducts } from '../types';

interface Props {
  customers: Record<string, Customer>;
  schedules: Record<DayOfWeek, string[]>;
}

// 月〜金のみ対象（「その他」は含めない）
const WEEKDAYS: DayOfWeek[] = ['月', '火', '水', '木', '金'];
const STORAGE_KEY = 'hot-switch-maker';

const loadMaker = (): Maker => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && MAKERS.includes(v as Maker)) return v as Maker;
  } catch {
    // 保存できない環境では既定値
  }
  return MAKERS[0];
};

export const HotSwitchRate: React.FC<Props> = ({ customers, schedules }) => {
  const [maker, setMaker] = useState<Maker>(loadMaker);

  const stats = useMemo(() => {
    // 月〜金の得意先を得意先番号でまとめる（同じ番号は1台）
    const groups = new Map<string, Customer[]>();
    WEEKDAYS.forEach(day => {
      (schedules[day] || []).forEach(id => {
        const c = customers[id];
        if (!c) return;
        const key = c.customerNumber.trim() || c.id;
        const list = groups.get(key) || [];
        list.push(c);
        groups.set(key, list);
      });
    });

    const result = {} as Record<Maker, { total: number; switched: number; rate: number }>;
    MAKERS.forEach(m => (result[m] = { total: 0, switched: 0, rate: 0 }));

    groups.forEach(list => {
      // メーカーは最初に選択されている記録を採用
      const m = list.find(c => c.maker)?.maker;
      if (!m) return;
      result[m].total += 1;
      // 新商品を1つでも入れていれば切替済み（複製先のどれかで入っていればOK）
      const switched = list.some(c => c.maker === m && sanitizeProducts(m, c.newProducts).length > 0);
      if (switched) result[m].switched += 1;
    });

    MAKERS.forEach(m => {
      const r = result[m];
      r.rate = r.total > 0 ? Math.round((r.switched / r.total) * 100) : 0;
    });
    return result;
  }, [customers, schedules]);

  const selectMaker = (m: Maker) => {
    setMaker(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // 無視
    }
  };

  const current = stats[maker];

  return (
    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-1.5 py-1 flex-shrink-0">
      <select
        value={maker}
        onChange={(e) => selectMaker(e.target.value as Maker)}
        className="text-xs font-bold text-red-700 bg-white border border-red-200 rounded px-1 py-0.5 outline-none"
        aria-label="メーカー選択"
      >
        {MAKERS.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] text-red-600 whitespace-nowrap">ホット切替率(月〜金)</span>
        <span className="whitespace-nowrap">
          <span className="text-base font-bold text-red-700">{current.rate}%</span>
          <span className="text-[10px] text-gray-500 ml-1">{current.switched}/{current.total}台</span>
        </span>
      </div>
    </div>
  );
};
