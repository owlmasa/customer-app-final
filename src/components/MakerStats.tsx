import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Customer, MAKERS, NEW_PRODUCTS, sanitizeProducts } from '../types';

interface Props {
  customers: Customer[]; // 表示中の曜日の得意先
  label: string;
}

const rate = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

export const MakerStats: React.FC<Props> = ({ customers, label }) => {
  const [isOpen, setIsOpen] = useState(true);

  const stats = useMemo(() => {
    // 同じ得意先番号は1台として数える
    const unique = new Map<string, Customer>();
    customers.forEach(c => {
      const key = c.customerNumber.trim() || c.id;
      if (!unique.has(key)) unique.set(key, c);
    });
    const list = Array.from(unique.values());

    const makers = MAKERS.map(maker => {
      const machines = list.filter(c => c.maker === maker);
      const total = machines.length;
      const withAny = machines.filter(c => sanitizeProducts(maker, c.newProducts).length > 0).length;
      const products = NEW_PRODUCTS[maker].map(product => {
        const count = machines.filter(c => (c.newProducts || []).includes(product)).length;
        return { product, count, rate: rate(count, total) };
      });
      return { maker, total, withAny, rate: rate(withAny, total), products };
    });

    const unassigned = list.filter(c => !c.maker).length;
    return { makers, unassigned };
  }, [customers]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-800 bg-transparent"
      >
        <span>新商品 投入率（{label}）</span>
        <span className="text-gray-400">{isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
      </button>

      {isOpen && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {stats.makers.map(m => (
              <div key={m.maker} className="border border-gray-200 rounded-md p-2.5">
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-indigo-700">{m.maker}</span>
                    <span className="text-xs text-gray-500">全{m.total}台</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-gray-900">{m.rate}%</span>
                    <span className="text-xs text-gray-500">({m.withAny}台)</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {m.products.map(p => (
                    <div key={p.product} className="flex items-center gap-2 text-xs">
                      <span className="w-24 text-gray-600 flex-shrink-0 truncate" title={p.product}>{p.product}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 rounded-full" style={{ width: `${p.rate}%` }} />
                      </div>
                      <span className="w-20 text-right text-gray-800 flex-shrink-0">
                        <span className="font-bold">{p.rate}%</span>
                        <span className="text-gray-400"> ({p.count}台)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            メーカー全体の投入率＝新商品を1つ以上入れている台数 ÷ そのメーカーの全台数。同じ得意先番号は1台として計算。
            {stats.unassigned > 0 && <span className="text-red-500">　メーカー未選択：{stats.unassigned}台（集計対象外）</span>}
          </p>
        </div>
      )}
    </div>
  );
};
