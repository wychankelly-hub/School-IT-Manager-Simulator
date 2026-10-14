const RESPONSE_SHEET = 'Responses';
const ACTION_SHEET = 'Action_Log';

const MAX_ACTION_EVENTS = 200;

/*
  Responses 原有欄位保留，
  最後新增：
  - Submission_ID
  - Client_Submitted_At
*/
const RESPONSE_HEADERS = [
  'Timestamp',
  'Lesson_Code',
  'Session_ID',
  'Attempt_No',
  'Class',
  'Student_No',
  'Group_No',
  'Case_ID',
  'Case_Title',

  'Final_Answer',
  'Final_Answer_Correct',

  'Short_Answer',
  'Confidence',

  'Was_Fixed',
  'Action_Count',
  'Undo_Count',
  'Elapsed_Seconds',

  'Action_History_JSON',
  'Misconception_Flags',

  'Security_Incident_Ever',
  'Security_Incident_Count',
  'Final_Security_Score',

  'Submission_ID',
  'Client_Submitted_At'
];


/*
  Action_Log 原有欄位保留，
  最後新增：
  - Submission_ID
  - Event_Index
  - Client_Time
*/
const ACTION_HEADERS = [
  'Timestamp',
  'Lesson_Code',
  'Session_ID',
  'Class',
  'Student_No',
  'Group_No',
  'Case_ID',

  'Action_Type',
  'Action_Value',
  'Details_JSON',

  'Submission_ID',
  'Event_Index',
  'Client_Time'
];


const CASE_TITLES = {

  CASE01_DRIVER:
    '新打印機不能正常使用',

  CASE02_CPU:
    '電腦突然非常慢',

  CASE03_STORAGE:
    '儲存空間快將用盡',

  CASE04_MALWARE:
    '不斷彈出可疑廣告',

  CASE05_FIREWALL:
    '視像會議不能連線'

};


const FINAL_ANSWER_KEYS = {

  CASE01_DRIVER:
    '驅動程式（Device Driver）出現兼容性問題',

  CASE02_CPU:
    '某個程式大量使用 CPU',

  CASE03_STORAGE:
    '儲存空間不足',

  CASE04_MALWARE:
    '電腦可能受到惡意軟件影響',

  CASE05_FIREWALL:
    '防火牆規則阻擋了視像會議軟件'

};


/*
  Submission_ID 是 Responses 第 23 欄。
*/
const RESPONSE_SUBMISSION_ID_COLUMN = 23;


/* =========================================================
   WEB APP
========================================================= */


/*
  重要：
  doGet() 不再碰 Google Sheet。

  以前每位學生開網頁時都會 ensureSheets_()，
  33 人同時開啟時已經會造成額外 Spreadsheet calls。

  現在只是純粹送出 HTML。
*/
function doGet() {

  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('校園 IT 管理員模擬器')
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}


/* =========================================================
   ONE-TIME SETUP
========================================================= */


/*
  更換新版程式後，
  老師只需要手動執行一次 setupSheets()。
*/
function setupSheets() {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  ensureSheet_(
    ss,
    RESPONSE_SHEET,
    RESPONSE_HEADERS
  );


  ensureSheet_(
    ss,
    ACTION_SHEET,
    ACTION_HEADERS
  );


  return 'Google Sheet 已完成設定。';

}


function ensureSheet_(
  ss,
  name,
  headers
) {

  let sheet =
    ss.getSheetByName(name);


  if (!sheet) {

    sheet =
      ss.insertSheet(name);

  }


  /*
    只更新 header，
    不刪除原有學生資料。
  */
  sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .setValues([
      headers
    ])
    .setFontWeight('bold');


  sheet.setFrozenRows(1);


  return sheet;

}


/* =========================================================
   GET PROGRESS
========================================================= */


/*
  每位學生登入只 call 一次。

  Frontend 亦會加入：
  - random delay
  - automatic retry

  避免 33 人完全同一刻 call server。
*/
function getProgress(identity) {

  const clean =
    cleanIdentity_(identity);


  const sheet =
    getRequiredSheet_(
      RESPONSE_SHEET
    );


  if (
    sheet.getLastRow() < 2
  ) {

    return {
      completedCaseIds: []
    };

  }


  /*
    只讀需要用到的前 8 欄，
    不讀 Action History 等大型資料。
  */
  const data =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        8
      )
      .getValues();


  const completed =
    new Set();


  data.forEach(row => {

    const lessonCode =
      String(
        row[1]
      ).trim();


    const className =
      String(
        row[4]
      ).trim();


    const studentNo =
      String(
        row[5]
      ).trim();


    const caseId =
      String(
        row[7]
      ).trim();


    if (

      lessonCode ===
        clean.lesson_code &&

      className ===
        clean.class_name &&

      studentNo ===
        clean.student_no &&

      caseId

    ) {

      completed.add(
        caseId
      );

    }

  });


  return {

    completedCaseIds:
      Array.from(
        completed
      )

  };

}


/* =========================================================
   SUBMIT WHOLE CASE
========================================================= */


/*
  最重要的新版架構：

  一個 Case 無論學生按了：
  - 10 次
  - 20 次
  - 50 次

  都不會即時寫 Sheet。

  完成 Case 後：

  前端
  ↓
  submitCase(payload)
  ↓
  Responses：一次 setValues()
  Action_Log：一次 batch setValues()

  即整個 Case 只有一次 server request。
*/
function submitCase(payload) {

  const identity =
    cleanIdentity_(payload);


  const caseId =
    String(
      payload.case_id || ''
    ).trim();


  if (
    !CASE_TITLES[
      caseId
    ]
  ) {

    throw new Error(
      '無效的 Case ID'
    );

  }


  const submissionId =
    String(
      payload.submission_id || ''
    ).trim();


  if (!submissionId) {

    throw new Error(
      '缺少 Submission ID'
    );

  }


  const finalAnswer =
    String(
      payload.final_answer || ''
    ).trim();


  const finalCorrect =
    finalAnswer ===
      FINAL_ANSWER_KEYS[
        caseId
      ];


  const history =
    normalizeHistory_(
      payload.action_history
    );


  const securityIncidentEver =
    Boolean(
      payload.security_incident_ever
    );


  const misconceptionFlags =
    analyseMisconceptions_(

      caseId,

      history,

      finalAnswer,

      securityIncidentEver

    );


  /*
    先把 Action rows 在記憶體組好。

    不需要一條一條 appendRow。
  */
  const actionRows =
    buildActionRows_(

      identity,

      payload,

      caseId,

      submissionId,

      history

    );


  /*
    Script Lock 只包住真正需要 atomic 的
    Sheet read/write。

    33 人同時 submit 時，
    requests 會排隊而不是搶同一 row。
  */
  const lock =
    LockService
      .getScriptLock();


  lock.waitLock(
    30000
  );


  try {


    const responseSheet =
      getRequiredSheet_(
        RESPONSE_SHEET
      );


    const actionSheet =
      getRequiredSheet_(
        ACTION_SHEET
      );


    /*
      防 duplicate submission。

      例如：
      server 已成功寫入，
      但學生 browser 沒收到 response，
      frontend 自動 retry。

      同一 Submission_ID
      不會再寫第二次。
    */
    if (

      submissionExists_(

        responseSheet,

        submissionId

      )

    ) {

      return {

        ok: true,

        duplicate: true,

        finalCorrect:
          finalCorrect

      };

    }


    const attemptNo =
      getNextAttemptNoFromSheet_(

        responseSheet,

        identity.lesson_code,

        identity.class_name,

        identity.student_no,

        caseId

      );


    const responseRow = [

      new Date(),

      safeCell_(
        identity.lesson_code
      ),

      safeCell_(
        String(
          payload.session_id || ''
        )
      ),

      attemptNo,

      safeCell_(
        identity.class_name
      ),

      safeCell_(
        identity.student_no
      ),

      safeCell_(
        identity.group_no
      ),

      caseId,

      CASE_TITLES[
        caseId
      ],

      safeCell_(
        finalAnswer
      ),

      finalCorrect,

      safeCell_(
        String(
          payload.short_answer || ''
        )
      ),

      safeCell_(
        String(
          payload.confidence || ''
        )
      ),

      Boolean(
        payload.was_fixed
      ),

      Number(
        payload.action_count || 0
      ),

      Number(
        payload.undo_count || 0
      ),

      Number(
        payload.elapsed_seconds || 0
      ),

      /*
        Action History 同時保留 JSON，
        方便日後 Dashboard 分析。

        限制長度，避免超過 Sheet cell limit。
      */
      safeCell_(
        safeJson_(
          history,
          45000
        )
      ),

      safeCell_(
        misconceptionFlags
          .join(' | ')
      ),

      securityIncidentEver,

      Number(
        payload.security_incident_count || 0
      ),

      Number(
        payload.final_security_score || 100
      ),

      safeCell_(
        submissionId
      ),

      safeCell_(
        String(
          payload.client_submitted_at || ''
        )
      )

    ];


    /*
      Responses：
      1 次 write。
    */
    const responseTargetRow =
      responseSheet
        .getLastRow() + 1;


    responseSheet
      .getRange(
        responseTargetRow,
        1,
        1,
        responseRow.length
      )
      .setValues([
        responseRow
      ]);


    /*
      Action_Log：
      無論有 5、10、20 個 events，
      都只做一次 setValues()。
    */
    if (
      actionRows.length > 0
    ) {

      const actionStartRow =
        actionSheet
          .getLastRow() + 1;


      actionSheet
        .getRange(
          actionStartRow,
          1,
          actionRows.length,
          ACTION_HEADERS.length
        )
        .setValues(
          actionRows
        );

    }


    return {

      ok: true,

      duplicate: false,

      attemptNo:
        attemptNo,

      finalCorrect:
        finalCorrect

    };


  }

  finally {

    lock.releaseLock();

  }

}


/* =========================================================
   BUILD ACTION LOG BATCH
========================================================= */


function buildActionRows_(
  identity,
  payload,
  caseId,
  submissionId,
  history
) {

  const serverTime =
    new Date();


  return history.map(
    (event, index) => {


      const eventType =
        String(
          event.event_type ||
          'EVENT'
        ).substring(
          0,
          50
        );


      const action =
        String(
          event.action || ''
        ).substring(
          0,
          500
        );


      const details = {

        value:
          event.value || '',

        details:
          event.details || {}

      };


      return [

        serverTime,

        safeCell_(
          identity.lesson_code
        ),

        safeCell_(
          String(
            payload.session_id || ''
          )
        ),

        safeCell_(
          identity.class_name
        ),

        safeCell_(
          identity.student_no
        ),

        safeCell_(
          identity.group_no
        ),

        safeCell_(
          caseId
        ),

        safeCell_(
          eventType
        ),

        safeCell_(
          action
        ),

        safeCell_(
          safeJson_(
            details,
            5000
          )
        ),

        safeCell_(
          submissionId
        ),

        Number(
          event.event_index ||
          index + 1
        ),

        safeCell_(
          String(
            event.client_time || ''
          )
        )

      ];

    }
  );

}


/* =========================================================
   DUPLICATE PROTECTION
========================================================= */


function submissionExists_(
  sheet,
  submissionId
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {

    return false;

  }


  const range =
    sheet.getRange(

      2,

      RESPONSE_SUBMISSION_ID_COLUMN,

      lastRow - 1,

      1

    );


  const found =
    range
      .createTextFinder(
        submissionId
      )
      .matchEntireCell(
        true
      )
      .findNext();


  return Boolean(
    found
  );

}


/* =========================================================
   ATTEMPT NUMBER
========================================================= */


function getNextAttemptNoFromSheet_(
  sheet,
  lessonCode,
  className,
  studentNo,
  caseId
) {

  if (
    sheet.getLastRow() < 2
  ) {

    return 1;

  }


  const data =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        8
      )
      .getValues();


  let count =
    0;


  data.forEach(row => {

    if (

      String(
        row[1]
      ).trim() ===
        lessonCode &&

      String(
        row[4]
      ).trim() ===
        className &&

      String(
        row[5]
      ).trim() ===
        studentNo &&

      String(
        row[7]
      ).trim() ===
        caseId

    ) {

      count++;

    }

  });


  return count + 1;

}


/* =========================================================
   MISCONCEPTION ANALYSIS
========================================================= */


function analyseMisconceptions_(
  caseId,
  history,
  finalAnswer,
  securityIncidentEver
) {

  const flags =
    [];


  /*
    只看 ACTION event，
    OPEN_APP 不算 misconception。
  */
  const actions =
    history

      .filter(
        item =>
          item.event_type ===
          'ACTION'
      )

      .map(
        item =>
          String(
            item.action || ''
          )
      );


  if (

    caseId ===
      'CASE01_DRIVER' &&

    actions.includes(
      '執行磁碟清理'
    )

  ) {

    flags.push(
      '曾以磁碟清理解決打印機問題'
    );

  }


  if (

    caseId ===
      'CASE02_CPU' &&

    actions.includes(
      '執行磁碟清理'
    )

  ) {

    flags.push(
      '曾以磁碟清理解決高 CPU 使用率'
    );

  }


  if (

    caseId ===
      'CASE04_MALWARE' &&

    actions.includes(
      '執行磁碟清理'
    )

  ) {

    flags.push(
      '曾以磁碟清理解決惡意軟件問題'
    );

  }


  if (
    securityIncidentEver
  ) {

    if (

      caseId ===
        'CASE05_FIREWALL'

    ) {

      flags.push(
        '曾完全關閉防火牆'
      );

    }

    else {

      flags.push(
        '曾以關閉防火牆處理與防火牆無直接關係的問題'
      );

    }

  }


  if (

    FINAL_ANSWER_KEYS[
      caseId
    ] &&

    finalAnswer !==
      FINAL_ANSWER_KEYS[
        caseId
      ]

  ) {

    flags.push(
      '最終概念判斷錯誤'
    );

  }


  return flags;

}


/* =========================================================
   HISTORY CLEANING
========================================================= */


function normalizeHistory_(history) {

  if (
    !Array.isArray(
      history
    )
  ) {

    return [];

  }


  return history
    .slice(
      0,
      MAX_ACTION_EVENTS
    )
    .map(
      (event, index) => {

        return {

          event_index:
            Number(
              event.event_index ||
              index + 1
            ),

          client_time:
            String(
              event.client_time ||
              ''
            ).substring(
              0,
              60
            ),

          display_time:
            String(
              event.display_time ||
              ''
            ).substring(
              0,
              30
            ),

          event_type:
            String(
              event.event_type ||
              'EVENT'
            ).substring(
              0,
              50
            ),

          action:
            String(
              event.action ||
              ''
            ).substring(
              0,
              500
            ),

          value:
            String(
              event.value ||
              ''
            ).substring(
              0,
              500
            ),

          details:
            event.details &&
            typeof event.details ===
              'object'

              ? event.details

              : {}

        };

      }
    );

}


/* =========================================================
   SHEET HELPERS
========================================================= */


function getRequiredSheet_(
  name
) {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      name
    );


  if (!sheet) {

    throw new Error(

      '找不到工作表 "' +
      name +
      '"。請老師先在 Apps Script 執行一次 setupSheets()。'

    );

  }


  return sheet;

}


/* =========================================================
   IDENTITY
========================================================= */


function cleanIdentity_(obj) {

  const lessonCode =
    String(
      obj.lesson_code || ''
    ).trim();


  const className =
    String(
      obj.class_name || ''
    ).trim();


  const studentNo =
    String(
      obj.student_no || ''
    ).trim();


  const groupNo =
    String(
      obj.group_no || ''
    ).trim();


  if (!lessonCode) {

    throw new Error(
      '請輸入課堂代碼'
    );

  }


  if (!className) {

    throw new Error(
      '請輸入班別'
    );

  }


  if (!studentNo) {

    throw new Error(
      '請輸入學號'
    );

  }


  if (!groupNo) {

    throw new Error(
      '請輸入小組'
    );

  }


  return {

    lesson_code:
      lessonCode.substring(
        0,
        30
      ),

    class_name:
      className.substring(
        0,
        20
      ),

    student_no:
      studentNo.substring(
        0,
        20
      ),

    group_no:
      groupNo.substring(
        0,
        20
      )

  };

}


/* =========================================================
   SAFE JSON
========================================================= */


function safeJson_(
  value,
  maxLength
) {

  let text;


  try {

    text =
      JSON.stringify(
        value
      );

  }

  catch (error) {

    text =
      JSON.stringify({
        error:
          'Unable to serialize JSON'
      });

  }


  if (
    text.length >
      maxLength
  ) {

    text =
      text.substring(
        0,
        maxLength
      );

  }


  return text;

}


/* =========================================================
   FORMULA INJECTION PROTECTION
========================================================= */


function safeCell_(value) {

  let text =
    String(

      value == null
        ? ''
        : value

    );


  if (
    /^[=+\-@]/.test(
      text
    )
  ) {

    text =
      "'" + text;

  }


  return text;

}
