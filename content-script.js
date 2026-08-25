(() => {
  const SITE = detectSite();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;

    if (message.type === "EXTRACT_JOBS") {
      try {
        const jobs = extractJobs(Number(message.limit) || 50);
        sendResponse({ ok: true, site: SITE, pageUrl: location.href, jobs });
      } catch (error) {
        sendResponse({ ok: false, error: String(error?.message || error) });
      }
      return false;
    }

    if (message.type === "EXECUTE_APPLICATION") {
      executeApplication(String(message.payload?.greeting || ""))
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ ok: false, status: "error", message: String(error?.message || error) }));
      return true;
    }

    return false;
  });

  function detectSite() {
    const host = location.hostname.toLowerCase();
    if (host.includes("zhipin.com")) return "BOSS直聘";
    if (host.includes("liepin.com")) return "猎聘";
    if (host.includes("zhaopin.com")) return "智联招聘";
    return "未知网站";
  }

  function extractJobs(limit) {
    const adapter = getAdapter();
    const cards = uniqueElements([
      ...queryAll(adapter.cardSelectors),
      ...findCardsFromLinks(adapter.linkSelectors)
    ]);
    const seen = new Set();
    const jobs = [];

    for (const card of cards) {
      if (jobs.length >= Math.min(limit, 100)) break;
      const job = extractCard(card, adapter);
      if (!job || seen.has(job.url)) continue;
      seen.add(job.url);
      jobs.push(job);
    }

    return jobs;
  }

  function getAdapter() {
    if (SITE === "BOSS直聘") {
      return {
        cardSelectors: [
          ".job-card-wrapper",
          ".job-card-box",
          ".job-list-box li",
          "li[class*='job-card']"
        ],
        linkSelectors: ["a[href*='/job_detail/']"],
        titleSelectors: [".job-name", "[class*='job-name']", "a[href*='/job_detail/']"],
        companySelectors: [".company-name", "[class*='company-name']", ".company-info h3"],
        salarySelectors: [".salary", "[class*='salary']"],
        locationSelectors: [".job-area", "[class*='job-area']", ".company-location"],
        tagSelectors: [".tag-list", ".job-card-footer", "[class*='tag']"],
        linkSelector: "a[href*='/job_detail/']"
      };
    }

    if (SITE === "猎聘") {
      return {
        cardSelectors: [
          ".job-card-pc-container",
          ".job-card-container",
          "[data-selector='job-card']",
          "div[class*='job-card']"
        ],
        linkSelectors: ["a[href*='/job/']"],
        titleSelectors: [".job-title-box", "[class*='job-title']", "a[href*='/job/']"],
        companySelectors: [".company-name", "[class*='company-name']", "[class*='company-title']"],
        salarySelectors: [".job-salary", "[class*='salary']"],
        locationSelectors: [".job-dq-box", "[class*='location']", "[class*='area']"],
        tagSelectors: [".labels-tag", "[class*='tag']", "[class*='label']"],
        linkSelector: "a[href*='/job/']"
      };
    }

    return {
      cardSelectors: [
        ".joblist-box__item",
        ".positionlist__list__item",
        "[class*='joblist'] [class*='item']",
        "[class*='job-card']"
      ],
      linkSelectors: ["a[href*='/jobdetail/']", "a[href*='jobs.zhaopin.com']"],
      titleSelectors: ["[class*='job-name']", "[class*='job-title']", "a[href*='/jobdetail/']"],
      companySelectors: ["[class*='company-name']", "[class*='company-title']"],
      salarySelectors: ["[class*='salary']"],
      locationSelectors: ["[class*='location']", "[class*='area']"],
      tagSelectors: ["[class*='tag']", "[class*='label']"],
      linkSelector: "a[href*='/jobdetail/'], a[href*='jobs.zhaopin.com']"
    };
  }

  function queryAll(selectors) {
    const output = [];
    for (const selector of selectors) {
      try {
        output.push(...document.querySelectorAll(selector));
      } catch (_) {}
    }
    return output;
  }

  function findCardsFromLinks(selectors) {
    return queryAll(selectors).map((link) => {
      let node = link;
      for (let i = 0; i < 6 && node?.parentElement; i += 1) {
        const text = normalizeText(node.innerText);
        if (text.length >= 30 && text.length <= 1600) return node;
        node = node.parentElement;
      }
      return link.parentElement || link;
    });
  }

  function uniqueElements(elements) {
    return [...new Set(elements)].filter((element) => element instanceof HTMLElement && isVisible(element));
  }

  function extractCard(card, adapter) {
    const link = card.matches?.(adapter.linkSelector) ? card : card.querySelector(adapter.linkSelector);
    if (!link?.href) return null;

    const title = firstText(card, adapter.titleSelectors) || normalizeText(link.innerText);
    const company = firstText(card, adapter.companySelectors);
    const salary = firstText(card, adapter.salarySelectors);
    const locationText = firstText(card, adapter.locationSelectors);
    const tags = adapter.tagSelectors.flatMap((selector) => {
      try {
        return [...card.querySelectorAll(selector)].map((node) => normalizeText(node.innerText));
      } catch (_) {
        return [];
      }
    }).filter(Boolean).slice(0, 8);
    const rawText = normalizeText(card.innerText).slice(0, 4500);

    if (!title || title.length > 120) return null;
    return {
      id: simpleHash(`${SITE}|${link.href}|${title}|${company}`),
      site: SITE,
      title: title.slice(0, 120),
      company: company.slice(0, 120),
      salary: salary.slice(0, 80),
      location: locationText.slice(0, 100),
      tags,
      description: rawText,
      rawText,
      url: link.href.split("?")[0],
      collectedAt: Date.now()
    };
  }

  function firstText(root, selectors) {
    for (const selector of selectors) {
      try {
        const node = root.querySelector(selector);
        const text = normalizeText(node?.innerText || node?.textContent);
        if (text) return text;
      } catch (_) {}
    }
    return "";
  }

  async function executeApplication(greeting) {
    if (hasVerificationChallenge()) {
      return { ok: false, status: "blocked", message: "检测到安全验证，批量任务已停止，请手动处理后再继续。" };
    }

    const already = findVisibleButton(["继续沟通", "已投递", "已申请", "沟通中"]);
    if (already) {
      highlight(already, "已沟通/已投递，已跳过");
      return { ok: true, status: "already-contacted", message: normalizeText(already.innerText) };
    }

    const action = findVisibleButton([
      "立即沟通",
      "立即投递",
      "投递简历",
      "立即应聘",
      "申请职位",
      "聊一聊"
    ]);

    if (!action) {
      injectAssistantCard(greeting, "没有识别到投递按钮，请在当前页手动确认。", "warning");
      return { ok: false, status: "no-action", message: "未识别到投递/沟通按钮" };
    }

    highlight(action, "职舟正在执行本次已确认的投递");
    action.click();
    await wait(1200);

    if (hasVerificationChallenge()) {
      return { ok: false, status: "blocked", message: "点击后出现安全验证，任务已停止。" };
    }

    const input = findMessageInput();
    let sentGreeting = false;
    if (input && greeting) {
      setInputValue(input, greeting);
      await wait(350);
      const sendButton = findVisibleButton(["发送", "确认发送"]);
      if (sendButton) {
        sendButton.click();
        sentGreeting = true;
        await wait(400);
      }
    }

    const confirmButton = findVisibleButton(["确认投递", "确定投递", "确认申请"]);
    if (confirmButton) {
      confirmButton.click();
      await wait(400);
    }

    injectAssistantCard(
      greeting,
      sentGreeting ? "已点击沟通并发送招呼语" : "已点击投递/沟通按钮，请核对页面结果",
      "success"
    );
    return {
      ok: true,
      status: sentGreeting ? "sent" : "applied",
      message: sentGreeting ? "已发送招呼语" : `已点击「${normalizeText(action.innerText)}」`
    };
  }

  function findVisibleButton(texts) {
    const candidates = [...document.querySelectorAll("button, a, [role='button'], span")];
    for (const wanted of texts) {
      const exact = candidates.find((node) => isVisible(node) && normalizeText(node.innerText) === wanted);
      if (exact) return exact.closest("button, a, [role='button']") || exact;
    }
    for (const wanted of texts) {
      const partial = candidates.find((node) => {
        const text = normalizeText(node.innerText);
        return isVisible(node) && text.length <= 16 && text.includes(wanted);
      });
      if (partial) return partial.closest("button, a, [role='button']") || partial;
    }
    return null;
  }

  function findMessageInput() {
    const selectors = [
      "textarea:visible",
      "textarea",
      "[contenteditable='true'][role='textbox']",
      "[contenteditable='true']"
    ];
    for (const selector of selectors) {
      let nodes = [];
      try {
        nodes = [...document.querySelectorAll(selector.replace(":visible", ""))];
      } catch (_) {}
      const input = nodes.find((node) => isVisible(node));
      if (input) return input;
    }
    return null;
  }

  function setInputValue(input, value) {
    input.focus();
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
      if (descriptor?.set) descriptor.set.call(input, value);
      else input.value = value;
    } else {
      input.textContent = value;
    }
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function hasVerificationChallenge() {
    const text = normalizeText(document.body?.innerText).slice(0, 25000);
    return ["安全验证", "人机验证", "拖动滑块", "访问异常", "完成验证", "验证码"].some((word) => text.includes(word));
  }

  function highlight(element, label) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.style.setProperty("outline", "4px solid #6d5dfc", "important");
    element.style.setProperty("outline-offset", "4px", "important");
    element.dataset.jobAgentLabel = label;
  }

  function injectAssistantCard(greeting, status, tone) {
    document.getElementById("job-agent-assistant-card")?.remove();
    const card = document.createElement("div");
    card.id = "job-agent-assistant-card";
    card.style.cssText = [
      "position:fixed",
      "right:24px",
      "top:84px",
      "z-index:2147483647",
      "width:320px",
      "padding:16px",
      "border-radius:16px",
      "box-shadow:0 18px 50px rgba(20,18,55,.24)",
      "background:#fff",
      "color:#27243b",
      "font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif",
      `border:1px solid ${tone === "success" ? "#aee9cc" : "#f2d39c"}`
    ].join(";");
    const title = document.createElement("strong");
    title.textContent = `职舟：${status}`;
    const text = document.createElement("p");
    text.textContent = greeting || "";
    text.style.cssText = "margin:10px 0 0;color:#625f76;word-break:break-word";
    const close = document.createElement("button");
    close.textContent = "关闭";
    close.style.cssText = "margin-top:12px;border:0;border-radius:8px;padding:6px 12px;background:#eeeafd;color:#5847df;cursor:pointer";
    close.addEventListener("click", () => card.remove());
    card.append(title, text, close);
    document.documentElement.appendChild(card);
  }

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function simpleHash(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `job_${(hash >>> 0).toString(36)}`;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
