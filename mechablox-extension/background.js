// SPDX-License-Identifier: GPL-3.0-or-later
// background.js - service worker REMOTE patch.
// Owns ONE resilient WebSocket to the bridge. Default ws://127.0.0.1:17613
// but now configurable via chrome.storage.local "zsBridgeUrl" for HP -> PC remote.
// User sets it in popup (ws://192.168.x.x:17613, ws://100.x.x.x:17613, wss://xxx.trycloudflare.com)

const PORT = 17613;
const DEFAULT_URL = `ws://127.0.0.1:${PORT}`; // will be auto-found on HP (LAN scan), PC stays 127.0.0.1
let URL = DEFAULT_URL;
let autoScanning = false;

// Load custom URL from storage (HP remote)
try {
  chrome.storage.local.get("zsBridgeUrl", (r) => {
    if (r && r.zsBridgeUrl && typeof r.zsBridgeUrl === "string" && r.zsBridgeUrl.trim()) {
      URL = r.zsBridgeUrl.trim();
      console.log("[zs-bg] using custom bridge URL:", URL);
      // if already connecting to default, reconnect to custom
      if (URL !== DEFAULT_URL) {
        try { if (ws) ws.close(); } catch {}
        connect();
      }
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.zsBridgeUrl) {
      const nv = (changes.zsBridgeUrl.newValue || "").trim() || DEFAULT_URL;
      URL = nv;
      console.log("[zs-bg] bridge URL changed ->", URL, "reconnecting...");
      try { if (ws) ws.close(); } catch {}
      reconnectDelay = RECONNECT_MIN;
      connect();
      broadcastStatus();
    }
  });
} catch (e) { console.log("[zs-bg] storage init failed", e); }

const PROVIDER_URLS = ["https://chat.deepseek.com/*", "https://chatgpt.com/*", "https://chat.openai.com/*", "https://gemini.google.com/*", "https://www.kimi.ai/*", "https://kimi.ai/*", "https://chat.z.ai/*", "https://chat.qwen.ai/*", "https://arena.ai/*", "https://www.meta.ai/*", "https://meta.ai/*"];

const RECONNECT_MIN = 1000;
const RECONNECT_MAX = 5000;
const HEARTBEAT_MS = 10000;
const STALE_SOCKET_MS = 25000;
const REQUEST_TIMEOUT_DEFAULT = 130000;

let ws = null;
let connected = false;
let reconnectDelay = RECONNECT_MIN;
let reconnectTimer = null;
let heartbeatTimer = null;
let lastMessageAt = 0;
let nextId = 1;
const pending = new Map();
let toolsCache = [];
let mcpAlive = false;
let serversCache = [];
let studioConnected = null;
let studioApp = null;
let studioProc = null;

function log(...a) { console.log("[zs-bg]", ...a); }

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  clearTimeout(reconnectTimer);
  log("connecting to", URL);
  try {
    ws = new WebSocket(URL);
  } catch (e) {
    log("WebSocket ctor failed", e, URL);
    scheduleReconnect();
    return;
  }
  ws.onopen = () => {
    connected = true;
    reconnectDelay = RECONNECT_MIN;
    lastMessageAt = Date.now();
    log("connected to bridge", URL);
    startHeartbeat();
    broadcastStatus();
  };
  ws.onmessage = (ev) => {
    lastMessageAt = Date.now();
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    handleBridgeMessage(msg);
  };
  ws.onclose = (ev) => {
    log("bridge closed", ev.code, ev.reason, URL);
    connected = false;
    mcpAlive = false;
    studioConnected = null;
    studioApp = null;
    studioProc = null;
    serversCache = [];
    stopHeartbeat();
    failAllPending("bridge connection closed");
    broadcastStatus();
    scheduleReconnect();
  };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 1.7, RECONNECT_MAX);
}
function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (connected) {
      if (lastMessageAt && Date.now() - lastMessageAt > STALE_SOCKET_MS) {
        log("socket stale, forcing reconnect");
        try { ws.close(); } catch {}
        return;
      }
      send({ type: "ping" }).catch(() => {});
      refreshStudioStatus();
    }
  }, HEARTBEAT_MS);
}
function stopHeartbeat() { clearInterval(heartbeatTimer); heartbeatTimer = null; }

function waitForConnection(timeout = 8000) {
  return new Promise((resolve) => {
    if (connected && ws && ws.readyState === WebSocket.OPEN) return resolve(true);
    connect();
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (connected && ws && ws.readyState === WebSocket.OPEN) { clearInterval(iv); resolve(true); }
      else if (Date.now() - t0 > timeout) { clearInterval(iv); resolve(false); }
    }, 100);
  });
}

async function send(obj, timeout = REQUEST_TIMEOUT_DEFAULT) {
  if (!connected || !ws || ws.readyState !== WebSocket.OPEN) await waitForConnection(8000);
  return new Promise((resolve) => {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      resolve({ ok: false, kind: "disconnected", error: `bridge not connected (${URL})` });
      return;
    }
    const id = nextId++;
    const payload = { ...obj, id };
    const timer = setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); resolve({ ok: false, kind: "timeout", error: "bridge did not respond in time" }); }
    }, timeout);
    pending.set(id, { resolve, timer });
    try { ws.send(JSON.stringify(payload)); } catch (e) {
      clearTimeout(timer); pending.delete(id);
      resolve({ ok: false, kind: "disconnected", error: String(e) });
    }
  });
}

let studioProbing = false;
async function refreshStudioStatus() {
  if (studioProbing || !connected) return;
  studioProbing = true;
  try {
    const r = await send({ type: "studio_status" }, 12000);
    const v = r && r.ok && typeof r.studio === "boolean" ? r.studio : null;
    if (v !== studioConnected) { studioConnected = v; broadcastStatus(); }
  } finally { studioProbing = false; }
}

function handleBridgeMessage(msg) {
  if ("studio" in msg && (typeof msg.studio === "boolean" || msg.studio === null)) studioConnected = msg.studio;
  if ("studio_app" in msg && (typeof msg.studio_app === "boolean" || msg.studio_app === null)) studioApp = msg.studio_app;
  if ("studio_proc" in msg && (typeof msg.studio_proc === "boolean" || msg.studio_proc === null)) studioProc = msg.studio_proc;
  if (msg.type === "studio_status") { resolvePending(msg.id, { ok: true, studio: studioConnected }); broadcastStatus(); return; }
  if (msg.type === "connected") {
    mcpAlive = !!msg.mcp_alive;
    if (Array.isArray(msg.tools)) toolsCache = msg.tools;
    if (Array.isArray(msg.servers)) serversCache = msg.servers;
    broadcastStatus(); return;
  }
  if (msg.type === "pong") { resolvePending(msg.id, { ok: true }); return; }
  if (msg.type === "tools") {
    if (Array.isArray(msg.tools)) toolsCache = msg.tools;
    if (Array.isArray(msg.servers)) serversCache = msg.servers;
    mcpAlive = !!msg.mcp_alive;
    resolvePending(msg.id, { ok: true, tools: toolsCache });
    broadcastStatus(); return;
  }
  if (msg.type === "tool_result") {
    resolvePending(msg.id, msg.ok ? { ok: true, text: msg.text, images: msg.images || [] } : { ok: false, kind: msg.kind, error: msg.error });
    return;
  }
  if (msg.type === "mcp_status") {
    mcpAlive = !!msg.alive;
    if (Array.isArray(msg.tools)) toolsCache = msg.tools;
    if (Array.isArray(msg.servers)) serversCache = msg.servers;
    resolvePending(msg.id, { ok: !!msg.ok, alive: msg.alive, error: msg.error });
    broadcastStatus(); return;
  }
  if (msg.type === "server_changed") { resolvePending(msg.id, { ok: !!msg.ok, error: msg.error, restarting: !!msg.restarting }); return; }
  if (msg.type === "error") { resolvePending(msg.id, { ok: false, error: msg.error }); return; }
}

function resolvePending(id, value) {
  const p = pending.get(id); if (!p) return;
  clearTimeout(p.timer); pending.delete(id); p.resolve(value);
}
function failAllPending(reason) {
  for (const [, p] of pending) { clearTimeout(p.timer); p.resolve({ ok: false, kind: "disconnected", error: reason }); }
  pending.clear();
}

function statusObj() {
  return { type: "zs-status", connected, mcpAlive, studio: studioConnected, studioApp, studioProc, tools: toolsCache.length, servers: serversCache, bridgeUrl: URL };
}
function broadcastStatus() {
  chrome.runtime.sendMessage(statusObj()).catch(() => {});
  chrome.tabs.query({ url: PROVIDER_URLS }, (tabs) => {
    for (const t of tabs) chrome.tabs.sendMessage(t.id, statusObj()).catch(() => {});
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "status":
        if (!connected) connect();
        sendResponse(statusObj());
        break;
      case "list_tools": {
        const r = await send({ type: "list_tools" }, 10000);
        if (r.ok) sendResponse({ ok: true, tools: r.tools });
        else sendResponse({ ok: toolsCache.length > 0, tools: toolsCache, error: r.error });
        break;
      }
      case "call_tool": {
        const timeout = (msg.timeout || 120000) + 10000;
        const r = await send({ type: "call_tool", name: msg.name, arguments: msg.arguments, timeout: msg.timeout }, timeout);
        sendResponse(r); break;
      }
      case "restart_mcp": {
        const r = await send({ type: "restart_mcp" }, 30000);
        sendResponse(r); break;
      }
      case "add_server": {
        const r = await send({ type: "add_server", server_id: msg.server_id, command: msg.command, args: msg.args, env: msg.env }, 15000);
        sendResponse(r); break;
      }
      case "remove_server": {
        const r = await send({ type: "remove_server", server_id: msg.server_id }, 15000);
        sendResponse(r); break;
      }
      case "reconnect":
        reconnectDelay = RECONNECT_MIN;
        try { if (ws) ws.close(); } catch {}
        connect();
        sendResponse({ ok: true, url: URL });
        break;
      case "set_bridge_url": {
        const newUrl = (msg.url || "").trim();
        if (!newUrl) { sendResponse({ ok: false, error: "URL kosong" }); break; }
        try { new URL(newUrl); } catch { sendResponse({ ok: false, error: "URL tidak valid (contoh ws://192.168.1.15:17613 atau wss://xxx.trycloudflare.com)" }); break; }
        await chrome.storage.local.set({ zsBridgeUrl: newUrl });
        // onChanged listener will reconnect; also do it now
        URL = newUrl;
        try { if (ws) ws.close(); } catch {}
        reconnectDelay = RECONNECT_MIN;
        connect();
        sendResponse({ ok: true, url: URL });
        break;
      }
      case "get_bridge_url":
        sendResponse({ ok: true, url: URL, defaultUrl: DEFAULT_URL });
        break;
      case "scan_lan": {
        // Auto-find PC on LAN: try common IPs in parallel, first ws that opens wins
        if (autoScanning) { sendResponse({ ok: false, error: "scan already running" }); break; }
        autoScanning = true;
        (async () => {
          const candidates = [];
          // priority: last successful + default gateway range
          // HP 192.168.1.71 scan showed PC at .73, so try .1-.254 of same /24 plus common gateways
          const bases = ["192.168.1", "192.168.0", "192.168.43", "192.168.18", "10.0.0"];
          // try .73 first (known for this setup), then .1, .15, .100 etc
          const priority = [73, 1, 15, 100, 101, 102, 254, 71];
          for (const b of bases) for (const p of priority) candidates.push(`ws://${b}.${p}:${PORT}`);
          // dedupe + limit 80
          const uniq = [...new Set(candidates)].slice(0,80);
          let found = null;
          const tryOne = (url) => new Promise(res => {
            try {
              const s = new WebSocket(url);
              const t = setTimeout(() => { try{s.close();}catch{}; res(null); }, 900);
              s.onopen = () => { clearTimeout(t); try{s.close();}catch{}; res(url); };
              s.onerror = () => { clearTimeout(t); res(null); };
            } catch { res(null); }
          });
          // batch 12 parallel
          for (let i=0; i<uniq.length; i+=12) {
            const batch = uniq.slice(i,i+12);
            const results = await Promise.all(batch.map(tryOne));
            found = results.find(r=>r);
            if (found) break;
            // allow UI to update
            try { chrome.runtime.sendMessage({type:"zs-status", scanProgress: Math.min(100, Math.round((i/uniq.length)*100))}); } catch{}
          }
          autoScanning = false;
          if (found) {
            await chrome.storage.local.set({ zsBridgeUrl: found });
            URL = found;
            try{ if(ws) ws.close(); }catch{}
            reconnectDelay = RECONNECT_MIN;
            connect();
            sendResponse({ ok: true, url: found });
          } else {
            sendResponse({ ok: false, error: "PC tidak ditemukan di LAN. Pastikan PC & HP satu WiFi & bridge jalan (ws://0.0.0.0:17613)" });
          }
        })();
        return true; // async
      }
      default: sendResponse({ ok: false, error: "unknown message" });
    }
  })();
  return true;
});

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
connect();
// Auto-scan on HP if not connected after 3s (easy setup: no manual IP)
setTimeout(() => {
  if (!connected && !autoScanning) {
    console.log("[zs-bg] auto-scan LAN for PC...");
    chrome.runtime.sendMessage({type:"scan_lan"}, ()=>{});
    // also trigger via self
    try {
      const candidates = ["192.168.1.73","192.168.1.15","192.168.1.100","192.168.0.1"];
      // fire scan via message to self
      chrome.runtime.sendMessage({type:"scan_lan"});
    } catch {}
  }
}, 4000);
