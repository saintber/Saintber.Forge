# scripts

依**使用對象**分類。設計見 採納時的設計（快照）§4、§9、§14.2。

> **目前狀態：四個分類目錄已建立並可追蹤，腳本尚未實作。** 下方說明內容位置與責任；後續在對應目錄開發，不需要再搬移歸類。

| 目錄 | 對象 | 副作用 | 說明 |
|---|---|---|---|
| `bootstrap/` | 使用者 | 有（安裝到使用者的機器） | `install.ps1`、`install.sh`。唯一不依賴 Node 的地方：只負責準備 Node 和取得 saintber |
| `dev/` | 開發者 | 只改本 repo | 專案初始化、catalog 建置、遷出輔助等；靜態範本在 `tooling/scaffold/`，Spec Kit 安裝正本在 `tooling/speckit/install.mjs`，不另建已淘汰的 `sync-speckit.mjs` |
| `ci/` | CI | 建置、測試、產生暫存與 artifact | 一致性檢查、依變動路徑派送、打包的 dry-run。**禁止**對外發布、部署，以及使用發佈憑證 |
| `release/` | 發佈流程 | 對外發布（建立 release、上傳檔案） | 預計 `pack-entry`、`pack-shared`、`update-catalog`、`verify-release`。**目錄與責任已核准**（ADR-0001 決策 10）；腳本尚未實作 |

## 為什麼 `release/` 與 `ci/` 要分開

兩者的**風險不同**：`ci/` 每次 PR 都會跑，會建置、測試並產生暫存與 artifact，但**禁止**對外發布、部署與使用發佈憑證；`release/` 會對外建立 release 並上傳檔案。分開放，責任才清楚。

**核准範圍**（ADR-0001 決策 10）：只有「目錄與責任分工」。下列**尚未決定**，不是已採納的規則：
- 發佈的觸發策略（例如是否僅由 tag 觸發）。
- pack 與 verify 是否一律需要憑證（它們可以在 CI 本機驗證，不一定需要）。

## 為什麼沒有 `cd/`

Hub **不部署任何工具**。工具如何部署（例如 forge-explorer 的 Blazor 放到哪裡）由工具自己決定。Hub 只負責**產出並發佈入口包**，所以叫 `release/`，不叫 `cd/`。

## 語言

- `bootstrap/` 用 PowerShell 與 sh。
- 其餘以 Node `.mjs` 為主，以便跨平台；這是慣例，不是不可違反的限制。
