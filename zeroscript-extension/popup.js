// SPDX-License-Identifier: GPL-3.0-or-later - Remote patch
const KOFI_URL = "https://ko-fi.com/sebattfg";
const SUPPORTED_HOSTS = [
  "chat.deepseek.com", "deepseek.com", "chatgpt.com", "chat.openai.com",
  "gemini.google.com", "www.kimi.ai", "kimi.ai",
  "chat.z.ai", "chat.qwen.ai", "arena.ai", "www.meta.ai", "meta.ai",
];
const DEFAULT_AI_URL = "https://chat.deepseek.com/";
const DEFAULT_BRIDGE = "ws://127.0.0.1:17613";

document.getElementById("ver").textContent = `v${chrome.runtime.getManifest().version}`;

function render(s) {
  const dot = document.getElementById("dot");
  const state = document.getElementById("state");
  const tools = document.getElementById("tools");
  const servers = document.getElementById("servers");
  const bridgeUrlEl = document.getElementById("bridgeUrl");
  const urlHelp = document.getElementById("urlHelp");
  const list = s.servers || [];
  const up = list.filter((x) => x.alive).length;
  const mcpOk = s.connected && (s.mcpAlive || up > 0 || s.tools > 0);
  const studioOff = mcpOk && s.studio === false;
  const ok = mcpOk && !studioOff;
  dot.className = "dot " + (s.connected ? (ok ? "on" : "warn") : "");
  state.textContent = s.connected
    ? (ok ? "Connected · Roblox Studio ready" : studioOff ? "Studio not connected · enable MCP di Studio" : "Bridge OK · buka Roblox Studio")
    : "Bridge offline";
  tools.textContent = s.connected ? `${s.tools || 0} tools available` : `Bridge tidak konek ke ${s.bridgeUrl || DEFAULT_BRIDGE}`;
  servers.textContent = s.connected
    ? list.map((x) => `${x.alive ? "●" : "○"} ${x.id} (${x.alive ? x.tools + " tools" : "down"})`).join("\n")
    : "";
  bridgeUrlEl.textContent = `URL: ${s.bridgeUrl || DEFAULT_BRIDGE}`;
  if (urlHelp) {
    if (!s.connected) urlHelp.textContent = `⚠️ Tidak konek ke ${s.bridgeUrl || DEFAULT_BRIDGE}. Cek PC firewall & IP.`;
    else urlHelp.textContent = `✅ Konek ke ${s.bridgeUrl || DEFAULT_BRIDGE}`;
    urlHelp.style.color = s.connected ? "#34d399" : "#fbbf24";
  }
  // sync input if user hasn't typed
  const inp = document.getElementById("bridgeInput");
  if (inp && document.activeElement !== inp && s.bridgeUrl) {
    inp.value = s.bridgeUrl;
    inp.placeholder = DEFAULT_BRIDGE;
  }
}

function refresh() {
  chrome.runtime.sendMessage({ type: "status" }, (s) => s && render(s));
  chrome.runtime.sendMessage({ type: "get_bridge_url" }, (r) => {
    if (r && r.url) {
      const inp = document.getElementById("bridgeInput");
      if (inp && document.activeElement !== inp) inp.value = r.url;
    }
  });
}

document.getElementById("reconnect").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "reconnect" }, () => setTimeout(refresh, 600));
});
document.getElementById("restart").addEventListener("click", (e) => {
  e.target.textContent = "Restarting…";
  chrome.runtime.sendMessage({ type: "restart_mcp" }, () => {
    e.target.textContent = "⟳ Restart Roblox server";
    setTimeout(refresh, 600);
  });
});
document.getElementById("kofi").addEventListener("click", () => { chrome.tabs.create({ url: KOFI_URL }); });
document.getElementById("settings").addEventListener("click", () => {
  chrome.tabs.query({}, (tabs) => {
    const active = tabs.find((t) => t.active && t.url && SUPPORTED_HOSTS.some((h) => t.url.includes(h)));
    const anySupported = active || tabs.find((t) => t.url && SUPPORTED_HOSTS.some((h) => t.url.includes(h)));
    if (anySupported) { chrome.tabs.sendMessage(anySupported.id, { type: "zs-open-menu" }); chrome.tabs.update(anySupported.id, { active: true }); }
    else { chrome.tabs.create({ url: DEFAULT_AI_URL }); }
  });
});

// Remote URL save
document.getElementById("saveUrl").addEventListener("click", () => {
  const inp = document.getElementById("bridgeInput");
  const url = (inp.value || "").trim();
  const btn = document.getElementById("saveUrl");
  if (!url) { inp.style.borderColor = "#ef4444"; return; }
  btn.textContent = "Saving…";
  btn.disabled = true;
  chrome.runtime.sendMessage({ type: "set_bridge_url", url }, (r) => {
    btn.textContent = "Save & Reconnect";
    btn.disabled = false;
    if (!r || !r.ok) {
      inp.style.borderColor = "#ef4444";
      alert(r && r.error ? r.error : "Gagal save URL");
    } else {
      inp.style.borderColor = "#34d399";
      setTimeout(() => inp.style.borderColor = "", 1500);
      setTimeout(refresh, 800);
    }
  });
});
document.getElementById("resetUrl").addEventListener("click", () => {
  const inp = document.getElementById("bridgeInput");
  inp.value = DEFAULT_BRIDGE;
  document.getElementById("saveUrl").click();
});
document.getElementById("bridgeInput").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("saveUrl").click(); });

chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === "zs-status") render(msg); });
refresh();
setInterval(refresh, 2000);
