# 🛠️ Scripts & Launchers Guide — Starting & Connecting the App

> **Folder:** `scripts/` & Root Launchers  
> **What it does:** This folder contains the helper tools that start up the servers with a single click, create public mobile links, and print scannable QR codes in your terminal so you can use MediKiosk on your phone.

---

## 📁 What is Inside?

```
medikiosk/
├── start_medikiosk.bat        # Double-click file to start everything on Windows
├── package.json               # Command center with short commands (like npm run dev:all)
└── scripts/
    ├── tunnel-qr.js           # Generates the public phone link and terminal QR code
    └── run_ocr.js             # Fast tool to test reading an image from the terminal
```

---

## 🚀 The Easiest Ways to Start the App

### Option A: The Windows Double-Click Launcher (`start_medikiosk.bat`)
- If you are on Windows, simply double-click **`start_medikiosk.bat`**.
- It checks your computer, launches the backend and frontend at the same time, creates the mobile QR code, and opens `http://localhost:3000` automatically in your web browser!

---

### Option B: The Terminal Commands (`package.json`)
You can also run commands from your terminal:

| Command | What it does |
| :--- | :--- |
| `npm run dev:all` | **The Complete Suite:** Starts the backend server, frontend website, and the mobile phone link with QR code. |
| `npm run dev` | **Local Laptop Only:** Starts the backend and frontend on your laptop without the mobile link. |
| `npm run dev:tunnel` | **Mobile Link Only:** Runs just the tunnel script to get a new QR code for your phone. |

---

## 📱 How the Universal Mobile QR Code Works (`scripts/tunnel-qr.js`)

When you run `npm run dev:all` (or `start_medikiosk.bat`), MediKiosk prints **one unified, universal QR code** right inside your terminal:

```text
====================================================================
  📱 SCAN TO OPEN MEDIKIOSK ON YOUR PHONE
====================================================================
Works on any mobile phone (same Wi-Fi or 4G/5G Mobile Data):

[ █████████████████████████████████ ]
[ █ ▄▄▄▄▄ █  █ █▄ █ ▄▄▄ █ ▄▄▄▄▄ █ ]
[ █ █   █ █ ▄█▄ ▀▄█ █   █ █   █ █ ]
[ █ █▄▄▄█ █ ▄▄█▄▄ █ █▄▄ █ █▄▄▄█ █ ]
[ █▄▄▄▄▄▄▄█▄█ ▀ █ █ ▄ █▄█▄▄▄▄▄▄▄█ ]

🌐 Universal Mobile Link: https://xxxx.serveousercontent.com
📶 Network: Works on both Wi-Fi and Mobile Data (4G/5G)
⚡ Keep-Alive: ACTIVE (Auto-reconnecting via Serveo.net)
💻 Local LAN URL: http://192.168.1.15:3000
====================================================================
```

### 🌟 Key Resilience Features Built-In:
1. **One Global QR Code for Everything:** No confusing choices. A single QR code opens MediKiosk on your smartphone whether you are on the clinic Wi-Fi, hotspot, or 4G/5G mobile internet.
2. **Persistent SSH Keep-Alive:** Uses `ServerAliveInterval=10`, `ServerAliveCountMax=3`, and `TCPKeepAlive=yes` heartbeats so the connection stays open indefinitely even when your phone sleeps.
3. **Automated Dual-Provider Failover:** Automatically routes through **Serveo.net** with instant fallback to **Localhost.run (`nokey@localhost.run`)** if either network drops.
4. **Self-Healing Auto-Reconnect & Health Checks:** Checks tunnel health every 35 seconds via HTTPS GET and automatically revives the tunnel with fresh credentials if a drop is detected.
5. **Secure HTTPS for Mobile Camera & Mic:** Mobile browsers require secure HTTPS to allow barcode scanning and voice input. The universal gateway handles SSL automatically.
6. **Local Cache File (`scripts/.tunnel-info.json`):** Caches active IP and tunnel URLs so internal system endpoints like `/api/system/network-info` can broadcast status across the hospital.

### 💡 Good to Know:
If you see a blue **"Serveo Browser Warning"** on your phone when opening the link for the first time, simply tap the **"Continue to Site"** button. This is a standard one-time safety confirmation from the public tunnel provider.

---

## 🔍 Fast Terminal OCR Tester (`scripts/run_ocr.js`)

If you want to quickly test if our image-reading engine (Tesseract OCR) can read a prescription image without opening the web browser, you can run:

```bash
node scripts/run_ocr.js sample_data/sample_prescription.png
```

It will immediately process the image in the background and print all the recognized medicine names directly onto your terminal screen!
