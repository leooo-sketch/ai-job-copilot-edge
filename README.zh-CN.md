<div align="center">

![职舟 AI 求职智能体](assets/hero.png)

# 职舟 AI 求职智能体

**在 Edge 侧边栏完成岗位筛选、简历 AI 匹配、人工审核和限速投递。**

[![GitHub stars](https://img.shields.io/github/stars/leooo-sketch/ai-job-copilot-edge?style=social)](https://github.com/leooo-sketch/ai-job-copilot-edge/stargazers)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-6654e8)
[![License: MIT](https://img.shields.io/badge/License-MIT-2fa978.svg)](LICENSE)

[English](README.md) · [快速开始](#快速开始) · [路线图](ROADMAP.md) · [参与贡献](CONTRIBUTING.md)

</div>

> 一个本地优先、过程透明的开源求职智能体。它自动处理重复步骤，但不会替你隐藏重要决策：先筛选岗位，再根据真实简历评分，最后由你审核并确认投递。

## 核心流程

```text
岗位列表 → 硬条件初筛 → AI 简历/JD 匹配 → 人工审核 → 限速投递
```

没有自建服务器，不绕过验证码，也不会在未经确认时投递。

## 功能

- 三阶段工作流：收集岗位、AI 匹配、审核投递。
- 支持岗位、城市、薪资、公司黑名单和职位黑名单。
- 根据简历生成匹配分、摘要、优势、缺口、风险和真实招呼语。
- 支持 DeepSeek、OpenAI 和本机 OpenAI 兼容接口。
- 常驻 Microsoft Edge 侧边栏。
- 投递前必须二次明确确认。
- 每批最多 20 个岗位，可配置间隔；遇到验证码或安全验证自动停止。
- 简历、配置、API Key 和日志保存在扩展本地存储中。
- 权限严格限定，没有使用 `<all_urls>`。

## 当前支持

| 类型 | 支持范围 |
|---|---|
| 招聘网站 | BOSS 直聘、猎聘、智联招聘 |
| 云端模型 | DeepSeek、OpenAI Chat Completions |
| 本地模型 | `localhost` / `127.0.0.1` 上的 OpenAI 兼容接口 |
| 浏览器 | 支持 Manifest V3 Side Panel 的 Microsoft Edge |

招聘网站会不定期改版。如果网页能打开但扫描不到岗位，通常需要更新 `content-script.js` 中对应站点的选择器，欢迎提交适配 PR。

## 快速开始

1. 下载仓库或 Release 压缩包并解压。
2. Edge 地址栏打开 `edge://extensions`。
3. 开启“开发人员模式”。
4. 点击“加载解压缩的扩展”，选择包含 `manifest.json` 的目录。
5. 将扩展固定到工具栏并点击图标。
6. 登录支持的招聘网站，打开职位搜索结果列表。

### 首次配置

1. 粘贴简历全文；TXT/Markdown 可直接导入，PDF/Word 请复制文字。
2. 设置目标岗位、城市、薪资和黑名单。
3. 需要 AI 语义匹配时填写 DeepSeek/OpenAI API Key；不填则使用较保守的本地关键词评分。
4. 保存后依次执行：**扫描当前页 → AI 匹配 → 审核 → 确认并投递**。

第一次建议只选 1–3 个岗位，先确认当前版本与招聘网站最新页面兼容。

## 隐私和安全

- 项目没有自建后端。
- 只有启用 AI 匹配时，简历文本和岗位描述才会发给你配置的模型服务商。
- 远程模型只允许 DeepSeek 和 OpenAI；HTTP 仅允许本机地址。
- 招聘网页内容通过 `textContent` 渲染，避免 HTML 注入。
- 日志会隐藏 API Key。
- 检测到验证码、滑块、访问异常或安全验证会停止，不包含绕过功能。
- 某些网站点击“立即沟通”就会实际发起沟通，请务必核对所选岗位和最终页面。

详细说明见 [PRIVACY.md](PRIVACY.md) 和 [SECURITY.md](SECURITY.md)。

## 开发检查

只需要 Node.js 18+，没有第三方运行时依赖：

```bash
npm test
npm run check
```

## 路线图

- 更稳定的站点适配器与选择器诊断
- 本地优先的 PDF/DOCX 简历解析
- 每个平台首次真实投递前的预演模式
- 可导出的求职记录
- Edge 扩展商店发布包
- 更多语言和招聘平台

如果这个项目帮你节省了时间，欢迎点一个 **Star**，让更多求职者找到它。

## 免责声明

本项目是独立开源工具，与 Microsoft、BOSS 直聘、猎聘、智联招聘、DeepSeek 或 OpenAI 均无隶属关系。用户应自行遵守各平台用户协议、频率限制和投递规则。高频或重复投递可能导致账号受限。

## License

[MIT](LICENSE) © 2026 [leooo-sketch](https://github.com/leooo-sketch)
