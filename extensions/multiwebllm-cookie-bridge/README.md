# MultiWebLLM Cookie Bridge

轻量 Chrome 扩展，用于从当前浏览器 **一键导出 Cookie** 到 MultiWebLLM 管理后台（服务商配置页）。

导出格式与 [Cookie Editor](https://github.com/buigiathanh/Cookie_Editor) 的 **JSON 导出** 一致（`chrome.cookies.getAll` 原始对象数组），后台会自动压缩并按服务商域名过滤。

> **许可说明**：本扩展为 MultiWebLLM 项目自有实现（MIT），**未包含** Cookie Editor 的 GPL 源码。若你使用官方 Cookie Editor，仍可通过「从剪贴板导入」粘贴其 JSON 导出结果。

## 安装（开发者模式）

1. 生成图标（首次）：
   ```bash
   node scripts/generate-icons.mjs
   ```
2. Chrome 打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」
3. 选择本目录 `extensions/multiwebllm-cookie-bridge`

## 非 localhost 部署

若管理后台不在 `localhost` / `127.0.0.1`，需把站点 origin 写入 manifest：

```bash
node scripts/patch-manifest-origins.mjs https://your-domain.com:8080
```

然后在 `chrome://extensions` 中点击扩展的「重新加载」。

## 使用

1. 在 MultiWebLLM **服务商** 页编辑 Cookie 类型服务商，填写正确 **基础地址**（如 `https://gemini.google.com`）
2. 在 Chrome 中登录对应网站
3. 点击 **「扩展一键获取」** 或授权对话框中的 **「一键获取 Cookie」**

## 开发

| 消息 action | 说明 |
|-------------|------|
| `check_install` | 检测扩展是否已安装 |
| `export_cookies` | `{ url }` 导出该 URL 可用的 Cookie |
| `open_tab` | `{ url }` 打开登录页 |

网页通过 `externally_connectable` 调用 `chrome.runtime.sendMessage`；扩展 ID 由页面内 `content-bridge.js` 自动发现。
