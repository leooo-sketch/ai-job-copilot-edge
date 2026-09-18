const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const core = require('../autofill-core');

test('education training mode is not inferred from full-time study', () => {
  const fields = ['培养方式', '学科', '是否统招'].map((label, i) => ({ fieldId: String(i), label, section: '教育经历', repeatKind: 'education', repeatIndex: 0 }));
  const plan = core.buildFillPlan({education: [{educationType: '全日制', majorCategory: '管理学'}]}, fields);
  assert.equal(plan[0].canonicalKey, 'education.0.trainingMode');
  assert.equal(plan[0].value, '');
  assert.equal(plan[1].value, '管理学');
  assert.equal(plan[2].value, '');
});

test('legacy Ant dropdown already open stays open and matches degree synonyms', async () => {
  const h = harness('<label>学历<div class="ant-select" aria-expanded="true" aria-controls="degrees"><span class="ant-select-selection-item"></span></div></label><ul id="degrees"><li class="ant-select-dropdown-menu-item">大学本科</li><li class="ant-select-dropdown-menu-item">硕士研究生</li></ul>');
  try {
    const wrapper = h.doc.querySelector('.ant-select');
    let toggles = 0;
    wrapper.onclick = () => { toggles++; h.doc.querySelector('ul').hidden = true; };
    h.doc.querySelectorAll('li').forEach((li) => { li.onclick = () => { wrapper.querySelector('span').textContent = li.textContent; h.doc.querySelector('ul').hidden = true; wrapper.setAttribute('aria-expanded', 'false'); }; });
    const {fields} = await h.message({type: 'AUTOFILL_SCAN_FORM'});
    const {result} = await h.message({type: 'AUTOFILL_APPLY_PLAN', entries: [{fieldId: fields[0].fieldId, value: '本科'}]});
    assert.equal(toggles, 0);
    assert.equal(result.filled, 1, JSON.stringify(result));
    assert.equal(wrapper.querySelector('span').textContent, '大学本科');
  } finally { h.dom.window.close(); }
});

function harness(html) {
  const dom = new JSDOM(`<style>* { opacity: 1; }</style>${html}`, { url: 'https://app.mokahr.com/campus_apply/test', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window;
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    const hidden = this.closest('[hidden], [style*="display: none"]');
    return { top: 0, bottom: hidden ? 0 : 30, left: 0, right: hidden ? 0 : 100, width: hidden ? 0 : 100, height: hidden ? 0 : 30 };
  };
  win.HTMLElement.prototype.scrollIntoView = function () {};
  let listener;
  win.chrome = { runtime: { onMessage: { addListener(fn) { listener = fn; }, removeListener() {} } } };
  win.eval(fs.readFileSync(path.resolve(__dirname, '../autofill-content.js'), 'utf8'));
  return { dom, win, doc: win.document, message: (message) => new Promise((resolve) => listener(message, {}, resolve)) };
}
const input = (label, id, value = '', placeholder = '') => `<div class="form-item"><div class="field-label">${label}*</div><div><input id="${id}" value="${value}" placeholder="${placeholder}"></div><div class="error" role="alert">必填项未填写</div></div>`;
const description = (id) => `<div class="form-item"><div class="field-label">工作职责*</div><div><textarea id="${id}" placeholder="内容" aria-describedby="${id}error"></textarea></div><div id="${id}error" role="alert">必填项未填写</div></div>`;
const select = (id, unit, values) => `<select id="${id}" placeholder="${unit}"><option value="">${unit}</option>${values.map((v, i) => `<option value="internal-${i}">${v}${unit}</option>`).join('')}</select>`;
const range = (prefix) => `<div class="form-item"><div class="field-label">起止时间*</div><div>${select(prefix + 'sy', '年', [2021, 2024, 2025])}${select(prefix + 'sm', '月', [1, 6, 9])}—${select(prefix + 'ey', '年', [2023, 2025, 2027])}${select(prefix + 'em', '月', [6, 8, 9])}</div><div class="error">必填项未填写</div></div>`;

test('flat repeated rows keep dates before company attached to the correct record', async () => {
  const h = harness(`<section><h2>实习经历</h2>${range('a')}${input('公司名称', 'a', '甲公司')}${description('ad')}${range('b')}${input('公司名称', 'b', '乙公司')}${description('bd')}</section>`);
  try {
    const { fields } = await h.message({ type: 'AUTOFILL_SCAN_FORM' });
    assert.ok(fields.slice(0, 6).every((f) => f.repeatIndex === 0));
    assert.ok(fields.slice(6).every((f) => f.repeatIndex === 1), JSON.stringify(fields));
  } finally { h.dom.window.close(); }
});

test('React Select inner search input respects an already selected visible value', async () => {
  const h = harness('<label>学校名称<div class="Select"><div class="Select-control"><span class="Select-value-label">示例大学</span><input id="school"></div></div></label>');
  try {
    const { fields } = await h.message({ type: 'AUTOFILL_SCAN_FORM' });
    assert.equal(fields.length, 1);
    assert.equal(fields[0].currentValue, '示例大学');
    const { result } = await h.message({ type: 'AUTOFILL_APPLY_PLAN', entries: [{fieldId: fields[0].fieldId, value: '另一学校'}] });
    assert.equal(result.skipped, 1);
  } finally { h.dom.window.close(); }
});

test('manual mappings stay local, sensitive values are ready, and work fallbacks remain review-only', () => {
  const profile = { basics: { name: '测试用户' }, private: { gender: '男' }, work: [{ name: '甲', summary: '既有经历概述' }] };
  const field = { fieldId: 'x', label: '称呼', section: '个人信息' };
  const item = core.buildFillPlan(profile, [field])[0];
  assert.equal(core.mapFromProfile(profile, item, field, 'basics.name').value, '测试用户');
  assert.equal(core.mapFromProfile(profile, item, field, 'invented.path'), item);
  assert.equal(core.mapFromProfile(profile, item, field, 'private.gender', true).selected, true);
  assert.notEqual(core.fieldMemoryKey('https://a.test/apply', field), core.fieldMemoryKey('https://b.test/apply', field));
  assert.equal(core.fieldMemoryKey('https://a.test/apply', {...field, repeatKind: 'work'}), '');
  const duty = core.buildFillPlan(profile, [{ fieldId: 'duty', label: '工作职责', section: '工作经历', repeatKind: 'work', repeatIndex: 0 }])[0];
  assert.equal(duty.canonicalKey, 'work.0.summary');
  assert.equal(duty.value, '既有经历概述');
  assert.equal(duty.status, 'review');
  assert.equal(duty.selected, false);
});

test('profile editor preserves every legacy structured field and exposes award/certificate add controls', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../sidepanel.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://fixture.test' });
  try {
    dom.window.JobAutofillCore = core;
    const script = fs.readFileSync(path.resolve(__dirname, '../sidepanel.js'), 'utf8');
    dom.window.eval(script.replace('document.addEventListener("DOMContentLoaded", init);', '') + `
      collectUI();
      const legacy = JobAutofillCore.cloneDefaultProfile();
      for (const [kind, editor] of Object.entries(PROFILE_STRUCTURED_EDITORS)) {
        legacy[kind] = [Object.fromEntries(editor.fields.map(([key]) => [key, key === 'experienceType' ? '工作' : '示例-' + key]))];
      }
      legacy.work[0].experienceType = '工作';
      legacy.internships[0].experienceType = '实习';
      state.profile = legacy;
      hydrateProfileForm();
      window.roundtrip = collectProfileForm();
      window.before = JobAutofillCore.sanitizeProfile(legacy);
    `);
    assert.deepEqual(JSON.parse(JSON.stringify(dom.window.roundtrip)), JSON.parse(JSON.stringify(dom.window.before)));
    for (const kind of ['awards', 'certificates']) assert.ok(dom.window.document.querySelector(`[data-add-record="${kind}"]`));
  } finally { dom.window.close(); }
});

test('Moka-style validation messages, split date ranges and reversed internship cards stay aligned', async () => {
  const h = harness(`<section><h2>实习经历</h2><div class="record-card">${range('b')}${input('公司名称', 'bcompany', '乙公司')}${input('职位名称', 'brole')}${description('bduty')}</div><div class="record-card">${range('a')}${input('公司名称', 'acompany', '甲公司')}${input('职位名称', 'arole')}${description('aduty')}</div></section>`);
  try {
    const profile = { internships: [
      { name: '甲公司', position: '甲职位', startDate: '2021-09', endDate: '2023-08', responsibilities: '甲职责' },
      { name: '乙公司', position: '乙职位', startDate: '2024-09', endDate: '2025-06', responsibilities: '乙职责' }
    ] };
    const { fields } = await h.message({ type: 'AUTOFILL_SCAN_FORM' });
    assert.equal(fields.length, 14);
    assert.ok(fields.every((f) => !/必填项未填写/.test(f.label)), JSON.stringify(fields));
    assert.ok(fields.slice(0, 7).every((f) => f.repeatIndex === 0), JSON.stringify(fields));
    assert.ok(fields.slice(7).every((f) => f.repeatIndex === 1));
    const plan = core.buildFillPlan(profile, fields);
    const item = (id) => plan.find((p) => p.fieldId === fields.find((f) => f.id === id).fieldId);
    assert.equal(item('bduty').canonicalKey, 'internships.1.responsibilities');
    assert.equal(item('brole').status, 'ready');
    assert.equal(item('bsy').value, '2024');
    assert.equal(item('bsm').value, '9');
    assert.equal(item('aey').value, '2023');
    const { result } = await h.message({ type: 'AUTOFILL_APPLY_PLAN', entries: plan.filter((p) => p.selected) });
    assert.equal(result.filled, 12, JSON.stringify(result));
    assert.equal(result.failed, 0);
    assert.equal(h.doc.getElementById('bduty').value, '乙职责');
    assert.equal(h.doc.getElementById('aduty').value, '甲职责');
    assert.equal(h.doc.getElementById('bsy').selectedOptions[0].textContent, '2024年');
  } finally { h.dom.window.close(); }
});

test('awards, certificates and highest-education fields resolve individually', async () => {
  const h = harness(`<section><h2>个人信息</h2>${input('毕业届次', 'cohort')}${input('最高学历学习形式', 'study')}</section><section><h2>获奖经历</h2><div class="record-card">${input('奖项名称', 'award')}<div class="form-item"><label>获奖时间</label>${select('ay', '年', [2024, 2025])}${select('am', '月', [6, 9])}</div></div></section><section><h2>证书</h2>${input('证书名称', 'certificate')}${input('获得时间', 'certDate')}</section>`);
  try {
    const { fields } = await h.message({ type: 'AUTOFILL_SCAN_FORM' });
    const profile = { education: [{ educationLevel: '本科', endDate: '2021-06', educationType: '非全日制' }, { educationLevel: '硕士', endDate: '2027-06', educationType: '全日制' }], awards: [{ title: '示例奖学金', date: '2025-09' }], certificates: [{ name: '示例资格证', date: '2024-06-12' }] };
    const plan = core.buildFillPlan(profile, fields);
    const item = (id) => plan.find((p) => p.fieldId === fields.find((f) => f.id === id).fieldId);
    assert.equal(item('cohort').value, '2027');
    assert.equal(item('study').value, '全日制');
    assert.equal(item('award').value, '示例奖学金');
    assert.equal(item('ay').value, '2025');
    assert.equal(item('am').value, '9');
    assert.equal(item('certificate').value, '示例资格证');
    assert.equal(item('certDate').value, '2024-06-12');
    assert.ok(plan.every((p) => p.status === 'ready'), JSON.stringify(plan));
  } finally { h.dom.window.close(); }
});

test('text reverted by the form is reported as failed, long accepted text is verified in full', async () => {
  const h = harness(`<label>工作职责<textarea id="rejected"></textarea></label><label>项目描述<textarea id="long"></textarea></label>`);
  try {
    h.doc.getElementById('rejected').addEventListener('input', () => setTimeout(() => { h.doc.getElementById('rejected').value = ''; }, 15));
    const { fields } = await h.message({ type: 'AUTOFILL_SCAN_FORM' });
    const longValue = '项目描述'.repeat(150);
    const { result } = await h.message({ type: 'AUTOFILL_APPLY_PLAN', entries: fields.map((f) => ({ fieldId: f.fieldId, value: f.id === 'long' ? longValue : '将被回退' })) });
    assert.equal(result.failed, 1);
    assert.equal(result.filled, 1);
    assert.equal(h.doc.getElementById('long').value, longValue);
  } finally { h.dom.window.close(); }
});

test('custom selects use visible option labels, do not click unrelated menus, and verify rejected selection', async () => {
  const h = harness(`<label>出生月份<div class="moka-select" id="month" tabindex="0" aria-controls="months"><span class="select-value"></span></div></label><div id="months" role="listbox" hidden><div role="option" data-value="0">1月</div><div role="option" data-value="8">9月</div></div><div role="listbox"><div role="option" id="unrelated">9</div></div>`);
  try {
    let unrelatedClicks = 0;
    h.doc.getElementById('unrelated').onclick = () => { unrelatedClicks++; };
    h.doc.getElementById('month').onclick = () => { h.doc.getElementById('months').hidden = false; };
    const { fields } = await h.message({ type: 'AUTOFILL_SCAN_FORM' });
    assert.equal(fields.length, 1);
    let res = await h.message({ type: 'AUTOFILL_APPLY_PLAN', entries: [{ fieldId: fields[0].fieldId, value: '9' }] });
    assert.equal(res.result.failed, 1, 'a click without a retained value is not success');
    h.doc.querySelectorAll('#months [role="option"]').forEach((el) => { el.onclick = () => { h.doc.querySelector('#month .select-value').textContent = el.textContent; h.doc.getElementById('months').hidden = true; }; });
    res = await h.message({ type: 'AUTOFILL_APPLY_PLAN', entries: [{ fieldId: fields[0].fieldId, value: '9' }] });
    assert.equal(res.result.filled, 1, JSON.stringify(res));
    assert.equal(h.doc.querySelector('#month .select-value').textContent, '9月');
    assert.equal(unrelatedClicks, 0);
  } finally { h.dom.window.close(); }
});

test('searchable generic listbox options fill ethnicity and study mode without selecting another menu', async () => {
  const h = harness(`<label>民族<div class="recruit-select" id="ethnicity" tabindex="0" aria-haspopup="listbox" aria-controls="ethnicity-menu"><span class="select-value">请选择</span></div></label>
    <div id="ethnicity-menu" role="listbox" hidden><input placeholder="搜索"><div>汉族</div><div>土家族</div></div>
    <label>最高学历学习形式<div class="recruit-select" id="study" tabindex="0" aria-haspopup="listbox" aria-controls="study-menu"><span class="select-value">请选择</span></div></label>
    <ul id="study-menu" role="listbox" hidden><li>全日制</li><li>非全日制</li></ul>
    <ul role="listbox"><li id="unrelated-option">汉族</li></ul>`);
  try {
    h.doc.getElementById('ethnicity').onclick = () => { h.doc.getElementById('ethnicity-menu').hidden = false; };
    h.doc.getElementById('study').onclick = () => { h.doc.getElementById('study-menu').hidden = false; };
    let unrelatedClicks = 0;
    h.doc.getElementById('unrelated-option').onclick = () => { unrelatedClicks++; };
    for (const id of ['ethnicity-menu', 'study-menu']) {
      h.doc.querySelectorAll(`#${id} > div, #${id} > li`).forEach((option) => {
        option.onclick = () => {
          const wrapper = h.doc.getElementById(id === 'ethnicity-menu' ? 'ethnicity' : 'study');
          wrapper.querySelector('.select-value').textContent = option.textContent;
          h.doc.getElementById(id).hidden = true;
        };
      });
    }
    const { fields } = await h.message({ type: 'AUTOFILL_SCAN_FORM' });
    assert.equal(fields.length, 2, JSON.stringify(fields));
    const profile = { private: { ethnicity: '汉族' }, education: [{ educationType: '全日制', educationLevel: '硕士' }] };
    const plan = core.buildFillPlan(profile, fields);
    assert.equal(plan[0].status, 'ready');
    assert.equal(plan[1].status, 'ready');
    const { result } = await h.message({ type: 'AUTOFILL_APPLY_PLAN', entries: plan.filter((item) => item.selected) });
    assert.equal(result.filled, 2, JSON.stringify(result));
    assert.equal(h.doc.querySelector('#ethnicity .select-value').textContent, '汉族');
    assert.equal(h.doc.querySelector('#study .select-value').textContent, '全日制');
    assert.equal(unrelatedClicks, 0);
  } finally { h.dom.window.close(); }
});

test('popup search filters async choices before selecting a unique saved city', async () => {
  const h = harness(`<label>现居住地<div class="recruit-select" id="city" tabindex="0" aria-controls="city-menu"><span class="select-value">请选择</span></div></label>
    <div id="city-menu" role="listbox" hidden><input placeholder="搜索城市"><div id="initial-option">北京</div></div>`);
  try {
    h.doc.getElementById('city').onclick = () => { h.doc.getElementById('city-menu').hidden = false; };
    h.doc.querySelector('#city-menu input').addEventListener('input', () => setTimeout(() => {
      const city = h.doc.createElement('div');
      city.textContent = '厦门';
      city.onclick = () => {
        h.doc.querySelector('#city .select-value').textContent = city.textContent;
        h.doc.getElementById('city-menu').hidden = true;
      };
      h.doc.getElementById('city-menu').append(city);
    }, 80));
    const { fields } = await h.message({ type: 'AUTOFILL_SCAN_FORM' });
    const plan = core.buildFillPlan({ basics: { currentCity: '厦门' } }, fields);
    assert.equal(plan[0].status, 'ready', JSON.stringify(plan));
    const { result } = await h.message({ type: 'AUTOFILL_APPLY_PLAN', entries: [{ fieldId: fields[0].fieldId, value: plan[0].value }] });
    assert.equal(result.filled, 1, JSON.stringify(result));
    assert.equal(h.doc.querySelector('#city .select-value').textContent, '厦门');
  } finally { h.dom.window.close(); }
});

test('readonly select input with arrow and portal listbox retains the chosen value', async () => {
  const h = harness(`<label>民族<div id="ethnic-control"><input id="ethnic-input" readonly placeholder="请选择"><svg></svg><span class="select-value"></span></div></label>
    <div id="ethnic-popup" role="listbox" hidden><div>汉族</div><div>土家族</div></div>`);
  try {
    h.doc.getElementById('ethnic-input').onclick = () => { h.doc.getElementById('ethnic-popup').hidden = false; };
    h.doc.querySelectorAll('#ethnic-popup > div').forEach((option) => {
      option.onclick = () => {
        h.doc.querySelector('#ethnic-control .select-value').textContent = option.textContent;
        h.doc.getElementById('ethnic-popup').hidden = true;
      };
    });
    const { fields } = await h.message({ type: 'AUTOFILL_SCAN_FORM' });
    assert.equal(fields.length, 1, JSON.stringify(fields));
    assert.equal(fields[0].customSelect, true);
    const { result } = await h.message({ type: 'AUTOFILL_APPLY_PLAN', entries: [{ fieldId: fields[0].fieldId, value: '汉族' }] });
    assert.equal(result.filled, 1, JSON.stringify(result));
  } finally { h.dom.window.close(); }
});

test('screenshot location labels map only to existing profile fields', () => {
  const fields = [
    { fieldId: 'city', label: '现居住地', section: '个人信息' },
    { fieldId: 'school-city', label: '最高学历院校地点', section: '个人信息' },
    { fieldId: 'unknown', label: '最高学历院校地点', section: '个人信息' }
  ];
  const plan = core.buildFillPlan({ basics: { currentCity: '厦门' }, education: [{ institution: '甲校', city: '北京', educationLevel: '本科' }, { institution: '乙校', city: '上海', educationLevel: '硕士' }] }, fields);
  assert.equal(plan[0].value, '厦门');
  assert.equal(plan[1].value, '上海');
  assert.equal(plan[1].canonicalKey, 'education.1.city');
  assert.equal(plan[2].value, '上海');
  const missing = core.buildFillPlan({ education: [{ educationLevel: '硕士' }] }, [fields[1]])[0];
  assert.equal(missing.status, 'missing');
  assert.equal(missing.selected, false);
  const study = core.buildFillPlan({ education: [{ educationLevel: '本科', educationType: '非全日制' }, { educationLevel: '硕士', educationType: '全日制' }] }, [{ fieldId: 'study', label: '学习形式', section: '个人信息' }])[0];
  assert.equal(study.value, '全日制');
  assert.equal(study.canonicalKey, 'education.1.educationType');
});

test('work fallback keeps employment identity and the AI cannot replace reliable or split-date mappings', () => {
  const profile = { work: [{ name: '甲公司', position: '甲职位' }, { name: '乙公司', position: '乙职位', startDate: '2024-09' }], internships: [] };
  const fields = [
    { fieldId: 'name', label: '公司名称', section: '实习经历', repeatKind: 'internships', repeatIndex: 0, currentValue: '乙公司' },
    { fieldId: 'position', label: '职位名称', section: '实习经历', repeatKind: 'internships', repeatIndex: 0 },
    { fieldId: 'month', label: '开始时间', section: '实习经历', repeatKind: 'internships', repeatIndex: 0, datePart: 'month' }
  ];
  const plan = core.buildFillPlan(profile, fields);
  assert.equal(plan[1].canonicalKey, 'work.1.position');
  assert.equal(plan[1].status, 'review');
  assert.equal(plan[2].value, '9');
  const revised = core.applyAIPlanDecisions(profile, plan, fields, [{ fieldId: 'month', action: 'map', sourcePath: 'work.1.startDate', confidence: .93 }]);
  assert.equal(revised[2].value, '9');
  assert.equal(revised[2].status, 'review');
});
