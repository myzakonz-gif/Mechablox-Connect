# OPSI 1 - HP ke PC Satu WiFi (Tanpa Tunnel, 3 Menit)

## Di PC (Windows)
1. Extract `Mechablox Connect-Free-Remote.zip` (sudah patch 1.5.4-remote)
   - Jangan pakai zip lama dari Releases

2. Buka CMD / PowerShell di folder extract, allow firewall sekali:
   netsh advfirewall firewall add rule name="Mechablox Connect Bridge" dir=in action=allow protocol=TCP localport=17613

3. Cek IP PC:
   ipconfig
   -> Cari Wireless LAN adapter Wi-Fi -> IPv4 Address: 192.168.1.xx (contoh 192.168.1.15)
   Catat!

4. Jalankan Bridge yang baru:
   python bridge.py
   # harus keluar: listening on ws://0.0.0.0:17613
   # jangan pakai start.bat lama (sudah 0.0.0.0)

5. Buka Roblox Studio -> load Place -> Assistant AI -> ... -> Manage MCP Servers -> Enable Studio as MCP Server (sampai dot hijau)
   Di bridge log harus: Roblox Studio connected - 27 tools ready

## Di HP Android

1. Install **Lemur Browser** (Play Store) - pengganti Kiwi yang sudah tidak update.
   Chrome asli Android TIDAK support extension desktop.

2. Kirim folder `mechablox-extension` dari PC ke HP via USB / Google Drive / Telegram Saved Messages (kirim zip lalu extract di HP pakai ZArchiver)

3. Di Lemur HP: Menu : -> Extensions -> Developer mode ON -> Load unpacked -> pilih folder `mechablox-extension` (yang ada manifest.json)

4. Buka `gemini.google.com` di Lemur, login akun sama.

5. Klik icon puzzle (Extension) -> Mechablox Connect -> di card "Bridge URL" isi:
   ws://192.168.1.15:17613
   (ganti 192.168.1.15 dengan IP PC kamu dari ipconfig tadi)
   Klik Save & Reconnect

6. Lihat dot di popup:
   - Grey = Bridge offline (salah IP / firewall / beda WiFi)
   - Kuning = Bridge OK tapi Studio belum open/enable MCP
   - Hijau = Connected · Roblox Studio ready -> SUKSES

7. Di gemini.google.com HP, klik "Start session", chat: "list_commands" atau "buatkan part merah di workspace"

## Troubleshooting
- Gak konek: pastikan HP & PC satu WiFi sama (cek di router, bukan data seluler). Ping dari HP: di Lemur buka http://192.168.1.15:17613 harus ada response (bukan timeout)
- Windows Firewall block: matikan sebentar Private firewall di Settings -> Privacy & security -> Windows Security -> Firewall
- Port dipakai: netstat -ano | findstr 17613
- Gemini model ngambek jadi plain text (tidak pakai tools) di sesi panjang: itu bug Gemini (ada warning di Extension), ganti ke DeepSeek chat.deepseek.com atau start new chat
