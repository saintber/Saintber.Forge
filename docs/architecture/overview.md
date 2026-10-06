# 架構概觀（現況）

> 只描述**已經完成**的部分。**缺 CLI 章節**：saintber CLI、安裝腳本、各工具的入口都還沒有實作，所以沒有可描述的現況。
> 採納時的設計與尚未實作的規劃見 [ADR-0001](decisions/0001-hub-and-project-split.md)；那**不是**現況。

## Repo 的結構

```text
/                          Hub（根專案）
├─ workspace.json          登錄專案（hub、forge-explorer）
├─ catalog/index.json      工具索引，目前 tools 為空
├─ docs/                   Hub 的文件、Policy、ADR
├─ specs/                  Hub 的工作包（目前沒有）
├─ tooling/speckit/        Spec Kit 版本紀錄（上游 v1.1.0）
├─ scripts/、schemas/      只有 README，尚無腳本與 schema
├─ .specify/               Hub 的 Spec Kit
└─ projects/
   └─ forge-explorer/      唯一的專案（.NET / Blazor Server）
```

## 專案

### Hub
目前只有**治理與文件**：憲章（Active v1.0.0）、Policy、ADR-0001、Spec Kit 設定。**沒有程式碼**：根目錄沒有 `src/`、`tests/`、`package.json`。

### forge-explorer
- 原 Saintber.Forge 的 .NET 內容，整體搬到 `projects/forge-explorer/`，**路徑以外沒有修改**（命名空間 `Saintber.Forge.*` 與 `Saintber.Forge.sln` 檔名不變）。
- 有自己的 `.specify/`、憲章、Policy 與封存（`001-portal-home`）。
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
