import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { fetchStaff, loadData } from './api';
import { pullFromServer, pushToServer, useSync } from './useSync';
import { parseMigrationText } from '../migration';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// URLに ?gas=...&key=... が付いていれば入力欄に自動で入れる
const readUrlParams = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    return { gas: p.get('gas') || '', key: p.get('key') || '' };
  } catch {
    return { gas: '', key: '' };
  }
};

export const ConnectionSettings: React.FC<Props> = ({ isOpen, onClose }) => {
  const sync = useSync();
  const [gasUrl, setGasUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [staffList, setStaffList] = useState<string[]>([]);
  const [staff, setStaff] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [migrationText, setMigrationText] = useState('');
  const [migrationMsg, setMigrationMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const params = readUrlParams();
    setGasUrl(sync.gasUrl || params.gas);
    setApiKey(sync.apiKey || params.key);
    setStaff(sync.staff);
    setStaffList(sync.staff ? [sync.staff] : []);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const loadStaff = async () => {
    setBusy(true);
    setError('');
    try {
      const list = await fetchStaff(gasUrl.trim(), apiKey.trim());
      setStaffList(list);
      if (list.length === 0) setError('担当者シートに名前が入っていません');
      else if (!list.includes(staff)) setStaff(list[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    const url = gasUrl.trim();
    const key = apiKey.trim();
    if (!url || !key || !staff) return;

    if (sync.dirty && sync.staff && sync.staff !== staff) {
      if (!window.confirm(`「${sync.staff}」の未送信の変更があります。担当者を切り替えると、その変更は送信されません。続けますか？`)) return;
    }

    setBusy(true);
    setError('');
    try {
      const server = await loadData(url, key, staff);
      const local = useStore.getState();
      const localCount = Object.keys(local.customers).length;
      const serverCount = Object.keys(server.customers || {}).length;
      const sameStaff = sync.staff === staff && sync.gasUrl === url;

      if (serverCount === 0 && localCount > 0) {
        // スプシが空 → この端末のデータを送る（初回の移行）
        if (!window.confirm(`スプレッドシートの「${staff}」はまだ空です。この端末の${localCount}件をスプレッドシートに保存しますか？`)) {
          setBusy(false);
          return;
        }
        useSync.setState({ gasUrl: url, apiKey: key, staff, version: server.version, dirty: true });
        await pushToServer();
      } else {
        if (localCount > 0 && !sameStaff &&
          !window.confirm(`この端末の${localCount}件は、スプレッドシートの「${staff}」の${serverCount}件に置き換わります。よろしいですか？`)) {
          setBusy(false);
          return;
        }
        useSync.setState({ gasUrl: url, apiKey: key, staff });
        if (sameStaff && sync.dirty) {
          // 同じ担当者で未送信の変更があるなら、先に送る
          await pushToServer();
        } else {
          // 読み込みで置き換え（変更扱いにしない）
          await pullFromServer();
        }
      }
      // 接続用リンクのURL・キーをアドレスバーから消す（再読み込みで設定画面が開かないように）
      try { window.history.replaceState(null, '', window.location.pathname); } catch { /* 無視 */ }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    if (sync.dirty && !window.confirm('未送信の変更があります。接続を解除すると送信されません。解除しますか？')) return;
    sync.disconnect();
    onClose();
  };

  const connected = !!(sync.gasUrl && sync.apiKey && sync.staff);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setMigrationText(text);
      setMigrationMsg('');
    } catch {
      setMigrationMsg('自動で貼り付けできませんでした。下の欄を長押しして「ペースト」してください');
    }
  };

  const importMigration = () => {
    setMigrationMsg('');
    try {
      const data = parseMigrationText(migrationText);
      const count = Object.keys(data.customers).length;
      const days = (Object.keys(data.schedules) as (keyof typeof data.schedules)[])
        .map(d => `${d}${data.schedules[d].length}`)
        .join('・');
      const current = Object.keys(useStore.getState().customers).length;
      const target = connected ? `「${sync.staff}」のスプレッドシート` : 'この端末';
      if (!window.confirm(`${count}件（${days}）を取り込みます。${current > 0 ? `今の${current}件は置き換わります。` : ''}取り込み後、${target}に保存されます。よろしいですか？`)) return;
      // 置き換え → 接続中なら自動でスプレッドシートに保存される
      useStore.getState().replaceAll(data.customers, data.schedules);
      setMigrationText('');
      setMigrationMsg(`${count}件を取り込みました`);
    } catch (e) {
      setMigrationMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-800">スプレッドシート接続</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 bg-transparent"><X size={24} /></button>
        </div>

        <div className="p-4 space-y-4">
          {connected && (
            <div className="text-xs bg-green-50 border border-green-200 text-green-800 rounded-md p-2">
              接続中：<span className="font-bold">{sync.staff}</span>
              {sync.lastSyncedAt && <span className="ml-2 text-green-700">最終同期 {new Date(sync.lastSyncedAt).toLocaleString('ja-JP')}</span>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ウェブアプリのURL</label>
            <input
              type="url"
              className="w-full p-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="https://script.google.com/macros/s/…/exec"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">APIキー</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-md text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>

          <button
            type="button"
            onClick={loadStaff}
            disabled={busy || !gasUrl.trim() || !apiKey.trim()}
            className="w-full py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 border border-gray-300 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            担当者を読み込む
          </button>

          {staffList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">担当者</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={staff}
                onChange={(e) => setStaff(e.target.value)}
              >
                {staffList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex justify-between gap-2 pt-2">
            {connected ? (
              <button type="button" onClick={disconnect} className="px-3 py-2 text-xs text-red-600 bg-red-50 rounded-md">
                接続を解除
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md text-sm">閉じる</button>
              <button
                type="button"
                onClick={connect}
                disabled={busy || !staff || !gasUrl.trim() || !apiKey.trim()}
                className="px-4 py-2 text-white bg-blue-600 rounded-md text-sm disabled:opacity-50"
              >
                接続
              </button>
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            接続すると、変更は自動でスプレッドシートに保存されます。電波が無い時はこの端末に一時保存し、つながった時に送信します。
          </p>

          {connected && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-bold text-gray-800">移行データを貼り付け</p>
              <p className="text-[11px] text-gray-500">
                今の版（端末保存版）の「移行用コピー」でコピーした内容を貼り付けると、曜日・並び順ごと取り込めます。
              </p>
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="w-full py-2 rounded-md text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200"
              >
                コピーした内容を貼り付け
              </button>
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md text-[10px] font-mono h-20"
                placeholder="ここに貼り付け"
                value={migrationText}
                onChange={(e) => setMigrationText(e.target.value)}
              />
              <button
                type="button"
                onClick={importMigration}
                disabled={!migrationText.trim()}
                className="w-full py-2 rounded-md text-sm font-medium bg-purple-600 text-white disabled:opacity-50"
              >
                取り込む
              </button>
              {migrationMsg && <p className="text-xs text-purple-800">{migrationMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
