const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

test("manifest is a scoped Edge Manifest V3 side-panel extension", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel.default_path, "sidepanel.html");
  assert.ok(manifest.permissions.includes("sidePanel"));
  assert.ok(manifest.permissions.includes("storage"));
  assert.ok(!manifest.host_permissions.includes("<all_urls>"));
  assert.ok(manifest.content_scripts[0].matches.every((match) => /zhipin|liepin|zhaopin/.test(match)));
});

test("all extension JavaScript parses", () => {
  for (const file of ["service-worker.js", "content-script.js", "sidepanel.js"]) {
    const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test("site content is rendered without unsafe HTML injection", () => {
  const panelScript = fs.readFileSync(path.join(root, "sidepanel.js"), "utf8");
  assert.doesNotMatch(panelScript, /\.innerHTML\s*=/);
  assert.doesNotMatch(panelScript, /\beval\s*\(/);
  assert.match(panelScript, /textContent\s*=/);
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
    console
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
