import { Customer, DayOfWeek } from '../types';

export interface SyncData {
  customers: Record<string, Customer>;
  schedules: Partial<Record<DayOfWeek, string[]>>;
}

export interface LoadResult extends SyncData {
  ok: true;
  version: number;
  updatedAt: string;
}

export interface SaveResult {
  ok: boolean;
  version?: number;
  updatedAt?: string;
  conflict?: boolean;
  error?: string;
}

export class ApiError extends Error {
  // network: 通信できなかった（オフラインなど）
  constructor(message: string, public network = false) {
    super(message);
  }
}

// GASはプリフライト(CORS)に対応していないため text/plain で送る
const post = async <T>(url: string, body: Record<string, unknown>): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
  } catch {
    throw new ApiError('通信できませんでした', true);
  }
  if (!res.ok) throw new ApiError(`サーバーエラー (${res.status})`);
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('サーバーの応答を読み取れません。ウェブアプリのURLとアクセス設定（全員）を確認してください');
  }
  return json as T;
};

export const fetchStaff = async (url: string, key: string): Promise<string[]> => {
  const r = await post<{ ok: boolean; staff?: string[]; error?: string }>(url, { action: 'staff', key });
  if (!r.ok) throw new ApiError(r.error || '担当者を取得できませんでした');
  return r.staff || [];
};

export const loadData = async (url: string, key: string, staff: string): Promise<LoadResult> => {
  const r = await post<LoadResult | { ok: false; error?: string }>(url, { action: 'load', key, staff });
  if (!r.ok) throw new ApiError((r as any).error || '読み込みに失敗しました');
  return r as LoadResult;
};

export const saveData = (
  url: string,
  key: string,
  staff: string,
  data: SyncData,
  baseVersion: number,
  force = false,
): Promise<SaveResult> => post<SaveResult>(url, { action: 'save', key, staff, data, baseVersion, force });

export interface StaffData extends SyncData {
  name: string;
  version: number;
  updatedAt: string;
}

export interface LineStatus {
  tokenSet: boolean;
  staff: Record<string, boolean>; // 担当者名 → LINE登録済みか
  managers: number;
}

export interface AllResult {
  staff: StaffData[];
  targets: Record<string, number>; // 'yyyy-MM' → 目標切替率(%)
  line?: LineStatus;
}

// 親機用：全担当者のデータ（管理キーが必要）
export const fetchAll = async (url: string, adminKey: string): Promise<AllResult> => {
  const r = await post<{ ok: boolean; error?: string } & Partial<AllResult>>(url, { action: 'all', key: adminKey });
  if (!r.ok) throw new ApiError(r.error || '読み込みに失敗しました');
  return { staff: r.staff || [], targets: r.targets || {}, line: r.line };
};

const adminCall = async <T>(url: string, adminKey: string, body: Record<string, unknown>): Promise<T> => {
  const r = await post<{ ok: boolean; error?: string } & T>(url, { ...body, key: adminKey });
  if (!r.ok) throw new ApiError(r.error || '失敗しました');
  return r;
};

export const setTarget = (url: string, adminKey: string, month: string, target: number) =>
  adminCall<{ targets: Record<string, number> }>(url, adminKey, { action: 'setTarget', month, target });

export const setLineToken = (url: string, adminKey: string, token: string) =>
  adminCall<{ line: LineStatus }>(url, adminKey, { action: 'setLineToken', token });

export const notifyNow = (url: string, adminKey: string, type: 'morning' | 'evening') =>
  adminCall<{ sent: number }>(url, adminKey, { action: 'notifyNow', type });

// LIFF（LINEログイン）：キー不要。IDトークンで本人確認
export interface LiffResult {
  staff?: string;
  key?: string;
  isManager?: boolean;
  adminKey?: string;
  unregistered?: string[];
}

export const liffLogin = async (url: string, idToken: string): Promise<LiffResult> => {
  const r = await post<{ ok: boolean; error?: string } & LiffResult>(url, { action: 'liffLogin', idToken });
  if (!r.ok) throw new ApiError(r.error || 'LINEでのログインに失敗しました');
  return r;
};

export const liffRegister = async (url: string, idToken: string, name: string): Promise<LiffResult> => {
  const r = await post<{ ok: boolean; error?: string } & LiffResult>(url, { action: 'liffRegister', idToken, name });
  if (!r.ok) throw new ApiError(r.error || '登録に失敗しました');
  return r;
};
