# Launch Kit

Use these assets after replacing `<REPO_URL>` with the final public repository URL. Do not post the same copy everywhere; adapt the opening sentence to each community and answer comments personally.

## Repository metadata

**Name:** `ai-job-copilot-edge`

**Description:** Open-source Edge side-panel agent that filters jobs, matches your resume with AI, and applies only after human review.

**Topics:** `edge-extension`, `browser-extension`, `manifest-v3`, `job-search`, `ai-agent`, `deepseek`, `openai`, `resume`, `career`, `productivity`, `javascript`, `chinese`

**Release title:** `v0.1.0 — First public release`

**Release summary:**

> The first public release of AI Job Copilot for Edge. Scan job lists, apply hard filters, compare each role with your resume using DeepSeek/OpenAI/local models, review the queue, and run a rate-limited application batch with explicit confirmation and CAPTCHA safety stops.

## Chinese launch post — 即刻 / 掘金 / V2EX / 知乎

**Title:** 我把“AI 自动找工作”做成了一个开源 Edge 扩展

**Body:**

> 找工作最累的往往不是判断岗位，而是重复打开页面、筛条件、看 JD、写招呼语。
>
> 我做了一个开源的 Edge 侧边栏智能体：先按岗位/城市/薪资/黑名单初筛，再用 DeepSeek、OpenAI 或本地模型比较简历和 JD，最后由用户审核后才限速投递。
>
> 它不是“闭眼海投”：没有自建后端、不绕验证码、不隐藏投递决策，API Key 和简历保存在浏览器扩展本地。
>
> 当前支持 BOSS 直聘、猎聘和智联招聘。网站页面会改版，所以也很希望有人一起维护适配器、补测试和改体验。
>
> 开源地址：<REPO_URL>
>
> 如果你觉得有用，欢迎 Star；如果扫描不到岗位，也欢迎带着脱敏信息提 Issue。

Suggested tags: `AI求职` `Edge扩展` `开源项目` `DeepSeek` `效率工具` `产品经理` `找工作`

## Xiaohongshu / Douyin caption

**Title:** 我把 AI 自动找工作做成开源插件了（不闭眼海投）

**Caption:**

> 把重复的岗位筛选、简历匹配、招呼语和投递队列放进 Edge 侧边栏。支持 DeepSeek / OpenAI / 本地模型，投递前必须人工审核，遇到验证码自动停。代码和安装教程全部开源：<REPO_URL>

Suggested tags: `#AI求职` `#找工作` `#Edge插件` `#开源项目` `#DeepSeek` `#效率工具`

## 45-second demo script

1. **0–4s:** “每天重复刷岗位、看 JD、写招呼语？我把它做成开源 Edge 插件了。”
2. **4–10s:** 展示 Edge 侧边栏和求职配置，强调简历/API Key 本地保存。
3. **10–20s:** 点击“扫描当前页”，展示岗位、城市、薪资和黑名单初筛。
4. **20–30s:** 点击“AI 匹配”，展示分数、优势、缺口和招呼语。
5. **30–39s:** 勾选岗位，展示投递前二次确认和验证码自动停机说明。
6. **39–45s:** “支持 BOSS、猎聘、智联。GitHub 已开源，链接见简介，欢迎 Star 和贡献适配器。”

## English launch post — X / LinkedIn / Hacker News Show HN

**Title:** Show HN: An open-source Edge side-panel copilot for reviewed job applications

**Body:**

> I built AI Job Copilot, a local-first Manifest V3 extension for Microsoft Edge.
>
> It collects roles from a job-search page, applies hard filters, compares each JD with your real resume using DeepSeek/OpenAI/a local model, and creates a review queue. Applications run only after explicit confirmation, with rate limits and a hard stop on CAPTCHA or verification pages.
>
> No hosted backend, no `<all_urls>`, no CAPTCHA bypass, and no hidden application decisions.
>
> Source and setup: <REPO_URL>
>
> Feedback and site-adapter contributions are welcome.

## Product Hunt draft

**Name:** AI Job Copilot for Edge

**Tagline:** Review-first AI job matching and applications in your Edge side panel

**Description:** A local-first, open-source Edge extension that filters job listings, matches each role against your resume with DeepSeek/OpenAI/local models, and runs a rate-limited application queue only after explicit review.

**First comment:**

> Hi Product Hunt — I built this because most “auto apply” tools hide the decisions that matter. AI Job Copilot automates collection, filtering, and resume/JD analysis, but keeps the final application queue visible and user-approved. It has no hosted backend and deliberately stops on verification pages. The first release supports three Chinese job sites, and the adapter architecture is open for contributors. I would especially value feedback on the review workflow, local-model setup, and which job platform to support next.

## Seven-day launch sequence

1. **Day 0:** Publish the GitHub repository, tag `v0.1.0`, add topics, enable Issues, and upload the social preview image.
2. **Day 1:** Post a short Chinese demo to one community where you already participate; answer every substantive comment.
3. **Day 2:** Publish a technical build article explaining Manifest V3, site adapters, privacy, and confirmation design.
4. **Day 3:** Upload the 45-second demo to Xiaohongshu/Douyin/Bilibili and link the repository in the profile or comments where allowed.
5. **Day 4:** Create a Product Hunt draft and polish screenshots before scheduling. Post as the Maker and prepare the first comment.
6. **Day 5:** Submit a focused Show HN or English launch post; lead with technical choices and limitations, not hype.
7. **Day 6–7:** Turn repeated feedback into labelled GitHub issues, publish a small patch, and thank early contributors in the release notes.

## Star-growth principles

- Demonstrate one real end-to-end workflow in under a minute.
- Ask for specific contributions (“help maintain the Liepin adapter”), not generic attention.
- Publish fixes quickly during launch week so visitors see an active project.
- Never buy stars, exchange stars, mass-DM strangers, or spam unrelated communities.
- Track useful signals: README visits, installation success, issues, returning contributors, and stars from genuine users.
