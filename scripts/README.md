# scripts

依**使用對象**分類。設計見 採納時的設計（快照）§4、§9、§14.2。

> **目前狀態：所有腳本都還沒有實作。** 下方只是說明每個目錄將來放什麼，以及它的邊界，**沒有任何一個目錄存在**。要用到時，在對應的工作包中建立。

| 目錄 | 對象 | 副作用 | 說明 |
|---|---|---|---|
| `bootstrap/` | 使用者 | 有（安裝到使用者的機器） | `install.ps1`、`install.sh`。唯一不依賴 Node 的地方：只負責準備 Node 和取得 saintber |
| `dev/` | 開發者 | 只改本 repo | `new-project.mjs`、`sync-speckit.mjs`、`build-catalog.mjs`、`graduate-project.mjs` |
| `ci/` | CI | **無**（唯讀） | 一致性檢查、依變動路徑派送、打包的 dry-run。**可以在 PR 上跑** |
| `release/` | 發佈流程 | **有**（建立 release、上傳檔案） | `pack-entry.mjs`、`pack-shared.mjs`、`update-catalog.mjs`、`verify-release.mjs`。需要憑證，**只在 tag 觸發**，**不得在 PR 上跑** |

## 為什麼 `release/` 與 `ci/` 要分開

兩者的**副作用與憑證**不同：`ci/` 在每次 PR 都會執行，必須唯讀；`release/` 會建立 release 並上傳檔案，需要憑證，只能在明確的 tag 上執行。放在一起，容易讓需要憑證的腳本被 PR 觸發。

## 為什麼沒有 `cd/`

Hub **不部署任何工具**。工具如何部署（例如 forge-explorer 的 Blazor 放到哪裡）由工具自己決定。Hub 只負責**產出並發佈入口包**，所以叫 `release/`，不叫 `cd/`。

## 語言

- `bootstrap/` 用 PowerShell 與 sh。
- 其餘以 Node `.mjs` 為主，以便跨平台；這是慣例，不是不可違反的限制。
