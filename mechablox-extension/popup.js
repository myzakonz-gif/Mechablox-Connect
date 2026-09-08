// SPDX-License-Identifier: GPL-3.0-or-later - Remote patch
const KOFI_URL = "https://ko-fi.com/myzakonz-gif";
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

// Auto Find PC
document.getElementById("autoFind").addEventListener("click", () => {
  const btn = document.getElementById("autoFind");
  btn.textContent = "🔍 Scanning LAN...";
  btn.disabled = true;
  document.getElementById("urlHelp").textContent = "Scanning 192.168.1.x / 192.168.0.x ...";
  chrome.runtime.sendMessage({ type: "scan_lan" }, (r) => {
    btn.textContent = "🔍 Auto Find PC";
    btn.disabled = false;
    if (r && r.ok) {
      document.getElementById("bridgeInput").value = r.url;
      document.getElementById("urlHelp").textContent = "✅ Ditemukan: " + r.url + " — saved & connecting";
      document.getElementById("urlHelp").style.color = "#34d399";
    } else {
      document.getElementById("urlHelp").textContent = "❌ " + (r && r.error || "tidak ditemukan");
      document.getElementById("urlHelp").style.color = "#fbbf24";
    }
    setTimeout(refresh, 800);
  });
});

// Scan QR (camera)
let qrStream = null;
document.getElementById("scanQr").addEventListener("click", async () => {
  const view = document.getElementById("qrView");
  const video = document.getElementById("qrVideo");
  view.style.display = "block";
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = qrStream;
    // Use BarcodeDetector if available (Chrome 83+), fallback to jsQR CDNs not bundled — simple: try native
    const scan = async () => {
      if (!qrStream) return;
      try {
        if ('BarcodeDetector' in window) {
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          const codes = await detector.detect(video);
          if (codes.length) {
            const val = codes[0].rawValue.trim();
            if (val.startsWith("ws://") || val.startsWith("wss://")) {
              document.getElementById("bridgeInput").value = val;
              document.getElementById("qrView").style.display = "none";
              if (qrStream) { qrStream.getTracks().forEach(t=>t.stop()); qrStream=null; }
              document.getElementById("saveUrl").click();
              return;
            }
          }
        }
      } catch {}
      requestAnimationFrame(scan);
    };
    scan();
  } catch (e) {
    alert("Kamera gagal: " + e.message + "\nKetik manual atau Auto Find.");
    view.style.display = "none";
  }
});
document.getElementById("qrClose").addEventListener("click", () => {
  document.getElementById("qrView").style.display = "none";
  if (qrStream) { qrStream.getTracks().forEach(t=>t.stop()); qrStream=null; }
});

chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === "zs-status") render(msg); });
refresh();
setInterval(refresh, 2000);
