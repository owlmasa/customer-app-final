/**
 * ルートセールス訪問一覧 v2 — スプレッドシート保存用API（Google Apps Script）
 *
 * 使い方
 *  1. script.google.com で「新しいプロジェクト」を作る
 *     （スプレッドシートの「拡張機能 → Apps Script」から開いてもOK）
 *  2. このファイルの中身を全部貼り付けて保存
 *  3. 関数「setup」を1回実行
 *     → 保存用スプレッドシートが自動で作られ、そのURLとAPIキーがログに出る
 *  4. 「デプロイ → 新しいデプロイ → ウェブアプリ」
 *       実行するユーザー：自分　／　アクセスできるユーザー：全員
 *  5. 発行されたウェブアプリURLと、ログに出たAPIキーをアプリ側に設定する
 */

// ===== 設定 =====
const SHEET_STAFF = '担当者';
const SHEET_CUSTOMERS = '得意先';
const SHEET_SCHEDULES = 'スケジュール';
const SHEET_META = '更新履歴';

const CUSTOMER_HEADERS = [
  'ID', '担当者', '得意先番号', '顧客名', 'メーカー', '新商品',
  '訪問頻度', '法人', 'ゴミ回収', 'ロケーション', '住所', '備考', '更新日時',
];
const SCHEDULE_HEADERS = ['担当者', '曜日', '順番', 'ID', '得意先番号', '顧客名'];
const META_HEADERS = ['担当者', 'バージョン', '更新日時', '件数'];

// ===== 初期設定（最初に1回だけ実行） =====
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss = SpreadsheetApp.getActive();
  if (!ss) {
    // スプレッドシートに紐づいていない場合は、保存用のシートを自動作成
    const id = props.getProperty('SHEET_ID');
    ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('ルートセールス訪問一覧 データ');
    props.setProperty('SHEET_ID', ss.getId());
  }
  ensureSheet_(ss, SHEET_STAFF, ['担当者名']);
  ensureSheet_(ss, SHEET_CUSTOMERS, CUSTOMER_HEADERS);
  ensureSheet_(ss, SHEET_SCHEDULES, SCHEDULE_HEADERS);
  ensureSheet_(ss, SHEET_META, META_HEADERS);

  // 得意先番号やIDの先頭の0が消えないよう文字列扱いにする
  ss.getSheetByName(SHEET_CUSTOMERS).getRange('A:C').setNumberFormat('@');
  ss.getSheetByName(SHEET_SCHEDULES).getRange('D:E').setNumberFormat('@');

  // 自動で作られる空の「シート1」は削除
  ['シート1', 'Sheet1'].forEach(n => {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  let key = props.getProperty('API_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('API_KEY', key);
  }
  // 親機（全担当者を見る画面）用の管理キー
  let adminKey = props.getProperty('ADMIN_KEY');
  if (!adminKey) {
    adminKey = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('ADMIN_KEY', adminKey);
  }
  Logger.log('スプレッドシート: ' + ss.getUrl());
  Logger.log('APIキー: ' + key);
  Logger.log('管理キー（親機用）: ' + adminKey);
}

// 保存先のスプレッドシート
function ss_() {
  const active = SpreadsheetApp.getActive();
  if (active) return active;
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('先に setup を実行してください');
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// ===== 入口 =====
function doGet(e) {
  return handle_(e.parameter || {});
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'JSONの形式が正しくありません' });
  }
  return handle_(body);
}

function handle_(req) {
  try {
    const props = PropertiesService.getScriptProperties();

    // 親機：全担当者のデータ（管理キーが必要）
    if (req.action === 'all') {
      const adminKey = props.getProperty('ADMIN_KEY');
      if (!adminKey || req.key !== adminKey) return json_({ ok: false, error: '管理キーが違います' });
      return json_({ ok: true, staff: loadAll_() });
    }

    const key = props.getProperty('API_KEY');
    if (!key || req.key !== key) return json_({ ok: false, error: 'APIキーが違います' });

    switch (req.action) {
      case 'staff':
        return json_({ ok: true, staff: listStaff_() });
      case 'load':
        return json_(Object.assign({ ok: true }, load_(req.staff)));
      case 'save':
        return json_(save_(req.staff, req.data, req.baseVersion, req.force));
      default:
        return json_({ ok: false, error: '不明な操作です: ' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===== 担当者 =====
function listStaff_() {
  const sh = ss_().getSheetByName(SHEET_STAFF);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .map(r => String(r[0]).trim())
    .filter(Boolean);
}

function requireStaff_(staff) {
  const name = String(staff || '').trim();
  if (!name) throw new Error('担当者が指定されていません');
  if (listStaff_().indexOf(name) === -1) throw new Error('担当者シートに「' + name + '」がありません');
  return name;
}

// ===== 読み込み =====
function load_(staff) {
  const name = requireStaff_(staff);
  const ss = ss_();

  const customers = {};
  rowsOf_(ss.getSheetByName(SHEET_CUSTOMERS)).forEach(r => {
    if (r[1] !== name) return;
    const c = {
      id: String(r[0]),
      customerNumber: String(r[2]),
      name: String(r[3]),
      maker: r[4] ? String(r[4]) : undefined,
      newProducts: r[5] ? String(r[5]).split('/').filter(Boolean) : [],
      visitFrequency: r[6] !== '' ? String(r[6]) : undefined,
      isCorporate: r[7] === true || r[7] === 'TRUE',
      isTrashCollection: r[8] === true || r[8] === 'TRUE',
      locationType: r[9] ? String(r[9]) : undefined,
      address: String(r[10]),
      remarks: String(r[11]),
    };
    customers[c.id] = c;
  });

  const schedules = { '月': [], '火': [], '水': [], '木': [], '金': [], 'その他': [] };
  rowsOf_(ss.getSheetByName(SHEET_SCHEDULES))
    .filter(r => r[0] === name)
    .sort((a, b) => Number(a[2]) - Number(b[2]))
    .forEach(r => {
      const day = String(r[1]);
      const id = String(r[3]);
      if (schedules[day] && customers[id]) schedules[day].push(id);
    });

  const meta = getMeta_(name);
  return { customers: customers, schedules: schedules, version: meta.version, updatedAt: meta.updatedAt };
}

// ===== 全担当者の読み込み（親機用） =====
function loadAll_() {
  return listStaff_().map(name => {
    const d = load_(name);
    return { name: name, customers: d.customers, schedules: d.schedules, version: d.version, updatedAt: d.updatedAt };
  });
}

// ===== 保存（その担当者の分をまるごと置き換え） =====
function save_(staff, data, baseVersion, force) {
  const name = requireStaff_(staff);
  if (!data || typeof data.customers !== 'object' || typeof data.schedules !== 'object') {
    throw new Error('保存データの形式が正しくありません');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('混み合っています。少し待ってから再度お試しください');
  try {
    const meta = getMeta_(name);
    // 別の端末で先に保存されていたら上書きしない
    if (!force && Number(baseVersion || 0) !== meta.version) {
      return { ok: false, conflict: true, version: meta.version, error: '別の端末で更新されています' };
    }

    const ss = ss_();
    const now = new Date();

    const customerRows = Object.keys(data.customers).map(id => {
      const c = data.customers[id] || {};
      return [
        String(c.id || id), name, String(c.customerNumber || ''), String(c.name || ''),
        c.maker || '', (c.newProducts || []).join('/'), c.visitFrequency || '',
        !!c.isCorporate, !!c.isTrashCollection, c.locationType || '',
        String(c.address || ''), String(c.remarks || ''), now,
      ];
    });

    const scheduleRows = [];
    Object.keys(data.schedules).forEach(day => {
      (data.schedules[day] || []).forEach((id, i) => {
        const c = data.customers[id];
        if (!c) return;
        scheduleRows.push([name, day, i + 1, String(id), String(c.customerNumber || ''), String(c.name || '')]);
      });
    });

    replaceRowsOf_(ss.getSheetByName(SHEET_CUSTOMERS), CUSTOMER_HEADERS.length, 1, name, customerRows);
    replaceRowsOf_(ss.getSheetByName(SHEET_SCHEDULES), SCHEDULE_HEADERS.length, 0, name, scheduleRows);

    const version = meta.version + 1;
    setMeta_(name, version, now, customerRows.length);
    return { ok: true, version: version, updatedAt: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

// ===== シート操作の共通処理 =====
function rowsOf_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

// 指定担当者の行だけ消して、新しい行に差し替える（他の担当者の行はそのまま）
function replaceRowsOf_(sh, width, staffCol, name, newRows) {
  const others = rowsOf_(sh)
    .filter(r => r[staffCol] !== name)
    .map(r => r.slice(0, width));
  const all = others.concat(newRows);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (all.length > 0) sh.getRange(2, 1, all.length, width).setValues(all);
}

function getMeta_(name) {
  const rows = rowsOf_(ss_().getSheetByName(SHEET_META));
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === name) {
      const d = rows[i][2];
      return { version: Number(rows[i][1]) || 0, updatedAt: d instanceof Date ? d.toISOString() : String(d || ''), row: i + 2 };
    }
  }
  return { version: 0, updatedAt: '', row: 0 };
}

function setMeta_(name, version, date, count) {
  const sh = ss_().getSheetByName(SHEET_META);
  const meta = getMeta_(name);
  const values = [[name, version, date, count]];
  if (meta.row) sh.getRange(meta.row, 1, 1, 4).setValues(values);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setValues(values);
}
