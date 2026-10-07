# forge-explorer Policy 索引

本目錄是 forge-explorer 專案的 Policy。格式與規則見 Hub 的採納時設計（快照）§11。

## 繼承的 Hub Policy

forge-explorer 在 workspace 內開發，繼承 Hub 的下列 Policy（Hub 憲章已於 2026-10-06 批准，Active v1.0.0）：

| Hub Policy | scope | 說明 |
|---|---|---|
| POL-STRUCT-001 Project Structure | workspace | |
| POL-DOC-001 Documentation Governance | workspace | |
| POL-SPEC-001 Specification Lifecycle | workspace | |
| POL-SPECKIT-001 Spec Kit Workflow | workspace | |
| POL-INVOKE-001 Invocation Contract | distribution | 只適用 `[tool]` 與 `[hub, tool]` 規則；forge-explorer **目前還沒有 saintber 入口**，所以尚無可套用的操作 |
| POL-SEC-001 Security Baseline | distribution | 適用 `[tool]` 與 `[hub, tool]` 規則 |
| POL-TEST-001 Testing Governance | workspace | |
| POL-DOD-001 Implementation Definition of Done | workspace | R6a 來自已批准的憲章原則 VI |

- **已提交的繼承基線**：Hub commit `44dfc96`（2026-10-07）；workspace 開發時讀取 Hub 的工作目錄。正在審閱的治理更正尚未包含於此基線，驗證並提交後再更新。
- Hub Policy 位置：`../../../../../docs/governance/policy/`（workspace 模式，見採納時設計（快照）§11.4、§13.4）。
- **與 Hub 憲章的衝突**：已由 owner 於 2026-10-07 裁決（**同意 A+B**）並套用到 forge-explorer 憲章，**v1.0.0 → v1.1.0**（原則 1–10 未修改）。依據紀錄見 [`conflicts-with-hub.md`](conflicts-with-hub.md)。本目錄五份專屬 Policy 的內文**沒有更動**。

## 本專案的專屬 Policy

這五份是從舊的全專案 Forge Policy 搬來的，補上 frontmatter 後只適用 forge-explorer。其中 `implementation-definition-of-done.md` 的 Verification Record 路徑已依已採納設計修訂並留下註記；其餘內文保留。沒有藉遷移新增或放寬規則。

| ID | 檔案 | scope | 說明 |
|---|---|---|---|
| POL-FE-STRUCT-001 | [project-structure.md](project-structure.md) | project | InnerApi / OuterApi / Frontend / Tools 的專案結構 |
| POL-FE-TECH-001 | [tech-baseline.md](tech-baseline.md) | project | .NET 版本與相容性 |
| POL-FE-SEC-001 | [security-baseline.md](security-baseline.md) | project | JWT / OIDC、API 分層、Blazor 特性等；通用部分已提煉成 POL-SEC-001 |
| POL-FE-TEST-001 | [testing-governance.md](testing-governance.md) | project | `.UnitTests` / `.IntegrationTests` 命名；通用部分已提煉成 POL-TEST-001 |
| POL-FE-DOD-001 | [implementation-definition-of-done.md](implementation-definition-of-done.md) | project | `dotnet restore / build / test` 的具體要求；通用部分已提煉成 POL-DOD-001 |

> 與 Hub Policy 重疊的部分：專案可以加嚴，不得放寬。若兩者字面衝突，必須明確解決或申請例外（見 Hub 的 `docs/governance/policy/README.md`），不採「離得近的優先」。

## 原文中已知的過時內容

除已授權並註記的路徑修訂外，遷移時**保留**原文，避免悄悄改變規則。下表區分已修訂項目與仍待後續工作包處理的舊內容：

| 位置 | 原文寫的 | 現況 |
|---|---|---|
| `implementation-definition-of-done.md`（Verification Record 位置） | 原位置 `docs/plan/verification/<change-id>.verify.md` | **已修訂**為 `specs/<NNN-name>/verification.md`，正文已有路徑修訂註記（見 Hub 的 POL-DOD-001 R7） |
| `testing-governance.md`（「所有 Forge 專案…皆須遵循」） | 適用所有 Forge 專案與子項目 | 只適用 forge-explorer；通用原則由 Hub 的 POL-TEST-001 涵蓋 |
| `testing-governance.md`（Decision 文件位置） | `docs/intent/<intent-id>-<intent-name>/` | 現在是 `docs/intent/<NNN-name>/decision.md`（小寫檔名）；封存後在 `archive/changes/<NNN-name>/inputs/` |
| `testing-governance.md`（兩處 `:contentReference[...]`） | 無意義的殘留標記 | 是舊文件產生時留下的雜訊，可在修訂時移除 |
| 各檔「Saintber.Forge」專案名 | 整個專案 | 指 forge-explorer（.NET 命名空間這次不改） |

## 已核准的例外

| 例外 ID | Policy | 範圍 | 理由 | 核准者 | 日期 | 到期或重審條件 |
|---|---|---|---|---|---|---|
| （目前沒有） | | | | | | |
