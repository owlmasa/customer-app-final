import React, { useEffect, useRef, useState } from 'react';
import { Loader2, UserCheck, AlertTriangle, MonitorSmartphone } from 'lucide-react';
import { GAS_URL, LIFF_ID } from '../config';
import { liffLogin, liffRegister, LiffResult } from '../sync/api';
import { pullFromServer, useSync } from '../sync/useSync';

const ADMIN_CONFIG_KEY = 'customer-manager-admin';

type Phase = 'checking' | 'ready' | 'register' | 'error';

const isAdminPath = () => window.location.pathname.replace(/\/+$/, '') === '/admin';

// 管理者なら、親機の接続設定を自動で保存
const saveAdminConfig = (adminKey: string) => {
  try {
    localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify({ gasUrl: GAS_URL, adminKey }));
  } catch {
    // 無視
  }
};

export const hasAdminAccess = () => {
  try {
    return !!JSON.parse(localStorage.getItem(ADMIN_CONFIG_KEY) || '{}').adminKey;
  } catch {
    return false;
  }
};

// LINEアプリ内（LIFF）で開いたときに、LINEアカウントで自動ログインする
// ふつうのブラウザで開いたときは、これまでどおり（接続設定で接続）
export const LiffGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [phase, setPhase] = useState<Phase>(LIFF_ID ? 'checking' : 'ready');
  const [message, setMessage] = useState('');
  const [names, setNames] = useState<string[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [busy, setBusy] = useState(false);
  const tokenRef = useRef('');
  const renderedRef = useRef(false);

  const apply = (r: LiffResult) => {
    if (r.adminKey) saveAdminConfig(r.adminKey);
    setIsManager(!!r.isManager);

    if (r.staff && r.key) {
      const s = useSync.getState();
      const changed = s.staff !== r.staff || s.apiKey !== r.key || s.gasUrl !== GAS_URL;
      if (changed) {
        useSync.setState({ gasUrl: GAS_URL, apiKey: r.key, staff: r.staff, version: 0, dirty: false, status: 'idle', message: '' });
        // すでに画面を出していれば読み込み直す（まだなら画面表示時に読み込まれる）
        if (renderedRef.current) pullFromServer();
      }
      setPhase('ready');
      return;
    }

    // 担当者として未登録
    if (r.isManager && isAdminPath()) {
      setPhase('ready');
      return;
    }
    setNames(r.unregistered || []);
    setPhase('register');
  };

  useEffect(() => {
    if (!LIFF_ID) return;
    (async () => {
      try {
        const liff = (await import('@line/liff')).default;
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isInClient() && !liff.isLoggedIn()) {
          // LINEの外（Safariなど）で開いた場合は従来どおり
          setPhase('ready');
          return;
        }
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        tokenRef.current = liff.getIDToken() || '';

        // 接続済みなら先に画面を出し、裏で本人確認する
        const s = useSync.getState();
        if (s.staff && s.apiKey && s.gasUrl) setPhase('ready');

        apply(await liffLogin(GAS_URL, tokenRef.current));
      } catch (e) {
        const s = useSync.getState();
        if (s.staff && s.apiKey) {
          setPhase('ready'); // 接続済みならそのまま使えるようにする
          return;
        }
        setMessage(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'ready') renderedRef.current = true;
  }, [phase]);

  const register = async (name: string) => {
    if (!window.confirm(`「${name}」として登録します。よろしいですか？\n（あとから変更するには管理者に連絡が必要です）`)) return;
    setBusy(true);
    setMessage('');
    try {
      apply(await liffRegister(GAS_URL, tokenRef.current, name));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'ready') return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
        {phase === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-6 text-gray-600">
            <Loader2 size={28} className="animate-spin text-green-600" />
            <p className="text-sm">LINEでログインしています…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-700 font-bold">
              <AlertTriangle size={20} />
              <span>ログインできませんでした</span>
            </div>
            <p className="text-sm text-gray-700">{message}</p>
            <button onClick={() => window.location.reload()} className="w-full py-2.5 rounded-md bg-green-600 text-white font-bold">
              もう一度試す
            </button>
          </div>
        )}

        {phase === 'register' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <UserCheck size={20} className="text-green-600" />
              <span>はじめに、あなたの名前を選んでください</span>
            </div>
            <p className="text-xs text-gray-500">このLINEアカウントと担当者を結びつけます。次からは自動でログインします。</p>
            {names.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {names.map(n => (
                  <button
                    key={n}
                    disabled={busy}
                    onClick={() => register(n)}
                    className="py-3 rounded-md bg-green-50 text-sm font-bold text-green-800 ring-1 ring-green-300 disabled:opacity-50"
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-700 bg-gray-50 border border-dashed border-gray-300 rounded-md p-3">
                選べる名前がありません。管理者に、担当者シートへ名前を追加してもらってください。
              </p>
            )}
            {message && <p className="text-xs text-red-600">{message}</p>}
            {isManager && (
              <a href="/admin" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-slate-900 text-white text-sm font-bold">
                <MonitorSmartphone size={16} /> 親機を開く
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
