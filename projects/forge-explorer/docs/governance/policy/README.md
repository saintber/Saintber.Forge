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

- **繼承基線**：Hub 在 `hub/000-restructure` 分支的版本（尚未建立 commit 或 tag；有了之後補上）。
- Hub Policy 位置：`../../../../../docs/governance/policy/`（workspace 模式，見採納時設計（快照）§11.4、§13.4）。
- **與 Hub 憲章的潛在衝突**：見 [`conflicts-with-hub.md`](conflicts-with-hub.md)。**舊憲章與本目錄的 Policy 原封不動，仍然有效**；是否修訂待 owner 裁決。

## 本專案的專屬 Policy

這五份是從舊的全專案 Forge Policy 搬來的，**內文沒有修改**，只補上 frontmatter。它們原本適用整個 Saintber.Forge，現在只適用 forge-explorer。

| ID | 檔案 | scope | 說明 |
|---|---|---|---|
| POL-FE-STRUCT-001 | [project-structure.md](project-structure.md) | project | InnerApi / OuterApi / Frontend / Tools 的專案結構 |
| POL-FE-TECH-001 | [tech-baseline.md](tech-baseline.md) | project | .NET 版本與相容性 |
| POL-FE-SEC-001 | [security-baseline.md](security-baseline.md) | project | JWT / OIDC、API 分層、Blazor 特性等；通用部分已提煉成 POL-SEC-001 |
| POL-FE-TEST-001 | [testing-governance.md](testing-governance.md) | project | `.UnitTests` / `.IntegrationTests` 命名；通用部分已提煉成 POL-TEST-001 |
| POL-FE-DOD-001 | [implementation-definition-of-done.md](implementation-definition-of-done.md) | project | `dotnet restore / build / test` 的具體要求；通用部分已提煉成 POL-DOD-001 |

> 與 Hub Policy 重疊的部分：專案可以加嚴，不得放寬。若兩者字面衝突，必須明確解決或申請例外（見 Hub 的 `docs/governance/policy/README.md`），不採「離得近的優先」。

## 原文中已知的過時內容

遷移時**刻意不改寫**原文，避免在搬檔案的同時悄悄改變規則。下列內容與遷移後的結構不符，閱讀時請以本表的對應為準，之後在專案自己的工作包中再正式修訂：

| 位置 | 原文寫的 | 現況 |
|---|---|---|
| `implementation-definition-of-done.md`（Verification Record 位置） | `docs/plan/verification/<change-id>.verify.md` | Verification Record 放在工作包內：`specs/<NNN-name>/verification.md`（見 Hub 的 POL-DOD-001 R7） |
| `testing-governance.md`（「所有 Forge 專案…皆須遵循」） | 適用所有 Forge 專案與子項目 | 只適用 forge-explorer；通用原則由 Hub 的 POL-TEST-001 涵蓋 |
| `testing-governance.md`（Decision 文件位置） | `docs/intent/<intent-id>-<intent-name>/` | 現在是 `docs/intent/<NNN-name>/decision.md`（小寫檔名）；封存後在 `archive/changes/<NNN-name>/inputs/` |
| `testing-governance.md`（兩處 `:contentReference[...]`） | 無意義的殘留標記 | 是舊文件產生時留下的雜訊，可在修訂時移除 |
| 各檔「Saintber.Forge」專案名 | 整個專案 | 指 forge-explorer（.NET 命名空間這次不改） |

## 已核准的例外

| 例外 ID | Policy | 範圍 | 理由 | 核准者 | 日期 | 到期或重審條件 |
|---|---|---|---|---|---|---|
| （目前沒有） | | | | | | |
