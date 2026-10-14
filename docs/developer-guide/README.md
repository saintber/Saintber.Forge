# 開發者手冊

- [開發流程：三種顆粒度](development-workflows.md)：**先讀**。直接開發、Spec Kit 單次功能、完整 Tool 方向的步驟、目錄與收尾；以及需求分析、方案探索、需求規格、技術設計、實作與驗證、採納與封存六個工作階段與溝通用詞（§10）、探索稿轉為 change 的轉換紀錄（§11）、流程配套工具 `saintber-design` 與 Spec Kit 指令的對照（§12）。
- [Intent 管理](intent-workflow.md)：需求依據（Intent）怎麼保存、修訂、另開與承接；多份需求的關係、現行與歷史的讀取、里程碑快照與最小格式（ADR-0006）。`saintber-intent` 技能只有設計，尚未實作。
- [worktree 並行開發與目錄選擇](parallel-development.md)：從遷移基準開出工作目錄，確定內容放哪裡。
- [Spec Kit 與 SDD 流程](speckit-workflow.md)：需要完整需求、設計與工作包時使用。
- [遷移交付狀態與驗證](../migration-status.md)：已完成部分與明確保留的後續事項。

流程依需求性質選擇；不要求所有修改依賴 Spec Kit，但都要遵守適用治理、設計先於實作與規格唯一。設計快照與未完事項是方向參考，不是後續工作的完整需求或自動授權。
