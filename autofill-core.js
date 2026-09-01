(function initAutofillCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JobAutofillCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAutofillCore() {
  "use strict";

  const PROFILE_KEY = "candidateAutofillProfile";
  const PROFILE_SCHEMA_VERSION = 3;
  const HIGH_CONFIDENCE = 0.88;
  const REVIEW_CONFIDENCE = 0.72;

  const DEFAULT_PROFILE = Object.freeze({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    basics: {
      name: "", givenName: "", middleName: "", familyName: "", formerName: "",
      englishName: "", namePinyin: "", phoneCountryCode: "+86", phone: "", alternatePhone: "",
      email: "", alternateEmail: "", wechat: "", url: "", github: "", linkedin: "",
      currentCity: "", currentProvince: "", currentCountry: "", nativePlace: "",
      address: "", postalCode: "", nationality: "", citizenship: "",
      currentCompany: "", currentTitle: "", yearsOfExperience: ""
    },
    private: {
      idType: "", idNumber: "", idExpiryDate: "", passportNumber: "", passportExpiryDate: "",
      birthDate: "", birthPlace: "", gender: "", ethnicity: "", healthStatus: "",
      maritalStatus: "", politicalStatus: "", partyJoinDate: "", hukouLocation: "", hukouType: "",
      heightCm: "", weightKg: "", disabilityStatus: "", veteranStatus: ""
    },
    jobPreferences: {
      expectedRole: "", expectedJobFamily: "", expectedIndustry: "", expectedCities: "",
      expectedSalaryMin: "", expectedSalaryMax: "", salaryPeriod: "月", currency: "CNY",
      availableDate: "", employmentType: "", workMode: "", willingToRelocate: "",
      travelDomestic: "", travelInternational: "", acceptPartTime: "", acceptTemporary: "",
      flexibleWork: "", source: "", referrerName: "", referrerEmployeeId: ""
    },
    eligibility: {
      workAuthorization: "", visaType: "", requiresSponsorship: "", nonCompete: "",
      relativeAtCompany: "", relativeDetails: "", disciplinaryHistory: "", criminalHistory: "",
      conflictOfInterest: "", canBackgroundCheck: ""
    },
    education: [], work: [], internships: [], projects: [], research: [], campus: [], volunteer: [],
    skills: [], languages: [], certificates: [], awards: [], publications: [], patents: [],
    familyMembers: [], emergencyContacts: [], references: [],
    narratives: {
      selfEvaluation: "", strengths: "", hobbies: "", careerPlan: "", whyCompany: "",
      whyRole: "", coverLetter: "", otherInfo: ""
    },
    automationPolicy: { allowWorkAsInternship: true, useAIReasoning: true }
  });

  const RECORD_SCHEMAS = Object.freeze({
    education: ["institution", "schoolType", "college", "area", "majorCategory", "minor", "researchDirection", "studyType", "degreeType", "educationLevel", "startDate", "endDate", "graduationDate", "score", "scoreScale", "rank", "rankTotal", "educationType", "studentType", "admissionBatch", "overseasStudy", "status", "country", "city", "courses", "thesis", "advisor", "honors", "summary"],
    work: ["experienceType", "name", "department", "position", "employmentType", "jobFunction", "industry", "companyNature", "companySize", "startDate", "endDate", "current", "country", "city", "location", "teamSize", "directReports", "responsibilities", "achievements", "technologies", "leavingReason", "supervisorName", "supervisorTitle", "supervisorPhone", "salary", "salaryPeriod", "summary"],
    internships: ["experienceType", "name", "department", "position", "employmentType", "jobFunction", "industry", "companyNature", "companySize", "startDate", "endDate", "current", "country", "city", "location", "teamSize", "directReports", "responsibilities", "achievements", "technologies", "leavingReason", "supervisorName", "supervisorTitle", "supervisorPhone", "salary", "salaryPeriod", "summary"],
    projects: ["name", "type", "entity", "department", "role", "industry", "startDate", "endDate", "current", "country", "city", "location", "url", "keywords", "technologies", "methods", "teamSize", "customers", "background", "objective", "responsibilities", "deliverables", "achievements", "metrics", "challenges", "solution", "summary"],
    research: ["name", "institution", "role", "startDate", "endDate", "advisor", "methods", "achievements", "summary"],
    campus: ["organization", "role", "startDate", "endDate", "responsibilities", "achievements", "summary"],
    volunteer: ["organization", "role", "startDate", "endDate", "location", "hours", "summary"],
    skills: ["name", "level", "years", "description"],
    languages: ["language", "level", "reading", "writing", "speaking", "listening", "testName", "score"],
    certificates: ["name", "issuer", "date", "expiryDate", "id", "url"],
    awards: ["title", "awarder", "date", "level", "summary"],
    publications: ["title", "publisher", "date", "authors", "url", "summary"],
    patents: ["title", "number", "status", "date", "inventors", "summary"],
    familyMembers: ["name", "relationship", "employer", "position", "phone", "politicalStatus"],
    emergencyContacts: ["name", "relationship", "phone", "employer", "address"],
    references: ["name", "relationship", "company", "title", "phone", "email"]
  });

  const RECORD_PRIMARY_KEYS = Object.freeze({
    education: "institution", work: "name", internships: "name", projects: "name", research: "name",
    campus: "organization", volunteer: "organization", skills: "name", languages: "language",
    certificates: "name", awards: "title", publications: "title", patents: "title",
    familyMembers: "name", emergencyContacts: "name", references: "name"
  });

  const FIELD_RULES = [
    rule("basics.name", "姓名", ["姓名", "中文姓名", "真实姓名", "full name", "legal name"], { autocomplete: ["name"], excludes: ["拼音", "英文", "紧急联系人", "推荐人", "亲属"] }),
    rule("basics.givenName", "名", ["given name", "first name", "名字"], { excludes: ["联系人"] }),
    rule("basics.middleName", "中间名", ["middle name", "中间名"]),
    rule("basics.familyName", "姓", ["family name", "last name", "surname", "姓氏"], { excludes: ["联系人"] }),
    rule("basics.formerName", "曾用名", ["曾用名", "原姓名", "former name"]),
    rule("basics.englishName", "英文名", ["英文名", "英文姓名", "english name", "preferred name"]),
    rule("basics.namePinyin", "姓名拼音", ["姓名全拼", "姓名拼音", "名字拼音", "pinyin"]),
    rule("basics.phoneCountryCode", "手机区号", ["手机国家代码", "电话国家代码", "国际区号", "country code"], { excludes: ["城市"] }),
    rule("basics.phone", "手机号码", ["手机号码", "手机号", "联系电话", "移动电话", "phone number", "mobile number", "telephone"], { autocomplete: ["tel", "tel-national"], types: ["tel", "text", "number"], excludes: ["区号", "国家代码", "紧急", "亲属", "推荐人"] }),
    rule("basics.alternatePhone", "备用电话", ["备用电话", "其他电话", "alternate phone", "secondary phone"]),
    rule("basics.email", "邮箱", ["电子邮箱", "邮箱地址", "邮箱", "email address", "email"], { autocomplete: ["email"], types: ["email", "text"], excludes: ["备用", "紧急", "推荐人"] }),
    rule("basics.alternateEmail", "备用邮箱", ["备用邮箱", "其他邮箱", "alternate email", "secondary email"]),
    rule("basics.wechat", "微信", ["微信号", "微信", "wechat", "weixin"]),
    rule("basics.url", "个人主页", ["个人网站", "个人主页", "作品集链接", "portfolio url", "personal website", "website"], { excludes: ["公司", "学校", "github", "linkedin"] }),
    rule("basics.github", "GitHub", ["github", "github主页", "代码仓库"]),
    rule("basics.linkedin", "LinkedIn", ["linkedin", "领英", "linkedin profile"]),
    rule("basics.currentCity", "现居城市", ["现居住城市", "现居城市", "当前城市", "居住城市", "现所在地", "current city", "city of residence"], { excludes: ["籍贯", "户口", "期望", "项目"] }),
    rule("basics.currentProvince", "现居省份", ["现居省份", "当前省份", "居住省份", "state/province"]),
    rule("basics.currentCountry", "现居国家", ["现居国家", "当前国家", "居住国家", "country of residence"]),
    rule("basics.nativePlace", "籍贯", ["籍贯", "原籍", "native place", "place of origin"], { excludes: ["户口"] }),
    rule("basics.address", "通讯地址", ["通讯地址", "联系地址", "居住地址", "详细地址", "mailing address", "street address"], { excludes: ["紧急", "家庭"] }),
    rule("basics.postalCode", "邮编", ["邮政编码", "邮编", "zip code", "postal code"]),
    rule("basics.nationality", "国籍", ["国籍", "nationality"]),
    rule("basics.citizenship", "公民身份", ["公民身份", "citizenship"]),
    rule("basics.currentCompany", "当前公司", ["目前公司", "当前公司", "现任雇主", "current company", "current employer"]),
    rule("basics.currentTitle", "当前职位", ["当前职位", "现任职位", "当前岗位", "current title", "current position"]),
    rule("basics.yearsOfExperience", "工作年限", ["工作年限", "工作经验年限", "总工作年限", "years of experience"]),

    rule("jobPreferences.expectedRole", "期望职位", ["期望职位", "意向岗位", "应聘职位", "目标岗位", "求职意向", "desired role", "target position"], { excludes: ["当前职位", "项目角色"] }),
    rule("jobPreferences.expectedJobFamily", "职位类别", ["期望职位类别", "岗位类别", "职能类别", "job family"]),
    rule("jobPreferences.expectedIndustry", "期望行业", ["期望行业", "意向行业", "行业偏好", "preferred industry"]),
    rule("jobPreferences.expectedCities", "期望城市", ["期望城市", "意向城市", "期望工作地点", "工作地点意向", "preferred location", "desired location"], { excludes: ["现居", "籍贯", "户口"] }),
    rule("jobPreferences.expectedSalaryMin", "期望最低薪资", ["期望最低薪资", "最低期望薪资", "minimum expected salary"]),
    rule("jobPreferences.expectedSalaryMax", "期望最高薪资", ["期望最高薪资", "最高期望薪资", "maximum expected salary"]),
    rule("jobPreferences.salaryPeriod", "薪资周期", ["薪资周期", "薪资类型", "salary period"]),
    rule("jobPreferences.currency", "薪资币种", ["薪资币种", "货币", "currency"]),
    rule("jobPreferences.availableDate", "到岗时间", ["到岗时间", "可入职日期", "最快到岗", "available date", "availability date"]),
    rule("jobPreferences.employmentType", "用工类型", ["期望工作性质", "用工类型", "全职/兼职", "employment type"]),
    rule("jobPreferences.workMode", "办公方式", ["办公方式", "工作模式", "远程办公", "work mode"]),
    rule("jobPreferences.willingToRelocate", "接受调动", ["是否接受调动", "愿意搬迁", "可否异地", "willing to relocate", "relocation"]),
    rule("jobPreferences.travelDomestic", "国内出差", ["是否接受国内出差", "国内出差", "domestic travel"]),
    rule("jobPreferences.travelInternational", "海外出差", ["是否接受海外出差", "国际出差", "international travel"]),
    rule("jobPreferences.acceptPartTime", "接受兼职", ["是否接受兼职", "接受兼职", "part time"]),
    rule("jobPreferences.acceptTemporary", "接受临时岗位", ["是否接受临时岗位", "临时派遣", "temporary assignment"]),
    rule("jobPreferences.flexibleWork", "弹性工作", ["是否接受弹性工作", "弹性办公", "flexible work"]),
    rule("jobPreferences.source", "申请来源", ["信息来源", "申请来源", "如何得知", "candidate source", "source"]),
    rule("jobPreferences.referrerName", "内推人", ["内推人姓名", "推荐人姓名", "referrer name"]),
    rule("jobPreferences.referrerEmployeeId", "内推人工号", ["内推人工号", "推荐人员工号", "referrer employee id"]),

    rule("private.idType", "证件类型", ["证件号码类型", "证件类型", "证件类别", "id type", "document type"], { sensitive: true, excludes: ["号码"] }),
    rule("private.idNumber", "证件号码", ["身份证号码", "证件号码", "身份证号", "id number", "identity number"], { sensitive: true, excludes: ["类型"] }),
    rule("private.idExpiryDate", "证件有效期", ["证件有效期", "身份证有效期", "id expiry date"], { sensitive: true }),
    rule("private.passportNumber", "护照号码", ["护照号码", "护照号", "passport number"], { sensitive: true }),
    rule("private.passportExpiryDate", "护照有效期", ["护照有效期", "passport expiry"], { sensitive: true }),
    rule("private.birthDate", "出生日期", ["出生日期", "出生年月", "生日", "date of birth", "birth date"], { sensitive: true }),
    rule("private.birthPlace", "出生地", ["出生地", "出生地点", "place of birth"], { sensitive: true }),
    rule("private.gender", "性别", ["性别", "gender", "sex"], { sensitive: true }),
    rule("private.ethnicity", "民族", ["民族", "ethnicity", "ethnic group", "race"], { sensitive: true }),
    rule("private.healthStatus", "健康状况", ["健康状况", "身体状况", "health status"], { sensitive: true }),
    rule("private.maritalStatus", "婚姻状况", ["婚姻状况", "婚姻状态", "marital status"], { sensitive: true }),
    rule("private.politicalStatus", "政治面貌", ["政治面貌", "政治身份", "political status"], { sensitive: true }),
    rule("private.partyJoinDate", "入党时间", ["加入党组织时间", "入党时间", "party join date"], { sensitive: true }),
    rule("private.hukouLocation", "户口所在地", ["入学前户口所在地", "户口所在地", "户籍所在地", "户籍地址", "hukou", "registered residence"], { sensitive: true, excludes: ["籍贯"] }),
    rule("private.hukouType", "户口性质", ["户口性质", "户籍类型", "hukou type"], { sensitive: true }),
    rule("private.heightCm", "身高", ["身高", "height"], { sensitive: true, types: ["number", "text"] }),
    rule("private.weightKg", "体重", ["体重", "weight"], { sensitive: true, types: ["number", "text"] }),
    rule("private.disabilityStatus", "残障状况", ["残障状况", "残疾情况", "disability status"], { sensitive: true }),
    rule("private.veteranStatus", "退伍军人身份", ["退伍军人", "退役军人", "veteran status"], { sensitive: true }),

    rule("eligibility.workAuthorization", "工作许可", ["工作许可", "合法工作资格", "work authorization"], { sensitive: true }),
    rule("eligibility.visaType", "签证类型", ["签证类型", "visa type"], { sensitive: true }),
    rule("eligibility.requiresSponsorship", "需要签证担保", ["需要签证担保", "是否需要sponsorship", "requires sponsorship"], { sensitive: true }),
    rule("eligibility.nonCompete", "竞业限制", ["竞业限制", "竞业协议", "non-compete"]),
    rule("eligibility.relativeAtCompany", "亲属任职", ["亲属在本公司任职", "是否有亲属", "relative at company"], { sensitive: true }),
    rule("eligibility.disciplinaryHistory", "处分记录", ["处分记录", "纪律处分", "disciplinary history"], { sensitive: true }),
    rule("eligibility.criminalHistory", "犯罪记录", ["犯罪记录", "刑事记录", "criminal history"], { sensitive: true }),
    rule("eligibility.conflictOfInterest", "利益冲突", ["利益冲突", "conflict of interest"], { sensitive: true }),
    rule("eligibility.canBackgroundCheck", "接受背调", ["是否接受背景调查", "接受背调", "background check"]),

    rule("education", "教育经历（整段）", ["教育经历", "教育背景", "学习经历", "education experience", "education history"], { types: ["textarea"] }),
    collectionRule("education.$.institution", "学校", ["学校全称", "毕业院校", "学校名称", "就读院校", "院校名称", "institution", "university", "college"], "education", { sections: ["教育信息", "教育经历", "教育背景", "education"] }),
    collectionRule("education.$.schoolType", "学校类型", ["学校类型", "院校类型", "院校类别", "school type"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.college", "院系", ["学院", "院系", "系别", "faculty", "school department"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.area", "专业", ["专业", "专业名称", "所学专业", "主修专业", "major", "field of study"], "education", { sections: ["教育信息", "教育经历", "教育背景", "education"], excludes: ["技能", "课程", "类别", "排名"] }),
    collectionRule("education.$.majorCategory", "专业类别", ["专业类别", "学科门类", "专业大类", "major category"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.minor", "辅修专业", ["辅修专业", "第二专业", "minor"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.researchDirection", "研究方向", ["研究方向", "研究领域", "专业方向", "research direction", "research area"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.studyType", "学位", ["学位", "degree"], "education", { sections: ["教育信息", "教育经历", "education"], excludes: ["类型", "类别"] }),
    collectionRule("education.$.degreeType", "学位类型", ["学位类型", "学位类别", "授予学位", "degree type"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.educationLevel", "学历", ["最高学历", "学历", "education level"], "education", { sections: ["教育信息", "教育经历", "education"], excludes: ["性质"] }),
    collectionRule("education.$.startDate", "入学时间", ["入学时间", "教育开始时间", "就读开始", "start date"], "education", { sections: ["教育信息", "教育经历", "education"], excludes: ["工作", "项目"] }),
    collectionRule("education.$.endDate", "毕业时间", ["毕业时间", "教育结束时间", "预计毕业时间", "graduation date", "graduation year", "end date"], "education", { sections: ["教育信息", "教育经历", "education"], excludes: ["工作", "项目"] }),
    collectionRule("education.$.score", "GPA/成绩", ["平均绩点", "绩点", "gpa", "平均成绩", "综合成绩"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.scoreScale", "成绩满分", ["绩点满分", "成绩满分", "gpa scale"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.rank", "排名", ["专业排名", "班级排名", "年级排名", "院系排名", "成绩排名", "成绩院系中排名", "成绩在院系中排名", "rank"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.rankTotal", "排名总人数", ["专业总人数", "年级总人数", "排名总人数", "rank total"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.educationType", "受教育类型", ["受教育类型", "学历性质", "学习形式", "培养方式", "教育类型", "education type"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.studentType", "学生类型", ["学生类型", "生源类型", "student type"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.admissionBatch", "录取批次", ["录取批次", "招生批次", "admission batch"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.overseasStudy", "海外学习经历", ["是否在海外学习", "是否有海外学习经历", "海外学习经历", "海外留学经历", "studied abroad", "overseas study"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.status", "就读状态", ["就读状态", "毕业状态", "在读状态", "education status"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.city", "学校所在地", ["学校所在地", "院校城市", "就读城市", "school location"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.courses", "主修课程", ["主修课程", "专业课程", "核心课程", "主要课程", "所学课程", "courses"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.thesis", "论文题目", ["毕业论文", "论文题目", "thesis"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.advisor", "导师", ["导师", "指导老师", "advisor"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.honors", "在校荣誉", ["在校荣誉", "教育荣誉", "honors"], "education", { sections: ["教育信息", "教育经历", "education"] }),
    collectionRule("education.$.summary", "教育经历描述", ["教育经历描述", "在校经历", "教育经历概述", "education summary"], "education", { sections: ["教育信息", "教育经历", "education"] }),

    rule("work", "工作经历（整段）", ["工作经历", "工作经验", "职业经历", "任职经历", "work experience", "employment history"], { types: ["textarea"], excludes: ["实习"] }),
    collectionRule("work.$.name", "工作单位", ["公司全称", "公司名称", "工作单位", "任职单位", "雇主", "company", "employer"], "work", { sections: ["工作经历", "工作经验", "职业经历", "work"], excludes: ["实习", "目标公司", "亲属"] }),
    collectionRule("work.$.department", "工作部门", ["所在部门", "部门名称", "工作部门", "department"], "work", { sections: ["工作经历", "工作经验", "work"], excludes: ["实习"] }),
    collectionRule("work.$.position", "工作职位", ["职位名称", "岗位名称", "工作职位", "担任职务", "job title", "position"], "work", { sections: ["工作经历", "工作经验", "work"], excludes: ["期望", "项目", "实习"] }),
    collectionRule("work.$.employmentType", "工作性质", ["工作性质", "任职类型", "雇佣类型", "employment type"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.jobFunction", "工作职能", ["工作职能", "岗位职能", "职能", "job function"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.industry", "公司行业", ["公司行业", "所在行业", "行业", "industry"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.companyNature", "公司性质", ["公司性质", "单位性质", "企业性质", "company type"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.companySize", "公司规模", ["公司规模", "企业规模", "company size"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.startDate", "入职时间", ["工作开始时间", "入职时间", "任职开始时间", "开始时间", "start date"], "work", { sections: ["工作经历", "工作经验", "work"], excludes: ["教育", "项目", "实习"] }),
    collectionRule("work.$.endDate", "离职时间", ["工作结束时间", "离职时间", "任职结束时间", "结束时间", "end date"], "work", { sections: ["工作经历", "工作经验", "work"], excludes: ["教育", "项目", "实习"] }),
    collectionRule("work.$.current", "是否在职", ["是否在职", "至今", "current role"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.city", "工作城市", ["工作地点", "工作城市", "所在城市", "work location"], "work", { sections: ["工作经历", "工作经验", "work"], excludes: ["期望", "现居", "实习"] }),
    collectionRule("work.$.teamSize", "团队规模", ["团队规模", "团队人数", "team size"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.directReports", "下属人数", ["下属人数", "管理人数", "direct reports"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.responsibilities", "工作职责", ["工作内容", "工作描述", "岗位职责", "主要职责", "职责描述", "description", "responsibilities"], "work", { sections: ["工作经历", "工作经验", "work"], excludes: ["实习", "项目"] }),
    collectionRule("work.$.achievements", "工作成果", ["工作成果", "主要业绩", "关键成果", "工作业绩", "achievements"], "work", { sections: ["工作经历", "工作经验", "work"], excludes: ["实习", "项目"] }),
    collectionRule("work.$.technologies", "工作技能/工具", ["使用工具", "工作技能", "技术栈", "technologies"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.leavingReason", "离职原因", ["离职原因", "离任原因", "reason for leaving"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.supervisorName", "直属上级", ["直属上级", "主管姓名", "汇报对象", "supervisor"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.supervisorPhone", "上级电话", ["主管电话", "上级电话", "supervisor phone"], "work", { sections: ["工作经历", "工作经验", "work"], sensitive: true }),
    collectionRule("work.$.salary", "工作薪资", ["离职前薪资", "工作薪资", "月薪", "salary"], "work", { sections: ["工作经历", "工作经验", "work"] }),
    collectionRule("work.$.summary", "工作概述", ["工作概述", "经历概述", "工作经验描述", "experience summary"], "work", { sections: ["工作经历", "工作经验", "work"], excludes: ["实习", "项目"] }),

    rule("internships", "实习经历（整段）", ["实习经历", "实习经验", "internship experience", "internship history"], { types: ["textarea"] }),
    collectionRule("internships.$.name", "实习单位", ["实习单位", "实习公司", "工作单位", "单位名称", "公司名称", "internship company", "employer"], "internships", { sections: ["实习经历", "实习经验", "internship"], excludes: ["目标公司", "亲属"] }),
    collectionRule("internships.$.department", "实习部门", ["实习部门", "所在部门", "部门名称", "department"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.position", "实习职位", ["实习职位", "实习岗位", "职位", "职务", "岗位名称", "internship title", "position"], "internships", { sections: ["实习经历", "实习经验", "internship"], excludes: ["期望", "项目"] }),
    collectionRule("internships.$.employmentType", "实习性质", ["实习性质", "实习类型", "全职实习", "兼职实习", "employment type"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.jobFunction", "实习职能", ["实习职能", "岗位职能", "职能", "job function"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.industry", "实习行业", ["公司行业", "实习行业", "所在行业", "行业", "industry"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.companyNature", "实习单位性质", ["公司性质", "单位性质", "企业性质", "company type"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.companySize", "实习单位规模", ["公司规模", "企业规模", "company size"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.startDate", "实习开始时间", ["实习开始时间", "开始时间", "入职时间", "start date"], "internships", { sections: ["实习经历", "实习经验", "internship"], excludes: ["教育", "项目"] }),
    collectionRule("internships.$.endDate", "实习结束时间", ["实习结束时间", "结束时间", "离职时间", "end date"], "internships", { sections: ["实习经历", "实习经验", "internship"], excludes: ["教育", "项目"] }),
    collectionRule("internships.$.current", "是否仍在实习", ["是否仍在实习", "是否在职", "至今", "current internship"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.city", "实习城市", ["实习地点", "实习城市", "工作地点", "所在城市", "internship location"], "internships", { sections: ["实习经历", "实习经验", "internship"], excludes: ["期望", "现居"] }),
    collectionRule("internships.$.teamSize", "实习团队规模", ["团队规模", "团队人数", "team size"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.responsibilities", "实习职责", ["实习内容", "实习描述", "实习职责", "岗位职责", "主要职责", "description", "responsibilities"], "internships", { sections: ["实习经历", "实习经验", "internship"], excludes: ["项目"] }),
    collectionRule("internships.$.achievements", "实习成果", ["实习成果", "实习业绩", "主要成果", "achievements"], "internships", { sections: ["实习经历", "实习经验", "internship"], excludes: ["项目"] }),
    collectionRule("internships.$.technologies", "实习技能/工具", ["使用工具", "实习技能", "技术栈", "technologies"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.supervisorName", "实习导师", ["实习导师", "直属上级", "主管姓名", "supervisor"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),
    collectionRule("internships.$.supervisorPhone", "实习导师电话", ["实习导师电话", "主管电话", "supervisor phone"], "internships", { sections: ["实习经历", "实习经验", "internship"], sensitive: true }),
    collectionRule("internships.$.summary", "实习概述", ["实习概述", "实习经历描述", "经历概述", "internship summary"], "internships", { sections: ["实习经历", "实习经验", "internship"] }),

    rule("projects", "项目经历（整段）", ["项目经历", "项目经验", "项目介绍", "项目情况", "project experience", "project history"], { types: ["textarea"] }),
    collectionRule("projects.$.name", "项目名称", ["项目名称", "项目名", "项目标题", "project name", "project title"], "projects", { sections: ["项目经历", "项目经验", "项目介绍", "projects"] }),
    collectionRule("projects.$.type", "项目类型", ["项目类型", "项目类别", "project type"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.entity", "项目所属单位", ["项目所属单位", "项目单位", "所属公司", "所属组织", "project organization", "project company"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.department", "项目所属部门", ["项目所属部门", "项目部门", "project department"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.role", "项目角色", ["项目角色", "担任角色", "项目职务", "职责角色", "project role"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.industry", "项目行业", ["项目行业", "所属行业", "project industry"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.startDate", "项目开始时间", ["项目开始时间", "项目起始时间", "项目开始日期", "start date"], "projects", { sections: ["项目经历", "项目经验", "projects"], excludes: ["工作", "教育"] }),
    collectionRule("projects.$.endDate", "项目结束时间", ["项目结束时间", "项目终止时间", "项目结束日期", "end date"], "projects", { sections: ["项目经历", "项目经验", "projects"], excludes: ["工作", "教育"] }),
    collectionRule("projects.$.current", "项目是否进行中", ["项目是否进行中", "是否仍在进行", "current project"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.city", "项目地点", ["项目地点", "项目城市", "project location"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.url", "项目链接", ["项目链接", "项目网址", "演示链接", "project url", "project link"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.keywords", "项目关键词", ["项目关键词", "关键词", "project keywords"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.technologies", "项目技术/工具", ["项目技术", "技术栈", "使用工具", "tools", "technologies"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.methods", "项目方法", ["项目方法", "工作方法", "研究方法", "methods"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.teamSize", "项目团队规模", ["项目团队规模", "项目人数", "团队规模", "team size"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.customers", "项目客户/用户", ["项目客户", "目标用户", "服务对象", "customers", "users"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.background", "项目背景", ["项目背景", "背景介绍", "project background"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.objective", "项目目标", ["项目目标", "项目目的", "project objective", "project goal"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.responsibilities", "项目职责", ["项目职责", "项目分工", "本人职责", "负责内容", "project responsibilities"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.deliverables", "项目交付物", ["项目交付物", "交付成果", "deliverables"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.achievements", "项目成果", ["项目成果", "项目业绩", "项目成效", "project achievements", "project results"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.metrics", "量化指标", ["量化指标", "关键数据", "项目数据", "metrics"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.challenges", "项目难点", ["项目难点", "项目挑战", "challenges"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.solution", "解决方案", ["解决方案", "解决思路", "项目方案", "solution"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),
    collectionRule("projects.$.summary", "项目描述", ["项目描述", "项目内容", "项目介绍", "项目概述", "项目经验描述", "project description", "project summary"], "projects", { sections: ["项目经历", "项目经验", "projects"] }),

    collectionRule("research.$.name", "科研名称", ["科研项目名称", "研究项目", "research project"], "research", { sections: ["科研经历", "研究经历", "research"] }),
    collectionRule("research.$.summary", "科研内容", ["科研内容", "研究内容", "research summary"], "research", { sections: ["科研经历", "研究经历", "research"] }),
    collectionRule("campus.$.organization", "校园组织", ["校园组织", "社团名称", "学生组织"], "campus", { sections: ["校园经历", "社团经历"] }),
    collectionRule("campus.$.role", "校园职务", ["校园职务", "社团职务", "学生干部职务"], "campus", { sections: ["校园经历", "社团经历"] }),
    collectionRule("volunteer.$.organization", "志愿组织", ["志愿组织", "公益组织", "volunteer organization"], "volunteer", { sections: ["志愿经历", "公益经历", "volunteer"] }),
    collectionRule("volunteer.$.summary", "志愿内容", ["志愿内容", "志愿服务内容", "volunteer experience"], "volunteer", { sections: ["志愿经历", "volunteer"] }),

    rule("skills", "技能", ["技能及爱好", "专业技能", "技能特长", "技能", "skills", "technical skills"], { excludes: ["技能证书"] }),
    collectionRule("skills.$.name", "技能名称", ["技能名称", "技能项", "skill name"], "skills", { sections: ["技能", "skills"] }),
    collectionRule("skills.$.level", "技能水平", ["熟练程度", "技能水平", "proficiency"], "skills", { sections: ["技能", "skills"] }),
    rule("languages", "语言能力", ["语言能力", "外语水平", "语言技能", "languages", "language proficiency"]),
    collectionRule("languages.$.language", "语言", ["语种", "语言名称", "language"], "languages", { sections: ["语言能力", "languages"] }),
    collectionRule("languages.$.level", "语言水平", ["语言水平", "熟练程度", "proficiency level"], "languages", { sections: ["语言能力", "languages"] }),
    rule("certificates", "证书", ["资格证书", "技能证书", "证书", "certificates", "certifications"], { excludes: ["证件"] }),
    collectionRule("certificates.$.name", "证书名称", ["证书名称", "资格名称", "certificate name", "license name"], "certificates", { sections: ["证书", "资格", "certifications"] }),
    collectionRule("certificates.$.issuer", "发证机构", ["发证机构", "颁发机构", "issuer"], "certificates", { sections: ["证书", "资格", "certifications"] }),
    rule("awards", "奖励活动", ["奖励活动", "获奖情况", "荣誉奖励", "奖项", "awards", "honors"]),
    rule("publications", "论文发表", ["论文发表", "出版物", "publications"]),
    rule("patents", "专利", ["专利", "patents"]),
    collectionRule("emergencyContacts.$.name", "紧急联系人", ["紧急联系人姓名", "紧急联系人", "emergency contact name"], "emergencyContacts", { sensitive: true, sections: ["紧急联系人", "emergency contact"] }),
    collectionRule("emergencyContacts.$.phone", "紧急联系人电话", ["紧急联系人电话", "紧急联系电话", "emergency contact phone"], "emergencyContacts", { sensitive: true, sections: ["紧急联系人", "emergency contact"] }),
    collectionRule("references.$.name", "证明人", ["证明人姓名", "推荐人姓名", "reference name"], "references", { sensitive: true, sections: ["证明人", "推荐人", "references"] }),
    collectionRule("references.$.phone", "证明人电话", ["证明人电话", "推荐人电话", "reference phone"], "references", { sensitive: true, sections: ["证明人", "推荐人", "references"] }),
    rule("narratives.selfEvaluation", "自我评价", ["自我评价", "个人评价", "个人总结", "自我介绍", "self evaluation", "professional summary"]),
    rule("narratives.strengths", "个人优势", ["个人优势", "核心优势", "个人特长", "strengths", "highlights"]),
    rule("narratives.hobbies", "兴趣爱好", ["兴趣爱好", "爱好", "hobbies", "interests"], { excludes: ["技能"] }),
    rule("narratives.careerPlan", "职业规划", ["职业规划", "发展规划", "career plan"]),
    rule("narratives.whyCompany", "申请公司原因", ["为什么选择本公司", "申请本公司原因", "why company"]),
    rule("narratives.whyRole", "申请岗位原因", ["为什么申请该岗位", "应聘理由", "why role"]),
    rule("narratives.coverLetter", "求职信", ["求职信", "动机信", "cover letter"]),
    rule("narratives.otherInfo", "其他说明", ["其他说明", "补充说明", "其他信息", "additional information", "other information"])
  ];

  function rule(path, label, aliases, options = {}) { return { path, label, aliases, collection: null, ...options }; }
  function collectionRule(path, label, aliases, collection, options = {}) { return { path, label, aliases, collection, ...options }; }
  function cloneDefaultProfile() { return JSON.parse(JSON.stringify(DEFAULT_PROFILE)); }
  function normalizeText(value) {
    return String(value || "").toLowerCase()
      .replace(/(?:请|请您)?(?:填写|输入|选择|上传|勾选)/g, "")
      .replace(/\b(required|optional|please|enter|select)\b/g, "")
      .replace(/[\s\-—_：:，,。\.、/\\()（）\[\]【】*＊]+/g, "").trim();
  }
  function cleanString(value, maxLength = 12000) { return typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, maxLength) : ""; }
  function cleanBoolean(value, fallback) { return typeof value === "boolean" ? value : fallback; }

  function sanitizeRecords(value, kind, maxItems = 20) {
    if (!Array.isArray(value)) return [];
    const allowedKeys = RECORD_SCHEMAS[kind] || [];
    const primaryKey = RECORD_PRIMARY_KEYS[kind];
    return value.slice(0, maxItems).map((record) => {
      const source = typeof record === "string" ? { [primaryKey]: record } : (record || {});
      const clean = {};
      for (const key of allowedKeys) clean[key] = cleanString(source[key], ["summary", "responsibilities", "achievements", "description", "courses"].includes(key) ? 12000 : 2000);
      return clean;
    }).filter((record) => Object.values(record).some(Boolean));
  }

  function sanitizeProfile(input) {
    const source = input && typeof input === "object" ? input : {};
    const result = cloneDefaultProfile();
    for (const key of Object.keys(result.basics)) result.basics[key] = cleanString(source.basics?.[key], 2000);
    for (const key of Object.keys(result.private)) result.private[key] = cleanString(source.private?.[key], 2000);
    for (const key of Object.keys(result.jobPreferences)) result.jobPreferences[key] = cleanString(source.jobPreferences?.[key], 4000);
    for (const key of Object.keys(result.eligibility)) result.eligibility[key] = cleanString(source.eligibility?.[key], 4000);
    if (!result.jobPreferences.expectedRole) result.jobPreferences.expectedRole = cleanString(source.basics?.expectedRole, 2000);
    if (!result.jobPreferences.expectedCities) result.jobPreferences.expectedCities = cleanString(source.basics?.expectedCity, 2000);
    for (const kind of Object.keys(RECORD_SCHEMAS)) result[kind] = sanitizeRecords(source[kind], kind);
    const isLegacyProfile = Number(source.schemaVersion || 0) < 3 && !Array.isArray(source.internships);
    if (isLegacyProfile) {
      const workRecords = [];
      const internshipRecords = [];
      for (const record of result.work) {
        if (/实习|intern/.test(normalizeText(record.experienceType))) internshipRecords.push({ ...record, experienceType: record.experienceType || "实习" });
        else workRecords.push({ ...record, experienceType: record.experienceType || "工作" });
      }
      result.work = workRecords;
      result.internships = internshipRecords;
    }
    result.work = result.work.map((record) => ({ ...record, experienceType: record.experienceType || "工作" }));
    result.internships = result.internships.map((record) => ({ ...record, experienceType: record.experienceType || "实习" }));
    for (const key of Object.keys(result.narratives)) result.narratives[key] = cleanString(source.narratives?.[key]);
    result.automationPolicy.allowWorkAsInternship = cleanBoolean(source.automationPolicy?.allowWorkAsInternship, true);
    result.automationPolicy.useAIReasoning = cleanBoolean(source.automationPolicy?.useAIReasoning, true);
    result.schemaVersion = PROFILE_SCHEMA_VERSION;
    return result;
  }

  function scoreRule(field, candidateRule) {
    const label = normalizeText(field.label);
    const placeholder = normalizeText(field.placeholder);
    const attributes = normalizeText(`${field.name || ""} ${field.id || ""} ${field.ariaLabel || ""}`);
    const section = normalizeText(field.section);
    const autocomplete = normalizeText(field.autocomplete);
    const allText = `${label}|${placeholder}|${attributes}|${section}`;
    if ((candidateRule.excludes || []).some((term) => allText.includes(normalizeText(term)))) return null;
    if (candidateRule.types?.length && field.type && !candidateRule.types.includes(String(field.type).toLowerCase()) && !field.customSelect && field.tag !== "select") return null;
    let score = 0;
    let reason = "";
    for (const aliasValue of candidateRule.aliases) {
      const alias = normalizeText(aliasValue);
      if (!alias) continue;
      if (label && label === alias && score < 0.97) { score = 0.97; reason = "字段标签精确匹配"; }
      else if (label && alias.length >= 2 && label.includes(alias) && score < 0.9) { score = 0.9; reason = "字段标签匹配"; }
      else if (placeholder && placeholder === alias && score < 0.88) { score = 0.88; reason = "占位提示精确匹配"; }
      else if (placeholder && alias.length >= 2 && placeholder.includes(alias) && score < 0.82) { score = 0.82; reason = "占位提示匹配"; }
      else if (attributes && attributes === alias && score < 0.86) { score = 0.86; reason = "字段属性精确匹配"; }
      else if (attributes && alias.length >= 3 && attributes.includes(alias) && score < 0.76) { score = 0.76; reason = "字段属性匹配"; }
    }
    if ((candidateRule.autocomplete || []).some((value) => autocomplete === normalizeText(value))) { score = Math.max(score, 0.99); reason = "浏览器标准字段类型匹配"; }
    if (!score) return null;
    if ((candidateRule.sections || []).some((value) => section.includes(normalizeText(value)))) score += 0.04;
    if (field.required) score += 0.01;
    return { rule: candidateRule, score: Math.min(0.99, Math.round(score * 100) / 100), reason };
  }

  function bestRuleForField(field) {
    const candidates = FIELD_RULES.map((candidateRule) => scoreRule(field, candidateRule)).filter(Boolean).sort((a, b) => b.score - a.score);
    if (!candidates.length || candidates[0].score < REVIEW_CONFIDENCE) return null;
    const best = candidates[0];
    const second = candidates[1];
    return { ...best, ambiguous: Boolean(second && best.score - second.score < 0.08), alternative: second?.rule?.label || "" };
  }

  function getPathValue(object, path) { return String(path || "").split(".").reduce((value, key) => value?.[key], object); }
  function formatRecord(record) { return Object.values(record || {}).map((value) => cleanString(value)).filter(Boolean).join("；"); }
  function formatCollection(value) { return Array.isArray(value) ? value.map(formatRecord).filter(Boolean).join("\n") : cleanString(value); }
  function resolveValue(profile, matchedRule, occurrence) {
    if (!matchedRule.collection) {
      const value = getPathValue(profile, matchedRule.path);
      return Array.isArray(value) ? formatCollection(value) : cleanString(value);
    }
    const record = profile[matchedRule.collection]?.[occurrence];
    return cleanString(record?.[matchedRule.path.split(".").pop()]);
  }
  function canonicalPath(matchedRule, occurrence) { return matchedRule.collection ? matchedRule.path.replace("$", String(occurrence)) : matchedRule.path; }
  function isSensitivePath(path) {
    return /^(?:private|familyMembers|emergencyContacts|references)\./.test(path)
      || /^(?:work|internships)\.\d+\.(?:supervisorPhone|salary)$/.test(path)
      || /^(?:eligibility\.(?:workAuthorization|visaType|requiresSponsorship|relativeAtCompany|relativeDetails|disciplinaryHistory|criminalHistory|conflictOfInterest))/.test(path);
  }

  function resolvePlanValue(profile, matchedRule, occurrence, fieldContext) {
    if (!matchedRule.collection) {
      let canonicalKey = matchedRule.path;
      let value = resolveValue(profile, matchedRule, occurrence);
      let crossCategory = false;
      if (matchedRule.path === "internships" && !value && fieldContext.includes("实习") && profile.automationPolicy.allowWorkAsInternship && profile.work.length) {
        canonicalKey = "work";
        value = formatCollection(profile.work);
        crossCategory = true;
      }
      return { canonicalKey, value, crossCategory };
    }
    let sourceCollection = matchedRule.collection;
    let record = profile[sourceCollection]?.[occurrence];
    let crossCategory = false;
    if (sourceCollection === "internships" && !record && fieldContext.includes("实习") && profile.automationPolicy.allowWorkAsInternship) {
      sourceCollection = "work";
      record = profile.work?.[occurrence];
      crossCategory = Boolean(record);
    }
    const key = matchedRule.path.split(".").pop();
    return {
      canonicalKey: matchedRule.path.replace(matchedRule.collection, sourceCollection).replace("$", String(occurrence)),
      value: cleanString(record?.[key]),
      crossCategory
    };
  }

  function buildRepeatSourceIndexMap(profile, fields) {
    const groups = new Map();
    for (const field of fields) {
      const kind = cleanString(field?.repeatKind, 40);
      const repeatIndex = Number(field?.repeatIndex);
      if (!RECORD_SCHEMAS[kind] || !Number.isInteger(repeatIndex) || !cleanString(field.currentValue, 1000)) continue;
      const match = bestRuleForField(field);
      if (!match?.rule?.collection || match.rule.collection !== kind) continue;
      const key = match.rule.path.split(".").pop();
      const desired = normalizeText(field.currentValue);
      if (!desired) continue;
      const groupKey = `${kind}:${repeatIndex}`;
      if (!groups.has(groupKey)) groups.set(groupKey, { kind, repeatIndex, votes: new Map(), evidence: [] });
      const group = groups.get(groupKey);
      const primaryKey = RECORD_PRIMARY_KEYS[kind];
      profile[kind].forEach((record, sourceIndex) => {
        const actual = normalizeText(record?.[key]);
        if (!actual) return;
        const exact = actual === desired;
        const contains = !exact && Math.min(actual.length, desired.length) >= 2 && (actual.includes(desired) || desired.includes(actual));
        if (!exact && !contains) return;
        const weight = (key === primaryKey ? 8 : 2) * (exact ? 1 : 0.6);
        group.votes.set(sourceIndex, (group.votes.get(sourceIndex) || 0) + weight);
        group.evidence.push({ sourceIndex, key, weight, label: field.label, value: field.currentValue });
      });
    }
    const result = new Map();
    for (const [groupKey, group] of groups) {
      const ranked = [...group.votes.entries()].sort((left, right) => right[1] - left[1]);
      if (!ranked.length || (ranked[1] && ranked[0][1] === ranked[1][1])) continue;
      const evidence = group.evidence.filter((item) => item.sourceIndex === ranked[0][0]).sort((left, right) => right.weight - left.weight)[0];
      result.set(groupKey, {
        sourceIndex: ranked[0][0],
        reason: evidence ? `已按网页现有“${cleanString(evidence.label, 80)}”对齐资料记录` : "已按网页现有值对齐资料记录"
      });
    }
    return result;
  }

  function buildFillPlan(profileInput, fieldsInput) {
    const profile = sanitizeProfile(profileInput);
    const fields = Array.isArray(fieldsInput) ? fieldsInput : [];
    const occurrences = {};
    const repeatSourceIndices = buildRepeatSourceIndexMap(profile, fields);
    return fields.map((field) => {
      const base = {
        fieldId: String(field.fieldId || ""), label: cleanString(field.label || field.placeholder || field.name || "未命名字段", 300),
        section: cleanString(field.section, 300), fieldType: field.type || field.tag || "text",
        currentValue: cleanString(field.currentValue, 1000), required: Boolean(field.required),
        options: Array.isArray(field.options) ? field.options.slice(0, 100) : [], selected: false,
        sensitive: false, confidence: 0, status: "unmapped", reason: "没有找到可靠的资料字段映射",
        canonicalKey: "", canonicalLabel: "", value: "", aiSuggested: false
      };
      if (field.unsupported) return { ...base, status: "unsupported", reason: field.unsupportedReason || "此字段需要手动处理" };
      const match = bestRuleForField(field);
      if (!match) return base;
      const counterKey = match.rule.path;
      const repeatGroupKey = match.rule.collection && field.repeatKind === match.rule.collection && Number.isInteger(Number(field.repeatIndex))
        ? `${field.repeatKind}:${Math.max(0, Number(field.repeatIndex))}` : "";
      const alignedRecord = repeatGroupKey ? repeatSourceIndices.get(repeatGroupKey) : null;
      const explicitOccurrence = alignedRecord ? alignedRecord.sourceIndex
        : repeatGroupKey ? Math.max(0, Number(field.repeatIndex)) : null;
      const occurrence = match.rule.collection ? (explicitOccurrence ?? (occurrences[counterKey] || 0)) : 0;
      if (match.rule.collection) occurrences[counterKey] = occurrence + 1;
      const fieldContext = normalizeText(`${field.section || ""} ${field.label || ""}`);
      const resolved = resolvePlanValue(profile, match.rule, occurrence, fieldContext);
      const value = resolved.value;
      const canonicalKey = resolved.canonicalKey;
      const crossWorkToInternship = resolved.crossCategory;
      const mapped = {
        ...base, canonicalKey,
        canonicalLabel: match.rule.collection ? `${match.rule.label} ${occurrence + 1}` : match.rule.label,
        sensitive: Boolean(match.rule.sensitive || isSensitivePath(canonicalKey)), confidence: match.score, value,
        reason: crossWorkToInternship
          ? "跨栏目建议：网页为实习经历，但资料来源标记为工作经历，必须确认后填写"
          : alignedRecord ? `${match.reason}；${alignedRecord.reason}`
            : match.ambiguous ? `${match.reason}，但与“${match.alternative}”接近` : match.reason,
        crossCategory: crossWorkToInternship
      };
      if (base.currentValue) return { ...mapped, status: "existing", reason: "网页中已有内容，不会覆盖" };
      if (crossWorkToInternship && !profile.automationPolicy.allowWorkAsInternship) return { ...base, status: "unmapped", reason: "资料策略不允许把工作经历映射到实习栏目" };
      if (!value) return { ...mapped, status: "missing", reason: "已识别字段，但资料库中尚无对应内容" };
      if (crossWorkToInternship || match.ambiguous || match.score < HIGH_CONFIDENCE || mapped.sensitive) return { ...mapped, status: "review", reason: mapped.sensitive ? `${mapped.reason}；敏感信息必须由你勾选确认` : `${mapped.reason}；请人工确认` };
      return { ...mapped, status: "ready", selected: true };
    });
  }

  function flattenProfile(profileInput, options = {}) {
    const profile = sanitizeProfile(profileInput);
    const rows = [];
    const visit = (value, path) => {
      if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}.${index}`));
      if (value && typeof value === "object") return Object.entries(value).forEach(([key, child]) => {
        if (key !== "schemaVersion" && key !== "automationPolicy") visit(child, path ? `${path}.${key}` : key);
      });
      const text = cleanString(value);
      if (text && (options.includeSensitive || !isSensitivePath(path))) rows.push({ path, value: text });
    };
    visit(profile, "");
    return rows;
  }

  function buildAIProfileView(profileInput) {
    const profile = sanitizeProfile(profileInput);
    const view = cloneDefaultProfile();
    view.basics = { name: profile.basics.name, currentCity: profile.basics.currentCity, currentProvince: profile.basics.currentProvince, currentCountry: profile.basics.currentCountry, currentCompany: profile.basics.currentCompany, currentTitle: profile.basics.currentTitle, yearsOfExperience: profile.basics.yearsOfExperience };
    view.private = {};
    view.eligibility = {};
    view.familyMembers = [];
    view.emergencyContacts = [];
    view.references = [];
    for (const key of ["jobPreferences", "education", "work", "internships", "projects", "research", "campus", "volunteer", "skills", "languages", "certificates", "awards", "publications", "patents", "narratives", "automationPolicy"]) view[key] = profile[key];
    return view;
  }

  function applyAIPlanDecisions(profileInput, planInput, fieldsInput, decisionsInput) {
    const profile = sanitizeProfile(profileInput);
    const plan = Array.isArray(planInput) ? planInput.map((item) => ({ ...item })) : [];
    const fields = new Map((Array.isArray(fieldsInput) ? fieldsInput : []).map((field) => [String(field.fieldId || ""), field]));
    const values = new Map(flattenProfile(profile, { includeSensitive: true }).map((row) => [row.path, row.value]));
    const decisions = Array.isArray(decisionsInput) ? decisionsInput : [];
    for (const decision of decisions.slice(0, 250)) {
      const item = plan.find((entry) => entry.fieldId === String(decision?.fieldId || ""));
      if (!item || ["existing", "unsupported", "filled"].includes(item.status)) continue;
      if (decision?.action === "skip") continue;
      const sourcePath = cleanString(decision?.sourcePath, 300).replace(/\[(\d+)\]/g, ".$1");
      const value = values.get(sourcePath);
      if (!value) continue;
      const field = fields.get(item.fieldId) || {};
      const sourceRecord = sourcePath.match(/^(education|work|internships|projects|research|campus|volunteer)\.(\d+)\./);
      if (sourceRecord && field.repeatKind) {
        const sameCollection = sourceRecord[1] === field.repeatKind;
        const allowedCrossCollection = field.repeatKind === "internships" && sourceRecord[1] === "work" && profile.automationPolicy.allowWorkAsInternship;
        if ((!sameCollection && !allowedCrossCollection) || (Number.isInteger(Number(field.repeatIndex)) && Number(sourceRecord[2]) !== Number(field.repeatIndex))) continue;
      }
      const fieldContext = normalizeText(`${field.section || item.section || ""} ${field.label || item.label || ""}`);
      const workRecord = sourcePath.match(/^work\.(\d+)\./);
      const experienceType = workRecord ? normalizeText(profile.work?.[Number(workRecord[1])]?.experienceType) : "";
      const crossWorkToInternship = Boolean(workRecord && fieldContext.includes("实习") && experienceType !== "实习" && experienceType !== "internship");
      if (crossWorkToInternship && !profile.automationPolicy.allowWorkAsInternship) continue;
      const sensitive = isSensitivePath(sourcePath);
      const confidence = Math.max(REVIEW_CONFIDENCE, Math.min(0.94, Number(decision.confidence) || 0.78));
      const aiReason = cleanString(decision.reason, 260) || "千问根据表单语义给出资料映射建议";
      const reason = crossWorkToInternship
        ? `AI 跨栏目建议：表单未提供工作经历入口，拟把真实工作经历填入实习经历；${aiReason}。请确认该公司的栏目口径。`
        : `AI 语义复核：${aiReason}`;
      const status = sensitive || crossWorkToInternship || confidence < HIGH_CONFIDENCE ? "review" : "ready";
      Object.assign(item, {
        canonicalKey: sourcePath, canonicalLabel: cleanString(decision.sourceLabel, 120) || sourcePath,
        value, confidence, sensitive, status, selected: status === "ready", reason, aiSuggested: true,
        crossCategory: crossWorkToInternship
      });
    }
    return plan;
  }

  function mergeProfilePatch(existingInput, patchInput, options = {}) {
    const existing = sanitizeProfile(existingInput);
    const patch = sanitizeProfile(patchInput);
    const overwrite = Boolean(options.overwrite);
    const recordIdentity = (kind, record) => {
      const primary = normalizeText(record?.[RECORD_PRIMARY_KEYS[kind]]);
      const secondaryKeys = kind === "education" ? ["area", "studyType", "startDate"]
        : kind === "projects" ? ["entity", "role", "startDate"]
          : ["position", "department", "startDate"];
      return [primary, ...secondaryKeys.map((key) => normalizeText(record?.[key]))].filter(Boolean).join("|");
    };
    const mergeCollection = (kind, targetRecords, sourceRecords) => {
      const output = sanitizeRecords(targetRecords, kind);
      for (const incoming of sanitizeRecords(sourceRecords, kind)) {
        const identity = recordIdentity(kind, incoming);
        const primary = normalizeText(incoming?.[RECORD_PRIMARY_KEYS[kind]]);
        let index = identity ? output.findIndex((record) => recordIdentity(kind, record) === identity) : -1;
        if (index < 0 && primary) {
          const samePrimary = output.map((record, candidateIndex) => ({ candidateIndex, primary: normalizeText(record?.[RECORD_PRIMARY_KEYS[kind]]), startDate: normalizeText(record?.startDate) }))
            .filter((item) => item.primary === primary && (!item.startDate || !normalizeText(incoming.startDate) || item.startDate === normalizeText(incoming.startDate)));
          if (samePrimary.length === 1) index = samePrimary[0].candidateIndex;
        }
        if (index < 0) {
          output.push(incoming);
          continue;
        }
        for (const [key, value] of Object.entries(incoming)) {
          if (cleanString(value) && (overwrite || !cleanString(output[index]?.[key]))) output[index][key] = value;
        }
      }
      return output.slice(0, 20);
    };
    const mergeObject = (target, source) => {
      for (const [key, value] of Object.entries(source)) {
        if (key === "schemaVersion" || key === "automationPolicy") continue;
        if (Array.isArray(value)) {
          if (value.length && RECORD_SCHEMAS[key]) target[key] = mergeCollection(key, target[key], value);
        } else if (value && typeof value === "object") {
          if (!target[key] || typeof target[key] !== "object") target[key] = {};
          mergeObject(target[key], value);
        } else if (cleanString(value) && (overwrite || !cleanString(target[key]))) target[key] = value;
      }
    };
    mergeObject(existing, patch);
    return sanitizeProfile(existing);
  }

  function filterProfileByEvidence(profileInput, evidencePathsInput) {
    const source = sanitizeProfile(profileInput);
    const filtered = cloneDefaultProfile();
    const evidencePaths = (Array.isArray(evidencePathsInput) ? evidencePathsInput : [])
      .map((path) => cleanString(path, 300).replace(/\[(\d+)\]/g, ".$1"))
      .filter(Boolean);
    const setPath = (object, path, value) => {
      const keys = path.split(".");
      let cursor = object;
      for (let index = 0; index < keys.length - 1; index += 1) {
        const key = keys[index];
        const nextIsIndex = /^\d+$/.test(keys[index + 1]);
        if (Array.isArray(cursor)) {
          const numericKey = Number(key);
          if (!cursor[numericKey]) cursor[numericKey] = nextIsIndex ? [] : {};
          cursor = cursor[numericKey];
        } else {
          if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = nextIsIndex ? [] : {};
          cursor = cursor[key];
        }
      }
      const finalKey = keys[keys.length - 1];
      if (Array.isArray(cursor)) cursor[Number(finalKey)] = JSON.parse(JSON.stringify(value));
      else cursor[finalKey] = JSON.parse(JSON.stringify(value));
    };
    for (const path of evidencePaths) {
      const value = getPathValue(source, path);
      if (value === undefined || value === null || value === "") continue;
      setPath(filtered, path, value);
    }
    filtered.automationPolicy = cloneDefaultProfile().automationPolicy;
    return sanitizeProfile(filtered);
  }

  function profileCompleteness(profileInput) {
    const profile = sanitizeProfile(profileInput);
    const required = [profile.basics.name, profile.basics.phone, profile.basics.email, profile.basics.currentCity, profile.jobPreferences.expectedRole];
    const optionalGroups = [profile.education.length, profile.work.length + profile.internships.length, profile.projects.length, profile.skills.length, profile.languages.length, profile.certificates.length, profile.narratives.selfEvaluation, profile.jobPreferences.expectedCities];
    const completed = required.filter(Boolean).length + optionalGroups.filter(Boolean).length;
    return { completed, total: required.length + optionalGroups.length, percent: Math.round((completed / (required.length + optionalGroups.length)) * 100) };
  }

  function extractProfileDraftFromResume(textInput, existingInput) {
    const text = String(textInput || "");
    const profile = sanitizeProfile(existingInput);
    const suggestions = [];
    const setIfEmpty = (path, value, source) => {
      const clean = cleanString(value, 2000);
      if (!clean || getPathValue(profile, path)) return;
      const parts = path.split(".");
      let cursor = profile;
      while (parts.length > 1) cursor = cursor[parts.shift()];
      cursor[parts[0]] = clean;
      suggestions.push({ key: path, value: clean, source });
    };
    const matchValue = (pattern) => text.match(pattern)?.[1]?.trim() || "";
    setIfEmpty("basics.name", matchValue(/(?:^|\n)\s*(?:姓名|中文姓名)\s*[:：]\s*([^\n|｜]{2,30})/i), "简历中的姓名标签");
    setIfEmpty("basics.phone", matchValue(/(?:(?:手机|电话|联系方式)\s*[:：]?\s*)?((?:\+?86[-\s]?)?1[3-9]\d{9})/i).replace(/\s|-/g, ""), "手机号格式校验");
    setIfEmpty("basics.email", matchValue(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i), "邮箱格式校验");
    setIfEmpty("basics.url", matchValue(/(?:个人网站|个人主页|作品集|Portfolio)\s*[:：]?\s*(https?:\/\/[^\s|｜]+)/i), "简历中的主页标签");
    setIfEmpty("basics.currentCity", matchValue(/(?:现居住城市|现居城市|所在地)\s*[:：]\s*([^\n|｜,，]{2,30})/i), "简历中的现居城市标签");
    setIfEmpty("jobPreferences.expectedRole", matchValue(/(?:期望职位|求职意向|目标岗位)\s*[:：]\s*([^\n|｜]{2,80})/i), "简历中的求职意向标签");
    setIfEmpty("jobPreferences.expectedCities", matchValue(/(?:期望城市|意向城市|期望工作地点)\s*[:：]\s*([^\n|｜]{2,50})/i), "简历中的期望城市标签");
    setIfEmpty("narratives.selfEvaluation", matchValue(/(?:自我评价|个人总结)\s*[:：]\s*([^\n]{8,1000})/i), "简历中的自我评价标签");
    return { profile, suggestions };
  }

  function parseRecordLines(textInput, kind) {
    const keys = RECORD_SCHEMAS[kind];
    if (!keys) return [];
    return String(textInput || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const values = line.split("|").map((value) => value.trim());
      const record = {};
      keys.forEach((key, index) => { record[key] = values[index] || ""; });
      return record;
    });
  }

  function serializeRecordLines(recordsInput, kind) {
    const keys = RECORD_SCHEMAS[kind];
    if (!keys || !Array.isArray(recordsInput)) return "";
    return recordsInput.map((record) => keys.map((key) => cleanString(record?.[key])).join(" | ").replace(/(?:\s*\|\s*)+$/g, "")).filter(Boolean).join("\n");
  }

  return {
    PROFILE_KEY, PROFILE_SCHEMA_VERSION, HIGH_CONFIDENCE, REVIEW_CONFIDENCE, DEFAULT_PROFILE,
    RECORD_SCHEMAS, FIELD_RULES, cloneDefaultProfile, sanitizeProfile, normalizeText,
    bestRuleForField, buildFillPlan, profileCompleteness, extractProfileDraftFromResume,
    parseRecordLines, serializeRecordLines, flattenProfile, buildAIProfileView,
    applyAIPlanDecisions, mergeProfilePatch, filterProfileByEvidence, getPathValue, isSensitivePath
  };
});
