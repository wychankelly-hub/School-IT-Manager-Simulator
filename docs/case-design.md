# Case Design

## Case 1 — 新打印機不能正常使用

核心概念：

```text
驅動程式（Device Driver）
```

正確 flow：

```text
裝置管理員
→ 檢查 Driver
→ 發現 compatibility warning
→ 更新 compatible Driver
```

## Case 2 — 電腦突然非常慢

核心概念：

```text
CPU
工作管理員（Task Manager）
```

Evidence：

```text
CPU 97%
VideoRender.exe 91%
```

## Case 3 — 儲存空間快將用盡

核心概念：

```text
磁碟清理（Disk Cleanup）
```

## Case 4 — 不斷彈出可疑廣告

核心概念：

```text
抗電腦病毒軟件（Antivirus Software）
```

## Case 5 — 視像會議不能連線

核心概念：

```text
防火牆（Firewall）
```

正確 flow：

```text
查看 Firewall log
→ 發現規則阻擋 Video Meeting
→ 只調整必要規則
```

陷阱：

```text
完全關閉 Firewall
→ Video Meeting 暫時成功
→ Security Level 下降
→ 可移動但不能關閉的 Security Alert
→ 必須重新開 Firewall
```
