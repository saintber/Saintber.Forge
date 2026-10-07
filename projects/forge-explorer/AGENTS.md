# AGENTS.md — forge-explorer

這是 Hub（`Saintber.Forge`）底下的一個專案。在這個目錄內工作時，以**這個目錄**的規則為準。

- All conversations MUST be conducted in Traditional Chinese (zh-TW)

## 先讀這些

| 內容 | 位置 |
|---|---|
| 本專案的憲章 | `.specify/memory/constitution.md`（**v1.1.0**，2026-10-07 修訂；「Tool」一詞的範圍見其「五、與 Hub 的關係」） |
| 本專案的 Policy | `docs/governance/policy/`（先讀其 `README.md`：繼承了哪些 Hub Policy、哪些是專屬、有哪些尚待核准） |
| Hub 的 Policy（繼承） | `../../docs/governance/policy/` |
| Hub 的憲章 | `../../.specify/memory/constitution.md`（**Active v1.0.0**，2026-10-06 批准） |
| 使用方式、建置與測試 | `README.md` |

專案可以加嚴 Hub 的規則，不得放寬。**設計先於實作**：實作必須依照已核准的設計，不得先偏離再改文件合理化。

## 執行 Spec Kit

- **在這個目錄內**執行 slash command（`/speckit-specify` 等；技能形式，連字號）。Spec Kit v1.1.0 會往上找最近的 `.specify/`，所以會解析到本專案，工作包建立在**這個專案的** `specs/`，**不是** Hub 的 `specs/`。
- 從別處指定本專案，可設 `SPECIFY_INIT_DIR` 指向此目錄；路徑無效時它會報錯，不會退回 Hub。
- 每次執行後，確認產出的路徑在 `projects/forge-explorer/` 之下。代理實際產出的隔離**尚未做完整驗收**（見 Hub 的 `docs/migration-status.md` U3）。
- **CLI 產生、不得直接手改**：`.claude/skills/`、`.agents/skills/`，以及 `.specify/` 內由 Spec Kit 管理的共同 scripts 與 templates（清單見 `.specify/integrations/speckit.manifest.json`）。要升級用 `specify integration upgrade`，不要手改。
- **人維護、依其修訂流程**：`.specify/memory/constitution.md`（憲章）與本專案的 Policy、有效規格等治理內容。它們**不是** CLI 產生的，要修訂時依各自的流程（憲章依其修訂程序，需 owner 核准）。

## 資料與封存的位置

| 內容 | 位置 |
|---|---|
| 進行中的工作包 | `specs/<NNN-name>/` |
| 人類輸入（Intent、Decision） | `docs/intent/<NNN-name>/` |
| 有效規格 | `docs/specifications/<capability>/`（**尚未建立**，見 Hub 的 `migration-status.md` U1） |
| 已封存的工作包 | `archive/changes/<NNN-name>/`（`001-portal-home` 在此） |

**不要把 `archive/` 的內容當成現行需求。** 它只用於追溯歷史。

## 目前的限制（如實說明）

- **saintber 入口尚未實作**：沒有 `saintber.project.json`、install / configure / run；不在 Hub 的 catalog。
- Node / `package.json` 不適用：這個專案目前沒有 Node 入口。
- **不要改** .NET 的程式碼、命名空間（`Saintber.Forge.*`）與 `Saintber.Forge.sln` 檔名，除非有已核准的工作包。
- 整合測試（Playwright E2E）需要執行中的應用程式與 PostgreSQL，細節見 `README.md`。
