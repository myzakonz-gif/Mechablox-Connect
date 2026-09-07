# Mechablox Connect — Kontrol Roblox Studio dari HP

**HP (Gemini / DeepSeek / ChatGPT) → PC (Roblox Studio MCP)**

Mechablox Connect adalah bridge + browser extension untuk mengendalikan Roblox Studio langsung dari chat AI di HP. Buka Gemini di HP, ketik perintah, Studio di PC jalan.

![Bridge](assets/banner.png)

## Fitur
- Read/edit scripts, run Luau, generate assets, control play-test dari chat
- Bridge `ws://0.0.0.0:17613` bisa diakses LAN / Tailscale / Tunnel
- Extension configurable `Bridge URL` (ganti tanpa rebuild) — `ws://192.168.x.x:17613`, `ws://100.x.x.x:17613`, `wss://xxx.trycloudflare.com`
- Token auth opsional `ZS_BRIDGE_TOKEN` untuk tunnel publik

## Opsi Koneksi

### Opsi 1: Satu WiFi (3 menit) — Rekomendasi
**PC:**
```bash
netsh advfirewall firewall add rule name="Mechablox Bridge" dir=in action=allow protocol=TCP localport=17613
ipconfig  # catat IPv4 192.168.1.xx
python bridge.py  # listening on ws://0.0.0.0:17613
# Roblox Studio -> Assistant AI -> ... -> Manage MCP Servers -> Enable Studio as MCP Server (dot hijau)
```

**HP:**
1. Install **Lemur Browser** (Play Store)
2. Kirim folder `zeroscript-extension` ke HP, di Lemur: `:` -> Extensions -> Developer mode ON -> Load unpacked
3. Buka `gemini.google.com`, puzzle icon -> Mechablox Connect -> Bridge URL: `ws://192.168.1.xx:17613` -> Save & Reconnect
4. Dot hijau = `Connected · Roblox Studio ready` -> `Start session`

Lihat `CARA_PAKAI_OPSI1_LAN.md` lengkap.

### Opsi 2: Tailscale (beda jaringan)
PC & HP install Tailscale, login sama. `tailscale ip -4` → `100.x.x.x`, HP isi `ws://100.x.x.x:17613`

### Opsi 3: Cloudflare Tunnel / Ngrok
```bash
cloudflared tunnel --url http://localhost:17613
# HP isi wss://xxx.trycloudflare.com
# pakai token: set ZS_BRIDGE_TOKEN=rahasia123 && python bridge.py -> HP: wss://xxx.trycloudflare.com/?token=rahasia123
```

## Install Extension di HP
- Kirim zip release ke HP, extract ZArchiver, Load unpacked di Lemur
- Support Gemini, DeepSeek, ChatGPT, Kimi, GLM, Qwen, Arena, Meta AI

## Troubleshooting
- Grey: salah IP / firewall / beda WiFi
- Kuning: Bridge OK tapi Studio belum open / MCP belum enable
- `netstat -ano | findstr 17613` cek port

## License
GPL-3.0 — Copyright (c) 2026 Mechablox Connect / sebattfg. See LICENSE.
