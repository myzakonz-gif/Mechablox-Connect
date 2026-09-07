# Remote Beda Jaringan (Tailscale / Ngrok)

## Tailscale (Aman, Rekomendasi kalau mau di luar rumah)
PC & HP install Tailscale (tailscale.com/download), login akun sama.
PC: tailscale ip -4  -> 100.64.x.x
HP: buka Tailscale app -> IP 100.x.x.x
Di Lemur HP Bridge URL isi: ws://100.64.x.x:17613  (IP Tailscale PC)
Keunggulan: terenkripsi, tidak perlu buka port publik, tidak perlu token.

## Ngrok / Cloudflare Tunnel (Publik)
Kalau tidak mau install Tailscale di HP:
PC install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect/networks/downloads/
Jalankan:
  cloudflared tunnel --url http://localhost:17613
-> dapat https://xxx-xxxx.trycloudflare.com
Di Lemur HP Bridge URL isi: wss://xxx-xxxx.trycloudflare.com
(otomatis wss, cloudflared forward ke ws://localhost:17613)

OPSIONAL TOKEN (wajib kalau publik):
PC sebelum run bridge:
  set ZS_BRIDGE_TOKEN=rahasia123
  python bridge.py
HP Bridge URL: wss://xxx.trycloudflare.com/?token=rahasia123
Tanpa token, orang yang tau URL ngrok kamu bisa eksekusi Luau apapun di Studio!

## Verifikasi
Di HP Lemur console (chrome://inspect jika HP colok PC) lihat [zs-bg] connected to bridge wss://...
