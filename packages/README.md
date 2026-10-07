# Shared 套件

保留共用程式碼的位置。目前**沒有 Shared 套件**，沒有啟用 npm workspaces。

至少有兩個實際消費者並需要共同演進時，才建立 `packages/<name>/`；每個套件有 owner、公開 API、版本、文件與 CHANGELOG。消費方式遵守 [POL-STRUCT-001 R5](../docs/governance/policy/project-structure.md)，不直接 import 相鄰工具原始碼。
