const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const vm = require("node:vm");
const autofillCore = require(path.resolve(__dirname, "..", "autofill-core.js"));

const root = path.resolve(__dirname, "..");

test("manifest is a scoped Edge Manifest V3 side-panel extension", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel.default_path, "sidepanel.html");
  assert.ok(manifest.permissions.includes("sidePanel"));
  assert.ok(manifest.permissions.includes("storage"));
  assert.ok(manifest.permissions.includes("scripting"));
  assert.ok(!manifest.host_permissions.includes("<all_urls>"));
  assert.ok(manifest.optional_host_permissions.includes("https://*/*"));
  assert.ok(manifest.host_permissions.includes("https://dashscope.aliyuncs.com/*"));
  assert.ok(manifest.content_scripts[0].matches.every((match) => /zhipin|liepin|zhaopin/.test(match)));
});

test("all extension JavaScript parses", () => {
  for (const file of ["service-worker.js", "content-script.js", "autofill-core.js", "autofill-content.js", "resume-file-parser.js", "sidepanel.js"]) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test("site content is rendered without unsafe HTML injection", () => {
  const panelHtml = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const panelScript = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.doesNotMatch(panelScript, /\.innerHTML\s*=/);
  assert.doesNotMatch(panelScript, /\beval\s*\(/);
  assert.match(panelScript, /textContent\s*=/);

  const htmlIds = [...panelHtml.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(htmlIds).size, htmlIds.length, "sidepanel.html contains duplicate ids");
  const collectedIds = panelScript.match(/const ids = \[([\s\S]*?)\];/)?.[1].match(/"([^"]+)"/g)?.map((value) => value.slice(1, -1)) || [];
  for (const id of collectedIds) assert.ok(htmlIds.includes(id), `missing sidepanel element #${id}`);
});

test("real submission requires explicit confirmation and has a verification stop", () => {
  const panelHtml = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
  const panelScript = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const contentScript = fs.readFileSync(path.join(root, "content-script.js"), "utf8");
  assert.match(panelHtml, /我已核对岗位，并授权本批次实际投递/);
  assert.match(panelScript, /confirmCheck\.checked/);
  assert.match(contentScript, /安全验证/);
  assert.match(contentScript, /hasVerificationChallenge/);
});

test("API endpoint allowlist blocks arbitrary remote hosts", () => {
  const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  assert.match(worker, /api\.deepseek\.com/);
  assert.match(worker, /api\.openai\.com/);
  assert.match(worker, /dashscope\.aliyuncs\.com/);
  assert.match(worker, /enable_thinking/);
  assert.match(worker, /allowedHosts/);
  assert.match(worker, /远程模型接口必须使用 HTTPS/);
});

test("salary and hard-filter rules behave as expected", () => {
  const panelScript = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  const context = vm.createContext({
    document: { addEventListener() {} },
    URL,
    Intl,
    setTimeout,
    clearTimeout,
    console,
    JobAutofillCore: autofillCore
  });
  vm.runInContext(panelScript, context);
  const salary = vm.runInContext("parseSalary('15-25K·14薪')", context);
  assert.equal(salary.min, 15);
  assert.equal(salary.max, 25);

  const result = vm.runInContext(`prefilterJob(
    {title:'AI产品经理', company:'示例科技', location:'上海', salary:'20-30K', description:'大模型产品规划', rawText:'大模型产品规划'},
    {...DEFAULT_CONFIG, keywords:'AI产品经理', cities:'上海', salaryMin:18, jobBlacklist:'销售'}
  )`, context);
  assert.equal(result.passed, true);

  const blocked = vm.runInContext(`prefilterJob(
    {title:'保险销售', company:'示例科技', location:'上海', salary:'20-30K', description:'销售', rawText:'销售'},
    {...DEFAULT_CONFIG, keywords:'销售', cities:'上海', jobBlacklist:'销售'}
  )`, context);
  assert.equal(blocked.passed, false);
  assert.match(blocked.reasons.join(" "), /岗位黑名单/);
});

test("autofill maps representative Chinese application fields conservatively", () => {
  const profile = autofillCore.sanitizeProfile({
    basics: {
      name: "测试用户",
      namePinyin: "CESHI YONGHU",
      phone: "13800138000",
      currentCity: "上海",
      nativePlace: "江苏",
      expectedRole: "AI产品经理"
    },
    private: {
      idType: "居民身份证",
      idNumber: "310000000000000000",
      hukouLocation: "江苏南京"
    },
    education: [
      { institution: "示例大学", area: "人工智能", studyType: "硕士" },
      { institution: "第二大学", area: "环境工程", studyType: "本科" }
    ],
    narratives: { selfEvaluation: "善于把复杂技术转化为可落地产品方案。" }
  });
  const base = { tag: "input", type: "text", placeholder: "", name: "", id: "", ariaLabel: "", autocomplete: "", section: "个人信息", currentValue: "", required: true, options: [] };
  const fields = [
    { ...base, fieldId: "name", label: "姓名" },
    { ...base, fieldId: "pinyin", label: "姓名全拼" },
    { ...base, fieldId: "city", label: "现居住城市" },
    { ...base, fieldId: "hukou", label: "入学前户口所在地" },
    { ...base, fieldId: "id", label: "证件号码" },
    { ...base, fieldId: "school-1", label: "学校名称", section: "教育经历" },
    { ...base, fieldId: "major-1", label: "专业名称", section: "教育经历" },
    { ...base, fieldId: "school-2", label: "学校名称", section: "教育经历" },
    { ...base, fieldId: "major-2", label: "专业名称", section: "教育经历" },
    { ...base, fieldId: "self", label: "自我评价", tag: "textarea", type: "textarea", section: "自我评价" },
    { ...base, fieldId: "existing", label: "手机号", type: "tel", currentValue: "13900000000" },
    { ...base, fieldId: "unknown", label: "是否接受人才库长期保留" }
  ];
  const plan = autofillCore.buildFillPlan(profile, fields);
  const byId = Object.fromEntries(plan.map((item) => [item.fieldId, item]));

  assert.equal(byId.name.canonicalKey, "basics.name");
  assert.equal(byId.name.status, "ready");
  assert.equal(byId.pinyin.canonicalKey, "basics.namePinyin");
  assert.equal(byId.city.value, "上海");
  assert.equal(byId.hukou.canonicalKey, "private.hukouLocation");
  assert.equal(byId.hukou.status, "review");
  assert.equal(byId.id.sensitive, true);
  assert.equal(byId.id.selected, false);
  assert.equal(byId["school-1"].value, "示例大学");
  assert.equal(byId["school-2"].value, "第二大学");
  assert.equal(byId["major-2"].value, "环境工程");
  assert.equal(byId.self.value, "善于把复杂技术转化为可落地产品方案。");
  assert.equal(byId.existing.status, "existing");
  assert.equal(byId.unknown.status, "unmapped");
});

test("resume extraction only suggests verifiable fields and never infers sensitive data", () => {
  const result = autofillCore.extractProfileDraftFromResume(`
姓名：测试用户
手机：13800138000
邮箱：test@example.com
现居城市：上海
期望职位：AI产品经理
个人网站：https://example.com
已婚，群众，身体健康
  `, {});
  assert.equal(result.profile.basics.name, "测试用户");
  assert.equal(result.profile.basics.phone, "13800138000");
  assert.equal(result.profile.basics.email, "test@example.com");
  assert.equal(result.profile.jobPreferences.expectedRole, "AI产品经理");
  assert.equal(result.profile.private.maritalStatus, "");
  assert.equal(result.profile.private.politicalStatus, "");
  assert.equal(result.profile.private.healthStatus, "");
});

test("profile v3 migrates legacy data, splits internships, and covers enterprise sections", () => {
  const profile = autofillCore.sanitizeProfile({
    schemaVersion: 2,
    basics: { name: "测试用户", expectedRole: "AI产品经理", expectedCity: "上海" },
    skills: ["SQL", "Python"],
    languages: ["英语 CET-6"],
    work: [
      { experienceType: "工作", name: "示例公司", position: "产品经理" },
      { experienceType: "实习", name: "示例实习公司", position: "产品实习生" }
    ]
  });
  assert.equal(profile.schemaVersion, 3);
  assert.equal(profile.jobPreferences.expectedRole, "AI产品经理");
  assert.equal(profile.jobPreferences.expectedCities, "上海");
  assert.equal(profile.skills[0].name, "SQL");
  assert.equal(profile.work.length, 1);
  assert.equal(profile.internships.length, 1);
  assert.equal(profile.internships[0].name, "示例实习公司");
  for (const key of ["eligibility", "research", "campus", "volunteer", "publications", "patents", "familyMembers", "emergencyContacts", "references"]) {
    assert.ok(Object.hasOwn(profile, key), `missing profile section ${key}`);
  }
});

test("project experience maps both aggregate textareas and multiple project cards", () => {
  const profile = autofillCore.sanitizeProfile({
    schemaVersion: 3,
    projects: [
      { name: "职舟 AI 求职智能体", role: "产品负责人", startDate: "2025-01", summary: "构建可靠网申填充流程" },
      { name: "独立站自动运营", role: "项目负责人", startDate: "2024-01", summary: "自动选品与上品" }
    ]
  });
  const base = { tag: "input", type: "text", placeholder: "", name: "", id: "", ariaLabel: "", autocomplete: "", section: "项目经验", currentValue: "", required: true, options: [], repeatKind: "projects" };
  const fields = [
    { ...base, fieldId: "project-name-1", label: "项目名称", repeatIndex: 0 },
    { ...base, fieldId: "project-role-1", label: "项目角色", repeatIndex: 0 },
    { ...base, fieldId: "project-name-2", label: "项目名称", repeatIndex: 1 },
    { ...base, fieldId: "project-role-2", label: "项目角色", repeatIndex: 1 },
    { ...base, fieldId: "project-all", label: "项目经验", tag: "textarea", type: "textarea", repeatKind: "", repeatIndex: undefined }
  ];
  const plan = Object.fromEntries(autofillCore.buildFillPlan(profile, fields).map((item) => [item.fieldId, item]));
  assert.equal(plan["project-name-1"].value, "职舟 AI 求职智能体");
  assert.equal(plan["project-role-2"].value, "项目负责人");
  assert.match(plan["project-all"].value, /职舟 AI 求职智能体/);
  assert.match(plan["project-all"].value, /独立站自动运营/);
});

test("existing school value aligns the whole form card to the matching education record", () => {
  const profile = autofillCore.sanitizeProfile({
    schemaVersion: 3,
    education: [
      { institution: "示例理工大学", educationLevel: "硕士研究生", area: "工程管理", startDate: "2023-09" },
      { institution: "示例财经学院", educationLevel: "大学本科", area: "管理学", startDate: "2019-09", courses: "管理学原理", rank: "前20%", degreeType: "管理学学士", educationType: "全日制", overseasStudy: "否" }
    ]
  });
  const base = { tag: "input", type: "text", placeholder: "", name: "", id: "", ariaLabel: "", autocomplete: "", section: "教育经历", required: true, options: [], repeatKind: "education", repeatIndex: 0 };
  const fields = [
    { ...base, fieldId: "school", label: "学校名称", currentValue: "示例财经学院" },
    { ...base, fieldId: "level", label: "学历", currentValue: "硕士研究生" },
    { ...base, fieldId: "major", label: "专业", currentValue: "" },
    { ...base, fieldId: "start", label: "入学时间", currentValue: "" },
    { ...base, fieldId: "courses", label: "专业课程", currentValue: "" },
    { ...base, fieldId: "rank", label: "成绩院系中排名", currentValue: "" },
    { ...base, fieldId: "degree-type", label: "学位类型", currentValue: "" },
    { ...base, fieldId: "education-type", label: "受教育类型", currentValue: "" },
    { ...base, fieldId: "overseas", label: "是否在海外学习", currentValue: "" }
  ];
  const plan = Object.fromEntries(autofillCore.buildFillPlan(profile, fields).map((item) => [item.fieldId, item]));
  assert.equal(plan.major.canonicalKey, "education.1.area");
  assert.equal(plan.major.value, "管理学");
  assert.equal(plan.start.value, "2019-09");
  assert.equal(plan.courses.value, "管理学原理");
  assert.equal(plan.rank.value, "前20%");
  assert.equal(plan["degree-type"].canonicalKey, "education.1.degreeType");
  assert.equal(plan["education-type"].canonicalKey, "education.1.educationType");
  assert.equal(plan.overseas.value, "否");
  assert.match(plan.major.reason, /网页现有/);
});

test("real internship records are preferred before work-to-internship fallback", () => {
  const profile = autofillCore.sanitizeProfile({
    schemaVersion: 3,
    work: [{ name: "正式工作公司", position: "产品经理" }],
    internships: [{ name: "真实实习公司", position: "产品实习生" }],
    automationPolicy: { allowWorkAsInternship: true, useAIReasoning: true }
  });
  const field = { fieldId: "intern-company", label: "工作单位", section: "实习经历", tag: "input", type: "text", currentValue: "", required: true, options: [], repeatKind: "internships", repeatIndex: 0 };
  const [item] = autofillCore.buildFillPlan(profile, [field]);
  assert.equal(item.canonicalKey, "internships.0.name");
  assert.equal(item.value, "真实实习公司");
  assert.equal(item.crossCategory, false);
  assert.equal(item.status, "ready");
});

test("resume profile merge appends distinct projects and fills matching records", () => {
  const merged = autofillCore.mergeProfilePatch({
    schemaVersion: 3,
    projects: [{ name: "项目 A", role: "负责人", startDate: "2024-01", summary: "旧说明" }]
  }, {
    schemaVersion: 3,
    projects: [
      { name: "项目 A", role: "负责人", startDate: "2024-01", achievements: "新增成果" },
      { name: "项目 B", role: "产品经理", startDate: "2025-01" }
    ]
  });
  assert.equal(merged.projects.length, 2);
  assert.equal(merged.projects[0].summary, "旧说明");
  assert.equal(merged.projects[0].achievements, "新增成果");
  assert.equal(merged.projects[1].name, "项目 B");
});

test("content agent can safely prepare repeatable education, work, internship, and project sections", () => {
  const content = fs.readFileSync(path.join(root, "autofill-content.js"), "utf8");
  assert.match(content, /AUTOFILL_PREPARE_REPEAT_SECTIONS/);
  assert.match(content, /prepareRepeatSections/);
  assert.match(content, /safeClickAddControl/);
  assert.match(content, /preventSubmit/);
  assert.match(content, /项目经历\|项目经验/);
});

test("work history mapped into an internship-only section is always review-only", () => {
  const profile = autofillCore.sanitizeProfile({
    work: [{ experienceType: "工作", name: "示例公司", position: "产品经理", responsibilities: "负责产品规划" }],
    automationPolicy: { allowWorkAsInternship: true, useAIReasoning: true }
  });
  const field = { fieldId: "intern-company", label: "实习单位", section: "实习经历", tag: "input", type: "text", currentValue: "", required: true, options: [] };
  const [item] = autofillCore.buildFillPlan(profile, [field]);
  assert.equal(item.value, "示例公司");
  assert.equal(item.status, "review");
  assert.equal(item.selected, false);
  assert.equal(item.crossCategory, true);
  assert.match(item.reason, /工作经历/);
});

test("AI mappings can only use existing profile paths and cannot invent values", () => {
  const profile = autofillCore.sanitizeProfile({ work: [{ experienceType: "工作", name: "真实公司" }] });
  const fields = [{ fieldId: "company", label: "实习单位", section: "实习经历" }];
  const plan = autofillCore.buildFillPlan(profile, fields);
  const result = autofillCore.applyAIPlanDecisions(profile, plan, fields, [
    { fieldId: "company", action: "map", sourcePath: "work.0.name", confidence: 0.99, reason: "表单只有实习栏目" },
    { fieldId: "company", action: "map", sourcePath: "work.0.invented", confidence: 0.99, reason: "虚构路径" }
  ]);
  assert.equal(result[0].value, "真实公司");
  assert.equal(result[0].status, "review");
  assert.equal(result[0].selected, false);
  assert.match(result[0].reason, /跨栏目/);
});

test("AI resume fields without evidence are discarded before profile merge", () => {
  const filtered = autofillCore.filterProfileByEvidence({
    basics: { name: "真实姓名", currentCity: "模型猜测城市" },
    work: [{ experienceType: "工作", name: "真实公司", achievements: "模型虚构成果" }]
  }, ["basics.name", "work.0.name", "work.0.experienceType"]);
  assert.equal(filtered.basics.name, "真实姓名");
  assert.equal(filtered.basics.currentCity, "");
  assert.equal(filtered.work[0].name, "真实公司");
  assert.equal(filtered.work[0].experienceType, "工作");
  assert.equal(filtered.work[0].achievements, "");
});

test("autofill implementation cannot submit forms or overwrite existing values by plan", () => {
  const content = fs.readFileSync(path.join(root, "autofill-content.js"), "utf8");
  const panel = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.doesNotMatch(content, /\.submit\s*\(/);
  assert.doesNotMatch(content, /requestSubmit\s*\(/);
  assert.match(content, /检测到已有内容，未覆盖/);
  assert.match(panel, /扩展不会提交表单/);
  assert.match(panel, /item\.sensitive/);
});
