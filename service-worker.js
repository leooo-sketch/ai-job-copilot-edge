const CONFIG_KEY = "jobAgentConfig";
const STATE_KEY = "jobAgentState";

const DEFAULT_CONFIG = {
  provider: "deepseek",
  apiBaseUrl: "https://api.deepseek.com",
  apiKey: "",
  model: "deepseek-chat",
  resumeText: "",
  keywords: "AI产品经理, 产品经理",
  cities: "",
  salaryMin: 0,
  salaryMax: 0,
  companyBlacklist: "",
  jobBlacklist: "销售, 保险, 外包驻场",
  minScore: 70,
  maxJobs: 20,
  delaySeconds: 8,
  greetingTemplate: "您好，我对「{jobTitle}」岗位很感兴趣。我的经历与岗位要求有较高匹配度，希望有机会进一步沟通，谢谢！"
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  const stored = await chrome.storage.local.get([CONFIG_KEY, STATE_KEY]);
  if (!stored[CONFIG_KEY]) {
    await chrome.storage.local.set({ [CONFIG_KEY]: DEFAULT_CONFIG });
  }
  if (!stored[STATE_KEY]) {
    await chrome.storage.local.set({
      [STATE_KEY]: { jobs: [], logs: [], updatedAt: Date.now() }
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  if (message.type === "AI_SCORE_JOB") {
    scoreJobWithAI(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: cleanError(error) }));
    return true;
  }

  if (message.type === "OPEN_JOB") {
    openJob(message.url)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: cleanError(error) }));
    return true;
  }

  if (message.type === "BATCH_APPLY") {
    runBatchApply(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: cleanError(error) }));
    return true;
  }

  return false;
});

async function scoreJobWithAI(payload = {}) {
  const { job, config } = payload;
  if (!job || !config) throw new Error("缺少岗位或配置数据");
  if (!config.apiKey) throw new Error("请先填写 API Key");

  const endpoint = buildChatEndpoint(config.apiBaseUrl);
  assertAllowedEndpoint(endpoint);

  const prompt = [
    "你是严谨的求职岗位匹配助手。请比较候选人简历与岗位信息。",
    "只输出一个 JSON 对象，不要输出 Markdown。字段必须是：",
    "score(0-100整数), summary(80字内), strengths(字符串数组，最多3项), gaps(字符串数组，最多3项), risks(字符串数组，最多2项), greeting(100字内且不得虚构经历)。",
    "评分规则：核心技能40%，相关经历30%，行业/岗位方向20%，地点薪资等硬条件10%。信息不足时保守评分，不得编造。",
    `候选人目标关键词：${String(config.keywords || "未设置")}`,
    `候选人简历：\n${String(config.resumeText || "").slice(0, 14000)}`,
    `岗位名称：${String(job.title || "")}`,
    `公司：${String(job.company || "")}`,
    `薪资与地点：${String(job.salary || "")} ${String(job.location || "")}`,
    `岗位描述：\n${String(job.description || job.rawText || "").slice(0, 9000)}`
  ].join("\n\n");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || "deepseek-chat",
      temperature: 0.15,
      messages: [
        { role: "system", content: "你是求职匹配分析器，必须返回合法 JSON，且不得虚构候选人经历。" },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `模型接口请求失败（${response.status}）`);
  }

  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("模型没有返回可用内容");
  const parsed = parseJsonObject(raw);
  return normalizeScoreResult(parsed);
}

function buildChatEndpoint(baseUrl) {
  const normalized = String(baseUrl || "https://api.deepseek.com").trim().replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function assertAllowedEndpoint(value) {
  const url = new URL(value);
  const allowedHosts = new Set([
    "api.deepseek.com",
    "api.openai.com",
    "127.0.0.1",
    "localhost"
  ]);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error("当前版本仅允许 DeepSeek、OpenAI 或本机兼容接口");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) {
    throw new Error("远程模型接口必须使用 HTTPS");
  }
}

function parseJsonObject(raw) {
  const text = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("模型返回的 JSON 无法解析");
  }
}

function normalizeScoreResult(value = {}) {
  const score = Math.max(0, Math.min(100, Math.round(Number(value.score) || 0)));
  return {
    score,
    summary: String(value.summary || "模型未提供摘要").slice(0, 180),
    strengths: cleanStringArray(value.strengths, 3),
    gaps: cleanStringArray(value.gaps, 3),
    risks: cleanStringArray(value.risks, 2),
    greeting: String(value.greeting || "").slice(0, 220),
    source: "ai"
  };
}

function cleanStringArray(value, limit) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).slice(0, 100)).filter(Boolean).slice(0, limit);
}

async function openJob(url) {
  assertJobUrl(url);
  const tab = await chrome.tabs.create({ url, active: true });
  return { tabId: tab.id };
}

async function runBatchApply(payload = {}) {
  const jobs = Array.isArray(payload.jobs) ? payload.jobs.slice(0, 20) : [];
  const greetingTemplate = String(payload.greetingTemplate || DEFAULT_CONFIG.greetingTemplate);
  const delayMs = Math.max(4000, Math.min(30000, Number(payload.delaySeconds || 8) * 1000));
  if (!jobs.length) throw new Error("没有待投递岗位");

  const results = [];
  let automationTabId = null;

  try {
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      assertJobUrl(job.url);
      broadcastProgress({ phase: "opening", index, total: jobs.length, job });

      if (automationTabId == null) {
        const tab = await chrome.tabs.create({ url: job.url, active: true });
        automationTabId = tab.id;
      } else {
        await chrome.tabs.update(automationTabId, { url: job.url, active: true });
      }

      await waitForTabComplete(automationTabId, 30000);
      await wait(1200);

      const greeting = greetingTemplate
        .replaceAll("{jobTitle}", job.title || "该")
        .replaceAll("{company}", job.company || "贵公司");

      let response;
      try {
        response = await chrome.tabs.sendMessage(automationTabId, {
          type: "EXECUTE_APPLICATION",
          payload: { greeting }
        });
      } catch (error) {
        response = { ok: false, status: "page-unavailable", message: cleanError(error) };
      }

      const result = {
        jobId: job.id,
        title: job.title,
        company: job.company,
        ...(response || { ok: false, status: "unknown" })
      };
      results.push(result);
      broadcastProgress({ phase: "result", index, total: jobs.length, job, result });

      if (result.status === "blocked") {
        broadcastProgress({ phase: "stopped", index, total: jobs.length, job, result });
        break;
      }

      if (index < jobs.length - 1) await wait(delayMs);
    }
  } finally {
    if (automationTabId != null) {
      chrome.tabs.update(automationTabId, { active: true }).catch(() => {});
    }
  }

  return { results, completed: results.length, total: jobs.length, tabId: automationTabId };
}

function broadcastProgress(payload) {
  chrome.runtime.sendMessage({ type: "BATCH_PROGRESS", payload }).catch(() => {});
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("岗位页面加载超时")), timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish();
    };

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      if (error) reject(error);
      else resolve();
    }

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish();
    }).catch(finish);
  });
}

function assertJobUrl(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const allowed = host === "zhipin.com" || host.endsWith(".zhipin.com") ||
    host === "liepin.com" || host.endsWith(".liepin.com") ||
    host === "zhaopin.com" || host.endsWith(".zhaopin.com");
  if (url.protocol !== "https:" || !allowed) throw new Error("岗位链接不在支持的网站范围内");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanError(error) {
  return String(error?.message || error || "未知错误").replace(/\bsk-[A-Za-z0-9_-]+/g, "[已隐藏密钥]").slice(0, 500);
}
