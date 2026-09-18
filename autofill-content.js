(function installReliableAutofillAgent() {
  "use strict";

  if (globalThis.__JOB_AUTOFILL_AGENT__?.version === 6) return;
  if (globalThis.__JOB_AUTOFILL_AGENT__?.listener) chrome.runtime.onMessage.removeListener(globalThis.__JOB_AUTOFILL_AGENT__.listener);

  const state = {
    version: 6,
    fieldMap: new Map(),
    nearbyLabelCache: new WeakMap(),
    lastScanAt: 0
  };
  globalThis.__JOB_AUTOFILL_AGENT__ = state;

  const SELECT_OPTION_SELECTOR = [
    "[role='option']", ".Select-option", "[class*='select__option']", ".moka-dropdown-item",
    "[class*='dropdown-option']", "[class*='dropdown-item']", "[class*='select-option']",
    "[class*='SelectOption']", ".ant-select-dropdown-menu-item", ".ant-select-item-option",
    ".el-select-dropdown__item", ".arco-select-option", ".semi-select-option",
    ".ivu-select-item", ".rc-virtual-list-holder-inner > *",
    "[role='listbox'] > li", "[role='listbox'] > div", "[class*='dropdown'] li", "[class*='dropdown-menu'] li",
    "[class*='dropdown-list'] li", "[class*='select-dropdown'] li", "[class*='option-item']"
  ].join(",");
  const SELECT_POPUP_SELECTOR = [
    "[role='listbox']", ".ant-select-dropdown", ".el-select-dropdown", ".arco-select-popup",
    ".semi-select-option-list", ".ivu-select-dropdown", ".Select-menu-outer",
    "[class*='select-dropdown']", "[class*='selectDropdown']", "[class*='dropdown-menu']", "[class*='DropdownMenu']"
  ].join(",");

  state.listener = (message, _sender, sendResponse) => {
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
  };
  chrome.runtime.onMessage.addListener(state.listener);

  function scanFields() {
    const elements = collectFormElements().slice(0, 300);
    const fields = [];
    const handledChoiceElements = new Set();
    state.fieldMap = new Map();
    state.nearbyLabelCache = new WeakMap();

    for (const element of elements) {
      if (isRadioLike(element)) {
        if (handledChoiceElements.has(element)) continue;
        const group = collectChoiceGroup(element, elements);
        group.forEach((candidate) => handledChoiceElements.add(candidate));
        fields.push(describeChoiceGroup(group, fields.length));
        continue;
      }
      fields.push(describeElement(element, fields.length));
    }
    annotateDateParts(fields);
    annotateRepeatGroups(fields);
    state.lastScanAt = Date.now();
    return fields;
  }

  function annotateRepeatGroups(fields) {
    const grouped = new Map();
    for (const field of fields) {
      const kind = inferRepeatKind(field);
      if (!kind) continue;
      const element = state.fieldMap.get(field.fieldId)?.element || state.fieldMap.get(field.fieldId)?.elements?.[0];
      const container = element ? findRepeatCardContainer(element, kind, fields) : null;
      if (!container) continue;
      if (!grouped.has(kind)) grouped.set(kind, new Map());
      if (!grouped.get(kind).has(container)) grouped.get(kind).set(container, []);
      grouped.get(kind).get(container).push(field);
    }

    for (const [kind, containerMap] of grouped) {
      const groups = [...containerMap.entries()].sort((left, right) => compareDocumentOrder(left[0], right[0]));
      groups.forEach(([, groupFields], repeatIndex) => {
        for (const field of groupFields) {
          field.repeatKind = kind;
          field.repeatIndex = repeatIndex;
          field.repeatGroupId = `${kind}:${repeatIndex}`;
        }
      });
    }

    // Some ATS render records as flat sibling rows, with dates BEFORE company name.
    // If a kind is only partially grouped, partition its entire sequence consistently.
    for (const kind of ["education", "work", "internships", "projects", "awards", "certificates"]) {
      const sequence = fields.filter((field) => inferRepeatKind(field) === kind);
      if (!sequence.length || sequence.every((field) => field.repeatGroupId)) continue;
      const anchors = sequence.map((field, index) => isRepeatAnchor(field, kind) ? index : -1).filter((index) => index >= 0);
      const starts = anchors.map((anchor, index) => {
        if (index === 0) return 0;
        const preceding = sequence.slice(anchors[index - 1] + 1, anchor);
        const dateStart = preceding.findIndex((field) => field.dateRole === "start" && field.datePart === "year");
        return dateStart >= 0 ? anchors[index - 1] + 1 + dateStart : anchor;
      });
      sequence.forEach((field, index) => {
        const repeatIndex = Math.max(0, starts.filter((start) => start <= index).length - 1);
        field.repeatKind = kind;
        field.repeatIndex = repeatIndex;
        field.repeatGroupId = `${kind}:${repeatIndex}`;
      });
    }
  }

  function annotateDateParts(fields) {
    const targetOf = (field) => state.fieldMap.get(field.fieldId)?.element;
    const unitOf = (field) => {
      const element = targetOf(field);
      const visiblePlaceholder = (element?.closest?.(".Select-control, [class*='select__control']") || element)?.querySelector?.(".Select-placeholder, [class*='placeholder'], [class*='Placeholder']")?.textContent;
      const hint = compactText(field.placeholder || visiblePlaceholder || "");
      if (/^(?:请选择)?(?:年|年份|year|yyyy)$/i.test(hint)) return "year";
      if (/^(?:请选择)?(?:月|月份|month|mm)$/i.test(hint)) return "month";
      if (/^(?:请选择)?(?:日|day|dd)$/i.test(hint)) return "day";
      const options = field.options?.map((o) => compactText(o.label)).filter((s) => s && !/请选择|select/i.test(s)) || [];
      if (options.length >= 2 && options.every((s) => /^(19|20)\d{2}年?$/.test(s))) return "year";
      return "";
    };
    const parts = fields.filter((field) => unitOf(field));
    for (const field of fields) if (/毕业届次/.test(field.label)) field.datePart = "year";
    for (const field of parts) {
      if (field.datePart) continue;
      let current = targetOf(field)?.parentElement;
      for (let depth = 0; current && current !== document.body && depth < 7; depth += 1, current = current.parentElement) {
        const group = parts.filter((part) => current.contains(targetOf(part))).sort((a, b) => compareDocumentOrder(targetOf(a), targetOf(b)));
        const text = labelNodeText(current);
        if (group.length > 6) break;
        if (group.length < 2 || !/(时间|日期|年月|date|period|duration)/i.test(text)) continue;
        const units = group.map(unitOf).join(",");
        const range = /^(year,month,){1}year,month$|^year,month,day,year,month,day$/.test(units);
        const single = /^(year,month|year,month,day)$/.test(units);
        if (!range && !single) break;
        const kind = inferRepeatKind(field);
        const endOnly = /结束|离职|毕业|end|to date/i.test(text) && !/开始|起止|start/i.test(text);
        const singleLabel = kind === "awards" ? "获奖时间" : kind === "certificates" ? "获得时间" : field.label;
        group.forEach((part, index) => {
          part.datePart = unitOf(part);
          const end = range ? index >= group.length / 2 : endOnly;
          part.label = range || /入学|毕业|开始|结束|就读|起止/i.test(text)
            ? kind === "education" ? end ? "毕业时间" : "入学时间"
              : kind === "projects" ? end ? "项目结束时间" : "项目开始时间"
                : end ? "结束时间" : "开始时间"
            : singleLabel;
          part.dateRole = end ? "end" : "start";
          state.fieldMap.get(part.fieldId).datePart = part.datePart;
        });
        break;
      }
    }
  }

  function findRepeatCardContainer(element, kind, fields) {
    const candidates = [];
    let current = element.parentElement;
    for (let depth = 0; current && depth < 9 && current !== document.body; depth += 1, current = current.parentElement) {
      const contained = fields.filter((field) => {
        if (inferRepeatKind(field) !== kind) return false;
        const target = state.fieldMap.get(field.fieldId);
        const candidate = target?.element || target?.elements?.[0];
        return candidate && current.contains(candidate);
      });
      if (contained.length < 3 || contained.length > 40) continue;
      const anchorCount = contained.filter((field) => isRepeatAnchor(field, kind)).length;
      if (anchorCount === 1) candidates.push(current);
      if (anchorCount > 1) break;
    }
    return candidates[candidates.length - 1] || null;
  }

  function compareDocumentOrder(left, right) {
    if (left === right) return 0;
    const position = left.compareDocumentPosition(right);
    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }

  function inferRepeatKind(field) {
    const label = compactText(field.label || field.placeholder).toLowerCase();
    const section = compactText(field.section).toLowerCase();
    const context = `${section} ${label}`;
    if (/(?:获奖经历|获奖情况|荣誉奖励|awards)/i.test(section)) return "awards";
    if (/(?:证书|certificates|certifications)/i.test(section)) return "certificates";
    if (/(?:项目经历|项目经验|项目介绍|project)/i.test(context)) return "projects";
    if (/(?:实习经历|实习经验|internship)/i.test(context)) return "internships";
    if (/(?:教育信息|教育经历|教育背景|education)/i.test(context)) return "education";
    if (/(?:工作经历|工作经验|任职经历|职业经历|work experience|employment)/i.test(context)) return "work";
    return "";
  }

  function isRepeatAnchor(field, kind) {
    const label = compactText(field.label || field.placeholder).toLowerCase();
    if (kind === "awards") return /(?:奖项名称|奖励名称|获奖名称|award name|award title)/i.test(label);
    if (kind === "certificates") return /(?:证书名称|资格名称|certificate name|license name)/i.test(label);
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
      ".Select-control", ".moka-select", ".custom-select", "[class*='select__control']", "[class*='select-control']",
      "[aria-haspopup='listbox']", "[tabindex][class*='select']:not([role='option'])", "[tabindex][class*='Select']:not([role='option'])",
      "[role='radio']",
      ".ant-radio-wrapper:not(.ant-radio-wrapper-disabled)",
      ".el-radio:not(.is-disabled)",
      ".arco-radio:not(.arco-radio-disabled)",
      ".semi-radio:not(.semi-radio-disabled)",
      ".ivu-radio-wrapper:not(.ivu-radio-wrapper-disabled)"
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
        } else if (isFrameworkRadioWrapper(element)) {
          const usableInnerRadio = [...element.querySelectorAll("input[type='radio'], [role='radio']")].find((candidate) => isUsableElement(candidate));
          if (usableInnerRadio) continue;
        } else {
          const selectWrapper = element.closest(".ant-select, .el-select, .arco-select-view, .semi-select, .ivu-select, .Select-control, .moka-select, .custom-select, [class*='select__control'], [class*='select-control'], [aria-haspopup='listbox'], [tabindex][class*='select'], [tabindex][class*='Select']");
          const radioWrapper = element.closest(".ant-radio-wrapper, .el-radio, .arco-radio, .semi-radio, .ivu-radio-wrapper");
          if ((selectWrapper && found.has(selectWrapper)) || (radioWrapper && found.has(radioWrapper))) continue;
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
      projects: clampRepeatCount(desiredCountsInput?.projects),
      awards: clampRepeatCount(desiredCountsInput?.awards),
      certificates: clampRepeatCount(desiredCountsInput?.certificates)
    };
    const added = { education: 0, work: 0, internships: 0, projects: 0, awards: 0, certificates: 0 };
    const existing = {};
    const warnings = [];

    for (const kind of Object.keys(added)) {
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
        for (let attempt = 0; attempt < 12 && countExistingRecords(kind) <= before; attempt += 1) await wait(100);
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
    return ({ education: "教育经历", work: "工作经历", internships: "实习经历", projects: "项目经历", awards: "获奖经历", certificates: "证书" })[kind] || kind;
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
    if (/(?:获奖经历|获奖情况|荣誉奖励|awards)/i.test(context)) return "awards";
    if (/(?:证书|certificates|certifications)/i.test(context)) return "certificates";
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
      if (["awards", "certificates"].includes(kind)) return inferRepeatKind({ label, section }) === kind && isRepeatAnchor({ label }, kind);
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

  function isFrameworkRadioWrapper(element) {
    return element instanceof HTMLElement && element.matches(".ant-radio-wrapper, .el-radio, .arco-radio, .semi-radio, .ivu-radio-wrapper");
  }

  function isRadioLike(element) {
    return element instanceof HTMLInputElement && element.type === "radio"
      || element instanceof HTMLElement && (element.getAttribute("role") === "radio" || isFrameworkRadioWrapper(element));
  }

  function collectChoiceGroup(element, allElements) {
    if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
      return allElements.filter((candidate) => candidate instanceof HTMLInputElement && candidate.type === "radio" && candidate.name === element.name && candidate.form === element.form);
    }
    const findContainer = () => {
      let current = element.parentElement;
      for (let depth = 0; current && depth < 7 && current !== document.body; depth += 1, current = current.parentElement) {
        const members = allElements.filter((candidate) => isRadioLike(candidate) && current.contains(candidate));
        if (members.length >= 2 && members.length <= 12) return current;
      }
      return element.closest("fieldset, [role='radiogroup'], .ant-form-item, .el-form-item, [class*='form-item'], [class*='field']");
    };
    const container = findContainer();
    const group = container ? allElements.filter((candidate) => isRadioLike(candidate) && container.contains(candidate)) : [element];
    return group.length ? group : [element];
  }

  function choiceValue(element) {
    if (!element) return "";
    const input = element instanceof HTMLInputElement ? element : element.querySelector?.("input[type='radio']");
    return compactText(input?.value || element.getAttribute("data-value") || element.getAttribute("value") || element.textContent);
  }

  function choiceLabel(element) {
    const direct = findDirectLabel(element);
    if (direct) return direct;
    const wrapper = element.closest?.("label, .ant-radio-wrapper, .el-radio, .arco-radio, .semi-radio, .ivu-radio-wrapper") || element;
    return compactText(wrapper.getAttribute?.("aria-label") || wrapper.textContent || choiceValue(element));
  }

  function isChoiceChecked(element) {
    const input = element instanceof HTMLInputElement ? element : element.querySelector?.("input[type='radio']");
    return Boolean(input?.checked || element.getAttribute("aria-checked") === "true" || element.matches?.(".is-checked, .ant-radio-wrapper-checked, .arco-radio-checked, .semi-radio-checked, .ivu-radio-wrapper-checked"));
  }

  function describeChoiceGroup(elements, index) {
    const first = elements[0];
    const fieldId = makeFieldId(index);
    const container = first.closest?.("fieldset, [role='radiogroup'], .ant-form-item, .el-form-item, [class*='form-item'], [class*='field']");
    const label = compactText(container?.querySelector?.(":scope > legend, :scope > label, :scope > [class*='label']")?.textContent) || findFieldLabel(first);
    const options = elements.map((element) => ({
      value: choiceValue(element),
      label: choiceLabel(element)
    }));
    state.fieldMap.set(fieldId, { kind: "choice-group", elements, element: first });
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
      currentValue: choiceValue(elements.find(isChoiceChecked)) || "",
      required: elements.some((element) => element.required || element.getAttribute("aria-required") === "true"),
      customSelect: false,
      unsupported: false,
      description: collectFieldEvidence(first),
      className: compactText(first.className)
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
      description: collectFieldEvidence(element),
      className: compactText(element.className),
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

  function referencedText(element, attributeName) {
    return compactText(String(element.getAttribute(attributeName) || "").split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || "").join(" "));
  }

  function semanticLabel(value) {
    return compactText(value).replace(/(?:必填项未填写|此项为必填|该项必填|不能为空|请完善必填信息|required field|this field is required|validation error)/gi, "").replace(/[*＊：:]+$/g, "").trim();
  }

  function labelNodeText(node) {
    if (!node || node.matches?.("[role='alert'], [class*='error'], [class*='Error'], [class*='feedback'], [class*='Feedback']")) return "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll?.("input,select,textarea,button,[role='combobox'],[role='option'],[role='alert'],[class*='error'],[class*='Error'],[class*='feedback']").forEach((child) => child.remove());
    return semanticLabel(clone.textContent);
  }

  function findNearbyLabelText(element) {
    if (state.nearbyLabelCache.has(element)) return state.nearbyLabelCache.get(element);
    const rect = element.getBoundingClientRect();
    const nearby = [...document.querySelectorAll("label, legend, dt, th, [class*='label'], [class*='title']")]
      .filter((candidate) => candidate !== element && isUsableElement(candidate))
      .map((candidate) => {
        const text = labelNodeText(candidate);
        const other = candidate.getBoundingClientRect();
        const verticalGap = Math.min(Math.abs(rect.top - other.bottom), Math.abs(other.top - rect.bottom));
        const horizontalGap = Math.min(Math.abs(rect.left - other.right), Math.abs(other.left - rect.right));
        const sameRow = Math.abs((rect.top + rect.bottom) / 2 - (other.top + other.bottom) / 2) < Math.max(18, rect.height);
        const overlapsX = other.left < rect.right && other.right > rect.left;
        const above = overlapsX && other.bottom <= rect.top + 6 && rect.top - other.bottom < 90;
        const score = sameRow && other.right <= rect.left + 6 ? horizontalGap : above ? verticalGap + Math.abs(other.left - rect.left) * 0.2 + 20 : Number.POSITIVE_INFINITY;
        return { text, score };
      })
      .filter((item) => item.text && !isGenericFieldText(item.text) && item.text.length <= 100 && Number.isFinite(item.score) && item.score < 160)
      .sort((left, right) => left.score - right.score);
    const result = nearby[0]?.text || "";
    state.nearbyLabelCache.set(element, result);
    return result;
  }

  function collectFieldEvidence(element) {
    const data = [...(element.attributes || [])]
      .filter((attribute) => /^data-(?:label|field|name|testid|placeholder|caption|title)$/i.test(attribute.name))
      .map((attribute) => `${attribute.name} ${attribute.value}`).join(" ");
    const text = [
      element.getAttribute("title"),
      referencedText(element, "aria-describedby"),
      element.getAttribute("data-label"),
      element.getAttribute("data-field"),
      element.getAttribute("data-name"),
      data,
      findNearbyLabelText(element)
    ].map(compactText).filter(Boolean).join(" | ");
    return compactText(text);
  }

  function isGenericFieldText(text) {
    return !semanticLabel(text) || /^(?:请)?(?:输入|填写|选择|搜索|请选择|请填写|请输入|请搜索|未命名字段|内容|年|月|日|[-—至]|select|enter|input)$/i.test(semanticLabel(text));
  }

  function findFieldLabel(element) {
    const direct = semanticLabel(findDirectLabel(element));
    if (direct && !isGenericFieldText(direct)) return direct;
    const labelledText = semanticLabel(referencedText(element, "aria-labelledby"));
    if (labelledText && !isGenericFieldText(labelledText)) return labelledText;
    const aria = compactText(element.getAttribute("aria-label"));
    if (aria && !isGenericFieldText(aria)) return aria;

    let current = element.parentElement;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      const selectors = [
        ":scope > label",
        ":scope > .el-form-item__label",
        ":scope > * > .el-form-item__label",
        ":scope > .ant-form-item-label",
        ":scope > * > .ant-form-item-label",
        ":scope > [class*='form-label']",
        ":scope > [class*='field-label']",
        ":scope > [class*='control-label']",
        ":scope > [class*='label']", ":scope > [class*='Label']",
        ":scope > legend",
        ":scope > dt",
        ":scope > th"
      ];
      for (const selector of selectors) {
        let candidate = null;
        try { candidate = current.querySelector(selector); } catch (_) {}
        if (candidate?.getAttribute("for") && candidate.getAttribute("for") !== element.id) continue;
        const text = labelNodeText(candidate);
        if (text && text.length <= 120 && !isGenericFieldText(text)) return text;
      }
      const previous = depth === 0 ? element.previousElementSibling || current.previousElementSibling : current.previousElementSibling;
      const previousText = previous?.querySelector?.("input,select,textarea,[role='combobox']") ? "" : labelNodeText(previous);
      if (previousText && previousText.length <= 80 && !isGenericFieldText(previousText)) return previousText;
      // Don't borrow a label from the previous field or from another column.
      if (current.matches(".form-group,[class*='form-item'],[class*='field-item'],.field") && current.querySelectorAll("input,textarea,select,[role='combobox']").length <= 1) break;
    }
    const described = semanticLabel(referencedText(element, "aria-describedby"));
    if (described && !isGenericFieldText(described)) return described;
    const nearby = findNearbyLabelText(element);
    if (nearby && !isGenericFieldText(nearby)) return nearby;
    return compactText([element.getAttribute("placeholder"), element.getAttribute("name"), element.id].find((value) => value && !isGenericFieldText(value)) || "");
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
        ":scope > [class*='title']", ":scope > [class*='Title']"
      ];
      for (const selector of headingSelectors) {
        let heading = null;
        try { heading = current.querySelector(selector); } catch (_) {}
        const text = compactText(heading?.textContent);
        if (isLikelySectionHeading(text) && (!heading.compareDocumentPosition || heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)) return text;
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
    return /(?:个人信息|基本信息|投递意向|求职意向|教育信息|教育经历|教育背景|技能信息|技能|校园经历|社团经历|实习经历|实习经验|工作经历|工作经验|任职经历|项目经历|项目经验|科研经历|志愿经历|获奖经历|获奖情况|自我评价|作品上传|语言|证书|奖励|联系人|education|work experience|employment|internship|project|awards|certifications)/i.test(text);
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
    return semanticLabel(clone.textContent);
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
    if (!(element instanceof HTMLInputElement)) return false;
    const ancestor = element.closest(".ant-select, .el-select, .arco-select-view, .semi-select, .ivu-select, .Select, .Select-control, [class*='select'], [class*='Select'], [role='combobox'], [aria-haspopup='listbox']");
    const context = compactText(`${element.getAttribute("placeholder") || ""} ${element.getAttribute("aria-label") || ""} ${element.name || ""} ${element.id || ""}`).toLowerCase();
    const semanticAutocomplete = /(?:搜索.*(?:职位|岗位)|(?:职位|岗位)关键词|job.*keyword|position.*keyword)/i.test(context);
    return Boolean(
      element.getAttribute("aria-autocomplete")
      || element.getAttribute("aria-controls")
      || element.getAttribute("aria-owns")
      || element.getAttribute("list")
      || ancestor && (element.readOnly || ancestor.getAttribute("aria-haspopup") === "listbox" || /select|autocomplete|suggest/i.test(ancestor.className))
      || element.readOnly && /(?:请)?选择/.test(element.placeholder || "") && !isDateLikeElement(element) && Boolean(element.parentElement?.querySelector("svg, [class*='arrow'], [class*='suffix'], [class*='caret']"))
      || semanticAutocomplete
    );
  }

  function isFrameworkSelectWrapper(element) {
    if (!(element instanceof HTMLElement)) return false;
    return element.matches(".ant-select, .el-select, .arco-select-view, .semi-select, .ivu-select, .Select-control, .moka-select, .custom-select, [class*='select__control'], [class*='select-control'], [aria-haspopup='listbox'], [tabindex][class*='select']:not([class*='option']), [tabindex][class*='Select']:not([class*='Option'])");
  }

  function isDateLikeElement(element) {
    if (!(element instanceof HTMLInputElement)) return false;
    if (["date", "month", "datetime-local"].includes(element.type)) return true;
    const context = compactText(`${element.getAttribute("placeholder") || ""} ${element.name || ""} ${element.id || ""} ${element.getAttribute("aria-label") || ""}`).toLowerCase();
    return Boolean(element.closest("[class*='date'], [class*='picker'], [class*='calendar']")) || /(?:日期|时间|年月|date|time|year|month)/i.test(context);
  }

  function readCurrentValue(element) {
    if (element instanceof HTMLInputElement && element.type === "checkbox") return element.checked ? "true" : "";
    if (element.isContentEditable) return String(element.textContent || "").trim();
    if (element instanceof HTMLTextAreaElement) return element.value.trim();
    if (isCustomSelect(element)) {
      const wrapper = selectControlWrapper(element);
      const value = readSelectDisplay(wrapper, element);
      return isGenericFieldText(value) ? "" : value;
    }
    if (element instanceof HTMLSelectElement) return element.value ? compactText(element.selectedOptions[0]?.textContent || element.value) : "";
    return compactText(element.value || element.getAttribute("data-value") || "");
  }

  function readSelectDisplay(wrapper, element) {
    const selected = wrapper.querySelector?.(".ant-select-selection-item, .ant-select-selection-selected-value, .el-select__selected-item, .arco-select-view-value, .semi-select-selection-text, .ivu-select-selected-value, .Select-value-label, [class*='singleValue'], [class*='select-value'], [class*='selected-value'], [class*='selection-item']");
    return compactText(selected?.textContent || element.value || element.getAttribute?.("data-value") || "");
  }

  function selectControlWrapper(element) {
    return element.closest?.(".ant-select, .el-select, .arco-select-view, .semi-select, .ivu-select, .Select, .moka-select, .custom-select, [class*='select__control'], [class*='select-control'], [class*='select'], [class*='Select'], [role='combobox'], [aria-haspopup='listbox']")
      || (element instanceof HTMLInputElement && element.readOnly && /(?:请)?选择/.test(element.placeholder || "") ? element.parentElement : null)
      || element;
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
    if (target.kind === "choice-group") return choiceValue(target.elements.find(isChoiceChecked));
    return readCurrentValue(target.element);
  }

  async function fillTarget(target, value) {
    if (!value) return { ok: false, message: "资料值为空" };
    if (target.kind === "choice-group") return fillChoiceGroup(target.elements, value);
    if (target.kind === "custom-select") return fillCustomSelect(target.element, value);
    if (target.element instanceof HTMLSelectElement) return fillNativeSelect(target.element, value);
    if (target.element instanceof HTMLInputElement && target.element.type === "checkbox") return fillCheckbox(target.element, value);
    return fillTextLike(target.element, value, target.kind === "date-like");
  }

  async function fillTextLike(element, rawValue, dateLike = false) {
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
    await wait(160);
    flashElement(element);
    const accepted = readCurrentValue(element).replace(/\s+/g, " ").trim() === value.replace(/\s+/g, " ").trim();
    return { ok: accepted, message: accepted ? "已填写并核验页面保留的值" : "网页未保留完整填充值，请重新扫描或手动选择" };
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

  async function fillNativeSelect(element, value) {
    const option = chooseOption([...element.options].filter((item) => !item.disabled && item.value), value, (item) => item.textContent || item.value);
    if (!option) return { ok: false, message: "下拉选项中没有唯一匹配项，请手动选择" };
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(element, option.value);
    else element.value = option.value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(120);
    flashElement(element);
    return { ok: element.value === option.value, message: element.value === option.value ? `已选择“${compactText(option.textContent)}”` : "网页拒绝了下拉选项，请重新扫描" };
  }

  function fillChoiceGroup(elements, value) {
    const option = chooseOption(elements, value, (element) => choiceLabel(element) || choiceValue(element));
    if (!option) return { ok: false, message: "单选项中没有唯一匹配项，请手动选择" };
    const input = option instanceof HTMLInputElement ? option : option.querySelector?.("input[type='radio']");
    const activationTarget = option.closest?.("label, .ant-radio-wrapper, .el-radio, .arco-radio, .semi-radio, .ivu-radio-wrapper") || option;
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
      if (setter) setter.call(input, true);
      else input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    activationTarget.click();
    flashElement(activationTarget);
    return { ok: isChoiceChecked(option) || Boolean(input?.checked), message: `已选择“${choiceLabel(option) || choiceValue(option)}”` };
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
    const wrapper = selectControlWrapper(element);
    const input = element instanceof HTMLInputElement ? element : wrapper.querySelector?.("input:not([type='hidden']), [role='combobox']");
    const activationTarget = input || element;
    const beforeOptions = new Set(deepQueryAll(SELECT_OPTION_SELECTOR).filter(isSelectableOption));
    const beforePopups = new Set(deepQueryAll(SELECT_POPUP_SELECTOR).filter(isVisibleOption));
    wrapper.scrollIntoView({ block: "center", inline: "nearest" });
    activationTarget.focus({ preventScroll: true });
    const alreadyOpen = wrapper.getAttribute("aria-expanded") === "true" || input?.getAttribute("aria-expanded") === "true" || findSelectOptions(wrapper, beforeOptions, beforePopups).length > 0;
    if (!alreadyOpen) {
      activationTarget.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      activationTarget.click();
    }

    const editable = input instanceof HTMLInputElement && !input.readOnly && input.getAttribute("aria-readonly") !== "true";
    const originalValue = editable ? input.value : "";
    if (editable) {
      setNativeInputValue(input, value);
      dispatchTypingEvents(input, value);
    }

    let options = await waitForSelectOptions(wrapper, 1000, beforeOptions, beforePopups);
    let option = chooseOption(options, value, optionSearchText);
    if (!option) {
      const popupInput = findSelectSearchInput(wrapper, beforePopups);
      if (popupInput && popupInput !== input) {
        popupInput.focus({ preventScroll: true });
        setNativeInputValue(popupInput, value);
        dispatchTypingEvents(popupInput, value);
      } else if (editable) {
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true, cancelable: true }));
      }
      option = await waitForMatchingSelectOption(wrapper, value, 1300, beforeOptions, beforePopups);
    }
    if (!option) {
      activationTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      if (editable) {
        setNativeInputValue(input, originalValue);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return { ok: false, message: editable ? "已输入关键词，但未找到唯一候选项，请检查网页联想结果" : "自定义下拉框没有唯一匹配项，请手动选择" };
    }
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    option.click();
    await wait(180);
    if (editable && wrapper.getAttribute("aria-expanded") === "true") {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
      await wait(100);
    }
    const selectedText = compactText(option.textContent);
    const actual = readCurrentValue(element) || readSelectDisplay(wrapper, input || element);
    const accepted = Boolean(actual && chooseOption([{ text: actual }], value, (item) => item.text));
    const ok = accepted;
    flashElement(wrapper);
    return { ok, message: ok ? `已选择并核验“${selectedText}”` : "点击后未检测到选中结果，请重新扫描或手动选择" };
  }

  function setNativeInputValue(element, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
  }

  function dispatchTypingEvents(element, value) {
    try {
      element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: value }));
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    } catch (_) {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    element.dispatchEvent(new KeyboardEvent("keyup", { key: value.slice(-1), bubbles: true }));
  }

  function optionSearchText(item) {
    return `${item.textContent || ""}|${item.getAttribute("aria-label") || ""}|${item.getAttribute("title") || ""}`;
  }

  function controlledSelectRoots(wrapper) {
    const controlledIds = [wrapper, ...wrapper.querySelectorAll?.("[aria-controls], [aria-owns]") || []]
      .flatMap((node) => `${node.getAttribute?.("aria-controls") || ""} ${node.getAttribute?.("aria-owns") || ""}`.trim().split(/\s+/)).filter(Boolean);
    return [...new Set(controlledIds.map((id) => document.getElementById(id)).filter(Boolean))];
  }

  function selectPopupRoots(wrapper, beforePopups = new Set()) {
    const controlled = controlledSelectRoots(wrapper);
    if (controlled.length) return controlled;
    const local = [...wrapper.querySelectorAll(SELECT_POPUP_SELECTOR)].filter(isVisibleOption);
    if (local.length) return local;
    const visible = deepQueryAll(SELECT_POPUP_SELECTOR).filter(isVisibleOption);
    const fresh = visible.filter((root) => !beforePopups.has(root));
    if (fresh.length === 1) return fresh;
    if ((wrapper.getAttribute("aria-expanded") === "true" || wrapper.querySelector("[aria-expanded='true']")) && visible.length === 1) return visible;
    return [];
  }

  function isSelectableOption(element) {
    if (!isVisibleOption(element) || element.getAttribute("aria-disabled") === "true" || element.matches("[disabled], [class*='disabled']")) return false;
    if (element.querySelector("input, textarea, [role='option'], li, button")) return false;
    const label = compactText(element.getAttribute("aria-label") || element.textContent);
    return Boolean(label && label.length <= 120 && !isGenericFieldText(label));
  }

  function findSelectOptions(wrapper, beforeOptions = new Set(), beforePopups = new Set()) {
    const roots = selectPopupRoots(wrapper, beforePopups);
    const collect = (rootsToRead) => [...new Set(rootsToRead.flatMap((root) => [...root.querySelectorAll(SELECT_OPTION_SELECTOR)]))].filter(isSelectableOption);
    if (roots.length) return collect(roots);
    const local = collect([wrapper]);
    if (local.length) return local;
    const fresh = deepQueryAll(SELECT_OPTION_SELECTOR).filter((option) => !beforeOptions.has(option) && isSelectableOption(option));
    const owners = new Set(fresh.map((option) => option.closest(SELECT_POPUP_SELECTOR) || option.parentElement));
    return owners.size === 1 ? fresh : [];
  }

  function findSelectSearchInput(wrapper, beforePopups) {
    const roots = selectPopupRoots(wrapper, beforePopups);
    const selector = "input[type='search'], input[placeholder*='搜索'], input[placeholder*='检索'], input[role='combobox']";
    const inputs = roots.flatMap((root) => [...root.querySelectorAll(selector)]).filter((candidate) => isUsableElement(candidate) && !candidate.readOnly);
    return inputs.length === 1 ? inputs[0] : null;
  }

  async function waitForSelectOptions(wrapper, timeoutMs, beforeOptions, beforePopups) {
    const deadline = Date.now() + timeoutMs;
    let options = [];
    do {
      options = findSelectOptions(wrapper, beforeOptions, beforePopups);
      if (options.length) return options;
      await wait(90);
    } while (Date.now() < deadline);
    return options;
  }

  async function waitForMatchingSelectOption(wrapper, value, timeoutMs, beforeOptions, beforePopups) {
    const deadline = Date.now() + timeoutMs;
    let option = null;
    do {
      option = chooseOption(findSelectOptions(wrapper, beforeOptions, beforePopups), value, optionSearchText);
      if (option) return option;
      await wait(90);
    } while (Date.now() < deadline);
    return option;
  }

  function chooseOption(options, desiredValue, textGetter) {
    const desired = normalizeChoice(desiredValue);
    if (!desired) return null;
    const scored = options.map((option) => {
      const parts = String(textGetter(option) || "").split("|").map(normalizeChoice).filter(Boolean);
      let score = 0;
      for (const part of parts) {
        if (part === desired) score = Math.max(score, 100);
        else if (choiceSynonym(part) && choiceSynonym(part) === choiceSynonym(desired)) score = Math.max(score, 96);
        else if (!/^\d+$/.test(desired) && !choiceSynonym(desired) && Math.min(part.length, desired.length) >= 2 && (part.includes(desired) || desired.includes(part))) score = Math.max(score, 82);
      }
      return { option, score };
    }).filter((item) => item.score >= 68).sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    if (scored[1] && scored[0].score - scored[1].score < 8) return null;
    return scored[0].option;
  }

  function normalizeChoice(value) {
    const text = String(value || "").toLowerCase().replace(/请选择|select|\s|[：:，,。\.、/\\()（）\[\]【】]/g, "");
    return /^\d+(?:年|月|日|届)?$/.test(text) ? String(Number(text.replace(/[年月日届]/g, ""))) : text;
  }

  function choiceSynonym(value) {
    const normalized = normalizeChoice(value);
    const groups = [
      ["男", "男性", "male", "man", "m"], ["女", "女性", "female", "woman", "f"],
      ["是", "有", "同意", "已同意", "yes", "true", "1"], ["否", "无", "不同意", "no", "false", "0"],
      ["全日制", "fulltime", "full-time"], ["非全日制", "parttime", "part-time"],
      ["本科", "大学本科", "本科学历"], ["硕士", "硕士研究生", "硕士学位"],
      ["博士", "博士研究生", "博士学位"], ["大专", "专科", "大学专科"],
      ["学士", "学士学位"], ["非定向", "非定向（统招、并轨）"],
      ["前5%", "top5%"], ["前10%", "top10%"], ["前20%", "top20%"], ["前30%", "top30%"], ["前50%", "top50%"]
    ];
    const group = groups.find((items) => items.map(normalizeChoice).includes(normalized));
    return group ? normalizeChoice(group[0]) : "";
  }

  function isVisibleOption(element) {
    if (!element.isConnected || element.closest("[hidden], [aria-hidden='true']")) return false;
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
