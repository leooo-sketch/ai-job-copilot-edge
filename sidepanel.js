const CONFIG_KEY = "jobAgentConfig";
const STATE_KEY = "jobAgentState";
const PROFILE_KEY = JobAutofillCore.PROFILE_KEY;

const DEFAULT_CONFIG = {
  provider: "qwen",
  apiBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "",
  model: "qwen-plus",
  enableThinking: true,
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

const PROFILE_SCALAR_FIELDS = Object.freeze({
  profileNameInput: "basics.name", profileFamilyNameInput: "basics.familyName",
  profileGivenNameInput: "basics.givenName", profileMiddleNameInput: "basics.middleName",
  profileFormerNameInput: "basics.formerName", profileNamePinyinInput: "basics.namePinyin",
  profileEnglishNameInput: "basics.englishName", profilePhoneCountryCodeInput: "basics.phoneCountryCode",
  profilePhoneInput: "basics.phone", profileAlternatePhoneInput: "basics.alternatePhone",
  profileEmailInput: "basics.email", profileAlternateEmailInput: "basics.alternateEmail",
  profileWechatInput: "basics.wechat", profileUrlInput: "basics.url", profileGithubInput: "basics.github",
  profileLinkedinInput: "basics.linkedin", profileCurrentCityInput: "basics.currentCity",
  profileCurrentProvinceInput: "basics.currentProvince", profileCurrentCountryInput: "basics.currentCountry",
  profileNativePlaceInput: "basics.nativePlace", profileAddressInput: "basics.address",
  profilePostalCodeInput: "basics.postalCode", profileNationalityInput: "basics.nationality",
  profileCitizenshipInput: "basics.citizenship", profileCurrentCompanyInput: "basics.currentCompany",
  profileCurrentTitleInput: "basics.currentTitle", profileYearsExperienceInput: "basics.yearsOfExperience",
  profileExpectedRoleInput: "jobPreferences.expectedRole", profileExpectedJobFamilyInput: "jobPreferences.expectedJobFamily",
  profileExpectedIndustryInput: "jobPreferences.expectedIndustry", profileExpectedCityInput: "jobPreferences.expectedCities",
  profileExpectedSalaryMinInput: "jobPreferences.expectedSalaryMin", profileExpectedSalaryMaxInput: "jobPreferences.expectedSalaryMax",
  profileSalaryPeriodInput: "jobPreferences.salaryPeriod", profileCurrencyInput: "jobPreferences.currency",
  profileAvailableDateInput: "jobPreferences.availableDate", profileEmploymentTypeInput: "jobPreferences.employmentType",
  profileWorkModeInput: "jobPreferences.workMode", profileRelocateInput: "jobPreferences.willingToRelocate",
  profileTravelDomesticInput: "jobPreferences.travelDomestic", profileTravelInternationalInput: "jobPreferences.travelInternational",
  profileAcceptPartTimeInput: "jobPreferences.acceptPartTime", profileAcceptTemporaryInput: "jobPreferences.acceptTemporary",
  profileFlexibleWorkInput: "jobPreferences.flexibleWork", profileSourceInput: "jobPreferences.source",
  profileReferrerNameInput: "jobPreferences.referrerName", profileReferrerEmployeeIdInput: "jobPreferences.referrerEmployeeId",
  profileIdTypeInput: "private.idType", profileIdNumberInput: "private.idNumber",
  profileIdExpiryInput: "private.idExpiryDate", profilePassportNumberInput: "private.passportNumber",
  profilePassportExpiryInput: "private.passportExpiryDate", profileBirthDateInput: "private.birthDate",
  profileBirthPlaceInput: "private.birthPlace", profileGenderInput: "private.gender",
  profileEthnicityInput: "private.ethnicity", profileHealthStatusInput: "private.healthStatus",
  profileMaritalStatusInput: "private.maritalStatus", profilePoliticalStatusInput: "private.politicalStatus",
  profilePartyJoinDateInput: "private.partyJoinDate", profileHukouLocationInput: "private.hukouLocation",
  profileHukouTypeInput: "private.hukouType", profileHeightInput: "private.heightCm",
  profileWeightInput: "private.weightKg", profileDisabilityInput: "private.disabilityStatus",
  profileVeteranInput: "private.veteranStatus", profileWorkAuthorizationInput: "eligibility.workAuthorization",
  profileVisaTypeInput: "eligibility.visaType", profileRequiresSponsorshipInput: "eligibility.requiresSponsorship",
  profileNonCompeteInput: "eligibility.nonCompete", profileRelativeAtCompanyInput: "eligibility.relativeAtCompany",
  profileRelativeDetailsInput: "eligibility.relativeDetails", profileDisciplinaryHistoryInput: "eligibility.disciplinaryHistory",
  profileCriminalHistoryInput: "eligibility.criminalHistory", profileConflictOfInterestInput: "eligibility.conflictOfInterest",
  profileBackgroundCheckInput: "eligibility.canBackgroundCheck", profileSelfEvaluationInput: "narratives.selfEvaluation",
  profileStrengthsInput: "narratives.strengths", profileHobbiesInput: "narratives.hobbies",
  profileCareerPlanInput: "narratives.careerPlan", profileWhyCompanyInput: "narratives.whyCompany",
  profileWhyRoleInput: "narratives.whyRole", profileCoverLetterInput: "narratives.coverLetter",
  profileOtherInfoInput: "narratives.otherInfo"
});

const PROFILE_RECORD_FIELDS = Object.freeze({
  profileResearchInput: "research", profileCampusInput: "campus", profileVolunteerInput: "volunteer",
  profileSkillsInput: "skills", profileLanguagesInput: "languages", profileCertificatesInput: "certificates",
  profileAwardsInput: "awards", profilePublicationsInput: "publications", profilePatentsInput: "patents",
  profileFamilyMembersInput: "familyMembers", profileEmergencyContactsInput: "emergencyContacts",
  profileReferencesInput: "references"
});

const PROFILE_STRUCTURED_EDITORS = Object.freeze({
  education: {
    containerId: "profileEducationRecords", title: "教育经历", primary: "institution",
    fields: [
      ["institution", "学校全称"], ["schoolType", "学校类型"], ["college", "院系/学院"], ["area", "专业名称"],
      ["majorCategory", "专业类别/学科门类"], ["minor", "辅修专业"], ["researchDirection", "研究方向"],
      ["studyType", "学位"], ["degreeType", "学位类型"], ["educationLevel", "学历"],
      ["startDate", "入学时间", "text", "YYYY-MM"], ["endDate", "毕业时间", "text", "YYYY-MM"], ["graduationDate", "毕业日期", "text", "YYYY-MM-DD"],
      ["score", "GPA/平均成绩"], ["scoreScale", "GPA满分"], ["rank", "专业/年级排名"], ["rankTotal", "排名总人数"],
      ["educationType", "受教育类型/学习形式"], ["studentType", "学生类型"], ["admissionBatch", "录取批次"],
      ["overseasStudy", "是否有海外学习经历", "text", "是 / 否"], ["status", "在读/毕业状态"],
      ["country", "国家/地区"], ["city", "学校所在地"], ["courses", "主修课程", "textarea"], ["thesis", "论文题目"],
      ["advisor", "导师"], ["honors", "在校荣誉", "textarea"], ["summary", "教育经历描述", "textarea"]
    ]
  },
  work: {
    containerId: "profileWorkRecords", title: "工作经历", primary: "name",
    fields: experienceEditorFields("工作")
  },
  internships: {
    containerId: "profileInternshipRecords", title: "实习经历", primary: "name",
    fields: experienceEditorFields("实习")
  },
  projects: {
    containerId: "profileProjectRecords", title: "项目经历", primary: "name",
    fields: [
      ["name", "项目名称"], ["type", "项目类型"], ["entity", "所属单位/组织"], ["department", "所属部门"],
      ["role", "项目角色/职务"], ["industry", "项目行业"], ["startDate", "开始时间", "text", "YYYY-MM"], ["endDate", "结束时间", "text", "YYYY-MM"],
      ["current", "是否进行中", "text", "是 / 否"], ["country", "国家/地区"], ["city", "城市"], ["location", "详细地点"],
      ["url", "项目链接", "url"], ["keywords", "项目关键词"], ["technologies", "技术栈/工具"], ["methods", "方法/流程"],
      ["teamSize", "团队规模"], ["customers", "客户/目标用户"], ["background", "项目背景", "textarea"], ["objective", "项目目标", "textarea"],
      ["responsibilities", "个人职责", "textarea"], ["deliverables", "交付物", "textarea"], ["achievements", "项目成果", "textarea"],
      ["metrics", "量化指标", "textarea"], ["challenges", "难点/挑战", "textarea"], ["solution", "解决方案", "textarea"], ["summary", "项目概述", "textarea"]
    ]
  }
});

function experienceEditorFields(kindLabel) {
  const isInternship = kindLabel === "实习";
  return [
    ["name", `${kindLabel}单位/公司全称`], ["department", `${kindLabel}部门`], ["position", `${kindLabel}职位/职务`],
    ["employmentType", `${kindLabel}性质`, "text", isInternship ? "全职实习 / 兼职实习" : "全职 / 兼职 / 合同"],
    ["jobFunction", "岗位职能"], ["industry", "公司行业"], ["companyNature", "公司性质"], ["companySize", "公司规模"],
    ["startDate", "开始时间", "text", "YYYY-MM"], ["endDate", "结束时间", "text", "YYYY-MM"], ["current", `是否仍在${isInternship ? "实习" : "职"}`, "text", "是 / 否"],
    ["country", "国家/地区"], ["city", `${kindLabel}城市`], ["location", "详细地点"], ["teamSize", "团队规模"], ["directReports", "管理/下属人数"],
    ["responsibilities", `${kindLabel}职责/内容`, "textarea"], ["achievements", `${kindLabel}成果/业绩`, "textarea"], ["technologies", "技能/工具/技术栈", "textarea"],
    ["leavingReason", `${isInternship ? "结束" : "离职"}原因`], ["supervisorName", "直属上级/导师"], ["supervisorTitle", "上级职位"],
    ["supervisorPhone", "上级联系电话"], ["salary", `${kindLabel}薪资`], ["salaryPeriod", "薪资周期"], ["summary", `${kindLabel}经历概述`, "textarea"]
  ];
}

const state = {
  config: { ...DEFAULT_CONFIG },
  profile: JobAutofillCore.cloneDefaultProfile(),
  jobs: [],
  logs: [],
  activeTab: null,
  site: null,
  mode: "jobs",
  jobView: "scan",
  analyzing: false,
  applying: false,
  autofillScanning: false,
  autofillFilling: false,
  autofillFields: [],
  autofillPlan: []
};

const ui = {};
let toastTimer = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  collectUI();
  bindEvents();
  const stored = await chrome.storage.local.get([CONFIG_KEY, STATE_KEY, PROFILE_KEY]);
  state.config = { ...DEFAULT_CONFIG, ...(stored[CONFIG_KEY] || {}) };
  state.profile = JobAutofillCore.sanitizeProfile(stored[PROFILE_KEY]);
  state.jobs = Array.isArray(stored[STATE_KEY]?.jobs) ? stored[STATE_KEY].jobs : [];
  state.logs = Array.isArray(stored[STATE_KEY]?.logs) ? stored[STATE_KEY].logs : [];
  hydrateSettings();
  hydrateProfileForm();
  renderAll();
  await detectActiveSite();
}

function collectUI() {
  document.querySelectorAll("[id]").forEach((node) => { ui[node.id] = node; });
  ui.steps = [...document.querySelectorAll(".step")];
  ui.modeTabs = [...document.querySelectorAll(".mode-tab")];
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
  ui.qwenKeyFileInput.addEventListener("change", importQwenKeyFile);
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
  ui.modeTabs.forEach((button) => button.addEventListener("click", () => switchMode(button.dataset.mode)));
  ui.steps.forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  ui.scanList.addEventListener("click", handleJobListClick);
  ui.reviewList.addEventListener("click", handleJobListClick);
  ui.reviewList.addEventListener("change", handleReviewChange);
  ui.editProfileButton.addEventListener("click", openProfileDialog);
  ui.scanFormButton.addEventListener("click", scanApplicationForm);
  ui.selectReadyFieldsButton.addEventListener("click", selectReadyAutofillFields);
  ui.clearFieldSelectionButton.addEventListener("click", clearAutofillSelection);
  ui.autofillPlanList.addEventListener("change", handleAutofillPlanChange);
  ui.autofillPlanList.addEventListener("click", handleAutofillPlanClick);
  ui.fillSelectedFieldsButton.addEventListener("click", fillSelectedAutofillFields);
  ui.closeProfileButton.addEventListener("click", () => ui.profileDialog.close());
  ui.profileForm.addEventListener("submit", saveProfile);
  ui.extractProfileButton.addEventListener("click", extractProfileFromResume);
  ui.exportProfileButton.addEventListener("click", exportProfile);
  ui.profileFileInput.addEventListener("change", importProfile);
  ui.profileResumeFileInput.addEventListener("change", importResumeFilesToProfile);
  ui.profileDialog.addEventListener("click", handleProfileRecordEditorClick);
  ui.profileDialog.addEventListener("input", handleProfileRecordEditorInput);
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
  if (state.mode === "autofill") {
    const supported = isAutofillPage(tab?.url || "");
    const granted = supported ? await hasAutofillPermission(tab.url) : false;
    ui.siteBanner.classList.toggle("is-ready", supported);
    ui.siteBanner.classList.toggle("is-error", !supported);
    ui.siteName.textContent = supported ? `${safeHostname(tab.url)} · 可扫描网申` : "当前页面无法使用网申填充";
    ui.siteHint.textContent = supported
      ? granted ? "已获得当前网站权限，可扫描可见表单字段" : "扫描时只申请当前网站权限，不会持续读取其他网站"
      : "请打开以 http:// 或 https:// 开头的企业网申页面";
    ui.scanFormButton.disabled = !supported || state.autofillScanning || state.autofillFilling;
    return;
  }

  ui.siteBanner.classList.toggle("is-ready", Boolean(site));
  ui.siteBanner.classList.toggle("is-error", !site);
  ui.siteName.textContent = site ? `${site} 已连接` : "当前页面暂不支持岗位扫描";
  ui.siteHint.textContent = site
    ? "请停留在岗位列表页，侧边栏会读取当前可见岗位"
    : "岗位扫描支持 BOSS 直聘、猎聘和智联招聘；其他网站可切换到网申填充";
  ui.scanButton.disabled = !site || state.analyzing || state.applying;
}

function isAutofillPage(urlValue) {
  try {
    return ["http:", "https:"].includes(new URL(urlValue).protocol);
  } catch (_) {
    return false;
  }
}

function safeHostname(urlValue) {
  try {
    return new URL(urlValue).hostname || "当前网站";
  } catch (_) {
    return "当前网站";
  }
}

function permissionPattern(urlValue) {
  const url = new URL(urlValue);
  return `${url.protocol}//${url.host}/*`;
}

async function hasAutofillPermission(urlValue) {
  try {
    return await chrome.permissions.contains({ origins: [permissionPattern(urlValue)] });
  } catch (_) {
    return false;
  }
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

async function scanApplicationForm() {
  if (!state.activeTab?.id || !isAutofillPage(state.activeTab.url || "")) {
    showToast("请先打开企业网申表单页面");
    return;
  }
  state.autofillScanning = true;
  setButtonBusy(ui.scanFormButton, true, "正在扫描…");
  try {
    const origin = permissionPattern(state.activeTab.url);
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) throw new Error("未获得当前网站权限，无法读取表单");
    await injectAutofillAgent(state.activeTab.id);
    setButtonBusy(ui.scanFormButton, true, "正在展开经历…");
    const desiredCounts = {
      education: state.profile.education.length,
      work: state.profile.work.length,
      internships: state.profile.internships.length || (state.profile.automationPolicy.allowWorkAsInternship ? state.profile.work.length : 0),
      projects: state.profile.projects.length
    };
    try {
      const prepareResponse = await chrome.tabs.sendMessage(state.activeTab.id, { type: "AUTOFILL_PREPARE_REPEAT_SECTIONS", desiredCounts });
      if (prepareResponse?.ok) {
        const added = Object.entries(prepareResponse.result?.added || {}).filter(([, count]) => count > 0);
        if (added.length) appendLog("info", "已按资料库展开重复经历栏目", added.map(([kind, count]) => `${repeatCollectionLabel(kind)} +${count}`).join("，"));
        const warnings = prepareResponse.result?.warnings || [];
        if (warnings.length) appendLog("warning", "部分重复栏目需要手动展开", warnings.join("；"));
      }
    } catch (error) {
      appendLog("warning", "自动展开经历栏目未完成", `${cleanError(error)}；继续扫描当前已有字段`);
    }
    setButtonBusy(ui.scanFormButton, true, "正在扫描…");
    const response = await chrome.tabs.sendMessage(state.activeTab.id, { type: "AUTOFILL_SCAN_FORM" });
    if (!response?.ok) throw new Error(response?.error || "页面没有返回表单字段");
    state.autofillFields = Array.isArray(response.fields) ? response.fields : [];
    state.autofillPlan = JobAutofillCore.buildFillPlan(state.profile, state.autofillFields);
    if (state.autofillFields.length && state.profile.automationPolicy.useAIReasoning && state.config.apiKey) {
      setButtonBusy(ui.scanFormButton, true, "千问正在复核…");
      try {
        const aiResponse = await chrome.runtime.sendMessage({
          type: "AI_REASON_AUTOFILL",
          payload: { profile: state.profile, fields: state.autofillFields, plan: state.autofillPlan, config: state.config }
        });
        if (!aiResponse?.ok) throw new Error(aiResponse?.error || "千问没有返回映射结果");
        state.autofillPlan = JobAutofillCore.applyAIPlanDecisions(
          state.profile, state.autofillPlan, state.autofillFields, aiResponse.result?.decisions
        );
        const aiMapped = state.autofillPlan.filter((item) => item.aiSuggested).length;
        appendLog("info", `千问复核了 ${aiMapped} 个字段映射`, aiResponse.result?.summary || "只采用能追溯到本机资料路径的建议");
      } catch (error) {
        appendLog("warning", "千问语义复核未完成", `${cleanError(error)}；已保留本地规则结果`);
      }
    }
    renderAutofill();
    appendLog("info", `识别到 ${state.autofillFields.length} 个网申字段`, safeHostname(response.pageUrl || state.activeTab.url));
    if (!state.autofillFields.length) {
      showToast("当前可见区域没有识别到可填写字段；请展开表单后重试");
    } else {
      const ready = state.autofillPlan.filter((item) => item.status === "ready").length;
      showToast(`已识别 ${state.autofillFields.length} 个字段，其中 ${ready} 个可直接填`);
    }
    await detectActiveSite();
  } catch (error) {
    appendLog("error", "网申表单扫描失败", cleanError(error));
    showToast(autofillErrorMessage(error));
  } finally {
    state.autofillScanning = false;
    setButtonBusy(ui.scanFormButton, false, "扫描当前表单");
    ui.scanFormButton.disabled = !isAutofillPage(state.activeTab?.url || "");
  }
}

function repeatCollectionLabel(kind) {
  return ({ education: "教育", work: "工作", internships: "实习", projects: "项目" })[kind] || kind;
}

async function injectAutofillAgent(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["autofill-content.js"]
  });
}

function autofillErrorMessage(error) {
  const message = cleanError(error);
  if (/Cannot access|chrome:\/\/|edge:\/\/|extensions gallery|商店|权限/i.test(message)) {
    return "该页面受浏览器保护，扩展无法读取。请在普通企业网申网页中使用。";
  }
  if (/Receiving end does not exist/i.test(message)) return "注入表单助手失败，请刷新网页并重试";
  return message;
}

function renderAutofill() {
  const completeness = JobAutofillCore.profileCompleteness(state.profile);
  ui.profileProgress.textContent = `${completeness.percent}%`;
  ui.profileProgress.style.setProperty("--profile-angle", `${completeness.percent * 3.6}deg`);
  ui.profileStatusTitle.textContent = completeness.completed
    ? `资料完整度 ${completeness.completed}/${completeness.total}`
    : "尚未配置结构化资料";
  ui.profileStatusHint.textContent = completeness.completed
    ? "数据只保存在扩展本机存储；扫描网页时仅发送当前选中的字段值。"
    : "先维护一次资料库，以后不同网申网站都能复用。";

  const plan = state.autofillPlan;
  ui.formFieldTotal.textContent = String(plan.length);
  ui.formReadyTotal.textContent = String(plan.filter((item) => item.status === "ready").length);
  ui.formReviewTotal.textContent = String(plan.filter((item) => item.status === "review").length);
  ui.autofillEmpty.hidden = plan.length > 0;
  ui.autofillPlanList.hidden = plan.length === 0;
  ui.autofillDock.hidden = plan.length === 0;
  ui.autofillPlanList.replaceChildren();

  plan.forEach((item) => {
    const card = element("article", `autofill-item status-${item.status}${item.selected ? " is-selected" : ""}`);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.selected);
    checkbox.disabled = !["ready", "review"].includes(item.status) || state.autofillFilling;
    checkbox.dataset.fieldId = item.fieldId;
    checkbox.setAttribute("aria-label", `选择填写 ${item.label}`);

    const body = element("div", "autofill-item-body");
    const top = element("div", "autofill-item-top");
    const labels = element("div", "autofill-labels");
    labels.append(element("strong", "", item.label));
    if (item.canonicalLabel) labels.append(element("span", "", `→ ${item.canonicalLabel}`));
    top.append(labels, autofillStatusBadge(item));
    body.append(top);

    if (item.value) body.append(element("p", "autofill-value", maskAutofillValue(item)));
    body.append(element("p", "autofill-reason", item.reason));
    const actions = element("div", "autofill-item-actions");
    actions.append(
      element("span", "confidence-text", item.confidence ? `置信度 ${Math.round(item.confidence * 100)}%` : statusLabelForField(item.status)),
      locateFieldButton(item)
    );
    body.append(actions);
    card.append(checkbox, body);
    ui.autofillPlanList.append(card);
  });

  const selected = plan.filter((item) => item.selected && ["ready", "review"].includes(item.status)).length;
  ui.selectedFieldCount.textContent = String(selected);
  ui.fillSelectedFieldsButton.disabled = selected === 0 || state.autofillFilling;
}

function autofillStatusBadge(item) {
  const labels = {
    ready: "可直接填",
    review: item.sensitive ? "敏感·待确认" : item.crossCategory ? "跨栏目·待确认" : "待确认",
    existing: "已有内容",
    missing: "资料缺失",
    unmapped: "未可靠识别",
    unsupported: "需手动",
    filled: "已填写",
    failed: "填写失败",
    skipped: "已跳过"
  };
  return element("span", `field-status ${item.status}${item.sensitive ? " sensitive" : ""}`, labels[item.status] || item.status);
}

function statusLabelForField(status) {
  const labels = { existing: "保护已有内容", missing: "资料库缺值", unmapped: "不自动猜测", unsupported: "浏览器限制", filled: "填写完成", failed: "请手动处理", skipped: "未覆盖" };
  return labels[status] || "";
}

function maskAutofillValue(item) {
  const value = String(item.value || "");
  if (!value) return "";
  if (item.sensitive || /phone|email|idNumber|birthDate/i.test(item.canonicalKey)) {
    if (value.includes("@")) {
      const [name, domain] = value.split("@");
      return `${name.slice(0, 2)}***@${domain || ""}`;
    }
    return value.length <= 4 ? "••••" : `••••••${value.slice(-4)}`;
  }
  return value.length > 110 ? `${value.slice(0, 110)}…` : value;
}

function locateFieldButton(item) {
  const button = element("button", "open-link", "在页面定位");
  button.type = "button";
  button.dataset.action = "locate-field";
  button.dataset.fieldId = item.fieldId;
  return button;
}

function handleAutofillPlanChange(event) {
  if (!event.target.matches("input[type='checkbox'][data-field-id]")) return;
  const item = state.autofillPlan.find((entry) => entry.fieldId === event.target.dataset.fieldId);
  if (!item || !["ready", "review"].includes(item.status)) return;
  item.selected = event.target.checked;
  renderAutofill();
}

async function handleAutofillPlanClick(event) {
  const button = event.target.closest("[data-action='locate-field']");
  if (!button || !state.activeTab?.id) return;
  try {
    const response = await chrome.tabs.sendMessage(state.activeTab.id, {
      type: "AUTOFILL_FOCUS_FIELD",
      fieldId: button.dataset.fieldId
    });
    if (!response?.ok) throw new Error(response?.error || "字段定位失败");
  } catch (error) {
    showToast(cleanError(error));
  }
}

function selectReadyAutofillFields() {
  state.autofillPlan.forEach((item) => { item.selected = item.status === "ready"; });
  renderAutofill();
}

function clearAutofillSelection() {
  state.autofillPlan.forEach((item) => { item.selected = false; });
  renderAutofill();
}

async function fillSelectedAutofillFields() {
  if (state.autofillFilling || !state.activeTab?.id) return;
  const selected = state.autofillPlan.filter((item) => item.selected && ["ready", "review"].includes(item.status));
  if (!selected.length) return;
  const sensitiveCount = selected.filter((item) => item.sensitive).length;
  if (sensitiveCount && !confirm(`所选内容包含 ${sensitiveCount} 个敏感字段。确认仅在当前网申页面填写这些值吗？扩展不会提交表单。`)) return;

  state.autofillFilling = true;
  setButtonBusy(ui.fillSelectedFieldsButton, true, "正在填写…");
  renderAutofill();
  try {
    if (!await hasAutofillPermission(state.activeTab.url)) throw new Error("当前网站权限已失效，请重新扫描表单");
    await injectAutofillAgent(state.activeTab.id);
    const response = await chrome.tabs.sendMessage(state.activeTab.id, {
      type: "AUTOFILL_APPLY_PLAN",
      entries: selected.map((item) => ({ fieldId: item.fieldId, value: item.value }))
    });
    if (!response?.ok) throw new Error(response?.error || "网页填写失败");
    const results = response.result?.results || [];
    results.forEach((result) => {
      const item = state.autofillPlan.find((entry) => entry.fieldId === result.fieldId);
      if (!item) return;
      item.status = result.status;
      item.reason = result.message || item.reason;
      item.selected = false;
    });
    const filled = Number(response.result?.filled || 0);
    const failed = Number(response.result?.failed || 0);
    appendLog(failed ? "warning" : "success", `网申字段已填写 ${filled} 项`, failed ? `${failed} 项未成功，请在页面手动核对` : "未提交表单，请逐项核对后手动提交");
    showToast(`已填写 ${filled} 项${failed ? `，${failed} 项需手动处理` : "，请在页面核对"}`);
  } catch (error) {
    appendLog("error", "网申字段填写失败", cleanError(error));
    showToast(autofillErrorMessage(error));
  } finally {
    state.autofillFilling = false;
    setButtonBusy(ui.fillSelectedFieldsButton, false, "填写所选字段");
    renderAutofill();
  }
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
  renderAutofill();
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
  if (state.mode !== "jobs") switchMode("jobs");
  state.jobView = name;
  Object.entries(ui.views).forEach(([key, view]) => view.classList.toggle("is-active", key === name));
  ui.steps.forEach((button) => button.classList.toggle("is-active", button.dataset.view === name));
}

function switchMode(mode) {
  if (!["jobs", "autofill"].includes(mode)) return;
  state.mode = mode;
  ui.modeTabs.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === mode));
  ui.jobSteps.hidden = mode !== "jobs";
  Object.entries(ui.views).forEach(([key, view]) => view.classList.toggle("is-active", mode === "jobs" && key === state.jobView));
  ui.autofillView.classList.toggle("is-active", mode === "autofill");
  detectActiveSite();
}

function openProfileDialog() {
  hydrateProfileForm();
  ui.profileMessage.textContent = "";
  ui.profileMessage.title = "";
  ui.profileDialog.showModal();
}

function hydrateProfileForm() {
  const profile = JobAutofillCore.sanitizeProfile(state.profile);
  Object.entries(PROFILE_SCALAR_FIELDS).forEach(([id, path]) => { ui[id].value = JobAutofillCore.getPathValue(profile, path) || ""; });
  Object.entries(PROFILE_RECORD_FIELDS).forEach(([id, kind]) => { ui[id].value = JobAutofillCore.serializeRecordLines(profile[kind], kind); });
  renderStructuredProfileEditors(profile);
  ui.profileAllowWorkAsInternshipInput.checked = profile.automationPolicy.allowWorkAsInternship;
  ui.profileUseAIReasoningInput.checked = profile.automationPolicy.useAIReasoning;
}

function collectProfileForm(options = {}) {
  const draft = JobAutofillCore.cloneDefaultProfile();
  Object.entries(PROFILE_SCALAR_FIELDS).forEach(([id, path]) => setObjectPath(draft, path, ui[id].value));
  Object.entries(PROFILE_RECORD_FIELDS).forEach(([id, kind]) => { draft[kind] = JobAutofillCore.parseRecordLines(ui[id].value, kind); });
  for (const [kind, editor] of Object.entries(PROFILE_STRUCTURED_EDITORS)) {
    const container = ui[editor.containerId];
    const cards = [...container.querySelectorAll(`[data-record-card="${kind}"]`)];
    draft[kind] = cards.map((card) => {
      const record = {};
      card.querySelectorAll("[data-record-key]").forEach((control) => { record[control.dataset.recordKey] = control.value.trim(); });
      if (kind === "work") record.experienceType = "工作";
      if (kind === "internships") record.experienceType = "实习";
      return record;
    });
  }
  draft.automationPolicy.allowWorkAsInternship = ui.profileAllowWorkAsInternshipInput.checked;
  draft.automationPolicy.useAIReasoning = ui.profileUseAIReasoningInput.checked;
  return options.preserveEmptyRecords ? draft : JobAutofillCore.sanitizeProfile(draft);
}

function renderStructuredProfileEditors(profileInput) {
  const profile = profileInput && typeof profileInput === "object" ? profileInput : JobAutofillCore.cloneDefaultProfile();
  for (const [kind, editor] of Object.entries(PROFILE_STRUCTURED_EDITORS)) {
    const container = ui[editor.containerId];
    container.replaceChildren();
    const records = profile[kind] || [];
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "record-empty";
      empty.textContent = `暂无${editor.title}。可点击上方按钮逐条添加，或上传简历自动拆分。`;
      container.append(empty);
      continue;
    }
    records.forEach((record, index) => container.append(createProfileRecordCard(kind, record, index)));
  }
}

function createProfileRecordCard(kind, record, index) {
  const editor = PROFILE_STRUCTURED_EDITORS[kind];
  const details = document.createElement("details");
  details.className = "profile-record-card";
  details.dataset.recordCard = kind;
  details.dataset.recordIndex = String(index);
  details.open = index === 0;

  const summary = document.createElement("summary");
  const title = document.createElement("span");
  title.className = "record-card-title";
  title.textContent = profileRecordTitle(editor, record, index);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "record-remove-button";
  remove.dataset.removeRecord = kind;
  remove.dataset.recordIndex = String(index);
  remove.textContent = "删除";
  remove.setAttribute("aria-label", `删除第 ${index + 1} 条${editor.title}`);
  summary.append(title, remove);
  details.append(summary);

  const grid = document.createElement("div");
  grid.className = "record-field-grid";
  for (const [key, labelText, controlType = "text", placeholder = ""] of editor.fields) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const control = controlType === "textarea" ? document.createElement("textarea") : document.createElement("input");
    if (control instanceof HTMLInputElement) control.type = controlType;
    else control.rows = 3;
    control.value = String(record?.[key] || "");
    control.placeholder = placeholder;
    control.autocomplete = "off";
    control.dataset.recordKind = kind;
    control.dataset.recordIndex = String(index);
    control.dataset.recordKey = key;
    if (controlType === "textarea") label.classList.add("record-wide-field");
    label.append(control);
    grid.append(label);
  }
  details.append(grid);
  return details;
}

function profileRecordTitle(editor, record, index) {
  const primary = String(record?.[editor.primary] || "").trim();
  const secondary = String(record?.position || record?.role || record?.area || record?.studyType || "").trim();
  const dates = [record?.startDate, record?.endDate].map((value) => String(value || "").trim()).filter(Boolean).join(" — ");
  return [`${editor.title} ${index + 1}`, primary, secondary, dates].filter(Boolean).join(" · ");
}

function handleProfileRecordEditorClick(event) {
  const addButton = event.target.closest("[data-add-record]");
  if (addButton) {
    const kind = addButton.dataset.addRecord;
    if (!PROFILE_STRUCTURED_EDITORS[kind]) return;
    const profile = collectProfileForm({ preserveEmptyRecords: true });
    profile[kind].push(kind === "work" ? { experienceType: "工作" } : kind === "internships" ? { experienceType: "实习" } : {});
    renderStructuredProfileEditors(profile);
    const cards = ui[PROFILE_STRUCTURED_EDITORS[kind].containerId].querySelectorAll(`[data-record-card="${kind}"]`);
    const latest = cards[cards.length - 1];
    if (latest) {
      latest.open = true;
      latest.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    return;
  }
  const removeButton = event.target.closest("[data-remove-record]");
  if (!removeButton) return;
  event.preventDefault();
  event.stopPropagation();
  const kind = removeButton.dataset.removeRecord;
  const index = Number(removeButton.dataset.recordIndex);
  if (!PROFILE_STRUCTURED_EDITORS[kind] || !Number.isInteger(index)) return;
  const profile = collectProfileForm({ preserveEmptyRecords: true });
  profile[kind].splice(index, 1);
  renderStructuredProfileEditors(profile);
}

function handleProfileRecordEditorInput(event) {
  const control = event.target.closest("[data-record-key]");
  if (!control) return;
  const card = control.closest("[data-record-card]");
  const kind = card?.dataset.recordCard;
  const editor = PROFILE_STRUCTURED_EDITORS[kind];
  if (!card || !editor) return;
  const record = {};
  card.querySelectorAll("[data-record-key]").forEach((field) => { record[field.dataset.recordKey] = field.value; });
  const index = Number(card.dataset.recordIndex) || 0;
  const title = card.querySelector(".record-card-title");
  if (title) title.textContent = profileRecordTitle(editor, record, index);
}

function setObjectPath(object, path, value) {
  const keys = path.split(".");
  let cursor = object;
  while (keys.length > 1) cursor = cursor[keys.shift()];
  cursor[keys[0]] = value;
}

async function saveProfile(event) {
  event.preventDefault();
  try {
    state.profile = collectProfileForm();
    await chrome.storage.local.set({ [PROFILE_KEY]: state.profile });
    if (state.autofillFields.length) state.autofillPlan = JobAutofillCore.buildFillPlan(state.profile, state.autofillFields);
    ui.profileMessage.textContent = "已保存到本机";
    renderAutofill();
    setTimeout(() => ui.profileDialog.close(), 350);
  } catch (error) {
    ui.profileMessage.textContent = cleanError(error);
  }
}

function extractProfileFromResume() {
  const current = collectProfileForm();
  const resumeText = ui.resumeTextInput.value.trim() || state.config.resumeText;
  if (!resumeText) {
    ui.profileMessage.textContent = "你点的是基础文本提取；要识别 PDF/DOCX 并拆分经历，请点击上方紫色上传按钮";
    return;
  }
  const result = JobAutofillCore.extractProfileDraftFromResume(resumeText, current);
  state.profile = result.profile;
  hydrateProfileForm();
  ui.profileMessage.textContent = result.suggestions.length
    ? `已提取 ${result.suggestions.length} 个可校验字段，请核对后保存`
    : "没有发现新的高可靠字段；未做猜测"
}

function exportProfile() {
  const profile = collectProfileForm();
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `job-application-profile-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ui.profileMessage.textContent = "资料已导出；文件含个人信息，请妥善保管";
}

async function importProfile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("资料 JSON 不能超过 1MB");
    const parsed = JSON.parse(await file.text());
    state.profile = JobAutofillCore.sanitizeProfile(parsed);
    hydrateProfileForm();
    ui.profileMessage.textContent = "已导入，请核对后点击保存";
  } catch (error) {
    ui.profileMessage.textContent = `导入失败：${cleanError(error)}`;
  } finally {
    event.target.value = "";
  }
}

async function importResumeFilesToProfile(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  const aiConfig = {
    ...state.config,
    provider: ui.providerInput.value || state.config.provider,
    apiBaseUrl: ui.apiBaseUrlInput.value.trim() || state.config.apiBaseUrl,
    model: ui.modelInput.value.trim() || state.config.model,
    apiKey: ui.apiKeyInput.value.trim() || state.config.apiKey,
    enableThinking: ui.enableThinkingInput.checked
  };
  try {
    if (!aiConfig.apiKey) {
      ui.profileDialog.close();
      ui.settingsDialog.showModal();
      throw new Error("请先导入千问 API Key 并保存配置，再上传简历");
    }
    ui.profileResumeFileInput.disabled = true;
    ui.profileMessage.textContent = `正在本地解析 ${files.length} 份简历…`;
    const extracted = await JobResumeParser.extractResumeFiles(files, (progress) => {
      if (progress.phase === "extracting") ui.profileMessage.textContent = `正在本地解析 ${progress.index + 1}/${progress.total}：${progress.fileName}`;
    });
    ui.profileMessage.textContent = "文字已在本地提取，千问正在整理并核验证据…";
    const response = await chrome.runtime.sendMessage({
      type: "AI_PARSE_RESUME_PROFILE",
      payload: { resumeText: extracted.text, existingProfile: collectProfileForm(), config: aiConfig }
    });
    if (!response?.ok) throw new Error(response?.error || "千问简历解析失败");
    state.profile = JobAutofillCore.mergeProfilePatch(collectProfileForm(), response.result?.profilePatch, { overwrite: false });
    state.config.resumeText = extracted.text.slice(0, 120000);
    ui.resumeTextInput.value = state.config.resumeText;
    updateResumeCount();
    await chrome.storage.local.set({ [CONFIG_KEY]: state.config });
    hydrateProfileForm();
    const parsedCount = extracted.reports.filter((item) => item.ok).length;
    const evidenceCount = response.result?.evidence?.length || 0;
    const warnings = [...extracted.warnings, ...(response.result?.warnings || [])];
    const warningCount = warnings.length;
    ui.profileMessage.textContent = `已解析 ${parsedCount}/${files.length} 份简历、生成 ${evidenceCount} 条证据${warningCount ? `，${warningCount} 条冲突/提示待核对` : ""}；请核对后保存`;
    ui.profileMessage.title = warnings.join("\n");
  } catch (error) {
    ui.profileMessage.textContent = cleanError(error);
    showToast(cleanError(error));
  } finally {
    ui.profileResumeFileInput.disabled = false;
    event.target.value = "";
  }
}

function splitProfileList(value) {
  return String(value || "").split(/[,，;；\n]/).map((item) => item.trim()).filter(Boolean);
}

async function importQwenKeyFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 64 * 1024) throw new Error("Key 文件不能超过 64KB");
    const text = (await file.text()).trim();
    const key = text.match(/sk-[A-Za-z0-9._-]{16,}/)?.[0] || (/^[A-Za-z0-9._-]{20,}$/.test(text) ? text : "");
    if (!key) throw new Error("文件中没有识别到有效的 API Key");
    ui.providerInput.value = "qwen";
    applyProviderDefaults();
    ui.apiKeyInput.value = key;
    ui.qwenKeyStatus.textContent = "已读取，点击“保存配置”后生效";
    ui.settingsMessage.textContent = "Key 已从本地文件读取，尚未保存";
  } catch (error) {
    ui.qwenKeyStatus.textContent = cleanError(error);
  } finally {
    event.target.value = "";
  }
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
  ui.enableThinkingInput.checked = state.config.enableThinking !== false;
  ui.qwenKeyStatus.textContent = state.config.apiKey ? "已配置（不会显示或写入日志）" : "尚未配置";
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
    enableThinking: ui.enableThinkingInput.checked,
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
    ui.qwenKeyStatus.textContent = state.config.apiKey ? "已配置（不会显示或写入日志）" : "尚未配置";
    renderAll();
    setTimeout(() => ui.settingsDialog.close(), 350);
  } catch (error) {
    ui.settingsMessage.textContent = cleanError(error);
  }
}

function applyProviderDefaults() {
  const presets = {
    qwen: { apiBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
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
  const allowed = ["api.deepseek.com", "api.openai.com", "dashscope.aliyuncs.com", "dashscope-intl.aliyuncs.com", "127.0.0.1", "localhost"];
  if (!allowed.includes(url.hostname) && !url.hostname.endsWith(".maas.aliyuncs.com")) throw new Error("接口仅支持千问百炼、DeepSeek、OpenAI 或本机服务");
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
  return String(error?.message || error || "未知错误").replace(/\bsk-[A-Za-z0-9._-]+/g, "[已隐藏密钥]").slice(0, 300);
}

function showToast(message) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => ui.toast.classList.remove("is-visible"), 3200);
}
