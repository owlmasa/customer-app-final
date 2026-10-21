import React, { useEffect } from 'react';
import { Cloud, CloudOff, Loader2, AlertTriangle, Check, Settings } from 'lucide-react';
import clsx from 'clsx';
import { isConnected, pullFromServer, pushToServer, syncOnStart, useSync } from './useSync';

// 起動時・復帰時・オンライン復帰時の同期（画面には何も出さない）
export const SyncManager: React.FC = () => {
  useEffect(() => {
    syncOnStart();

    const retry = () => {
      if (!isConnected()) return;
      const { dirty, status } = useSync.getState();
      if (status === 'conflict' || status === 'saving' || status === 'loading') return;
      if (dirty) pushToServer();
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !isConnected()) return;
      const { dirty, status } = useSync.getState();
      if (status === 'conflict' || status === 'saving' || status === 'loading') return;
      // 未送信があれば送る、なければ他の端末の変更を取り込む
      if (dirty) pushToServer();
      else pullFromServer();
    };

    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(retry, 30000);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, []);

  return null;
};

// ヘッダーに出す保存状態ボタン（押すと接続設定を開く）
export const SyncStatusButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { gasUrl, apiKey, staff, status, dirty } = useSync();
  const connected = !!(gasUrl && apiKey && staff);

  let icon = <Settings size={14} />;
  let label = '未接続';
  let tone = 'bg-gray-100 text-gray-600 border-gray-300';

  if (connected) {
    if (status === 'saving' || status === 'loading') {
      icon = <Loader2 size={14} className="animate-spin" />;
      label = status === 'saving' ? '保存中' : '読込中';
      tone = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (status === 'conflict') {
      icon = <AlertTriangle size={14} />;
      label = '要確認';
      tone = 'bg-red-50 text-red-700 border-red-300';
    } else if (status === 'error') {
      icon = <AlertTriangle size={14} />;
      label = 'エラー';
      tone = 'bg-red-50 text-red-700 border-red-300';
    } else if (status === 'offline' || dirty) {
      icon = <CloudOff size={14} />;
      label = '未送信';
      tone = 'bg-yellow-50 text-yellow-800 border-yellow-300';
    } else {
      icon = status === 'saved' ? <Check size={14} /> : <Cloud size={14} />;
      label = '保存済';
      tone = 'bg-green-50 text-green-700 border-green-200';
    }
  }

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1 px-2 py-2 rounded-md border text-xs font-medium whitespace-nowrap flex-shrink-0',
        tone,
      )}
      title={connected ? `${staff}（タップで接続設定）` : '接続設定'}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

// 衝突・エラー時に一覧の上に出す案内
export const SyncBanner: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const { status, message, gasUrl, apiKey, staff } = useSync();
  const connected = !!(gasUrl && apiKey && staff);

  if (!connected) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4 text-sm text-blue-800 flex items-center justify-between gap-3">
        <span>スプレッドシートに未接続です。今はこの端末の中だけに保存されます。</span>
        <button onClick={onOpenSettings} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium whitespace-nowrap">
          接続する
        </button>
      </div>
    );
  }

  if (status === 'conflict') {
    const useServer = () => {
      if (window.confirm('この端末で未送信の変更は消えて、スプレッドシートの内容に置き換わります。よろしいですか？')) {
        pullFromServer();
      }
    };
    const useLocal = () => {
      if (window.confirm('スプレッドシートの内容を、この端末の内容で上書きします。別の端末での変更は消えます。よろしいですか？')) {
        pushToServer(true);
      }
    };
    return (
      <div className="bg-red-50 border border-red-300 rounded-md p-3 mb-4 text-sm text-red-800">
        <p className="font-bold mb-1">{message || '別の端末で先に更新されています'}</p>
        <p className="text-xs mb-2">どちらの内容を残すか選んでください。</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={useServer} className="px-3 py-1.5 bg-white border border-red-300 rounded-md text-xs font-medium">
            スプレッドシートの内容を読み込む
          </button>
          <button onClick={useLocal} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium">
            この端末の内容で上書き
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-red-50 border border-red-300 rounded-md p-3 mb-4 text-sm text-red-800 flex items-center justify-between gap-3">
        <span>同期できませんでした：{message}</span>
        <button onClick={() => pushToServer()} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium whitespace-nowrap">
          再試行
        </button>
      </div>
    );
  }

  return null;
};
