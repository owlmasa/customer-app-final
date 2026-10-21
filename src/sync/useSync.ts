import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStore } from '../store/useStore';
import { ApiError, loadData, saveData } from './api';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict' | 'loading';

interface SyncState {
  // 端末に保存する設定
  gasUrl: string;
  apiKey: string;
  staff: string;
  version: number; // 最後にサーバーと一致したバージョン
  dirty: boolean; // サーバーに未送信の変更がある
  lastSyncedAt: string;

  // 画面表示用（保存しない）
  status: SyncStatus;
  message: string;

  setConfig: (c: { gasUrl: string; apiKey: string; staff: string }) => void;
  disconnect: () => void;
}

export const useSync = create<SyncState>()(
  persist(
    (set) => ({
      gasUrl: '',
      apiKey: '',
      staff: '',
      version: 0,
      dirty: false,
      lastSyncedAt: '',
      status: 'idle',
      message: '',
      setConfig: (c) => set({ ...c }),
      disconnect: () => set({ gasUrl: '', apiKey: '', staff: '', version: 0, dirty: false, status: 'idle', message: '' }),
    }),
    {
      name: 'customer-manager-sync',
      partialize: (s) => ({
        gasUrl: s.gasUrl,
        apiKey: s.apiKey,
        staff: s.staff,
        version: s.version,
        dirty: s.dirty,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
);

export const isConnected = () => {
  const s = useSync.getState();
  return !!(s.gasUrl && s.apiKey && s.staff);
};

// サーバーの内容を読み込んで置き換えている間は「変更あり」にしない
let applyingRemote = false;
let saving = false;
let saveAgain = false;
let timer: ReturnType<typeof setTimeout> | undefined;

const errorStatus = (e: unknown) => {
  if (e instanceof ApiError && e.network) {
    useSync.setState({ status: 'offline', message: '電波が戻ったら自動で送信します' });
  } else {
    useSync.setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};

// サーバーから読み込み（この端末の内容は置き換わる）
export const pullFromServer = async () => {
  const { gasUrl, apiKey, staff } = useSync.getState();
  if (!isConnected()) return;
  useSync.setState({ status: 'loading', message: '' });
  try {
    const r = await loadData(gasUrl, apiKey, staff);
    applyingRemote = true;
    useStore.getState().replaceAll(r.customers || {}, r.schedules || {});
    applyingRemote = false;
    useSync.setState({ version: r.version, dirty: false, status: 'saved', message: '', lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    applyingRemote = false;
    errorStatus(e);
  }
};

// サーバーへ保存
export const pushToServer = async (force = false) => {
  if (!isConnected()) return;
  if (saving) {
    saveAgain = true;
    return;
  }
  saving = true;
  const { gasUrl, apiKey, staff, version } = useSync.getState();
  const { customers, schedules } = useStore.getState();
  useSync.setState({ status: 'saving', message: '' });
  try {
    const r = await saveData(gasUrl, apiKey, staff, { customers, schedules }, version, force);
    if (r.ok && typeof r.version === 'number') {
      // 送信中にさらに変更があれば、続けてもう一度送る
      useSync.setState({ version: r.version, dirty: saveAgain, status: 'saved', message: '', lastSyncedAt: new Date().toISOString() });
    } else if (r.conflict) {
      saveAgain = false;
      useSync.setState({ status: 'conflict', message: '別の端末で先に更新されています' });
    } else {
      saveAgain = false;
      useSync.setState({ status: 'error', message: r.error || '保存に失敗しました' });
    }
  } catch (e) {
    saveAgain = false;
    errorStatus(e);
  } finally {
    saving = false;
  }
  if (saveAgain) {
    saveAgain = false;
    pushToServer();
  }
};

// 変更があったら少し待ってまとめて送る
export const scheduleSave = (delay = 1500) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => pushToServer(), delay);
};

// 接続直後・起動時の同期
export const syncOnStart = async () => {
  if (!isConnected()) return;
  const s = useSync.getState();
  if (s.dirty) {
    // 未送信の変更があれば先に送る（衝突したら画面で選んでもらう）
    await pushToServer();
    return;
  }
  await pullFromServer();
};

// データが変わったら「未送信」にして保存を予約
useStore.subscribe((state, prev) => {
  if (applyingRemote) return;
  if (state.customers === prev.customers && state.schedules === prev.schedules) return;
  if (!isConnected()) return;
  useSync.setState({ dirty: true });
  if (saving) saveAgain = true;
  scheduleSave();
});
