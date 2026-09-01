(function installReliableAutofillAgent() {
  "use strict";

  if (globalThis.__JOB_AUTOFILL_AGENT__?.version === 2) return;

  const state = {
    version: 2,
    fieldMap: new Map(),
    lastScanAt: 0
  };
  globalThis.__JOB_AUTOFILL_AGENT__ = state;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "AUTOFILL_PREPARE_REPEAT_SECTIONS") {
      prepareRepeatSections(message.desiredCounts).then(
        (result) => sendResponse({ ok: true, result }),
        (error) => sendResponse({ ok: false, error: cleanError(error) })
      );
      return true;
    }

    if (message?.type === "AUTOFILL_SCAN_FORM") {
      try {
        const fields = scanFields();
        sendResponse({ ok: true, fields, pageUrl: location.href, title: document.title });
      } catch (error) {
        sendResponse({ ok: false, error: cleanError(error) });
      }
      return false;
    }

    if (message?.type === "AUTOFILL_APPLY_PLAN") {
      applyPlan(message.entries).then(
        (result) => sendResponse({ ok: true, result }),
        (error) => sendResponse({ ok: false, error: cleanError(error) })
      );
      return true;
    }

    if (message?.type === "AUTOFILL_FOCUS_FIELD") {
      const target = state.fieldMap.get(String(message.fieldId || ""));
      const element = target?.element || target?.elements?.[0];
      if (!element?.isConnected) {
        sendResponse({ ok: false, error: "字段已失效，请重新扫描页面" });
        return false;
      }
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      element.focus({ preventScroll: true });
      flashElement(element);
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  function scanFields() {
    const elements = collectFormElements().slice(0, 300);
    const fields = [];
    const handledRadioNames = new Set();
    state.fieldMap = new Map();

    for (const element of elements) {
      const type = String(element.getAttribute("type") || element.type || "").toLowerCase();
      if (type === "radio" && element.name) {
        if (handledRadioNames.has(element.name)) continue;
        handledRadioNames.add(element.name);
        const group = elements.filter((candidate) => candidate instanceof HTMLInputElement && candidate.type === "radio" && candidate.name === element.name);
        fields.push(describeRadioGroup(group, fields.length));
        continue;
      }
      fields.push(describeElement(element, fields.length));
    }
    annotateRepeatGroups(fields);
    state.lastScanAt = Date.now();
    return fields;
  }

  function annotateRepeatGroups(fields) {
    const currentIndex = { education: -1, work: -1, internships: -1, projects: -1 };
    for (const field of fields) {
      const kind = inferRepeatKind(field);
      if (!kind) continue;
      if (isRepeatAnchor(field, kind)) currentIndex[kind] += 1;
      if (currentIndex[kind] < 0) currentIndex[kind] = 0;
      field.repeatKind = kind;
      field.repeatIndex = currentIndex[kind];
    }
  }

  function inferRepeatKind(field) {
    const label = compactText(field.label || field.placeholder).toLowerCase();
    const section = compactText(field.section).toLowerCase();
    const context = `${section} ${label}`;
    if (/(?:项目经历|项目经验|项目介绍|project)/i.test(context)) return "projects";
    if (/(?:实习经历|实习经验|internship)/i.test(context)) return "internships";
    if (/(?:教育信息|教育经历|教育背景|education)/i.test(context)) return "education";
    if (/(?:工作经历|工作经验|任职经历|职业经历|work experience|employment)/i.test(context)) return "work";
    return "";
  }

  function isRepeatAnchor(field, kind) {
    const label = compactText(field.label || field.placeholder).toLowerCase();
    if (kind === "education") return /(?:学校全称|学校名称|院校名称|毕业院校|institution|university)/i.test(label);
    if (kind === "projects") return /(?:项目名称|项目名|项目标题|project name|project title)/i.test(label);
    if (kind === "internships") return /(?:实习单位|实习公司|工作单位|公司名称|单位名称|company|employer)/i.test(label);
    if (kind === "work") return /(?:工作单位|公司全称|公司名称|任职单位|雇主|company|employer)/i.test(label);
    return false;
  }

  function collectFormElements() {
    const selector = [
      "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image'])",
      "textarea",
      "select",
      "[contenteditable='true']",
      "[role='combobox']",
      ".ant-select:not(.ant-select-disabled)",
      ".el-select:not(.is-disabled)",
      ".arco-select-view:not(.arco-select-view-disabled)",
      ".semi-select:not(.semi-select-disabled)",
      ".ivu-select:not(.ivu-select-disabled)",
      "[aria-haspopup='listbox'][class*='select']"
    ].join(",");
    const roots = [document];
    const found = new Set();
    const output = [];

    for (let rootIndex = 0; rootIndex < roots.length; rootIndex += 1) {
      const root = roots[rootIndex];
      for (const element of root.querySelectorAll(selector)) {
        if (found.has(element) || !isUsableElement(element)) continue;
        if (isFrameworkSelectWrapper(element)) {
          const usableInnerControl = [...element.querySelectorAll("input, [role='combobox']")].find((candidate) => isUsableElement(candidate));
          if (usableInnerControl) continue;
        } else {
          const wrapper = element.closest(".ant-select, .el-select, .arco-select-view, .semi-select, .ivu-select, [aria-haspopup='listbox'][class*='select']");
          if (wrapper && found.has(wrapper)) continue;
        }
        found.add(element);
        output.push(element);
      }
      for (const host of root.querySelectorAll("*")) {
        if (host.shadowRoot) roots.push(host.shadowRoot);
      }
    }

    return output.sort((left, right) => {
      const a = left.getBoundingClientRect();
      const b = right.getBoundingClientRect();
      return Math.abs(a.top - b.top) < 8 ? a.left - b.left : a.top - b.top;
    });
  }

  async function prepareRepeatSections(desiredCountsInput) {
    const desiredCounts = {
      education: clampRepeatCount(desiredCountsInput?.education),
      work: clampRepeatCount(desiredCountsInput?.work),
      internships: clampRepeatCount(desiredCountsInput?.internships),
      projects: clampRepeatCount(desiredCountsInput?.projects)
    };
    const added = { education: 0, work: 0, internships: 0, projects: 0 };
    const existing = {};
    const warnings = [];

    for (const kind of ["education", "work", "internships", "projects"]) {
      existing[kind] = countExistingRecords(kind);
      let needed = Math.max(0, desiredCounts[kind] - existing[kind]);
      while (needed > 0) {
        const control = findRepeatAddControl(kind);
        if (!control) {
          if (desiredCounts[kind] > existing[kind]) warnings.push(`${repeatKindLabel(kind)}仍缺少 ${needed} 个输入卡片，未找到可靠的“添加”按钮`);
          break;
        }
        const before = countExistingRecords(kind);
        safeClickAddControl(control);
        await wait(280);
        const after = countExistingRecords(kind);
        if (after <= before) {
          warnings.push(`已点击“${compactText(control.textContent)}”，但没有检测到新的${repeatKindLabel(kind)}输入框`);
          break;
        }
        const growth = Math.max(1, after - before);
        added[kind] += growth;
        existing[kind] = after;
        needed = Math.max(0, desiredCounts[kind] - after);
      }
    }
    return { desiredCounts, existing, added, warnings };
  }

  function clampRepeatCount(value) {
    const number = Number(value) || 0;
    return Math.max(0, Math.min(10, Math.floor(number)));
  }

  function repeatKindLabel(kind) {
    return ({ education: "教育经历", work: "工作经历", internships: "实习经历", projects: "项目经历" })[kind] || kind;
  }

  function deepQueryAll(selector) {
    const roots = [document];
    const output = [];
    const seen = new Set();
    for (let index = 0; index < roots.length; index += 1) {
      const root = roots[index];
      for (const element of root.querySelectorAll(selector)) {
        if (!seen.has(element)) {
          seen.add(element);
          output.push(element);
        }
      }
      for (const host of root.querySelectorAll("*")) if (host.shadowRoot) roots.push(host.shadowRoot);
    }
    return output;
  }

  function findRepeatAddControl(kind) {
    const candidates = deepQueryAll("button, a, [role='button']").filter((element) => isUsableElement(element));
    return candidates.find((element) => classifyRepeatAddControl(element) === kind) || null;
  }

  function classifyRepeatAddControl(element) {
    const directText = compactText(element.textContent || element.getAttribute("aria-label") || element.getAttribute("title"));
    const context = compactText(`${directText} ${findSection(element)}`).toLowerCase();
    if (!/(?:添加|新增|增加|继续添加|新建|add)/i.test(context)) return "";
    if (/(?:删除|移除|保存|提交|投递|确认|取消|delete|remove|save|submit)/i.test(directText)) return "";
    if (/(?:实习经历|实习经验|internship)/i.test(context)) return "internships";
    if (/(?:项目经历|项目经验|项目介绍|projects?)/i.test(context)) return "projects";
    if (/(?:教育信息|教育经历|教育背景|学习经历|education)/i.test(context)) return "education";
    if (/(?:工作经历|工作经验|任职经历|职业经历|work experience|employment)/i.test(context)) return "work";
    return "";
  }

  function countExistingRecords(kind) {
    const elements = collectFormElements();
    const anchors = elements.filter((element) => {
      const label = compactText(findFieldLabel(element)).toLowerCase();
      const section = compactText(findSection(element)).toLowerCase();
      if (kind === "education") return /(?:学校全称|学校名称|院校名称|毕业院校|institution|university)/i.test(label) && /(?:教育|education)/i.test(`${section} ${label}`);
      if (kind === "projects") return /(?:项目名称|项目名|项目标题|project name|project title)/i.test(label);
      if (kind === "internships") return /(?:实习|internship)/i.test(section) && /(?:工作单位|实习单位|实习公司|公司名称|单位名称|company|employer)/i.test(label);
      if (kind === "work") return !/(?:实习|internship)/i.test(section) && /(?:工作单位|公司全称|公司名称|任职单位|雇主|company|employer)/i.test(label) && /(?:工作|任职|职业|work|employment)/i.test(`${section} ${label}`);
      return false;
    });
    return anchors.length;
  }

  function safeClickAddControl(element) {
    const form = element.closest("form");
    const preventSubmit = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    if (form) form.addEventListener("submit", preventSubmit, { capture: true, once: true });
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    element.click();
    if (form) setTimeout(() => form.removeEventListener("submit", preventSubmit, { capture: true }), 120);
  }

  function isUsableElement(element) {
    if (!(element instanceof HTMLElement)) return false;
    const type = String(element.getAttribute("type") || "").toLowerCase();
    if (type === "password") return false;
    if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    if ((rect.width <= 0 || rect.height <= 0) && type !== "file") return false;
    return true;
  }

  function describeRadioGroup(elements, index) {
    const first = elements[0];
    const fieldId = makeFieldId(index);
    const label = findFieldLabel(first);
    const options = elements.map((element) => ({
      value: element.value,
      label: findDirectLabel(element) || element.value
    }));
    state.fieldMap.set(fieldId, { kind: "radio", elements });
    return {
      fieldId,
      label,
      placeholder: "",
      name: first.name || "",
      id: first.id || "",
      ariaLabel: first.getAttribute("aria-label") || "",
      autocomplete: first.autocomplete || "",
      section: findSection(first),
      tag: "input",
      type: "radio",
      inputMode: "choice",
      options,
      currentValue: elements.find((element) => element.checked)?.value || "",
      required: elements.some((element) => element.required || element.getAttribute("aria-required") === "true"),
      customSelect: false,
      unsupported: false
    };
  }

  function describeElement(element, index) {
    const fieldId = makeFieldId(index);
    const tag = element.tagName.toLowerCase();
    const rawType = String(element.getAttribute("type") || element.type || tag).toLowerCase();
    const customSelect = isCustomSelect(element);
    const dateLike = isDateLikeElement(element);
    const type = customSelect ? "select" : dateLike ? "date" : rawType;
    const isFile = rawType === "file";
    const isReadonly = Boolean(element.readOnly || element.getAttribute("aria-readonly") === "true");
    const options = tag === "select"
      ? [...element.options].filter((option) => !option.disabled).map((option) => ({ value: option.value, label: option.textContent?.trim() || option.value }))
      : [];

    state.fieldMap.set(fieldId, { kind: customSelect ? "custom-select" : dateLike ? "date-like" : tag, element });
    return {
      fieldId,
      label: findFieldLabel(element),
      placeholder: element.getAttribute("placeholder") || "",
      name: element.getAttribute("name") || "",
      id: element.id || "",
      ariaLabel: element.getAttribute("aria-label") || "",
      autocomplete: element.getAttribute("autocomplete") || "",
      section: findSection(element),
      tag,
      type,
      inputMode: customSelect || tag === "select" ? "choice" : "text",
      options,
      currentValue: readCurrentValue(element),
      required: Boolean(element.required || element.getAttribute("aria-required") === "true" || findRequiredMarker(element)),
      customSelect,
      unsupported: isFile || (isReadonly && !customSelect && !dateLike),
      unsupportedReason: isFile ? "浏览器禁止扩展自动选择本地附件，请手动上传" : isReadonly && !customSelect && !dateLike ? "只读字段需要手动处理" : ""
    };
  }

  function makeFieldId(index) {
    return `field-${Date.now().toString(36)}-${index}`;
  }

  function findDirectLabel(element) {
    const labels = element.labels ? [...element.labels] : [];
    const explicit = labels.map((label) => stripControlText(label, element)).find(Boolean);
    if (explicit) return explicit;
    if (element.id) {
      const label = document.querySelector(`label[for="${cssEscape(element.id)}"]`);
      if (label) return compactText(label.textContent);
    }
    const wrapped = element.closest("label");
    return wrapped ? stripControlText(wrapped, element) : "";
  }

  function findFieldLabel(element) {
    const direct = findDirectLabel(element);
    if (direct) return direct;
    const ariaLabelledBy = element.getAttribute("aria-labelledby");
    if (ariaLabelledBy) {
      const text = ariaLabelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ");
      if (compactText(text)) return compactText(text);
    }
    const aria = compactText(element.getAttribute("aria-label"));
    if (aria) return aria;

    let current = element.parentElement;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      const selectors = [
        ":scope > label",
        ":scope > .el-form-item__label",
        ":scope > * > .el-form-item__label",
        ":scope > .ant-form-item-label",
        ":scope > * > .ant-form-item-label",
        ":scope > [class*='form-label']",
        ":scope > [class*='field-label']"
      ];
      for (const selector of selectors) {
        let candidate = null;
        try { candidate = current.querySelector(selector); } catch (_) {}
        const text = compactText(candidate?.textContent);
        if (text && text.length <= 120) return text;
      }
      const previous = element.previousElementSibling;
      const previousText = compactText(previous?.textContent);
      if (previousText && previousText.length <= 80) return previousText;
    }
    return compactText(element.getAttribute("placeholder") || element.getAttribute("name") || element.id);
  }

  function findSection(element) {
    const fieldset = element.closest("fieldset");
    const legend = compactText(fieldset?.querySelector(":scope > legend")?.textContent);
    if (legend) return legend;
    let current = element.parentElement;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const headingSelectors = [
        ":scope > h1", ":scope > h2", ":scope > h3", ":scope > h4",
        ":scope > [class*='section-title']", ":scope > [class*='module-title']",
        ":scope > [class*='section'] > [class*='title']", ":scope > [class*='header'] [class*='title']",
        ":scope > * > h1", ":scope > * > h2", ":scope > * > h3", ":scope > * > h4"
      ];
      for (const selector of headingSelectors) {
        let heading = null;
        try { heading = current.querySelector(selector); } catch (_) {}
        const text = compactText(heading?.textContent);
        if (isLikelySectionHeading(text)) return text;
      }
      let previous = current.previousElementSibling;
      for (let steps = 0; previous && steps < 3; steps += 1, previous = previous.previousElementSibling) {
        const previousText = compactText(previous.textContent);
        if (/^H[1-4]$/.test(previous.tagName) && previousText) return previousText;
        if (isLikelySectionHeading(previousText)) return previousText;
      }
    }
    return "";
  }

  function isLikelySectionHeading(text) {
    if (!text || text.length > 100) return false;
    return /(?:个人信息|基本信息|投递意向|求职意向|教育信息|教育经历|教育背景|技能信息|技能|校园经历|社团经历|实习经历|实习经验|工作经历|工作经验|任职经历|项目经历|项目经验|科研经历|志愿经历|自我评价|作品上传|语言|证书|奖励|联系人|education|work experience|employment|internship|project)/i.test(text);
  }

  function findRequiredMarker(element) {
    const container = element.closest(".el-form-item, .ant-form-item, [class*='form-item'], [class*='field']");
    const text = compactText(container?.querySelector("label, [class*='label']")?.textContent);
    return /^[*＊]|[*＊]$/.test(text);
  }

  function stripControlText(container, control) {
    const clone = container.cloneNode(true);
    const selector = control.tagName.toLowerCase();
    clone.querySelectorAll(`${selector}, input, select, textarea, button`).forEach((node) => node.remove());
    return compactText(clone.textContent);
  }

  function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").replace(/^[*＊\s]+|[*＊\s]+$/g, "").trim().slice(0, 300);
  }

  function cssEscape(value) {
    if (globalThis.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function isCustomSelect(element) {
    if (element.tagName === "SELECT") return false;
    if (isFrameworkSelectWrapper(element)) return true;
    if (element.getAttribute("role") === "combobox") return true;
    if (!(element instanceof HTMLInputElement) || !element.readOnly) return false;
    const ancestor = element.closest("[class*='select'], [role='combobox']");
    return Boolean(ancestor);
  }

  function isFrameworkSelectWrapper(element) {
    if (!(element instanceof HTMLElement)) return false;
    return element.matches(".ant-select, .el-select, .arco-select-view, .semi-select, .ivu-select, [aria-haspopup='listbox'][class*='select']");
  }

  function isDateLikeElement(element) {
    if (!(element instanceof HTMLInputElement)) return false;
    if (["date", "month", "datetime-local"].includes(element.type)) return true;
    const context = compactText(`${element.getAttribute("placeholder") || ""} ${element.name || ""} ${element.id || ""} ${element.getAttribute("aria-label") || ""}`).toLowerCase();
    return Boolean(element.closest("[class*='date'], [class*='picker'], [class*='calendar']")) || /(?:日期|时间|年月|date|time|year|month)/i.test(context);
  }

  function readCurrentValue(element) {
    if (element instanceof HTMLInputElement && element.type === "checkbox") return element.checked ? "true" : "";
    if (element.isContentEditable) return compactText(element.textContent);
    if (isFrameworkSelectWrapper(element) || element.getAttribute("role") === "combobox") {
      const selected = element.querySelector(".ant-select-selection-item, .el-select__selected-item, .arco-select-view-value, .semi-select-selection-text, .ivu-select-selected-value, [data-value]:not(input)");
      const value = compactText(selected?.getAttribute("data-value") || selected?.textContent || element.getAttribute("data-value") || "");
      return /^(?:请选择|select)$/i.test(value) ? "" : value;
    }
    return compactText(element.value || element.getAttribute("data-value") || "");
  }

  async function applyPlan(entriesInput) {
    const entries = Array.isArray(entriesInput) ? entriesInput.slice(0, 200) : [];
    const results = [];
    for (const entry of entries) {
      const target = state.fieldMap.get(String(entry.fieldId || ""));
      if (!target) {
        results.push(result(entry, "missing", "字段已变化，请重新扫描"));
        continue;
      }
      const element = target.element || target.elements?.[0];
      if (!element?.isConnected) {
        results.push(result(entry, "missing", "字段已从页面移除"));
        continue;
      }
      if (readTargetValue(target)) {
        results.push(result(entry, "skipped", "检测到已有内容，未覆盖"));
        continue;
      }
      try {
        const applied = await fillTarget(target, String(entry.value || ""));
        results.push(result(entry, applied.ok ? "filled" : "failed", applied.message));
      } catch (error) {
        results.push(result(entry, "failed", cleanError(error)));
      }
    }
    return {
      results,
      filled: results.filter((item) => item.status === "filled").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      failed: results.filter((item) => ["failed", "missing"].includes(item.status)).length
    };
  }

  function result(entry, status, message) {
    return { fieldId: String(entry.fieldId || ""), status, message };
  }

  function readTargetValue(target) {
    if (target.kind === "radio") return target.elements.find((element) => element.checked)?.value || "";
    return readCurrentValue(target.element);
  }

  async function fillTarget(target, value) {
    if (!value) return { ok: false, message: "资料值为空" };
    if (target.kind === "radio") return fillRadio(target.elements, value);
    if (target.kind === "custom-select") return fillCustomSelect(target.element, value);
    if (target.element instanceof HTMLSelectElement) return fillNativeSelect(target.element, value);
    if (target.element instanceof HTMLInputElement && target.element.type === "checkbox") return fillCheckbox(target.element, value);
    return fillTextLike(target.element, value, target.kind === "date-like");
  }

  function fillTextLike(element, rawValue, dateLike = false) {
    const value = normalizeValueForElement(element, rawValue, dateLike);
    element.focus({ preventScroll: true });
    if (element.isContentEditable) {
      element.replaceChildren(document.createTextNode(value));
    } else {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (setter) setter.call(element, value);
      else element.value = value;
    }
    dispatchValueEvents(element, value);
    element.blur();
    flashElement(element);
    return { ok: readCurrentValue(element) !== "", message: "已填写并触发网页校验事件" };
  }

  function normalizeValueForElement(element, value, dateLike = false) {
    if (!(element instanceof HTMLInputElement)) return value;
    if (element.type === "date" || dateLike && element.type === "date") {
      const match = value.match(/(\d{4})[年\-/\.](\d{1,2})[月\-/\.]?(\d{1,2})?/);
      if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${String(match[3] || "1").padStart(2, "0")}`;
    }
    if (element.type === "number") return value.replace(/[^\d.\-]/g, "");
    return value;
  }

  function dispatchValueEvents(element, value) {
    try {
      element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: value }));
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    } catch (_) {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function fillNativeSelect(element, value) {
    const option = chooseOption([...element.options].filter((item) => !item.disabled), value, (item) => `${item.textContent || ""}|${item.value}`);
    if (!option) return { ok: false, message: "下拉选项中没有唯一匹配项，请手动选择" };
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(element, option.value);
    else element.value = option.value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    flashElement(element);
    return { ok: true, message: `已选择“${compactText(option.textContent)}”` };
  }

  function fillRadio(elements, value) {
    const option = chooseOption(elements, value, (element) => `${findDirectLabel(element)}|${element.value}`);
    if (!option) return { ok: false, message: "单选项中没有唯一匹配项，请手动选择" };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
    if (setter) setter.call(option, true);
    else option.checked = true;
    option.dispatchEvent(new Event("input", { bubbles: true }));
    option.dispatchEvent(new Event("change", { bubbles: true }));
    flashElement(option);
    return { ok: true, message: `已选择“${findDirectLabel(option) || option.value}”` };
  }

  function fillCheckbox(element, value) {
    const shouldCheck = /^(true|1|yes|是|有|已同意|同意|checked)$/i.test(value.trim());
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
    if (setter) setter.call(element, shouldCheck);
    else element.checked = shouldCheck;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    flashElement(element);
    return { ok: true, message: shouldCheck ? "已勾选" : "已取消勾选" };
  }

  async function fillCustomSelect(element, value) {
    element.scrollIntoView({ block: "center", inline: "nearest" });
    element.focus({ preventScroll: true });
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    element.click();
    await wait(180);
    const selectors = [
      "[role='listbox'] [role='option']",
      ".el-select-dropdown__item:not(.is-disabled)",
      ".ant-select-item-option:not(.ant-select-item-option-disabled)",
      ".arco-select-option:not(.arco-select-option-disabled)",
      ".semi-select-option-list [role='option']",
      ".ivu-select-item"
    ].join(",");
    const options = [...document.querySelectorAll(selectors)].filter(isVisibleOption);
    const option = chooseOption(options, value, (item) => `${item.textContent || ""}|${item.getAttribute("title") || ""}|${item.getAttribute("data-value") || ""}`);
    if (!option) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return { ok: false, message: "自定义下拉框没有唯一匹配项，请手动选择" };
    }
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    option.click();
    await wait(120);
    flashElement(element);
    return { ok: true, message: `已选择“${compactText(option.textContent)}”` };
  }

  function chooseOption(options, desiredValue, textGetter) {
    const desired = normalizeChoice(desiredValue);
    if (!desired) return null;
    const scored = options.map((option) => {
      const text = normalizeChoice(textGetter(option));
      let score = 0;
      if (text === desired) score = 3;
      else if (text.split("|").some((part) => part === desired)) score = 2.8;
      else if (text.includes(desired) || desired.includes(text.replace(/\|/g, ""))) score = 2;
      return { option, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    if (scored[1] && scored[0].score === scored[1].score) return null;
    return scored[0].option;
  }

  function normalizeChoice(value) {
    return String(value || "").toLowerCase().replace(/请选择|select|\s|[：:，,。\.、/\\()（）\[\]【】]/g, "");
  }

  function isVisibleOption(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function flashElement(element) {
    const originalOutline = element.style.outline;
    const originalOffset = element.style.outlineOffset;
    element.style.outline = "3px solid #6654e8";
    element.style.outlineOffset = "2px";
    setTimeout(() => {
      element.style.outline = originalOutline;
      element.style.outlineOffset = originalOffset;
    }, 1600);
  }

  function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function cleanError(error) {
    return String(error?.message || error || "未知错误").slice(0, 300);
  }
})();
