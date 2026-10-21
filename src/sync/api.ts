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
