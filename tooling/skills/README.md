# Repo 自製技能

這裡放只供本 repo 開發使用的 skill 正本，例如 `tooling/skills/<name>/SKILL.md`。

- [`saintber-design`](saintber-design/SKILL.md)：建立或修訂方案探索階段的**設計稿／草案**（`docs/proposals/`），讀取已有的需求分析，判斷沿用主稿、另開 topic、延續既有 change 或需要釐清。它不等於 `speckit-plan` 的技術設計。部署與使用見 [操作說明](saintber-design/README.md)；各階段、各流程的工具對照見 [開發流程 §12](../../docs/developer-guide/development-workflows.md#12-流程配套工具saintber-design-與-spec-kit-指令)。

- [`saintber-intent`](saintber-intent/SKILL.md)：建立或修訂需求分析階段的**早期需求稿**（`docs/proposals/`），判斷沿用主稿、另開 topic、延續既有 change 或需要釐清；與 `saintber-design` 分工，互相只讀不改。不依賴 Spec Kit，安裝器獨立。部署與使用見 [操作說明](saintber-intent/README.md)；管理規則見 [Intent 管理](../../docs/developer-guide/intent-workflow.md)。

兩個技能各有獨立安裝器，可以分別安裝。可以在自己的 worktree 直接撰寫、驗證與提交，不強制跑 Spec Kit。代理側部署方式依相應需求確立；不要手改上游管理的 `speckit-*`。供使用者安裝的產品技能則由未來的 `projects/ai-skills/` 擁有。
