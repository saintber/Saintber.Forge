# catalog

`index.json` 回答一個問題：**使用者的命令，指向哪個版本的工具入口包？**

它**不**回答原始碼在哪裡開發（那是 `../workspace.json`），也不描述工具的內部。見 採納時的設計（快照）§4.2、§7.6。

## 目前狀態

`tools` 是**空的**：還沒有任何工具提供入口（`saintber.project.json` 與 install / configure / run），saintber CLI 也還沒實作。

forge-explorer 雖然在 `workspace.json` 登錄，但**不在**這裡：它還沒有入口，不能被 `saintber` 呼叫。有入口之後才加入。

## 項目格式（尚未有實例）

```json
{
  "toolId": "ai-queue",
  "commandPrefix": ["ai", "queue"],
  "versions": {
    "0.1.0": {
      "source": {
        "type": "release",
        "url": "https://.../ai-queue-entry-0.1.0.tgz",
        "integrity": "sha512-...",
        "manifestPath": "saintber.project.json"
      }
    }
  }
}
```

來源類型 `release`（優先）、`git`（固定 commit）、`local-dev`（只用於開發）的規則見 採納時的設計（快照）§7.6。

## 規則

- 命令前綴必須唯一，拒絕有歧義的重疊前綴，也不得與 Hub 自身的命令名稱（`list`、`info`、`status`、`profile`、`cache`、`alias`、`self-*`、`doctor`）重疊。
- `local-dev` 項目必須對應到 `workspace.json` 登錄的專案；已遷出的工具可以只在這裡。
- 這是使用者取得工具的唯一來源，**變更必須經過審查**（`scripts/release/update-catalog.mjs` 只產生變更，不自動推到主線）。
- `profiles/`：官方提供的 Profile 範例（尚未建立，等 CLI 的 `profile run` 實作後再放）。
