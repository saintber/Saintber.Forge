# 遷移補建規格：證據核對與採納紀錄

- 日期：2026-10-07；核對者：Codex；範圍：遷移補建的證據與現況描述更正。
- 核對基準：`9b5e4f3` 與本次工作目錄；.NET 原始碼未修改。
- 授權：使用者要求核對並完成遷移；小型文件工作不強迫建立 Spec Kit 工作包，依 Hub ADR-0002 的明確指示收尾。
- 結論：下述文字經來源核對後採納；沒有新增功能要求，沒有以候選提案取代現況。不是執行時行為驗收。

| 項目 | 核對來源 | 採納的更正 |
|---|---|---|
| REQ-PH-002 | `src/Frontend/Saintber.Forge.BlazorServer/Components/ToolCard.razor` 的 `IsNullOrWhiteSpace` 條件 | 描述僅在非空白時顯示，不宣稱每張卡都有描述 |
| REQ-PA-004 | `Pages/Index.razor` 的 `IsAuthenticated` 分支；歷史 verification 的過期情境自述 | 現況只可支持 false 時走公開路徑；無過期流程的本輪重現證據 |
| FR-007 | 封存 `work/spec.md` 的原條款；`Program.cs` 的 Identity Web 註冊；身分實體與歷史 verification | 原需求是核發，不含資料庫保存。無 Token 欄位不等於框架未處理 Token；列證據不足，不自行新增保存需求 |
| REQ-PH-009／FR-010 | Portal 只有 `href`，示例工具 URL 無實作；舊紀錄也記點擊 404 | 不能宣稱 URL 一致性已交付；從有效條款移除並保留 ID，不重用，原需求保留為缺口 |

核發角色的協定依據：[Microsoft 官方 OIDC 說明](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)。這只能說明框架／平台可能負責的協定行為，不證明本專案的 AzureAd 設定與 Access Token 流程已實際驗證。

## 證據限制與歷史保存

只做靜態程式、原提案與既有驗證紀錄的核對；沒有連接真實 Microsoft Identity、沒有 Token 過期測試，也沒有新增 Portal 行為測試。原空單元測試不能提升為 A 等級。

`archive/changes/001-portal-home/` 保持原樣；舊封存中的「Token 未實現」等結論反映當時判讀，閱讀時以本次更正為準。兩份有效規格新增更正列，沒有回寫舊 Change Log 列或刪除舊證據。

本次是遷移補建內容的修正與採納紀錄，不使用尚未定案的自動 adopt 格式，也沒有在被腳本拒絕後手動繞過。後續若需產品行為變更，重新討論需求與驗收條件。
