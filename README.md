# School IT Manager Simulator
## 校園 IT 管理員模擬器

一個為中學 ICT 課堂設計的互動式電腦故障排解模擬器。

學生不是只回答 MC，而是在模擬電腦桌面中開啟工具、觀察系統狀態、嘗試不同處理方法、看到操作後果、復原錯誤操作、完成修復，最後再作個人提交。

> **Learning flow**  
> Explore → Observe → Try → Consequence → Undo → Diagnose → Fix → Reflect → Submit

## 目前功能

- 模擬電腦桌面
- 工作管理員（Task Manager）
- 磁碟清理（Disk Cleanup）
- 裝置管理員
- 抗電腦病毒軟件（Antivirus Software）
- 防火牆（Firewall）
- 可視化 CPU／記憶體／儲存空間／安全水平
- Consequence-based actions
- Undo 系統
- 可移動但不能直接關閉的 Firewall Security Alert
- 必須在 Firewall App 重新開啟防火牆才可清除警告
- 個案完成後學習總結
- 每位學生獨立提交
- Google Sheet Backend
- Action Log
- Misconception flags
- Security incident tracking

## 目前個案

1. 新打印機不能正常使用 — 驅動程式（Device Driver）
2. 電腦突然非常慢 — CPU／工作管理員（Task Manager）
3. 儲存空間快將用盡 — 磁碟清理（Disk Cleanup）
4. 不斷彈出可疑廣告 — 抗電腦病毒軟件（Antivirus Software）
5. 視像會議不能連線 — 防火牆（Firewall）

## Firewall Simulation

模擬器不會暗示「關閉 Firewall 就一定立即被入侵」。

當學生完全關閉防火牆時，模擬器會展示安全風險上升，以及原本受 Firewall rule 控制的網絡流量不再受到相同保護。Security Alert 可以拖動，但不能直接關閉；學生必須開啟「防火牆（Firewall）」並重新開啟防火牆。

Case 5 更會故意展示：

> 視像會議暫時恢復連線，但網絡安全下降。

讓學生理解：

> **功能恢復 ≠ 處理方法合適**

## Repository 結構

```text
school-it-manager-simulator/
├── README.md
├── LICENSE
├── CHANGELOG.md
├── .gitignore
├── apps-script/
│   ├── Code.gs
│   └── Index.html
└── docs/
    ├── google-sheet-setup.md
    ├── teaching-design.md
    └── case-design.md
```

## 快速部署

本專案目前使用 **Google Apps Script + Google Sheet**，不是直接由 GitHub Pages 執行，因為前端使用 `google.script.run`。

1. 建立一個新的 Google Sheet。
2. 到 `擴充功能 → Apps Script`。
3. 把 `apps-script/Code.gs` 貼入 `Code.gs`。
4. 建立 `Index.html`，把 `apps-script/Index.html` 貼入。
5. 在 Apps Script 執行 `setupSheets()`。
6. 部署為「網頁應用程式」。

學生只需要 Web App URL，不需要 Google Sheet 權限。

## 學生資料及私隱

不要把以下內容提交到公開 GitHub repository：

- 真實學生資料
- Google Sheet exports
- Google access token
- credentials
- 私人 deployment URL
- API key
- 學校內部敏感資料

## License

MIT License。
