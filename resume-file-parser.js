(function initResumeFileParser(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JobResumeParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createResumeFileParser() {
  "use strict";

  const MAX_FILES = 12;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 60 * 1024 * 1024;
  const MAX_COMBINED_CHARS = 140000;

  function extensionOf(name) {
    return String(name || "").toLowerCase().match(/\.([^.]+)$/)?.[1] || "";
  }

  function normalizeExtractedText(value) {
    return String(value || "")
      .replace(/\u0000/g, "")
      .replace(/[\t ]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  function assetUrl(path) {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) return chrome.runtime.getURL(path);
    if (typeof document !== "undefined") {
      const scriptUrl = document.querySelector('script[src*="resume-file-parser.js"]')?.src;
      if (scriptUrl) {
        const script = new URL(scriptUrl);
        const asset = new URL(path, new URL("./", script));
        asset.search = script.search;
        return asset.href;
      }
    }
    throw new Error("无法定位本地 PDF 解析组件");
  }

  async function loadPdfJs() {
    const pdfjs = await import(assetUrl("vendor/pdf.min.mjs"));
    pdfjs.GlobalWorkerOptions.workerSrc = assetUrl("vendor/pdf.worker.min.mjs");
    return pdfjs;
  }

  async function extractPdfText(file) {
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
    const document = await loadingTask.promise;
    const pages = [];
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        let line = "";
        const lines = [];
        for (const item of content.items || []) {
          if (!item?.str) continue;
          line += `${item.str}${item.hasEOL ? "\n" : " "}`;
          if (item.hasEOL) {
            lines.push(line.trim());
            line = "";
          }
        }
        if (line.trim()) lines.push(line.trim());
        pages.push(lines.filter(Boolean).join("\n"));
        page.cleanup();
      }
    } finally {
      if (typeof document.cleanup === "function") await document.cleanup();
      if (typeof document.destroy === "function") await document.destroy();
      else if (typeof loadingTask.destroy === "function") await loadingTask.destroy();
    }
    return normalizeExtractedText(pages.join("\n\n"));
  }

  async function extractDocxText(file) {
    if (!globalThis.mammoth?.extractRawText) throw new Error("DOCX 本地解析组件未加载");
    const result = await globalThis.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return {
      text: normalizeExtractedText(result.value),
      warnings: (result.messages || []).map((message) => String(message.message || message)).slice(0, 20)
    };
  }

  async function extractResumeFile(file) {
    const extension = extensionOf(file?.name);
    if (!file || !file.name) throw new Error("没有选择有效文件");
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} 超过 20MB`);
    if (["txt", "md"].includes(extension)) return { text: normalizeExtractedText(await file.text()), warnings: [] };
    if (extension === "pdf") return { text: await extractPdfText(file), warnings: [] };
    if (extension === "docx") return extractDocxText(file);
    throw new Error(`${file.name} 的格式不受支持；请选择 PDF、DOCX、TXT 或 MD`);
  }

  async function extractResumeFiles(filesInput, onProgress = () => {}) {
    const files = Array.from(filesInput || []).slice(0, MAX_FILES);
    if (!files.length) throw new Error("请选择至少一份简历");
    const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("所选简历合计不能超过 60MB");
    const reports = [];
    const sections = [];
    const warnings = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      onProgress({ index, total: files.length, fileName: file.name, phase: "extracting" });
      try {
        const result = await extractResumeFile(file);
        if (!result.text || result.text.length < 20) warnings.push(`${file.name} 没有提取到足够文字，若为扫描版 PDF 请先做 OCR`);
        else sections.push(`===== 简历文件：${file.name} =====\n${result.text}`);
        warnings.push(...(result.warnings || []).map((warning) => `${file.name}: ${warning}`));
        reports.push({ fileName: file.name, ok: Boolean(result.text), chars: result.text.length });
      } catch (error) {
        reports.push({ fileName: file.name, ok: false, chars: 0, error: String(error?.message || error) });
        warnings.push(`${file.name}: ${String(error?.message || error)}`);
      }
    }
    const fullText = sections.join("\n\n");
    const text = fullText.slice(0, MAX_COMBINED_CHARS);
    if (fullText.length > MAX_COMBINED_CHARS) warnings.push(`合并文本超过 ${MAX_COMBINED_CHARS} 字，已截断后发送给模型`);
    if (!text.trim()) throw new Error(warnings[0] || "没有从简历中提取到可用文字");
    onProgress({ index: files.length, total: files.length, phase: "complete" });
    return { text, reports, warnings: warnings.slice(0, 30), truncated: fullText.length > text.length };
  }

  return { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, MAX_COMBINED_CHARS, extensionOf, normalizeExtractedText, extractResumeFile, extractResumeFiles };
});
