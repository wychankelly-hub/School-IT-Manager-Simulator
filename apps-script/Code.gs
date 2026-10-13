const RESPONSE_SHEET = 'Responses';
const ACTION_SHEET = 'Action_Log';

const CASE_TITLES = {
  CASE01_DRIVER: '新打印機不能正常使用',
  CASE02_CPU: '電腦突然非常慢',
  CASE03_STORAGE: '儲存空間快將用盡',
  CASE04_MALWARE: '不斷彈出可疑廣告',
  CASE05_FIREWALL: '視像會議不能連線'
};

const FINAL_ANSWER_KEYS = {
  CASE01_DRIVER: '驅動程式（Device Driver）出現兼容性問題',
  CASE02_CPU: '某個程式大量使用 CPU',
  CASE03_STORAGE: '儲存空間不足',
  CASE04_MALWARE: '電腦可能受到惡意軟件影響',
  CASE05_FIREWALL: '防火牆規則阻擋了視像會議軟件'
};

const RESPONSE_HEADERS = [
  'Timestamp','Lesson_Code','Session_ID','Attempt_No','Class','Student_No',
  'Group_No','Case_ID','Case_Title','Final_Answer','Final_Answer_Correct',
  'Short_Answer','Confidence','Was_Fixed','Action_Count','Undo_Count',
  'Elapsed_Seconds','Action_History_JSON','Misconception_Flags',
  'Security_Incident_Ever','Security_Incident_Count','Final_Security_Score'
];

const ACTION_HEADERS = [
  'Timestamp','Lesson_Code','Session_ID','Class','Student_No','Group_No',
  'Case_ID','Action_Type','Action_Value','Details_JSON'
];

function doGet() {
  ensureSheets_();
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('校園 IT 管理員模擬器')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupSheets() {
  ensureSheets_();
  return '設定完成';
}

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, RESPONSE_SHEET, RESPONSE_HEADERS);
  ensureSheet_(ss, ACTION_SHEET, ACTION_HEADERS);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold');

  sheet.setFrozenRows(1);
  return sheet;
}

function getProgress(identity) {
  ensureSheets_();
  const clean = cleanIdentity_(identity);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESPONSE_SHEET);

  if (sheet.getLastRow() < 2) return { completedCaseIds: [] };

  const data = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues();

  const completed = new Set();

  data.forEach(row => {
    const lessonCode = String(row[1]).trim();
    const className = String(row[4]).trim();
    const studentNo = String(row[5]).trim();
    const caseId = String(row[7]).trim();

    if (
      lessonCode === clean.lesson_code &&
      className === clean.class_name &&
      studentNo === clean.student_no &&
      caseId
    ) completed.add(caseId);
  });

  return { completedCaseIds: Array.from(completed) };
}

function submitCase(payload) {
  ensureSheets_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const identity = cleanIdentity_(payload);
    const caseId = String(payload.case_id || '').trim();
    if (!CASE_TITLES[caseId]) throw new Error('無效的 Case ID');

    const finalAnswer = String(payload.final_answer || '').trim();
    const finalCorrect = finalAnswer === FINAL_ANSWER_KEYS[caseId];

    const history = Array.isArray(payload.action_history)
      ? payload.action_history
      : [];

    const securityIncidentEver = Boolean(payload.security_incident_ever);

    const misconceptionFlags = analyseMisconceptions_(
      caseId,
      history,
      finalAnswer,
      securityIncidentEver
    );

    const attemptNo = getNextAttemptNo_(
      identity.lesson_code,
      identity.class_name,
      identity.student_no,
      caseId
    );

    const row = [
      new Date(),
      safeCell_(identity.lesson_code),
      safeCell_(String(payload.session_id || '')),
      attemptNo,
      safeCell_(identity.class_name),
      safeCell_(identity.student_no),
      safeCell_(identity.group_no),
      caseId,
      CASE_TITLES[caseId],
      safeCell_(finalAnswer),
      finalCorrect,
      safeCell_(String(payload.short_answer || '')),
      safeCell_(String(payload.confidence || '')),
      Boolean(payload.was_fixed),
      Number(payload.action_count || 0),
      Number(payload.undo_count || 0),
      Number(payload.elapsed_seconds || 0),
      safeCell_(JSON.stringify(history)),
      safeCell_(misconceptionFlags.join(' | ')),
      securityIncidentEver,
      Number(payload.security_incident_count || 0),
      Number(payload.final_security_score || 100)
    ];

    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(RESPONSE_SHEET)
      .appendRow(row);

    return { ok: true, attemptNo, finalCorrect };
  } finally {
    lock.releaseLock();
  }
}

function logAction(payload) {
  ensureSheets_();
  const identity = cleanIdentity_(payload);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ACTION_SHEET);
  const details = payload.details ? JSON.stringify(payload.details) : '';

  sheet.appendRow([
    new Date(),
    safeCell_(identity.lesson_code),
    safeCell_(String(payload.session_id || '')),
    safeCell_(identity.class_name),
    safeCell_(identity.student_no),
    safeCell_(identity.group_no),
    safeCell_(String(payload.case_id || '')),
    safeCell_(String(payload.action_type || '')),
    safeCell_(String(payload.action_value || '')),
    safeCell_(details)
  ]);
}

function analyseMisconceptions_(caseId, history, finalAnswer, securityIncidentEver) {
  const flags = [];
  const actions = history.map(item => String(item.action || ''));

  if (caseId === 'CASE01_DRIVER' && actions.includes('執行磁碟清理')) {
    flags.push('曾以磁碟清理解決打印機問題');
  }

  if (caseId === 'CASE02_CPU' && actions.includes('執行磁碟清理')) {
    flags.push('曾以磁碟清理解決高 CPU 使用率');
  }

  if (caseId === 'CASE04_MALWARE' && actions.includes('執行磁碟清理')) {
    flags.push('曾以磁碟清理解決惡意軟件問題');
  }

  if (securityIncidentEver) {
    if (caseId === 'CASE05_FIREWALL') {
      flags.push('曾完全關閉防火牆');
    } else {
      flags.push('曾以關閉防火牆處理與防火牆無直接關係的問題');
    }
  }

  if (FINAL_ANSWER_KEYS[caseId] && finalAnswer !== FINAL_ANSWER_KEYS[caseId]) {
    flags.push('最終概念判斷錯誤');
  }

  return flags;
}

function getNextAttemptNo_(lessonCode, className, studentNo, caseId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESPONSE_SHEET);
  if (sheet.getLastRow() < 2) return 1;

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  let count = 0;

  data.forEach(row => {
    if (
      String(row[1]).trim() === lessonCode &&
      String(row[4]).trim() === className &&
      String(row[5]).trim() === studentNo &&
      String(row[7]).trim() === caseId
    ) count++;
  });

  return count + 1;
}

function cleanIdentity_(obj) {
  const lessonCode = String(obj.lesson_code || '').trim();
  const className = String(obj.class_name || '').trim();
  const studentNo = String(obj.student_no || '').trim();
  const groupNo = String(obj.group_no || '').trim();

  if (!lessonCode) throw new Error('請輸入課堂代碼');
  if (!className) throw new Error('請輸入班別');
  if (!studentNo) throw new Error('請輸入學號');
  if (!groupNo) throw new Error('請輸入小組');

  return {
    lesson_code: lessonCode.substring(0, 30),
    class_name: className.substring(0, 20),
    student_no: studentNo.substring(0, 20),
    group_no: groupNo.substring(0, 20)
  };
}

function safeCell_(value) {
  let text = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}
