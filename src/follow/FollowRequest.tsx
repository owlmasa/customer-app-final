import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, Search, X, Send, CheckCircle2, Loader2, AlertTriangle, MapPin } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useSync } from '../sync/useSync';
import { SyncManager } from '../sync/SyncManager';
import { fetchFollowTarget, sendFollowRequest } from '../sync/api';
import { Customer, DayOfWeek, DAYS_OF_WEEK } from '../types';

type DayFilter = 'all' | DayOfWeek;

interface Row {
  customer: Customer;
  days: DayOfWeek[];
}

// 自分の得意先からフォロー先を選んで、担当者（荒川さん）に依頼する画面
export const FollowRequest: React.FC = () => {
  const { customers, schedules } = useStore();
  const { gasUrl, apiKey, staff } = useSync();
  const connected = !!(gasUrl && apiKey && staff);

  const [query, setQuery] = useState('');
  const [day, setDay] = useState<DayFilter>('all');
  const [selected, setSelected] = useState<string[]>([]); // 選んだ順
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<{ target: string; registered: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ sent: number; target: string } | null>(null);

  useEffect(() => {
    if (!connected) return;
    fetchFollowTarget(gasUrl, apiKey)
      .then(setTarget)
      .catch(() => setTarget(null));
  }, [connected, gasUrl, apiKey]);

  // 同じ得意先番号（曜日ごとの複製）は1件にまとめる
  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    DAYS_OF_WEEK.forEach(d => {
      (schedules[d] || []).forEach(id => {
        const c = customers[id];
        if (!c) return;
        const key = c.customerNumber.trim() || c.id;
        const row = map.get(key);
        if (row) {
          if (!row.days.includes(d)) row.days.push(d);
        } else {
          map.set(key, { customer: c, days: [d] });
        }
      });
    });
    return Array.from(map.values());
  }, [customers, schedules]);

  const visible = rows.filter(r => {
    if (day !== 'all' && !r.days.includes(day)) return false;
    if (!query) return true;
    const q = query.trim();
    return r.customer.name.includes(q) || r.customer.customerNumber.includes(q) || (r.customer.address || '').includes(q);
  });

  const toggle = (id: string) => {
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  };

  const rowById = useMemo(() => new Map(rows.map(r => [r.customer.id, r])), [rows]);

  const submit = async () => {
    if (selected.length === 0) return;
    const names = selected.map(id => rowById.get(id)?.customer.name).filter(Boolean).join('、');
    const to = target?.target || '担当者';
    if (!window.confirm(`${to}さんに、次の${selected.length}件のフォロー依頼を送ります。\n\n${names}`)) return;
    setSending(true);
    setError('');
    try {
      const r = await sendFollowRequest(gasUrl, apiKey, staff, selected.map(id => ({ id, note: notes[id] || '' })));
      setDone(r);
      setSelected([]);
      setNotes({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-sm w-full space-y-3 text-sm text-gray-700">
          <p className="font-bold text-gray-900">まだ接続されていません</p>
          <p>LINEのリッチメニューから開くか、訪問一覧で接続してから開いてください。</p>
          <a href="/" className="block text-center py-2.5 rounded-md bg-blue-600 text-white font-bold">訪問一覧を開く</a>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-sm w-full space-y-4 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-600" />
          <p className="text-lg font-bold text-gray-900">送信しました</p>
          <p className="text-sm text-gray-600">{done.target}さんに、{done.sent}件のフォロー依頼をLINEで送りました。</p>
          <button onClick={() => setDone(null)} className="w-full py-2.5 rounded-md bg-[#0050A0] text-white font-bold">
            続けて依頼する
          </button>
          <a href="/" className="block w-full py-2.5 rounded-md bg-gray-100 text-gray-700 font-medium">訪問一覧へ</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <SyncManager />
      <header className="bg-[#0050A0] text-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <a href="/" className="p-1.5 -ml-1.5 rounded-md text-white" title="訪問一覧へ">
            <ArrowLeft size={20} />
          </a>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold">フォロー依頼</h1>
            <p className="text-[11px] text-blue-100 truncate">
              送り先：{target ? `${target.target}さん` : '確認中…'}
              {target && !target.registered && <span className="text-yellow-200">（LINE未登録のため送れません）</span>}
            </p>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="顧客名・得意先番号・住所で検索"
              className="w-full pl-8 pr-8 py-2 rounded-md text-sm text-gray-900 outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 bg-transparent">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {(['all', ...DAYS_OF_WEEK] as DayFilter[]).map(d => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={clsx(
                  'px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap',
                  day === d ? 'bg-white text-[#0050A0]' : 'bg-white/15 text-white',
                )}
              >
                {d === 'all' ? 'すべて' : d}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-3 space-y-2">
        <p className="text-xs text-gray-500">フォローしてほしい得意先をタップして選び、必要ならフォロー備考を書いてください（{visible.length}件表示）</p>
        {visible.map(({ customer: c, days }) => {
          const isSel = selected.includes(c.id);
          const order = selected.indexOf(c.id) + 1;
          return (
            <div
              key={c.id}
              className={clsx(
                'rounded-lg border bg-white transition-colors',
                isSel ? 'border-[#0050A0] ring-1 ring-[#0050A0]' : 'border-gray-200',
              )}
            >
              <button onClick={() => toggle(c.id)} className="w-full text-left p-3 flex items-start gap-3 bg-transparent">
                <span
                  className={clsx(
                    'mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                    isSel ? 'bg-[#0050A0] text-white' : 'bg-gray-100 text-gray-300 ring-1 ring-gray-300',
                  )}
                >
                  {isSel ? order : ''}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center flex-wrap gap-x-2 gap-y-1">
                    <span className="font-bold text-gray-900 text-sm">{c.name}</span>
                    {c.maker && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">{c.maker}</span>}
                    {(c.newProducts || []).length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700">新商品{c.newProducts!.length}</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">
                    No.{c.customerNumber}・{days.join('・')}
                  </span>
                  {c.address && (
                    <span className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5 truncate">
                      <MapPin size={11} className="flex-shrink-0" />
                      <span className="truncate">{c.address}</span>
                    </span>
                  )}
                </span>
              </button>
              {isSel && (
                <div className="px-3 pb-3">
                  {c.remarks && <p className="text-[11px] text-gray-500 mb-1.5 whitespace-pre-wrap">備考：{c.remarks}</p>}
                  <textarea
                    value={notes[c.id] || ''}
                    onChange={(e) => setNotes(n => ({ ...n, [c.id]: e.target.value }))}
                    placeholder="フォロー備考（例：新商品の切替をお願いします）"
                    rows={2}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#0050A0]"
                  />
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-10 bg-white rounded-lg border border-dashed border-gray-300">該当する得意先がありません</p>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-2">
          {error && (
            <p className="text-xs text-red-600 flex items-start gap-1">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 flex-1">
              <span className="font-bold text-lg text-[#0050A0]">{selected.length}</span>件選択中
            </span>
            {selected.length > 0 && (
              <button onClick={() => { setSelected([]); setNotes({}); }} className="px-3 py-2.5 rounded-md bg-gray-100 text-gray-600 text-sm">
                クリア
              </button>
            )}
            <button
              onClick={submit}
              disabled={selected.length === 0 || sending || (target !== null && !target.registered)}
              className="px-5 py-2.5 rounded-md bg-[#E60012] text-white font-bold text-sm flex items-center gap-1.5 disabled:opacity-40"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              完了して依頼
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
