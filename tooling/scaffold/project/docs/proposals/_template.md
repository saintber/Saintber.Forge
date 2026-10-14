# <主題>

- 狀態：草稿
- 類型：需求分析（`intent.md`）／方案探索（`design.md`）／合併稿（單檔 `<topic>.md`）／方向稿（`product-direction`），擇一
- owner：
- 目前決策：尚無
- 本次範圍：
- 尚未實作：
- baseline-commit：（開始時的 commit）
- 受影響的 capability：（沒有就寫「不影響有效規格」）
- 流程：A 直接開發 / B 將轉為 Spec Kit change / C 方向文件

> **使用方式**：從本範本建立 topic 的 `intent.md`（需求分析）或 `design.md`（方案探索），或單檔合併稿。**純需求分析稿可以略去**「方案」「驗證紀錄」「採納紀錄」等段落，只保留問題、目標、範圍、限制、待決事項與驗收方向；同一 topic 的同一角色只有一份主稿。早期 `intent.md` 不是正式 change 的 Intent，也不強制有版本索引。

## 問題

現況、不足之處、影響對象。

## 方案

候選方案與取捨；選定的方案與理由。

## 適用治理

讀過的憲章、Policy 與有效規格；是否超出既有授權（需要 owner 核准時記錄核准來源）。

## 驗收方式

如何判定完成。

## 驗證紀錄

（直接開發時填寫；欄位依 POL-DOD-001 R7：範圍、環境、Gate A、需要時 Gate B、Docs Consistency、Final Status。內容多時改用 `<主題>/verification.md`。）

## 採納紀錄

（影響有效規格時填寫：驗證依據（連到上方驗證紀錄）、baseline 檢查結果、capability、新增／修改／移除的 requirement ID、Change Log 列。不影響時寫「不影響有效規格」。依 POL-SPEC-001 R9a 手動採納，不使用 Spec Kit 擴充。）

## 轉換紀錄

（新建且尚未轉換的探索稿可寫「尚無轉換」。既有稿須先核對工作包、封存與有效規格，不能因紀錄空白就認定未轉換。真正轉換時，依流程手冊 §11 追加日期、轉換範圍、對應 change、目前位置、真實來源 commit 與備註；建立草稿本身不是轉換。）
