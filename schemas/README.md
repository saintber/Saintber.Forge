# schemas

Hub 與工具之間共同契約的 JSON Schema。見 `design.md` §7.4、§4.1。

## 目前狀態

**尚未建立任何 schema。** 它們會隨 saintber CLI 的工作包（`hub/001-*`）一起設計，因為格式要由實際驗證的程式碼來定，在沒有實作之前寫出來的 schema 很容易是錯的。

## 預計的 schema

| 檔案 | 驗證對象 | 依據 |
|---|---|---|
| `saintber.project.schema.json` | 工具的 `saintber.project.json` | §7.4 |
| `catalog.schema.json` | `catalog/index.json` | §7.6 |
| `workspace.schema.json` | `workspace.json` | §4.2 |
| `profile.schema.json` | Profile | §8.6 |

## 規則

- 每份 schema 有版本，`$schema` 引用用**有版本的網址**，不用 `../../` 相對路徑，這樣工具遷出後仍然有效（§7.4）。
- 只定義**共同、公開**的部分；工具自己的內部資料放在 manifest 的 `toolMetadata`，Hub 不解讀，也不在這裡定義（§7.4）。
- 變更 schema 要升版，不相容的變更要升 major。
