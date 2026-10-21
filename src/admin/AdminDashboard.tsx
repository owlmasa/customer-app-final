import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Settings, ChevronDown, ChevronUp, MonitorSmartphone, AlertTriangle, ArrowLeft, Target, MessageCircle, Check } from 'lucide-react';
import clsx from 'clsx';
import { fetchAll, LineStatus, notifyNow, setLineToken, setTarget, StaffData } from '../sync/api';
import { computeWeekStats, mergeStats, WeekStats, WEEKDAYS } from '../stats';
import { DAYS_OF_WEEK, Maker, MAKERS } from '../types';

const CONFIG_KEY = 'customer-manager-admin';

type View = 'all' | Maker;

const loadConfig = (): { gasUrl: string; adminKey: string } => {
  let gasUrl = '';
  let adminKey = '';
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    gasUrl = saved.gasUrl || '';
    adminKey = saved.adminKey || '';
    if (!gasUrl) {
      // 同じ端末で担当者として接続していれば、そのURLを使う
      const sync = JSON.parse(localStorage.getItem('customer-manager-sync') || '{}');
      gasUrl = sync?.state?.gasUrl || '';
    }
  } catch {
    // 無視
  }
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get('gas')) gasUrl = p.get('gas') || gasUrl;
    if (p.get('admin')) adminKey = p.get('admin') || adminKey;
  } catch {
    // 無視
  }
  return { gasUrl, adminKey };
};

const saveConfig = (c: { gasUrl: string; adminKey: string }) => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {
    // 無視
  }
};

const formatUpdated = (iso: string) => {
  if (!iso) return '未保存';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const diff = (Date.now() - d.getTime()) / 60000;
  if (diff < 1) return 'たった今';
  if (diff < 60) return `${Math.floor(diff)}分前`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}時間前`;
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
};

const pick = (s: WeekStats, view: View) => {
  if (view === 'all') return { rate: s.rate, switched: s.switched, total: s.total };
  const m = s.makers.find(x => x.maker === view)!;
  return { rate: m.rate, switched: m.switched, total: m.total };
};

// 日本時間の今月（yyyy-MM）
const currentMonth = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
};

const gapLabel = (rate: number, target: number) => {
  const g = rate - target;
  return `${g >= 0 ? '+' : ''}${g}pt`;
};

const barColor = (r: number) => (r >= 70 ? 'bg-green-500' : r >= 40 ? 'bg-orange-400' : 'bg-red-400');

const MakerDetail: React.FC<{ stats: WeekStats }> = ({ stats }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    {stats.makers.map(m => (
      <div key={m.maker} className="border border-gray-200 rounded-md p-2.5 bg-white">
        <div className="flex items-baseline justify-between mb-1.5">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-indigo-700">{m.maker}</span>
            <span className="text-xs text-gray-500">全{m.total}台</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-gray-900">{m.rate}%</span>
            <span className="text-xs text-gray-500">({m.switched}台)</span>
          </div>
        </div>
        <div className="space-y-1">
          {m.products.map(p => (
            <div key={p.product} className="flex items-center gap-2 text-xs">
              <span className="w-24 text-gray-600 flex-shrink-0 truncate">{p.product}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full" style={{ width: `${p.rate}%` }} />
              </div>
              <span className="w-20 text-right flex-shrink-0">
                <span className="font-bold">{p.rate}%</span>
                <span className="text-gray-400"> ({p.count}台)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const AdminDashboard: React.FC = () => {
  const [config, setConfig] = useState(loadConfig);
  const [form, setForm] = useState(config);
  const [showSettings, setShowSettings] = useState(!config.gasUrl || !config.adminKey);
  const [data, setData] = useState<StaffData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [view, setView] = useState<View>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [line, setLine] = useState<LineStatus | undefined>();
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [showLine, setShowLine] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const month = currentMonth();
  const target = targets[month];

  const refresh = useCallback(async (c = config) => {
    if (!c.gasUrl || !c.adminKey) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetchAll(c.gasUrl, c.adminKey);
      setData(r.staff);
      setTargets(r.targets);
      setLine(r.line);
      setFetchedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    refresh();
    // 5分ごとに自動更新
    const t = setInterval(() => refresh(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.map(s => ({ ...s, stats: computeWeekStats(s.customers || {}, s.schedules || {}) }));
  }, [data]);

  const overall = useMemo(() => (rows.length ? mergeStats(rows.map(r => r.stats)) : null), [rows]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => pick(b.stats, view).rate - pick(a.stats, view).rate || a.name.localeCompare(b.name, 'ja')),
    [rows, view],
  );

  const runAction = async (fn: () => Promise<string>) => {
    setActionMsg('');
    setError('');
    try {
      setActionMsg(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveTarget = () =>
    runAction(async () => {
      const t = Number(targetInput);
      if (!(t >= 0 && t <= 100)) throw new Error('目標は0〜100の数字で入力してください');
      const r = await setTarget(config.gasUrl, config.adminKey, month, t);
      setTargets(r.targets);
      setEditingTarget(false);
      return `${month.replace('-', '年')}月の目標を${t}%にしました`;
    });

  const saveToken = () =>
    runAction(async () => {
      const r = await setLineToken(config.gasUrl, config.adminKey, tokenInput);
      setLine(r.line);
      setTokenInput('');
      return 'LINEのチャネルアクセストークンを保存しました';
    });

  const sendNow = (type: 'morning' | 'evening') =>
    runAction(async () => {
      if (!window.confirm(`${type === 'morning' ? '担当者への朝の通知' : '管理者への夕方の通知'}を今すぐ送りますか？`)) return '';
      const r = await notifyNow(config.gasUrl, config.adminKey, type);
      return `${r.sent}件送信しました`;
    });

  const applySettings = () => {
    const c = { gasUrl: form.gasUrl.trim(), adminKey: form.adminKey.trim() };
    setConfig(c);
    saveConfig(c);
    setShowSettings(false);
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      // 無視
    }
    // config が変わると自動で読み込まれる
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 text-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
          <MonitorSmartphone size={22} className="text-orange-300 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">親機 ─ 全体モニター</h1>
            <p className="text-[11px] text-slate-300">
              {fetchedAt ? `${fetchedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新` : '未取得'}
              {data && `・担当者${data.length}名`}
            </p>
          </div>
          <button onClick={() => refresh()} disabled={loading} className="p-2 rounded-md bg-slate-800 text-white disabled:opacity-50" title="更新">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setForm(config); setShowSettings(!showSettings); }} className="p-2 rounded-md bg-slate-800 text-white" title="設定">
            <Settings size={18} />
          </button>
          <a href="/" className="p-2 rounded-md bg-slate-800 text-white" title="担当者画面へ">
            <ArrowLeft size={18} />
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {showSettings && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-sm">
            <p className="text-sm font-bold text-gray-800">親機の接続設定</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ウェブアプリのURL</label>
              <input
                type="url"
                className="w-full p-2 border border-gray-300 rounded-md text-xs"
                value={form.gasUrl}
                onChange={(e) => setForm({ ...form, gasUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/…/exec"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">管理キー（親機用）</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md text-xs font-mono"
                value={form.adminKey}
                onChange={(e) => setForm({ ...form, adminKey: e.target.value })}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <button
              onClick={applySettings}
              disabled={!form.gasUrl.trim() || !form.adminKey.trim()}
              className="w-full py-2 rounded-md bg-slate-900 text-white text-sm font-medium disabled:opacity-50"
            >
              保存して読み込む
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 rounded-md p-3 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {actionMsg && (
          <div className="bg-green-50 border border-green-300 text-green-800 rounded-md p-3 text-sm">{actionMsg}</div>
        )}

        {overall && (
          <>
            {/* 全体サマリー */}
            <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-500">全体のホット切替率（月〜金・全台数）</p>
                  <p className="text-4xl font-bold text-gray-900 leading-tight">
                    {overall.rate}<span className="text-xl">%</span>
                  </p>
                  <p className="text-xs text-gray-500">{overall.switched} / {overall.total}台</p>
                </div>
                {overall.unassigned > 0 && (
                  <p className="text-[11px] text-red-600 text-right">メーカー未選択<br /><span className="text-base font-bold">{overall.unassigned}台</span></p>
                )}
              </div>
              <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-orange-50 border border-orange-200">
                <Target size={16} className="text-orange-600 flex-shrink-0" />
                {editingTarget ? (
                  <>
                    <span className="text-xs text-orange-800 whitespace-nowrap">今月の目標</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      className="w-16 p-1 border border-orange-300 rounded text-sm text-right"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                    />
                    <span className="text-xs text-orange-800">%</span>
                    <button onClick={saveTarget} className="ml-auto px-3 py-1 rounded bg-orange-600 text-white text-xs font-bold">保存</button>
                    <button onClick={() => setEditingTarget(false)} className="px-2 py-1 rounded bg-white text-gray-600 text-xs border border-gray-200">戻る</button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-orange-800">
                      今月の目標：
                      {typeof target === 'number' ? (
                        <>
                          <span className="font-bold text-sm">{target}%</span>
                          <span className={clsx('ml-2 font-bold', overall.rate >= target ? 'text-green-700' : 'text-red-600')}>
                            {gapLabel(overall.rate, target)}
                          </span>
                        </>
                      ) : (
                        <span className="font-bold">未設定</span>
                      )}
                    </span>
                    <button
                      onClick={() => { setTargetInput(typeof target === 'number' ? String(target) : ''); setEditingTarget(true); }}
                      className="ml-auto px-3 py-1 rounded bg-white text-orange-700 text-xs font-bold border border-orange-300"
                    >
                      {typeof target === 'number' ? '変更' : '設定'}
                    </button>
                  </>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {overall.makers.map(m => (
                  <div key={m.maker} className="rounded-md bg-gray-50 border border-gray-100 p-2 text-center">
                    <p className="text-xs font-bold text-indigo-700">{m.maker}</p>
                    <p className="text-lg font-bold text-gray-900 leading-tight">{m.rate}%</p>
                    <p className="text-[10px] text-gray-500">{m.switched}/{m.total}台</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 表示切替 */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {(['all', ...MAKERS] as View[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap',
                    view === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-600 border-gray-300',
                  )}
                >
                  {v === 'all' ? '全メーカー' : v}
                </button>
              ))}
            </div>

            {/* 担当者別 */}
            <section className="space-y-2">
              <p className="text-xs text-gray-500">担当者別（切替率の高い順）・タップで詳細</p>
              {sorted.map((r, i) => {
                const v = pick(r.stats, view);
                const isOpen = open === r.name;
                return (
                  <div key={r.name} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <button onClick={() => setOpen(isOpen ? null : r.name)} className="w-full text-left p-3 bg-transparent">
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-bold text-gray-900 truncate">{r.name}</span>
                            <span className="flex items-baseline gap-1 flex-shrink-0">
                              <span className="text-xl font-bold text-gray-900">{v.rate}%</span>
                              <span className="text-xs text-gray-500">{v.switched}/{v.total}台</span>
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                            <div className={clsx('h-full rounded-full', barColor(v.rate))} style={{ width: `${v.rate}%` }} />
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
                            <span>
                              {view === 'all' && typeof target === 'number' && (
                                <span className={clsx('font-bold mr-2', v.rate >= target ? 'text-green-700' : 'text-red-600')}>
                                  目標{gapLabel(v.rate, target)}
                                </span>
                              )}
                              最終更新 {formatUpdated(r.updatedAt)}
                              {r.stats.unassigned > 0 && <span className="text-red-600 ml-2">未選択{r.stats.unassigned}台</span>}
                            </span>
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-3 bg-gray-50 rounded-b-lg">
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {DAYS_OF_WEEK.map(d => (
                            <span key={d} className={clsx('px-2 py-0.5 rounded border', WEEKDAYS.includes(d) ? 'bg-white border-gray-200 text-gray-700' : 'bg-gray-100 border-gray-200 text-gray-400')}>
                              {d}{d !== 'その他' && '曜'} {r.stats.dayCounts[d]}件
                            </span>
                          ))}
                        </div>
                        <MakerDetail stats={r.stats} />
                      </div>
                    )}
                  </div>
                );
              })}
              {sorted.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-8 bg-white rounded-lg border border-dashed border-gray-300">
                  担当者のデータがまだありません
                </p>
              )}
            </section>

            {/* LINE通知 */}
            <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
              <button onClick={() => setShowLine(!showLine)} className="w-full flex items-center gap-2 p-3 bg-transparent text-left">
                <MessageCircle size={18} className="text-green-600" />
                <span className="flex-1 text-sm font-bold text-gray-800">LINE通知</span>
                <span className={clsx('text-[11px] font-bold', line?.tokenSet ? 'text-green-700' : 'text-gray-400')}>
                  {line?.tokenSet ? '設定済み' : '未設定'}
                </span>
                {showLine ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showLine && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3 text-xs text-gray-700">
                  <p>平日のみ、担当者には朝7時に「今日の目標」、管理者には夕方18時に「全体レポート」を送ります（土日・祝日はお休み）。</p>
                  <div>
                    <label className="block font-medium text-gray-600 mb-1">チャネルアクセストークン（長期）</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 min-w-0 p-2 border border-gray-300 rounded-md font-mono text-[11px]"
                        placeholder={line?.tokenSet ? '設定済み（変更する時だけ入力）' : 'LINE Developersで発行したトークン'}
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        autoCapitalize="off"
                        autoCorrect="off"
                      />
                      <button onClick={saveToken} disabled={!tokenInput.trim()} className="px-3 rounded-md bg-green-600 text-white font-bold disabled:opacity-50">
                        保存
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-gray-600 mb-1">登録状況（管理者 {line?.managers ?? 0}名）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(line?.staff || {}).map(([name, ok]) => (
                        <span key={name} className={clsx('px-2 py-0.5 rounded border flex items-center gap-1', ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-400')}>
                          {ok && <Check size={12} />}{name}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      公式アカウントを友だち追加して、担当者は「登録 名前」、管理者は「管理者登録 管理キー」と送ると登録されます。
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => sendNow('morning')} disabled={!line?.tokenSet} className="flex-1 py-2 rounded-md border border-gray-300 bg-white font-medium disabled:opacity-50">
                      朝の通知を今すぐ送る
                    </button>
                    <button onClick={() => sendNow('evening')} disabled={!line?.tokenSet} className="flex-1 py-2 rounded-md border border-gray-300 bg-white font-medium disabled:opacity-50">
                      夕方の通知を今すぐ送る
                    </button>
                  </div>
                </div>
              )}
            </section>

            <p className="text-[11px] text-gray-400">
              切替率＝新商品を1つ以上入れている台数 ÷ そのメーカーの全台数（月〜金、同じ得意先番号は1台）。5分ごとに自動更新します。
            </p>
          </>
        )}

        {!overall && !error && !showSettings && (
          <p className="text-center text-sm text-gray-500 py-10">{loading ? '読み込み中…' : 'データがありません'}</p>
        )}
      </main>
    </div>
  );
};
