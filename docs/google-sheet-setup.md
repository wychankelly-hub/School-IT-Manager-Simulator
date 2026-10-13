# Google Sheet Setup

## 1. 建立 Google Sheet

建立一個新的 Google Sheet。

## 2. 開啟 Apps Script

```text
擴充功能 → Apps Script
```

## 3. 貼入程式碼

把：

```text
apps-script/Code.gs
apps-script/Index.html
```

分別貼入 Apps Script 的：

```text
Code.gs
Index.html
```

## 4. 初始化

在 Apps Script 執行：

```javascript
setupSheets()
```

Spreadsheet 會建立：

```text
Responses
Action_Log
```

## 5. 部署 Web App

```text
部署 → 新增部署 → 網頁應用程式
```

學生只需要 Web App URL。

**不要把 Google Sheet 本身分享給學生。**

## 6. 更新版本

每次修改 Apps Script 後，如使用已部署 Web App，記得更新部署版本。
