/**
 * Angel Tree DB Exporter — frontend logic.
 *
 * Flow:
 *   1. Pick version (v3.x shows admin name/password; v5.x hides them).
 *   2. Select/drop a .Lgd file, Upload -> server returns a UUID.
 *   3. Decrypt -> server acks 202 and decodes in the background.
 *   4. Poll GET /api/status every POLL_INTERVAL_MS until done/error.
 *   5. Show a preview and download links for the .txt / .json result.
 */
(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const API = (cfg.API_BASE_URL || "").replace(/\/+$/, "");
  const POLL_MS = cfg.POLL_INTERVAL_MS || 10000;

  const $ = (id) => document.getElementById(id);
  const versionSel = $("version");
  const credentials = $("credentials");
  const credHint = $("credHint");
  const adminName = $("adminName");
  const password = $("password");
  const dropzone = $("dropzone");
  const dropText = $("dropText");
  const fileInput = $("fileInput");
  const uploadBtn = $("uploadBtn");
  const decryptBtn = $("decryptBtn");
  const statusBox = $("statusBox");
  const resultBox = $("resultBox");
  const preview = $("preview");
  const downloadTxt = $("downloadTxt");
  const downloadJson = $("downloadJson");

  let selectedFile = null;
  let uuid = null;
  let pollTimer = null;

  // --- version toggle ---
  // v3.x uses the admin password as the decryption key. v5.x needs no login, so
  // the credential boxes are shown but disabled (greyed out).
  function syncVersionUI() {
    const isV3 = versionSel.value === "v3";
    adminName.disabled = !isV3;
    password.disabled = !isV3;
    credentials.classList.toggle("disabled", !isV3);
    credHint.textContent = isV3
      ? "密码（通行证密码）将用作解密密钥。"
      : "v5.x 无需登录 — 此处已禁用。";
  }
  versionSel.addEventListener("change", syncVersionUI);
  syncVersionUI();

  // --- file selection (click + drag/drop) ---
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", () => setFile(fileInput.files[0] || null));

  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); }),
  );
  dropzone.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) setFile(f);
  });

  function setFile(file) {
    selectedFile = file;
    uuid = null;
    stopPolling();
    resultBox.hidden = true;
    hideStatus();
    if (file) {
      dropText.innerHTML = "已选择：<strong>" + escapeHtml(file.name) + "</strong>（" + fmtBytes(file.size) + "）";
      dropzone.classList.add("has-file");
      uploadBtn.disabled = false;
      decryptBtn.disabled = true;
    } else {
      dropText.innerHTML = "将 <code>.Lgd</code> 文件拖到此处，或点击选择文件";
      dropzone.classList.remove("has-file");
      uploadBtn.disabled = true;
      decryptBtn.disabled = true;
    }
  }

  // --- upload ---
  uploadBtn.addEventListener("click", async () => {
    if (!selectedFile) return;
    setBusy(uploadBtn, true);
    showStatus("正在上传…", "busy");
    try {
      const res = await fetch(API + "/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "X-Filename": selectedFile.name },
        body: selectedFile,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || ("上传失败（" + res.status + "）"));
      uuid = data.uuid;
      showStatus("上传完成，可以开始解密。", "ok");
      decryptBtn.disabled = false;
    } catch (err) {
      showStatus(err.message, "err");
    } finally {
      setBusy(uploadBtn, false);
    }
  });

  // --- decrypt + poll ---
  decryptBtn.addEventListener("click", async () => {
    if (!uuid) return;
    const version = versionSel.value;
    if (version === "v3" && !password.value.trim()) {
      showStatus("请输入 v3.x 的管理员密码。", "err");
      return;
    }
    setBusy(decryptBtn, true);
    resultBox.hidden = true;
    showStatus("正在启动解密…", "busy");
    try {
      const res = await fetch(API + "/api/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid: uuid,
          version: version,
          adminName: adminName.value.trim() || undefined,
          password: version === "v3" ? password.value : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || ("解密请求失败（" + res.status + "）"));
      showStatus("正在解密… 每 " + Math.round(POLL_MS / 1000) + " 秒检查一次。", "busy");
      startPolling();
    } catch (err) {
      showStatus(err.message, "err");
      setBusy(decryptBtn, false);
    }
  });

  function startPolling() {
    stopPolling();
    const check = async () => {
      try {
        const res = await fetch(API + "/api/status?uuid=" + encodeURIComponent(uuid));
        const data = await res.json();
        if (data.status === "done") {
          stopPolling();
          setBusy(decryptBtn, false);
          showStatus("解密完成。", "ok");
          await loadResult();
        } else if (data.status === "error") {
          stopPolling();
          setBusy(decryptBtn, false);
          const detail = data.detail && data.detail.error ? "：" + data.detail.error : "";
          showStatus("解密失败" + detail, "err");
        } else {
          showStatus("正在解密…（" + data.status + "）每 " + Math.round(POLL_MS / 1000) + " 秒检查一次。", "busy");
        }
      } catch (err) {
        showStatus("状态查询失败：" + err.message, "err");
      }
    };
    check();
    pollTimer = setInterval(check, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  async function loadResult() {
    const txtUrl = API + "/api/result?uuid=" + encodeURIComponent(uuid) + "&format=txt";
    const jsonUrl = API + "/api/result?uuid=" + encodeURIComponent(uuid) + "&format=json";
    downloadTxt.href = txtUrl;
    downloadTxt.download = uuid + ".txt";
    downloadJson.href = jsonUrl;
    downloadJson.download = uuid + ".json";
    resultBox.hidden = false;
    try {
      const res = await fetch(txtUrl);
      const text = await res.text();
      preview.textContent = text.length > 20000 ? text.slice(0, 20000) + "\n…（内容过长已截断，请下载查看完整结果）" : text;
    } catch {
      preview.textContent = "（无法加载预览 — 请使用下载链接）";
    }
  }

  // --- ui helpers ---
  function showStatus(msg, kind) {
    statusBox.hidden = false;
    statusBox.className = "status" + (kind === "ok" ? " ok" : kind === "err" ? " err" : "");
    statusBox.innerHTML = (kind === "busy" ? '<span class="spinner"></span>' : "") + escapeHtml(msg);
  }
  function hideStatus() { statusBox.hidden = true; }
  function setBusy(btn, busy) { btn.disabled = busy; }
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
    );
  }
})();
