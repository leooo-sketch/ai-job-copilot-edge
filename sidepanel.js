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

const state = {
  config: { ...DEFAULT_CONFIG },
  jobs: [],
  logs: [],
  activeTab: null,
  site: null,
  analyzing: false,
  applying: false
};

const ui = {};
let toastTimer = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  collectUI();
  bindEvents();
  const stored = await chrome.storage.local.get([CONFIG_KEY, STATE_KEY]);
  state.config = { ...DEFAULT_CONFIG, ...(stored[CONFIG_KEY] || {}) };
  state.jobs = Array.isArray(stored[STATE_KEY]?.jobs) ? stored[STATE_KEY].jobs : [];
  state.logs = Array.isArray(stored[STATE_KEY]?.logs) ? stored[STATE_KEY].logs : [];
  hydrateSettings();
  renderAll();
  await detectActiveSite();
}

function collectUI() {
  const ids = [
    "siteBanner", "siteName", "siteHint", "settingsButton", "scanButton", "analyzeButton",
    "metricTotal", "metricPassed", "metricMatched", "scanEmpty", "scanList", "reviewEmpty",
    "reviewList", "applyDock", "selectedCount", "selectMatchedButton", "clearSelectionButton",
    "applyButton", "logsEmpty", "logList", "clearLogsButton", "batchStatus", "batchStatusTitle",
    "batchStatusDetail", "settingsDialog", "settingsForm", "closeSettingsButton", "providerInput",
    "apiBaseUrlInput", "modelInput", "apiKeyInput", "toggleApiKeyButton", "resumeTextInput",
    "resumeFileInput", "resumeCount", "keywordsInput", "citiesInput", "salaryMinInput",
    "salaryMaxInput", "companyBlacklistInput", "jobBlacklistInput", "minScoreInput", "maxJobsInput",
    "delaySecondsInput", "greetingTemplateInput", "settingsMessage", "confirmDialog", "confirmMessage",
    "confirmCheck", "cancelApplyButton", "confirmApplyButton", "toast"
  ];
  ids.forEach((id) => { ui[id] = document.getElementById(id); });
  ui.steps = [...document.querySelectorAll(".step")];
  ui.views = {
    scan: document.getElementById("scanView"),
    review: document.getElementById("reviewView"),
    logs: document.getElementById("logsView")
  };
}

function bindEvents() {
  ui.settingsButton.addEventListener("click", () => ui.settingsDialog.showModal());
  ui.closeSettingsButton.addEventListener("click", () => ui.settingsDialog.close());
  ui.settingsForm.addEventListener("submit", saveSettings);
  ui.providerInput.addEventListener("change", applyProviderDefaults);
  ui.toggleApiKeyButton.addEventListener("click", toggleApiKey);
  ui.resumeTextInput.addEventListener("input", updateResumeCount);
  ui.resumeFileInput.addEventListener("change", importResumeFile);
  ui.scanButton.addEventListener("click", scanCurrentPage);
  ui.analyzeButton.addEventListener("click", analyzeJobs);
  ui.selectMatchedButton.addEventListener("click", selectAllMatched);
  ui.clearSelectionButton.addEventListener("click", clearSelection);
  ui.applyButton.addEventListener("click", openApplyConfirmation);
  ui.confirmCheck.addEventListener("change", () => { ui.confirmApplyButton.disabled = !ui.confirmCheck.checked; });
  ui.cancelApplyButton.addEventListener("click", () => ui.confirmDialog.close());
  ui.confirmApplyButton.addEventListener("click", startBatchApply);
  ui.clearLogsButton.addEventListener("click", clearLogs);
  ui.steps.forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  ui.scanList.addEventListener("click", handleJobListClick);
  ui.reviewList.addEventListener("click", handleJobListClick);
  ui.reviewList.addEventListener("change", handleReviewChange);
  chrome.tabs.onActivated.addListener(detectActiveSite);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete" && tabId === state.activeTab?.id) detectActiveSite();
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "BATCH_PROGRESS") handleBatchProgress(message.payload);
  });
}

async function detectActiveSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.activeTab = tab || null;
  const site = identifySite(tab?.url || "");
  state.site = site;
  ui.siteBanner.classList.toggle("is-ready", Boolean(site));
  ui.siteBanner.classList.toggle("is-error", !site);
  ui.siteName.textContent = site ? `${site} 已连接` : "当前页面暂不支持";
  ui.siteHint.textContent = site
    ? "请停留在岗位列表页，侧边栏会读取当前可见岗位"
    : "支持 BOSS 直聘、猎聘和智联招聘";
  ui.scanButton.disabled = !site || state.analyzing || state.applying;
}

function identifySite(urlValue) {
  try {
    const host = new URL(urlValue).hostname.toLowerCase();
    if (host === "zhipin.com" || host.endsWith(".zhipin.com")) return "BOSS直聘";
    if (host === "liepin.com" || host.endsWith(".liepin.com")) return "猎聘";
    if (host === "zhaopin.com" || host.endsWith(".zhaopin.com")) return "智联招聘";
  } catch (_) {}
  return null;
}

async function scanCurrentPage() {
  if (!state.activeTab?.id || !state.site) {
    showToast("请先打开支持的招聘网站岗位列表页");
    return;
  }
  setButtonBusy(ui.scanButton, true, "正在扫描…");
  try {
    const response = await chrome.tabs.sendMessage(state.activeTab.id, {
      type: "EXTRACT_JOBS",
      limit: Math.min(100, Math.max(30, state.config.maxJobs * 3))
    });
    if (!response?.ok) throw new Error(response?.error || "页面没有返回岗位数据");
    if (!response.jobs?.length) throw new Error("当前页面没有识别到岗位卡片，请打开职位列表并滚动加载后重试");

    state.jobs = response.jobs.map((job) => ({
      ...job,
      filter: prefilterJob(job, state.config),
      analysis: null,
      selected: false,
      status: "scanned"
    }));
    appendLog("info", `扫描到 ${state.jobs.length} 个岗位`, `${response.site} · ${new URL(response.pageUrl).pathname}`);
    await persistState();
    renderAll();
    showToast(`已扫描 ${state.jobs.length} 个岗位`);
  } catch (error) {
    appendLog("error", "扫描失败", cleanError(error));
    showToast(`${cleanError(error)}。若刚安装扩展，请刷新招聘页面。`);
  } finally {
    setButtonBusy(ui.scanButton, false, "扫描当前页");
    ui.scanButton.disabled = !state.site;
  }
}

function prefilterJob(job, config) {
  const reasons = [];
  const text = normalize(`${job.title} ${job.company} ${job.location} ${job.salary} ${job.rawText}`);
  const titleAndDescription = normalize(`${job.title} ${job.description}`);
  const keywords = splitTerms(config.keywords);
  const cities = splitTerms(config.cities);
  const companyBlacklist = splitTerms(config.companyBlacklist);
  const jobBlacklist = splitTerms(config.jobBlacklist);

  if (keywords.length && !keywords.some((term) => titleAndDescription.includes(normalize(term)))) {
    reasons.push("未命中目标岗位关键词");
  }
  if (cities.length && !cities.some((term) => text.includes(normalize(term)))) {
    reasons.push("地区不匹配");
  }
  if (companyBlacklist.some((term) => normalize(job.company).includes(normalize(term)))) {
    reasons.push("命中公司黑名单");
  }
  const blockedJobTerm = jobBlacklist.find((term) => titleAndDescription.includes(normalize(term)));
  if (blockedJobTerm) reasons.push(`命中岗位黑名单：${blockedJobTerm}`);

  const salary = parseSalary(job.salary);
  const salaryMin = Number(config.salaryMin) || 0;
  const salaryMax = Number(config.salaryMax) || 0;
  if (salary && salaryMin && salary.max < salaryMin) reasons.push("薪资低于下限");
  if (salary && salaryMax && salary.min > salaryMax) reasons.push("薪资高于范围");

  return {
    passed: reasons.length === 0,
    reasons,
    salary,
    keywordHits: keywords.filter((term) => titleAndDescription.includes(normalize(term)))
  };
}

async function analyzeJobs() {
  if (state.analyzing) return;
  const candidates = state.jobs.filter((job) => job.filter?.passed).slice(0, state.config.maxJobs);
  if (!candidates.length) {
    showToast("没有通过初筛的岗位，请调整配置后重新扫描");
    return;
  }
  if (!state.config.resumeText.trim()) {
    ui.settingsDialog.showModal();
    showToast("请先粘贴简历文本");
    return;
  }

  state.analyzing = true;
  ui.scanButton.disabled = true;
  ui.analyzeButton.disabled = true;
  switchView("review");
  appendLog("info", "开始岗位匹配", `${candidates.length} 个岗位 · ${state.config.apiKey ? state.config.model : "本地规则模式"}`);

  for (let index = 0; index < candidates.length; index += 1) {
    const job = candidates[index];
    job.status = "analyzing";
    renderReview();
    try {
      const analysis = state.config.apiKey
        ? await requestAIScore(job)
        : scoreLocally(job, state.config);
      job.analysis = analysis;
      job.status = "analyzed";
      job.selected = analysis.score >= state.config.minScore;
      appendLog(
        analysis.score >= state.config.minScore ? "success" : "warning",
        `${job.title} · ${analysis.score} 分`,
        `${job.company || "未知公司"} · ${analysis.summary}`
      );
    } catch (error) {
      job.status = "error";
      job.analysis = { score: 0, summary: cleanError(error), strengths: [], gaps: ["AI 分析失败"], risks: [], greeting: "", source: "error" };
      job.selected = false;
      appendLog("error", `${job.title} 分析失败`, cleanError(error));
    }
    updateMetrics();
    renderReview();
  }

  state.analyzing = false;
  ui.scanButton.disabled = !state.site;
  ui.analyzeButton.disabled = false;
  await persistState();
  renderAll();
  showToast("岗位匹配已完成，请审核后再投递");
}

async function requestAIScore(job) {
  const response = await chrome.runtime.sendMessage({
    type: "AI_SCORE_JOB",
    payload: { job, config: state.config }
  });
  if (!response?.ok) throw new Error(response?.error || "AI 匹配失败");
  return response.result;
}

function scoreLocally(job, config) {
  const jobText = normalize(`${job.title} ${job.description}`);
  const resumeText = normalize(config.resumeText);
  const targets = splitTerms(config.keywords);
  const targetHits = targets.filter((term) => jobText.includes(normalize(term)));
  const resumeTerms = extractResumeTerms(config.resumeText);
  const skillHits = resumeTerms.filter((term) => jobText.includes(normalize(term))).slice(0, 8);
  const base = job.filter?.passed ? 46 : 25;
  const score = Math.min(88, base + Math.min(24, targetHits.length * 12) + Math.min(18, skillHits.length * 3));
  const strengths = [
    ...targetHits.slice(0, 2).map((term) => `目标方向命中：${term}`),
    ...skillHits.slice(0, 2).map((term) => `简历技能命中：${term}`)
  ].slice(0, 3);
  const gaps = skillHits.length < 2 ? ["本地规则识别到的技能重合较少，建议接入 AI 复核"] : [];
  const company = job.company || "贵公司";
  return {
    score,
    summary: `本地规则匹配：命中 ${targetHits.length} 个目标词、${skillHits.length} 个简历技能词。`,
    strengths,
    gaps,
    risks: ["当前为本地规则评分，不等同于语义匹配"],
    greeting: `您好，我对「${job.title}」岗位很感兴趣，希望有机会与${company}进一步沟通，谢谢！`,
    source: "local"
  };
}

function extractResumeTerms(text) {
  const commonSkills = [
    "产品规划", "需求分析", "用户研究", "竞品分析", "数据分析", "项目管理", "原型设计",
    "AIGC", "AI", "LLM", "大模型", "Prompt", "SQL", "Python", "Figma", "Axure",
    "增长", "商业化", "SaaS", "B端", "C端", "运营", "电商", "出海"
  ];
  const normalized = normalize(text);
  return commonSkills.filter((term) => normalized.includes(normalize(term)));
}

function renderAll() {
  updateMetrics();
  renderScan();
  renderReview();
  renderLogs();
}

function updateMetrics() {
  ui.metricTotal.textContent = String(state.jobs.length);
  ui.metricPassed.textContent = String(state.jobs.filter((job) => job.filter?.passed).length);
  ui.metricMatched.textContent = String(state.jobs.filter((job) => job.analysis?.score >= state.config.minScore).length);
}

function renderScan() {
  const hasJobs = state.jobs.length > 0;
  ui.scanEmpty.hidden = hasJobs;
  ui.scanList.hidden = !hasJobs;
  ui.scanList.replaceChildren();
  ui.analyzeButton.disabled = !state.jobs.some((job) => job.filter?.passed) || state.analyzing;

  state.jobs.forEach((job) => {
    const card = element("article", `job-card${job.filter?.passed ? "" : " is-rejected"}`);
    const top = element("div", "job-top");
    const info = element("div");
    info.append(element("div", "job-title", job.title), element("div", "job-company", job.company || "公司信息未识别"));
    top.append(info, element("div", "job-salary", job.salary || "薪资面议"));
    card.append(top);

    const meta = element("div", "job-meta");
    if (job.location) meta.append(element("span", "tag", job.location));
    meta.append(element("span", `tag ${job.filter?.passed ? "pass" : "reject"}`, job.filter?.passed ? "通过初筛" : "已过滤"));
    (job.tags || []).slice(0, 3).forEach((tag) => meta.append(element("span", "tag", tag)));
    card.append(meta);

    const actions = element("div", "job-actions");
    const reason = job.filter?.passed
      ? `命中：${job.filter.keywordHits?.join("、") || "硬条件"}`
      : job.filter?.reasons?.join("；") || "不符合筛选条件";
    actions.append(element("span", "job-reason", reason), jobOpenButton(job));
    card.append(actions);
    ui.scanList.append(card);
  });
}

function renderReview() {
  const analyzedJobs = state.jobs.filter((job) => job.filter?.passed && (job.analysis || job.status === "analyzing"));
  ui.reviewEmpty.hidden = analyzedJobs.length > 0;
  ui.reviewList.hidden = analyzedJobs.length === 0;
  ui.reviewList.replaceChildren();

  analyzedJobs.forEach((job) => {
    const wrapper = element("article", `job-card review-card${job.selected ? " is-selected" : ""}`);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(job.selected);
    checkbox.disabled = !job.analysis || job.status === "analyzing";
    checkbox.dataset.jobId = job.id;
    checkbox.setAttribute("aria-label", `选择 ${job.title}`);

    const content = element("div");
    const top = element("div", "job-top");
    const info = element("div");
    info.append(element("div", "job-title", job.title), element("div", "job-company", `${job.company || "公司未识别"} · ${job.salary || "薪资面议"}`));
    if (job.status === "analyzing") {
      top.append(info, element("span", "tag", "分析中…"));
    } else {
      top.append(info, scoreBadge(job.analysis?.score || 0));
    }
    content.append(top);

    if (job.analysis) {
      content.append(element("p", "review-summary", job.analysis.summary));
      if (job.analysis.strengths?.length) content.append(insightList(job.analysis.strengths, false));
      if (job.analysis.gaps?.length) content.append(insightList(job.analysis.gaps, true));
    }
    const actions = element("div", "job-actions");
    actions.append(element("span", "job-reason", job.analysis?.source === "local" ? "本地规则评分" : "AI 语义评分"), jobOpenButton(job));
    content.append(actions);
    wrapper.append(checkbox, content);
    ui.reviewList.append(wrapper);
  });

  const selected = state.jobs.filter((job) => job.selected && job.analysis).length;
  ui.selectedCount.textContent = String(selected);
  ui.applyDock.hidden = analyzedJobs.length === 0;
  ui.applyButton.disabled = selected === 0 || state.applying;
}

function renderLogs() {
  const hasLogs = state.logs.length > 0;
  ui.logsEmpty.hidden = hasLogs;
  ui.logList.hidden = !hasLogs;
  ui.logList.replaceChildren();
  state.logs.slice().reverse().forEach((log) => {
    const item = element("li", `log-item ${log.type || "info"}`);
    item.append(
      element("strong", "", log.title),
      element("p", "", log.detail || ""),
      element("div", "log-time", formatTime(log.at))
    );
    ui.logList.append(item);
  });
}

function scoreBadge(score) {
  const badge = element("div", `score-badge ${score >= 75 ? "good" : score >= 60 ? "" : "low"}`);
  badge.style.setProperty("--score-angle", `${Math.max(0, Math.min(100, score)) * 3.6}deg`);
  badge.append(element("span", "", String(score)));
  return badge;
}

function insightList(items, gaps) {
  const list = element("ul", `insight-list${gaps ? " gaps" : ""}`);
  items.slice(0, 3).forEach((item) => list.append(element("li", "", item)));
  return list;
}

function jobOpenButton(job) {
  const button = element("button", "open-link", "打开岗位 ↗");
  button.type = "button";
  button.dataset.action = "open-job";
  button.dataset.jobId = job.id;
  return button;
}

async function handleJobListClick(event) {
  const button = event.target.closest("[data-action='open-job']");
  if (!button) return;
  const job = state.jobs.find((item) => item.id === button.dataset.jobId);
  if (!job) return;
  const response = await chrome.runtime.sendMessage({ type: "OPEN_JOB", url: job.url });
  if (!response?.ok) showToast(response?.error || "岗位页面打开失败");
}

function handleReviewChange(event) {
  if (!event.target.matches("input[type='checkbox'][data-job-id]")) return;
  const job = state.jobs.find((item) => item.id === event.target.dataset.jobId);
  if (!job) return;
  job.selected = event.target.checked;
  persistState();
  renderReview();
}

function selectAllMatched() {
  let selected = 0;
  state.jobs.forEach((job) => {
    if (job.analysis?.score >= state.config.minScore && selected < 20) {
      job.selected = true;
      selected += 1;
    }
  });
  persistState();
  renderReview();
}

function clearSelection() {
  state.jobs.forEach((job) => { job.selected = false; });
  persistState();
  renderReview();
}

function openApplyConfirmation() {
  const selected = selectedJobs();
  if (!selected.length) return;
  ui.confirmMessage.textContent = `即将处理 ${selected.length} 个岗位。请确认这些岗位、公司与招呼语均符合你的真实意愿。`;
  ui.confirmCheck.checked = false;
  ui.confirmApplyButton.disabled = true;
  ui.confirmDialog.showModal();
}

async function startBatchApply() {
  if (!ui.confirmCheck.checked || state.applying) return;
  const jobs = selectedJobs().slice(0, Math.min(20, state.config.maxJobs));
  ui.confirmDialog.close();
  switchView("logs");
  state.applying = true;
  ui.applyButton.disabled = true;
  ui.batchStatus.hidden = false;
  ui.batchStatusTitle.textContent = "正在启动投递";
  ui.batchStatusDetail.textContent = `${jobs.length} 个岗位，岗位间隔 ${state.config.delaySeconds} 秒`;
  appendLog("warning", `用户已确认投递 ${jobs.length} 个岗位`, "扩展将逐个打开岗位页；遇到验证码会停止。" );

  try {
    const response = await chrome.runtime.sendMessage({
      type: "BATCH_APPLY",
      payload: {
        jobs: jobs.map((job) => ({ id: job.id, title: job.title, company: job.company, url: job.url })),
        greetingTemplate: state.config.greetingTemplate,
        delaySeconds: state.config.delaySeconds
      }
    });
    if (!response?.ok) throw new Error(response?.error || "批量投递失败");
    const successful = response.result.results.filter((item) => ["applied", "sent"].includes(item.status)).length;
    const blocked = response.result.results.find((item) => item.status === "blocked");
    appendLog(
      blocked ? "warning" : "success",
      blocked ? "任务因安全验证停止" : "本批次处理完成",
      `成功/已点击 ${successful} 个，共处理 ${response.result.completed} 个。请在最后打开的岗位页核对结果。`
    );
    showToast(blocked ? "检测到安全验证，任务已停止" : "本批次处理完成");
  } catch (error) {
    appendLog("error", "批量投递中断", cleanError(error));
    showToast(cleanError(error));
  } finally {
    state.applying = false;
    ui.batchStatus.hidden = true;
    renderAll();
    await persistState();
  }
}

function handleBatchProgress(payload = {}) {
  if (payload.phase === "opening") {
    ui.batchStatus.hidden = false;
    ui.batchStatusTitle.textContent = `正在处理 ${payload.index + 1}/${payload.total}`;
    ui.batchStatusDetail.textContent = `${payload.job?.title || "岗位"} · ${payload.job?.company || ""}`;
  }
  if (payload.phase === "result") {
    const result = payload.result || {};
    const type = ["sent", "applied", "already-contacted"].includes(result.status) ? "success" : result.status === "blocked" ? "warning" : "error";
    appendLog(type, `${result.title || "岗位"} · ${statusLabel(result.status)}`, result.message || result.company || "");
  }
}

function selectedJobs() {
  return state.jobs.filter((job) => job.selected && job.analysis);
}

async function clearLogs() {
  state.logs = [];
  await persistState();
  renderLogs();
}

function switchView(name) {
  if (!ui.views[name]) return;
  Object.entries(ui.views).forEach(([key, view]) => view.classList.toggle("is-active", key === name));
  ui.steps.forEach((button) => button.classList.toggle("is-active", button.dataset.view === name));
}

function hydrateSettings() {
  Object.entries({
    providerInput: "provider",
    apiBaseUrlInput: "apiBaseUrl",
    modelInput: "model",
    apiKeyInput: "apiKey",
    resumeTextInput: "resumeText",
    keywordsInput: "keywords",
    citiesInput: "cities",
    salaryMinInput: "salaryMin",
    salaryMaxInput: "salaryMax",
    companyBlacklistInput: "companyBlacklist",
    jobBlacklistInput: "jobBlacklist",
    minScoreInput: "minScore",
    maxJobsInput: "maxJobs",
    delaySecondsInput: "delaySeconds",
    greetingTemplateInput: "greetingTemplate"
  }).forEach(([id, key]) => { ui[id].value = state.config[key] ?? ""; });
  updateResumeCount();
}

async function saveSettings(event) {
  event.preventDefault();
  const next = {
    ...state.config,
    provider: ui.providerInput.value,
    apiBaseUrl: ui.apiBaseUrlInput.value.trim(),
    model: ui.modelInput.value.trim(),
    apiKey: ui.apiKeyInput.value.trim(),
    resumeText: ui.resumeTextInput.value.trim(),
    keywords: ui.keywordsInput.value.trim(),
    cities: ui.citiesInput.value.trim(),
    salaryMin: clampNumber(ui.salaryMinInput.value, 0, 200),
    salaryMax: clampNumber(ui.salaryMaxInput.value, 0, 300),
    companyBlacklist: ui.companyBlacklistInput.value.trim(),
    jobBlacklist: ui.jobBlacklistInput.value.trim(),
    minScore: clampNumber(ui.minScoreInput.value, 0, 100),
    maxJobs: clampNumber(ui.maxJobsInput.value, 1, 20),
    delaySeconds: clampNumber(ui.delaySecondsInput.value, 4, 30),
    greetingTemplate: ui.greetingTemplateInput.value.trim() || DEFAULT_CONFIG.greetingTemplate
  };

  try {
    validateApiBase(next.apiBaseUrl);
    state.config = next;
    state.jobs = state.jobs.map((job) => ({ ...job, filter: prefilterJob(job, next), selected: false }));
    await chrome.storage.local.set({ [CONFIG_KEY]: state.config });
    await persistState();
    ui.settingsMessage.textContent = "已保存";
    renderAll();
    setTimeout(() => ui.settingsDialog.close(), 350);
  } catch (error) {
    ui.settingsMessage.textContent = cleanError(error);
  }
}

function applyProviderDefaults() {
  const presets = {
    deepseek: { apiBaseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
    openai: { apiBaseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
    local: { apiBaseUrl: "http://127.0.0.1:11434/v1", model: "qwen2.5:7b" }
  };
  const preset = presets[ui.providerInput.value];
  if (!preset) return;
  ui.apiBaseUrlInput.value = preset.apiBaseUrl;
  ui.modelInput.value = preset.model;
}

function validateApiBase(value) {
  const url = new URL(value);
  const allowed = ["api.deepseek.com", "api.openai.com", "127.0.0.1", "localhost"];
  if (!allowed.includes(url.hostname)) throw new Error("接口仅支持 DeepSeek、OpenAI 或本机服务");
  if (url.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("远程接口必须使用 HTTPS");
}

function toggleApiKey() {
  const visible = ui.apiKeyInput.type === "text";
  ui.apiKeyInput.type = visible ? "password" : "text";
  ui.toggleApiKeyButton.textContent = visible ? "显示" : "隐藏";
}

async function importResumeFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast("简历文本文件不能超过 2MB");
    return;
  }
  ui.resumeTextInput.value = await file.text();
  updateResumeCount();
}

function updateResumeCount() {
  ui.resumeCount.textContent = `${ui.resumeTextInput.value.length} 字`;
}

function appendLog(type, title, detail) {
  state.logs.push({ id: crypto.randomUUID(), type, title, detail, at: Date.now() });
  state.logs = state.logs.slice(-200);
  renderLogs();
  persistState();
}

async function persistState() {
  const jobs = state.jobs.slice(0, 100).map((job) => ({
    ...job,
    description: String(job.description || "").slice(0, 5000),
    rawText: String(job.rawText || "").slice(0, 5000)
  }));
  await chrome.storage.local.set({
    [STATE_KEY]: { jobs, logs: state.logs.slice(-200), updatedAt: Date.now() }
  });
}

function parseSalary(value) {
  const text = String(value || "").replace(/,/g, "").toLowerCase();
  const range = text.match(/(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*(k|千|万)/i);
  if (!range) return null;
  let min = Number(range[1]);
  let max = Number(range[2]);
  const unit = range[3].toLowerCase();
  if (unit === "万") {
    min *= 10;
    max *= 10;
  }
  if (text.includes("年") || text.includes("annual")) {
    min /= 12;
    max /= 12;
  }
  return { min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 };
}

function splitTerms(value) {
  return String(value || "").split(/[,，;；\n]/).map((item) => item.trim()).filter(Boolean);
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function element(tag, className = "", text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function statusLabel(status) {
  const labels = {
    sent: "已发送招呼语",
    applied: "已点击投递",
    "already-contacted": "已沟通，跳过",
    "no-action": "未找到按钮",
    blocked: "安全验证，已停止",
    "page-unavailable": "页面不可用",
    error: "执行失败"
  };
  return labels[status] || status || "未知状态";
}

function setButtonBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || min));
}

function cleanError(error) {
  return String(error?.message || error || "未知错误").replace(/\bsk-[A-Za-z0-9_-]+/g, "[已隐藏密钥]").slice(0, 300);
}

function showToast(message) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => ui.toast.classList.remove("is-visible"), 3200);
}
