# Sweep

[English](README.en.md)

Sweep 是一个 macOS 本地优先的桌面清理工具，使用 Tauri 2、Rust、React 和 TypeScript 构建。它的目标不是自动删除所有可疑文件，而是先扫描、分类、展示风险，再由用户审阅后把选中的项目移到废纸篓。

> 当前项目处于早期开发阶段。首个发布版本面向 macOS Apple Silicon，本地开发构建未做 Apple 签名和 notarization。

## 功能

- 扫描当前用户目录下的缓存、日志、崩溃报告、下载残留、大文件、重复文件、浏览器缓存、iOS 备份和应用残留。
- 默认只选择低风险项目，高风险或需要判断的项目必须手动确认。
- 清理动作默认移动到 macOS 废纸篓，不直接硬删除文件。
- 审阅页支持按文件或按文件夹聚合查看。
- 支持类别筛选、批量选择和批量取消当前审阅范围。
- 概览页显示已选择空间，并按类别拆分已选择内容。
- 保存扫描和清理摘要历史，但不保存完整扫描文件清单。
- 记住用户调整后的窗口尺寸。
- 扩展用户目录扫描会避开 macOS 隐私保护目录，减少授权弹窗。
- 本地优先，不默认上传路径、文件名、扫描结果或遥测数据。

## 安装

从 GitHub Releases 下载最新的 `Sweep_0.1.0_aarch64.dmg`，打开后将 `Sweep.app` 拖入 Applications。

如果 macOS 提示应用来自未识别开发者，这是因为当前构建未签名。可以在系统设置的隐私与安全中手动允许打开，或从源码本地构建。

## 安全边界

Sweep v0.1.0 只处理当前用户可访问路径，不安装管理员 helper，不申请管理员权限，也不做系统级特权删除。

浏览器清理只覆盖缓存和临时下载残留，不清理 Cookie、历史记录、密码、登录会话或站点数据。

## 审阅流程

1. 在概览页开始扫描。
2. 按类别审阅候选项目。
3. 当某个类别项目很多时，切换到文件夹视图聚合查看。
4. 选择或取消单个文件、文件夹分组，或当前筛选结果集。
5. 将选中的项目移到废纸篓。

## 开发

环境要求：

- macOS
- Node.js
- Rust stable
- Tauri 2 所需的本地构建工具

安装依赖：

```bash
npm install
```

启动开发版：

```bash
npm run tauri -- dev
```

运行前端测试：

```bash
npm test
```

运行 Rust 测试：

```bash
cd src-tauri
cargo test
```

构建 macOS 应用包和安装镜像：

```bash
npm run tauri -- build
```

构建产物默认位于：

```text
src-tauri/target/release/bundle/
```

## 技术栈

- Tauri 2
- Rust
- React
- TypeScript
- Vite
- Vitest

## License

MIT License. See [LICENSE](LICENSE).
