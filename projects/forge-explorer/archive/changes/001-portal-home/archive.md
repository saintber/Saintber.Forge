# Archive Record: 001-portal-home

| 項目 | 內容 |
|---|---|
| change ID | 001-portal-home |
| 狀態 | `adopted`（沿用既有的完成紀錄；見下方「核對結果」） |
| 封存日期 | 2026-10-06 |
| 所屬專案 | forge-explorer |
| baseline-commit | `b5c7239`（PR #1：001 portal home - 開發完成） |
| 交付版本 | 無（尚未發佈版本） |

> 這是遷移（`hub/000-restructure`）時建立的**補記封存**，依 採納時的設計（快照）§15.4 處理：保存既有的完成紀錄，不重新驗證。
> 依 §12.5，本檔不記錄 adopt 所在的 commit；需要時以 change ID 從 git history 查詢。

## 來源路徑（遷移前）

| 內容 | 原位置 | 封存位置 |
|---|---|---|
| 工作包 | `specs/001-portal-home/` | `work/` |
| 驗證紀錄 | `docs/plan/verification/001-portal-home.verify.md` | `work/verification.md` |
| Intent | `docs/intent/001-portal-home/Intent.md` | `inputs/intent.md`（檔名改小寫） |
| Decision | `docs/intent/001-portal-home/Decision.md` | `inputs/decision.md`（檔名改小寫） |

內文**未修改**，包含其中引用的舊路徑（例如 `src/Frontend/...`）。這些是歷史紀錄，路徑相對於當時的 repo 根目錄；現在對應到 `projects/forge-explorer/` 之下。

## 核對結果（遷移前，2026-10-06）

- `tasks.md`：T001–T049 全部標示完成 `[X]`。
- `tasks.md` 中列出的實作檔案，現況核對如下：

| 檔案 | 現況 | 說明 |
|---|---|---|
| `src/Frontend/.../Components/ToolCard.razor`、`.razor.css` | 存在 | |
| `src/Frontend/.../Pages/Index.razor` | 存在 | |
| `src/Frontend/.../Services/` 四個服務檔 | 存在 | |
| `src/Frontend/.../appsettings.json` | 存在 | |
| `src/Persistence/.../Entities/`、`PortalDbContext.cs` | 存在 | |
| `tests/.../E2E/PortalHomeRwdTests.cs` | 存在 | |
| `src/Frontend/.../appsettings.Development.json`（T046） | **不在 repo** | 被 `.gitignore` 排除（`appsettings.*.json`），屬於本機設定，不是遺失 |
| `src/Frontend/.../wwwroot/css/app.css`（T027、T038） | **不存在** | repo 中的樣式在 `wwwroot/css/site.css`，`_Layout.cshtml` 也引用它。tasks 寫的檔名與實際不同，待核對樣式實際放在哪裡 |
| EF Migration（T017：`InitialCreate`） | **repo 中沒有 `Migrations/` 目錄** | tasks 與驗證紀錄都記載已套用，但 migration 檔案沒有進入版本控制 |

- 遷移前後的建置與測試結果相同：`dotnet build` 0 警告 0 錯誤；單元測試 1 個通過。整合測試（Playwright E2E）需要瀏覽器環境，**未執行**。

## 已知證據缺口

這些項目**不推翻**既有的完成紀錄，也不宣告尚未交付；只記錄證據不足之處，之後若要補驗再另開工作包。

1. **驗證紀錄中，「無 Tool 時顯示『目前無可用功能』」標示 PASS，但備註寫「尚未移除 Seed Data 進行測試」**（`work/verification.md` 約第 114 行）。備註與結論不一致，這個情境實際上沒有被測試。
2. **Migration 檔案不在 repo**（見上表）。資料庫結構的可重現性缺少證據；`PortalDbContext` 的 Seed Data 在，但 `InitialCreate` 沒有。
3. **`app.css` 與 tasks 的檔名不一致**（見上表）。
4. **視覺驗證為手動**：RWD 的 375px、800px、1920px 結果記為手動測試通過，自動化的 Playwright 測試（T041）在本次遷移中未重跑。
5. **Seed 的 Tool 連結（`/tools/example-a`、`/tools/example-b`）會導向 404**，驗證紀錄已列為已知限制。

## 有效規格

`work/spec.md` 的狀態是 `Draft`。**尚未**據此建立 `docs/specifications/` 的有效規格：依 §15.4，要以 spec、程式碼、驗證紀錄三方核對後才建立，不直接把候選規格整份複製成現況。這是 §15.3 步驟 5 的後續工作。
