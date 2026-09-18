const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const core = require('../autofill-core');

const root = path.resolve(__dirname, '..');

test('v3 local profiles migrate without losing existing answers or inventing new ones', () => {
  const migrated = core.sanitizeProfile({
    schemaVersion: 3,
    basics: { name: '测试用户', address: '原有通讯地址' },
    private: { birthDate: '2000-01-01' },
    education: [{ institution: '示例大学', score: '3.8' }],
    internships: [{ name: '示例公司', position: '产品实习生' }],
    emergencyContacts: [{ name: '联系人', phone: '13800000000' }]
  });
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.basics.address, '原有通讯地址');
  assert.equal(migrated.private.birthDate, '2000-01-01');
  assert.equal(migrated.education[0].score, '3.8');
  assert.equal(migrated.internships[0].position, '产品实习生');
  assert.equal(migrated.private.age, '');
  assert.equal(migrated.basics.currentAddress, '');
  assert.equal(migrated.basics.hometown, '');
  assert.equal(migrated.private.emergencyPhone, '');
  assert.equal(migrated.emergencyContacts[0].phone, '13800000000');
});

test('new basic-information controls save and reload alongside old profile fields', () => {
  const html = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://fixture.test' });
  try {
    dom.window.JobAutofillCore = core;
    dom.window.eval(script.replace('document.addEventListener("DOMContentLoaded", init);', '') + `
      collectUI();
      state.profile = JobAutofillCore.sanitizeProfile({basics: {name: '原姓名', address: '原通讯地址'}});
      hydrateProfileForm();
      window.originalName = ui.profileNameInput.value;
      window.originalAddress = ui.profileAddressInput.value;
      ui.profileAgeInput.value = '27';
      ui.profileHometownInput.value = '示例家乡';
      ui.profileCurrentAddressInput.value = '示例现居地址';
      ui.profileProfessionalQualificationsInput.value = '示例资格';
      ui.profileApplicationMethodInput.value = '校园招聘';
      ui.profileFriendOrRelativeAtCompanyInput.value = '否';
      ui.profilePersonalityAssessmentInput.value = '仅测试';
      window.saved = collectProfileForm();
      state.profile = window.saved;
      hydrateProfileForm();
      window.reloadedAge = ui.profileAgeInput.value;
    `);
    assert.equal(dom.window.originalName, '原姓名');
    assert.equal(dom.window.originalAddress, '原通讯地址');
    const saved = dom.window.saved;
    assert.equal(saved.basics.name, '原姓名');
    assert.equal(saved.basics.address, '原通讯地址');
    assert.equal(saved.basics.hometown, '示例家乡');
    assert.equal(saved.basics.currentAddress, '示例现居地址');
    assert.equal(saved.basics.professionalQualifications, '示例资格');
    assert.equal(saved.jobPreferences.applicationMethod, '校园招聘');
    assert.equal(saved.eligibility.friendOrRelativeAtCompany, '否');
    assert.equal(saved.private.personalityAssessment, '仅测试');
    assert.equal(dom.window.reloadedAge, '27');
  } finally { dom.window.close(); }
});

test('fields visible in the supplied forms map to distinct saved basic answers', () => {
  const profile = {
    basics: {
      hometown: '示例家乡', currentAddress: '示例现居地址', countryRegion: '中国',
      professionalQualifications: '示例职业资格', portfolioUrl: 'https://example.com/work'
    },
    private: { age: '27', personalityAssessment: '示例测评', emergencyPhone: '13800000000' },
    jobPreferences: { expectedSalaryText: '面议', applicationMethod: '校园招聘', source: '校园宣讲' },
    eligibility: { friendOrRelativeAtCompany: '否', plansPostgraduateExam: '否', hasAcademicAdvisor: '是' }
  };
  const cases = [
    ['年龄', 'private.age', '27'], ['家乡', 'basics.hometown', '示例家乡'],
    ['现居住地址', 'basics.currentAddress', '示例现居地址'], ['国家/地区', 'basics.countryRegion', '中国'],
    ['职称/职业资格证书', 'basics.professionalQualifications', '示例职业资格'],
    ['作品链接', 'basics.portfolioUrl', 'https://example.com/work'],
    ['期望薪资', 'jobPreferences.expectedSalaryText', '面议'],
    ['求职方式', 'jobPreferences.applicationMethod', '校园招聘'],
    ['了解集团的途径', 'jobPreferences.source', '校园宣讲'],
    ['MBTI或PDP性格测评结果', 'private.personalityAssessment', '示例测评'],
    ['紧急联系电话', 'private.emergencyPhone', '13800000000'],
    ['是否有亲友在公司任职', 'eligibility.friendOrRelativeAtCompany', '否'],
    ['是否准备考研', 'eligibility.plansPostgraduateExam', '否'],
    ['是否有导师', 'eligibility.hasAcademicAdvisor', '是']
  ];
  for (const [label, sourcePath, value] of cases) {
    const item = core.buildFillPlan(profile, [{ fieldId: label, label, section: '个人信息' }])[0];
    assert.equal(item.canonicalKey, sourcePath, label);
    assert.equal(item.value, value, label);
    assert.equal(item.status, 'ready', label);
  }
});

test('highest-education and internship-specific fields do not collapse into general contacts', () => {
  const profile = {
    education: [
      { educationLevel: '本科', score: '3.1', scoreScale: '4.0', endDate: '2022-06' },
      { educationLevel: '硕士', score: '3.8', scoreScale: '4.0', endDate: '2027-06' }
    ],
    internships: [{ name: '示例公司', reportingTo: '产品总监', referenceName: '示例证明人', referenceContact: '13800000000', responsibilities: '示例职责' }],
    emergencyContacts: [{ name: '联系人', phone: '13900000000' }]
  };
  const personal = [
    ['平均绩点或成绩', 'education.1.score', '3.8'],
    ['满分绩点或成绩', 'education.1.scoreScale', '4.0'],
    ['毕业时间', 'education.1.endDate', '2027-06'],
    ['紧急联系电话', 'emergencyContacts.0.phone', '13900000000']
  ];
  for (const [label, sourcePath, value] of personal) {
    const item = core.buildFillPlan(profile, [{ fieldId: label, label, section: '个人信息' }])[0];
    assert.equal(item.canonicalKey, sourcePath, label);
    assert.equal(item.value, value, label);
  }
  for (const [label, sourceKey] of [['职位汇报（给谁）', 'reportingTo'], ['证明人姓名', 'referenceName'], ['证明人联系方式', 'referenceContact'], ['工作描述', 'responsibilities']]) {
    const item = core.buildFillPlan(profile, [{ fieldId: label, label, section: '实习经历', repeatKind: 'internships', repeatIndex: 0 }])[0];
    assert.equal(item.canonicalKey, `internships.0.${sourceKey}`, label);
    assert.equal(item.status, 'ready', label);
  }
});
