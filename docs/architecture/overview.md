# 架構概觀（現況）

> 只描述**已經完成**的部分。**缺 CLI 章節**：saintber CLI、安裝腳本、各工具的入口都還沒有實作，所以沒有可描述的現況。
> 採納時的設計與尚未實作的規劃見 [ADR-0001](decisions/0001-hub-and-project-split.md)；那**不是**現況。

## Repo 的結構

```text
/                          Hub（根專案）
├─ workspace.json          登錄專案（hub、forge-explorer）
├─ catalog/index.json      工具索引，目前 tools 為空
├─ docs/                   Hub 的文件、Policy、ADR
├─ src/、tests/            Hub 程式與測試的骨架，尚無 CLI
├─ packages/               Shared 位置，目前沒有套件
├─ specs/                  Hub 的工作包（001-stage1-speckit-extension 尚未採納）
├─ archive/changes/        Hub 工作包歷史位置，目前沒有封存包
├─ tooling/speckit/        上游 v1.1.0 版本紀錄、hub 擴充原始碼與安裝／驗證工具
├─ scripts/                bootstrap、dev、ci、release 分類與說明；尚無腳本
├─ schemas/                契約 schema 的位置與說明；尚無 schema
├─ .specify/               Hub 的 Spec Kit
└─ projects/
   └─ forge-explorer/      唯一的專案（.NET / Blazor Server）
```

## 專案

### Hub
已有憲章（Active v1.0.0）、八份 Policy、ADR-0001／0002 與 Spec Kit 設定，也有 `tooling/speckit/` 下的 Node 開發腳本、擴充原始碼與測試。三個擴充指令完成必要安全修正與本輪腳本驗證；完整設計仍待確認，工作包未採納，結果見 [`migration-status.md`](../migration-status.md)。

**saintber CLI 尚未實作**：`src/`、`tests/` 已建立骨架，根目錄沒有 CLI 的 `package.json`。開發工具腳本的存在不代表安裝／設定／啟動入口已完成。Tool 靜態範本在 `tooling/scaffold/project/`，repo skill 正本位置在 `tooling/skills/`。

### forge-explorer
- 原 Saintber.Forge 的 .NET 內容，整體搬到 `projects/forge-explorer/`，**路徑以外沒有修改**（命名空間 `Saintber.Forge.*` 與 `Saintber.Forge.sln` 檔名不變）。
- 有自己的 `.specify/`、憲章（Active v1.1.0）、Policy、三份補建的有效規格與封存（`001-portal-home`）。規格的證據等級與缺口見該專案 [`有效規格索引`](../../projects/forge-explorer/docs/specifications/README.md)。
- **還沒有 saintber 入口**（`saintber.project.json` 與 install / configure / run），所以不在 `catalog/index.json` 中，不能被 `saintber` 呼叫。
- 建置與單元測試的結果見 [`../migration-status.md`](../migration-status.md)。

## 責任邊界（現況）

目前只有**文件層**的邊界：
- Hub 的 Policy（`docs/governance/policy/`）適用於 workspace 內的專案；forge-explorer 有自己的專屬 Policy。
- 憲章：Hub 與 forge-explorer 各一份。Hub 的憲章已於 2026-10-06 由使用者批准，**Active v1.0.0**。

## 尚未有現況可描述（待實作後補）

- saintber CLI 的路由與入口包取得。
- 安裝流程、bootstrap、Hub 家目錄。
- 工具的 install / configure / run。
- Shared。
