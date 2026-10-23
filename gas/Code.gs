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
const SHEET_TARGETS = '目標';
const SHEET_MANAGERS = '管理者';
const SHEET_DAILY = '日次記録';
const SHEET_SETTINGS = '設定';
const SHEET_FOLLOW = 'フォロー依頼';
const DEFAULT_FOLLOW_TARGET = '荒川凌'; // フォロー依頼の送り先（「設定」シートで変更できます）
const TZ = 'Asia/Tokyo';
const LINE_LOGIN_CHANNEL_ID = '2012167490'; // LIFFを作ったLINEログインチャネルのチャネルID
const MORNING_HOUR = 7;  // 担当者への通知
const EVENING_HOUR = 18; // 管理者への通知

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
  ensureSheet_(ss, SHEET_TARGETS, ['年月', '目標切替率(%)']);
  ensureSheet_(ss, SHEET_MANAGERS, ['LINE ID', '登録日時']);
  ensureSheet_(ss, SHEET_DAILY, ['日付', '時間帯', '担当者', '全台数', '切替台数', '切替率(%)']);
  const staffSheet = ss.getSheetByName(SHEET_STAFF);
  if (!staffSheet.getRange(1, 2).getValue()) staffSheet.getRange(1, 2).setValue('LINE ID').setFontWeight('bold');
  ss.getSheetByName(SHEET_TARGETS).getRange('A:A').setNumberFormat('@');

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
  // 通知用の定期実行（1時間ごと。日本時間の7時・18時だけ送信）
  const hasTrigger = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'hourlyJob');
  if (!hasTrigger) ScriptApp.newTrigger('hourlyJob').timeBased().everyHours(1).create();

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
  // LINEからのWebhook
  if (body && Array.isArray(body.events)) {
    try {
      handleLineWebhook_(body.events);
    } catch (err) {
      console.error(err);
    }
    return ContentService.createTextOutput('OK');
  }
  return handle_(body);
}

function handle_(req) {
  try {
    const props = PropertiesService.getScriptProperties();

    // 親機：全担当者のデータ（管理キーが必要）
    // LIFF（LINEログイン）：キー不要。LINEのIDトークンで本人確認する
    if (req.action === 'liffLogin') return json_(liffLogin_(req.idToken));
    if (req.action === 'liffRegister') return json_(liffRegister_(req.idToken, req.name));

    const ADMIN_ACTIONS = ['all', 'setTarget', 'setLineToken', 'notifyNow'];
    if (ADMIN_ACTIONS.indexOf(req.action) !== -1) {
      const adminKey = props.getProperty('ADMIN_KEY');
      if (!adminKey || req.key !== adminKey) return json_({ ok: false, error: '管理キーが違います' });
      switch (req.action) {
        case 'all':
          return json_({ ok: true, staff: loadAll_(), targets: getTargets_(), line: lineStatus_() });
        case 'setTarget':
          setTarget_(req.month, req.target);
          return json_({ ok: true, targets: getTargets_() });
        case 'setLineToken':
          props.setProperty('LINE_TOKEN', String(req.token || '').trim());
          return json_({ ok: true, line: lineStatus_() });
        case 'notifyNow':
          return json_(Object.assign({ ok: true }, req.type === 'evening' ? eveningJob_(true) : morningJob_(true)));
      }
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
      case 'followTarget':
        return json_(followTargetInfo_());
      case 'followRequest':
        return json_(followRequest_(req.staff, req.items));
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

// =====================================================================
// 目標
// =====================================================================
function monthKey_(date) {
  return Utilities.formatDate(date || new Date(), TZ, 'yyyy-MM');
}

function getTargets_() {
  const out = {};
  rowsOf_(ss_().getSheetByName(SHEET_TARGETS)).forEach(r => {
    const m = r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, 'yyyy-MM') : String(r[0]).trim();
    if (m && r[1] !== '') out[m] = Number(r[1]);
  });
  return out;
}

function setTarget_(month, target) {
  const m = String(month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error('年月の形式が正しくありません');
  const t = Number(target);
  if (!(t >= 0 && t <= 100)) throw new Error('目標は0〜100の数字で入力してください');
  const sh = ss_().getSheetByName(SHEET_TARGETS);
  const rows = rowsOf_(sh);
  for (let i = 0; i < rows.length; i++) {
    const rm = rows[i][0] instanceof Date ? Utilities.formatDate(rows[i][0], TZ, 'yyyy-MM') : String(rows[i][0]).trim();
    if (rm === m) {
      sh.getRange(i + 2, 2).setValue(t);
      return;
    }
  }
  sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[m, t]]);
}

// =====================================================================
// 切替率の計算（アプリと同じ考え方：月〜金・同じ得意先番号は1台）
// =====================================================================
const WEEKDAYS_JA = ['月', '火', '水', '木', '金'];

function staffStats_(d) {
  const groups = {};
  WEEKDAYS_JA.forEach(day => {
    (d.schedules[day] || []).forEach(id => {
      const c = d.customers[id];
      if (!c) return;
      const key = String(c.customerNumber || '').trim() || c.id;
      (groups[key] = groups[key] || []).push(c);
    });
  });
  let total = 0;
  let switched = 0;
  let unassigned = 0;
  const switchedKeys = {};
  Object.keys(groups).forEach(key => {
    const list = groups[key];
    const withMaker = list.filter(c => c.maker);
    if (withMaker.length === 0) {
      unassigned++;
      return;
    }
    const maker = withMaker[0].maker;
    total++;
    if (list.some(c => c.maker === maker && (c.newProducts || []).length > 0)) {
      switched++;
      switchedKeys[key] = true;
    }
  });
  return { total: total, switched: switched, unassigned: unassigned, rate: total ? switched / total * 100 : 0, switchedKeys: switchedKeys };
}

// =====================================================================
// 営業日（土日・祝日を除く）
// =====================================================================
function holidaySet_(from, to) {
  const set = {};
  try {
    const cal = CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com');
    if (cal) {
      cal.getEvents(from, new Date(to.getTime() + 24 * 3600 * 1000)).forEach(ev => {
        set[Utilities.formatDate(ev.getStartTime(), TZ, 'yyyy-MM-dd')] = true;
      });
    }
  } catch (err) {
    console.warn('祝日カレンダーを読めませんでした: ' + err);
  }
  return set;
}

function jstParts_(date) {
  const s = Utilities.formatDate(date, TZ, 'yyyy-MM-dd-u-H');
  const p = s.split('-');
  // u: 1=月 … 7=日
  return { ymd: p[0] + '-' + p[1] + '-' + p[2], y: Number(p[0]), m: Number(p[1]), d: Number(p[2]), dow: Number(p[3]), hour: Number(p[4]) };
}

function isBusinessDay_(date, holidays) {
  const j = jstParts_(date);
  return j.dow <= 5 && !holidays[j.ymd];
}

// 今日を含めた月末までの残り営業日
function remainingBusinessDays_(now, holidays) {
  const j = jstParts_(now);
  const lastDay = new Date(j.y, j.m, 0).getDate();
  let count = 0;
  for (let d = j.d; d <= lastDay; d++) {
    const dt = Utilities.parseDate(j.y + '-' + j.m + '-' + d + ' 12:00', TZ, 'yyyy-M-d HH:mm');
    if (isBusinessDay_(dt, holidays)) count++;
  }
  return count;
}

// =====================================================================
// LINE
// =====================================================================
function lineToken_() {
  return PropertiesService.getScriptProperties().getProperty('LINE_TOKEN') || '';
}

function lineStatus_() {
  const staffRows = rowsOf_(ss_().getSheetByName(SHEET_STAFF));
  const staff = {};
  staffRows.forEach(r => {
    const name = String(r[0]).trim();
    if (name) staff[name] = !!String(r[1] || '').trim();
  });
  return {
    tokenSet: !!lineToken_(),
    staff: staff,
    managers: rowsOf_(ss_().getSheetByName(SHEET_MANAGERS)).filter(r => String(r[0]).trim()).length,
  };
}

function linePush_(to, text) {
  const token = lineToken_();
  if (!token || !to) return false;
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) console.error('LINE送信エラー: ' + res.getContentText());
  return res.getResponseCode() === 200;
}

function lineReply_(replyToken, text) {
  const token = lineToken_();
  if (!token || !replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true,
  });
}

// 友だちからのメッセージで登録
//   担当者：「登録 田中太郎」
//   管理者：「管理者登録 （管理キー）」
function handleLineWebhook_(events) {
  const ss = ss_();
  events.forEach(ev => {
    if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
    const userId = ev.source && ev.source.userId;
    if (!userId) return;
    const text = String(ev.message.text || '').replace(/　/g, ' ').trim();

    let m = text.match(/^管理者登録\s+(\S+)$/);
    if (m) {
      const adminKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
      if (m[1] !== adminKey) {
        lineReply_(ev.replyToken, '管理キーが違います。');
        return;
      }
      const sh = ss.getSheetByName(SHEET_MANAGERS);
      const exists = rowsOf_(sh).some(r => r[0] === userId);
      if (!exists) sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[userId, new Date()]]);
      lineReply_(ev.replyToken, '管理者として登録しました。平日' + EVENING_HOUR + '時に全体レポートを送ります。');
      return;
    }

    m = text.match(/^登録\s+(.+)$/);
    if (m) {
      const name = m[1].replace(/\s+/g, '').trim();
      const sh = ss.getSheetByName(SHEET_STAFF);
      const rows = rowsOf_(sh);
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0]).replace(/\s+/g, '').trim() === name) {
          sh.getRange(i + 2, 2).setValue(userId);
          lineReply_(ev.replyToken, String(rows[i][0]).trim() + 'さんを登録しました。平日' + MORNING_HOUR + '時に今日の目標をお送りします。');
          return;
        }
      }
      lineReply_(ev.replyToken, '「' + name + '」は担当者シートに見つかりませんでした。管理者に確認してください。');
      return;
    }

    lineReply_(ev.replyToken, '登録するには「登録 （あなたの名前）」と送ってください。\n例）登録 田中太郎');
  });
}

// =====================================================================
// 定期実行（1時間ごと）
// =====================================================================
function hourlyJob() {
  const now = new Date();
  const j = jstParts_(now);
  const props = PropertiesService.getScriptProperties();
  const holidays = holidaySet_(now, now);
  if (!isBusinessDay_(now, holidays)) return;

  if (j.hour === MORNING_HOUR && props.getProperty('LAST_MORNING') !== j.ymd) {
    props.setProperty('LAST_MORNING', j.ymd);
    morningJob_(false);
  }
  if (j.hour === EVENING_HOUR && props.getProperty('LAST_EVENING') !== j.ymd) {
    props.setProperty('LAST_EVENING', j.ymd);
    eveningJob_(false);
  }
}

function recordDaily_(ymd, slot, rows) {
  const sh = ss_().getSheetByName(SHEET_DAILY);
  const others = rowsOf_(sh).filter(r => !(fmtYmd_(r[0]) === ymd && r[1] === slot)).map(r => r.slice(0, 6));
  const all = others.concat(rows.map(r => [ymd, slot, r.name, r.total, r.switched, Math.round(r.rate)]));
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (all.length) sh.getRange(2, 1, all.length, 6).setValues(all);
}

function fmtYmd_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v);
}

function dailyRecord_(ymd, slot, name) {
  const r = rowsOf_(ss_().getSheetByName(SHEET_DAILY)).find(r => fmtYmd_(r[0]) === ymd && r[1] === slot && r[2] === name);
  return r ? { total: Number(r[3]), switched: Number(r[4]) } : null;
}

function dateLabel_(now) {
  const j = jstParts_(now);
  return j.m + '/' + j.d + '(' + ['', '月', '火', '水', '木', '金', '土', '日'][j.dow] + ')';
}

function gapText_(rate, target) {
  const gap = Math.round(rate) - target;
  return (gap >= 0 ? '+' : '') + gap + 'pt';
}

// 朝：各担当者へ
function morningJob_(manual) {
  const now = new Date();
  const j = jstParts_(now);
  const holidays = holidaySet_(now, new Date(j.y, j.m, 0));
  const target = getTargets_()[monthKey_(now)];
  const remainDays = Math.max(1, remainingBusinessDays_(now, holidays));
  const todayDow = ['', '月', '火', '水', '木', '金', '土', '日'][j.dow];
  const staffRows = rowsOf_(ss_().getSheetByName(SHEET_STAFF));
  const all = loadAll_();
  const snapshot = [];
  let sent = 0;

  all.forEach(d => {
    const st = staffStats_(d);
    snapshot.push({ name: d.name, total: st.total, switched: st.switched, rate: st.rate });

    const row = staffRows.find(r => String(r[0]).trim() === d.name);
    const lineId = row ? String(row[1] || '').trim() : '';
    if (!lineId) return;

    const todayIds = d.schedules[todayDow] || [];
    const lines = ['【' + dateLabel_(now) + ' ' + d.name + 'さん】', '今日の訪問：' + todayIds.length + '件'];

    if (typeof target === 'number') {
      const need = Math.max(0, Math.ceil(st.total * target / 100) - st.switched);
      const perDay = Math.ceil(need / remainDays);
      lines.push('今月の目標：' + target + '%（現在 ' + Math.round(st.rate) + '%｜' + gapText_(st.rate, target) + '）');
      lines.push('今日の最低切替：' + perDay + '台');
      lines.push('（残り必要 ' + need + '台 ÷ 残り' + remainDays + '営業日）');
    } else {
      lines.push('今月の目標：未設定（現在 ' + Math.round(st.rate) + '%）');
    }

    const seen = {};
    const notSwitched = [];
    let noMaker = 0;
    todayIds.forEach(id => {
      const c = d.customers[id];
      if (!c) return;
      const key = String(c.customerNumber || '').trim() || c.id;
      if (seen[key]) return;
      seen[key] = true;
      if (!c.maker) {
        noMaker++;
        return;
      }
      if (!st.switchedKeys[key]) notSwitched.push('・' + c.name + '（' + c.maker + '）');
    });

    lines.push('');
    if (notSwitched.length) {
      lines.push('▼今日回る未切替ロケーション（' + notSwitched.length + '件）');
      lines.push.apply(lines, notSwitched.slice(0, 60));
      if (notSwitched.length > 60) lines.push('ほか' + (notSwitched.length - 60) + '件');
    } else {
      lines.push('今日回る先はすべて切替済みです');
    }
    if (noMaker) lines.push('※メーカー未選択：' + noMaker + '件');

    if (linePush_(lineId, lines.join('\n'))) sent++;
  });

  if (!manual) recordDaily_(j.ymd, '朝', snapshot);
  return { sent: sent, type: 'morning' };
}

// 夕方：管理者へ
function eveningJob_(manual) {
  const now = new Date();
  const j = jstParts_(now);
  const target = getTargets_()[monthKey_(now)];
  const all = loadAll_();
  const rows = all.map(d => {
    const st = staffStats_(d);
    const morning = dailyRecord_(j.ymd, '朝', d.name);
    return { name: d.name, total: st.total, switched: st.switched, rate: st.rate, today: morning ? st.switched - morning.switched : null };
  }).sort((a, b) => b.rate - a.rate);

  const total = rows.reduce((a, r) => a + r.total, 0);
  const switched = rows.reduce((a, r) => a + r.switched, 0);
  const rate = total ? switched / total * 100 : 0;
  const todaySum = rows.reduce((a, r) => a + (r.today || 0), 0);
  const hasToday = rows.some(r => r.today !== null);

  const lines = ['【' + dateLabel_(now) + ' 夕方レポート】'];
  lines.push('全体：' + Math.round(rate) + '%（' + switched + '/' + total + '台）' +
    (typeof target === 'number' ? '\n今月の目標：' + target + '%（' + gapText_(rate, target) + '）' : '\n今月の目標：未設定'));
  if (hasToday) lines.push('本日の切替：+' + todaySum + '台');
  lines.push('');
  lines.push('▼担当者別');
  rows.forEach((r, i) => {
    lines.push((i + 1) + '. ' + r.name + ' ' + Math.round(r.rate) + '%' +
      (typeof target === 'number' ? '（' + gapText_(r.rate, target) + '）' : '') +
      (r.today !== null ? ' 本日+' + r.today : ''));
  });
  if (typeof target === 'number') {
    const below = rows.filter(r => Math.round(r.rate) < target);
    lines.push('');
    lines.push(below.length
      ? '▼目標未達（' + below.length + '名）\n' + below.map(r => r.name + '（' + gapText_(r.rate, target) + '）').join('\n')
      : '全員が目標を達成しています');
  }

  const text = lines.join('\n');
  let sent = 0;
  rowsOf_(ss_().getSheetByName(SHEET_MANAGERS)).forEach(r => {
    if (String(r[0]).trim() && linePush_(String(r[0]).trim(), text)) sent++;
  });
  if (!manual) recordDaily_(j.ymd, '夕', rows);
  return { sent: sent, type: 'evening' };
}

// =====================================================================
// LIFF（LINEログイン）
// =====================================================================
function verifyIdToken_(idToken) {
  if (!LINE_LOGIN_CHANNEL_ID) throw new Error('LINE_LOGIN_CHANNEL_ID が設定されていません');
  if (!idToken) throw new Error('LINEの認証情報がありません');
  const res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post',
    payload: { id_token: String(idToken), client_id: String(LINE_LOGIN_CHANNEL_ID) },
    muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200 || !body.sub) throw new Error('LINEの認証に失敗しました。アプリを開き直してください');
  return body.sub;
}

function liffResult_(userId) {
  const props = PropertiesService.getScriptProperties();
  const staffRows = rowsOf_(ss_().getSheetByName(SHEET_STAFF));
  const mine = staffRows.find(r => String(r[1] || '').trim() === userId);
  const isManager = rowsOf_(ss_().getSheetByName(SHEET_MANAGERS)).some(r => String(r[0]).trim() === userId);
  const out = { ok: true, isManager: isManager };
  if (mine) {
    out.staff = String(mine[0]).trim();
    out.key = props.getProperty('API_KEY');
  } else {
    // まだ登録していない人には、未登録の担当者名を返す（アプリ上で選んで登録）
    out.unregistered = staffRows
      .filter(r => String(r[0]).trim() && !String(r[1] || '').trim())
      .map(r => String(r[0]).trim());
  }
  if (isManager) out.adminKey = props.getProperty('ADMIN_KEY');
  return out;
}

function liffLogin_(idToken) {
  return liffResult_(verifyIdToken_(idToken));
}

function liffRegister_(idToken, name) {
  const userId = verifyIdToken_(idToken);
  const target = String(name || '').replace(/\s+/g, '');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('混み合っています。少し待ってから再度お試しください');
  try {
    const sh = ss_().getSheetByName(SHEET_STAFF);
    const rows = rowsOf_(sh);
    if (rows.some(r => String(r[1] || '').trim() === userId)) return liffResult_(userId);
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).replace(/\s+/g, '') !== target) continue;
      const current = String(rows[i][1] || '').trim();
      if (current && current !== userId) {
        return { ok: false, error: '「' + String(rows[i][0]).trim() + '」は別のLINEアカウントで登録済みです。管理者に確認してください' };
      }
      sh.getRange(i + 2, 2).setValue(userId);
      return liffResult_(userId);
    }
    return { ok: false, error: '担当者シートに「' + name + '」がありません' };
  } finally {
    lock.releaseLock();
  }
}

// =====================================================================
// フォロー依頼
// =====================================================================
function settingsSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_SETTINGS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_SETTINGS);
    sh.getRange(1, 1, 2, 2).setValues([['項目', '値'], ['フォロー依頼の送り先', DEFAULT_FOLLOW_TARGET]]);
    sh.getRange(1, 1, 1, 2).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getSetting_(name, fallback) {
  const row = rowsOf_(settingsSheet_()).find(r => String(r[0]).trim() === name);
  const v = row ? String(row[1] || '').trim() : '';
  return v || fallback;
}

function followTargetInfo_() {
  const name = getSetting_('フォロー依頼の送り先', DEFAULT_FOLLOW_TARGET);
  const row = rowsOf_(ss_().getSheetByName(SHEET_STAFF)).find(r => String(r[0]).trim() === name);
  return { ok: true, target: name, registered: !!(row && String(row[1] || '').trim()) };
}

function followSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET_FOLLOW);
  if (!sh) {
    sh = ss.insertSheet(SHEET_FOLLOW);
    const headers = ['依頼日時', '依頼者', '送り先', '得意先番号', '顧客名', '住所', 'メーカー', 'フォロー備考', '送信結果'];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('D:D').setNumberFormat('@');
  }
  return sh;
}

function followRequest_(staff, items) {
  const name = requireStaff_(staff);
  if (!Array.isArray(items) || items.length === 0) throw new Error('フォロー先が選ばれていません');
  if (items.length > 100) throw new Error('一度に依頼できるのは100件までです');

  const info = followTargetInfo_();
  const targetRow = rowsOf_(ss_().getSheetByName(SHEET_STAFF)).find(r => String(r[0]).trim() === info.target);
  const targetId = targetRow ? String(targetRow[1] || '').trim() : '';
  if (!targetId) throw new Error(info.target + 'さんがLINE登録されていないため送れません');
  if (!lineToken_()) throw new Error('LINEのトークンが設定されていません（親機のLINE通知で設定してください）');

  // 得意先の情報はスプレッドシートの最新のものを使う
  const d = load_(name);
  const daysOf = id => ['月', '火', '水', '木', '金', 'その他'].filter(day => (d.schedules[day] || []).indexOf(id) !== -1);
  const byNumber = {};
  Object.keys(d.customers).forEach(id => {
    const c = d.customers[id];
    const key = String(c.customerNumber || '').trim() || id;
    (byNumber[key] = byNumber[key] || []).push(id);
  });

  const now = new Date();
  const blocks = [];
  const logs = [];
  const circled = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  items.forEach((it, i) => {
    const c = d.customers[String(it.id)];
    if (!c) return;
    const key = String(c.customerNumber || '').trim() || c.id;
    // 複製されている得意先は、すべての訪問曜日をまとめて表示
    const days = [];
    (byNumber[key] || [c.id]).forEach(id => daysOf(id).forEach(x => { if (days.indexOf(x) === -1) days.push(x); }));
    const note = String(it.note || '').trim();
    const no = i < circled.length ? circled[i] : '(' + (i + 1) + ')';
    const lines = [no + ' ' + c.name + '（No.' + c.customerNumber + '）'];
    if (days.length) lines.push('曜日：' + days.join('・'));
    if (c.address) {
      lines.push('住所：' + c.address);
      lines.push('地図：https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address));
    }
    lines.push('メーカー：' + (c.maker || '未選択') + (c.maker ? '／新商品：' + ((c.newProducts || []).join('・') || 'なし') : ''));
    const attrs = [];
    if (c.visitFrequency) attrs.push('訪問頻度 ' + c.visitFrequency);
    if (c.locationType) attrs.push(c.locationType);
    if (c.isCorporate) attrs.push('法人');
    if (c.isTrashCollection) attrs.push('ゴミ回収あり');
    if (attrs.length) lines.push(attrs.join('／'));
    if (c.remarks) lines.push('備考：' + c.remarks);
    lines.push('▶フォロー備考：' + (note || 'なし'));
    blocks.push(lines.join('\n'));
    logs.push([now, name, info.target, String(c.customerNumber || ''), c.name, c.address || '', c.maker || '', note]);
  });
  if (blocks.length === 0) throw new Error('選んだ得意先が見つかりません。画面を開き直してください');

  const header = '【フォロー依頼】' + name + 'さんから（' + blocks.length + '件）\n' +
    Utilities.formatDate(now, TZ, 'M/d HH:mm') + '\n━━━━━━━━━━';
  // LINEの1通は5,000文字まで。長いときは分けて送る
  const texts = [];
  let cur = header;
  blocks.forEach(b => {
    if ((cur + '\n\n' + b).length > 4500) {
      texts.push(cur);
      cur = b;
    } else {
      cur += '\n\n' + b;
    }
  });
  texts.push(cur);

  let ok = true;
  for (let i = 0; i < texts.length; i += 5) {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + lineToken_() },
      payload: JSON.stringify({ to: targetId, messages: texts.slice(i, i + 5).map(t => ({ type: 'text', text: t })) }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      ok = false;
      console.error('フォロー依頼の送信エラー: ' + res.getContentText());
    }
  }

  const sh = followSheet_();
  const rows = logs.map(r => r.concat([ok ? '送信済み' : '送信失敗']));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  if (!ok) throw new Error('LINEへの送信に失敗しました。時間をおいて再度お試しください');
  return { ok: true, sent: blocks.length, target: info.target };
}
