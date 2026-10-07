# 遷移交付狀態

> **主要遷移與基本目錄已完成；正在完成最後文件檢查與提交。** 更新：2026-10-07。
> 本次範圍依 [ADR-0002](architecture/decisions/0002-migration-delivery-scope.md)：先交付可供 worktree 並行開發的基準，不以全部前景功能或完整 Spec Kit 擴充完成為條件，也不安排第二階段。
> 分支：`backlogs/hub-restructure`（原名 `hub/000-restructure`）；不 push、不開 PR。

## 本次交付

| 項目 | 結果 | 位置或證據 |
|---|---|---|
| 原 .NET 內容搬移 | 完成；原始碼、測試與 solution 在 Tool 內，命名空間與檔名保留 | `projects/forge-explorer/` |
| 舊工作包與人類輸入 | 完成封存；歷史保持原樣，不當成現況 | `projects/forge-explorer/archive/changes/001-portal-home/` |
| 有效規格補建與證據核對 | 三個 capability；保留 S／H 等級與缺口，修正 Token 與 URL 一致性的過度推論 | [Tool 規格索引](../projects/forge-explorer/docs/specifications/README.md)、[補建核對與採納紀錄](../projects/forge-explorer/docs/developer-guide/migration-evidence-review.md) |
| Hub／Tool 治理 | Hub 憲章 Active v1.0.0；Tool Active v1.1.0，A+B 已套用；Hub 八份、Tool 五份 Policy | [Policy 索引](governance/policy/README.md) |
| Hub 基本目錄 | 程式、測試、Shared、文件、工作包、封存、Script 分類及開發工具位置已可追蹤 | [架構概觀](architecture/overview.md) |
| Tool 基本目錄 | forge-explorer 的文件／工作包／腳本位置與 CHANGELOG 已補齊；新 Tool 有靜態範本 | [Tool 範本](../tooling/scaffold/README.md) |
| 使用與開發文件入口 | 根 README、Hub／Tool docs 導覽、使用手冊入口與 worktree 指引已建立 | [並行開發](developer-guide/parallel-development.md) |
| Spec Kit 基礎整合 | 上游 1.1.0；Hub 與 Tool 都有各自 `.specify/` 及 Claude／Codex 整合 | 下方驗證紀錄 |
| 已開始擴充的必要安全修正 | 三指令腳本回歸通過，修正版已重新安裝；完整擴充仍未採納 | [001 驗證](../specs/001-stage1-speckit-extension/verification.md) |
| 暫存與產物排除 | 保留可追蹤骨架，排除建置、秘密與各層 `.specify/tmp/` | `.gitignore`；最後檢查見交付驗證 |

目錄骨架的建立不代表 CLI、bootstrap、Shared 或發佈功能已實作。未開始的工具仍只列規劃，不建立空的登錄專案。未開始的 Node 工具沒有虛構 package.json；技術與依賴在實際開發時確立。

## 驗證

### .NET 遷移

- 原 `b5c7239` 的 `src/`、`tests/`、`Saintber.Forge.sln` 共 51 檔已搬入 Tool；先前 Claude 與 Codex 分別確認 50 個 Git blob 相同。唯一有意修改的是整合測試 README 的三處 CI 路徑。本次交付再次核對。
- Codex 於 2026-10-07 在 Tool 執行 `dotnet build Saintber.Forge.sln --no-restore`：**0 警告、0 錯誤**。
- `dotnet test tests/Saintber.Forge.BlazorServer.UnitTests --no-build --no-restore`：**1 通過**。測試是空方法，只證明命令與專案結構可用，不能作為 Portal 行為證據。
- Playwright、真實 AzureAd 登入、Token 過期與資料庫遷移**未驗證**；環境需求見 Tool README，不阻擋本次目錄遷移。

### Spec Kit 與擴充

- Codex 獨立執行 `node tooling/speckit/extension/tests/run-all.mjs all`：**88 通過、0 失敗、0 略過**（單元 20、整合 68）。涵蓋路徑／ID、內容保留、多 capability、Git 基線、失敗回復與封存完整性。
- 以 `node tooling/speckit/install.mjs --project-dir <project>` 分別同步 Hub、forge-explorer：每邊 Claude／Codex 各 **3/3** 個指令；預設整合還原為 `claude`；**modified 0、missing 0**。
- 兩代理在隔離副本做過 S2 產出隔離、S3 無效專案、SA standalone 解析，checker 全部 PASS；Codex S2 有終端失敗後用檔案工具等效建立的差異。**不證明**原生 specify／plan／hooks／編號或 adopt／archive 的完整代理流程。
- standalone 只驗證解析與產出隔離，**不證明**治理內化、distribution 快照或完整遷出。
- Claude 本輪隔離變異測試 7 項中 6 項被抓到；archive 寫入後的完整性檢查有重複防線，不能宣稱它被獨立驗證。adopt 最後的回復修正有回歸測試，未再做變異。

交付時的路徑、骨架、安裝一致性與 worktree 檢查另記在 [遷移交付驗證](developer-guide/migration-verification.md)。

## Spec Kit 擴充的實際狀態

`001-stage1-speckit-extension` 留在 `specs/`，**整個工作包 Not Done，未 adopt、未 archive**。已驗證的程式與安全修正可保存提交，不等於完整設計、嚴格 Delta／Snapshot／Manifest 格式已經由使用者確認。

完整構想與新增格式限制保存在 [待審設計稿](architecture/proposals/speckit-extension-design.md)。這項審閱不阻擋本次遷移，也不阻擋其他 worktree 直接開發小型 skill。

| 保留事項 | 狀態 |
|---|---|
| G-PC：自動 Policy Check | 未完成；目前依適用 Policy 由人／代理檢查，先前 preset 試驗不採用 |
| G-NUM：原生編號接軌與碰撞保護 | 未完成；context 只計算活動＋封存編號，不強制原生流程使用或預留 |
| 原生階段的上下文、Policy 載入與讀取紀錄自動化 | 未完成 |
| adopt／archive 與原生流程的完整雙代理驗收 | 未驗證 |
| 舊 Change Log／封存格式相容、並行鎖與崩潰復原 | 尚未討論完整方案；不能宣稱原子交易 |
| standalone 治理內化、擴充分發與遷出演練 | 未完成 |

## 後續功能：只作需求討論入口

saintber CLI、bootstrap、工具入口、模組安裝、schemas、catalog 發佈與 release scripts，以及 AI 助理／佇列／技能、PowerShell／Node 工具都尚待各自討論與開發。這裡**不排順序、時程或第二階段**，也不直接把快照轉成需求。

需要完整需求流程時，在目標專案開新的 Spec Kit change；小粒度 skill 可直接開發並做必要驗證。兩者都遵守適用治理與設計先於實作。影響有效規格時，仍需驗證與採納紀錄，保持唯一現況。

## 核准與歷史

- 2026-10-06：Hub 憲章 v1.0.0、Spec Kit 1.1.0 升級／捨棄舊客製化、scripts/release 的目錄與責任、快照保留現址已獲使用者核准；快照附帶的其他發佈策略並未因此獲核准。
- 2026-10-07：Tool 憲章 A+B 已核准並套用（v1.1.0；原則 1–10 保留）。
- 2026-10-07：使用者明確收斂為遷移交付，優先提供 worktree 目錄基準，允許小型工作不依賴 Spec Kit；依 ADR-0002。
- 先前「無延期同意」「所有設計功能都是階段 1 完成條件」已被本次 owner 指示取代，不能再用來擴大遷移範圍。

舊通用 Policy 的提煉已由 Codex 對照 `b5c7239` 核對：SEC／TEST／DOD 的通用底線保留，.NET 專屬部分留在 Tool；新五份 Policy 均有設計／治理出處。效力與尚未制定範圍見 Policy 索引，不以快照提到功能作為實作授權。
