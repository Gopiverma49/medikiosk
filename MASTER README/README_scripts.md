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

## 📱 How the Mobile QR Code Works (`scripts/tunnel-qr.js`)

When you run `npm run dev:all`, you will see a big QR code printed right inside your terminal:

```
============================================================
✅ MOBILE ACCESS ONLINE (Secure HTTPS)
============================================================

📱 SCAN WITH YOUR PHONE CAMERA:
(Opens MediKiosk directly on your phone)

[  QR CODE APPEARS HERE  ]

🌐 Public URL: https://xxxx.serveousercontent.com
============================================================
```

### Why Do We Need a Tunnel & QR Code?
1. **Easy Phone Testing:** Instead of typing long IP addresses, you can simply point your phone's camera at the terminal screen to open the patient kiosk.
2. **Camera & Microphone Permissions:** Mobile web browsers (like Chrome on Android or Safari on iPhone) block camera access for barcode scanning and microphone access for voice input unless the website is on a **secure HTTPS connection**. The tunnel provides HTTPS so everything works out of the box!

### 💡 Good to Know:
If you see a blue **"Serveo Browser Warning"** on your phone when opening the link for the first time, simply tap the **"Continue to Site"** button. This is just a standard one-time safety confirmation from the free tunnel service.

---

## 🔍 Fast Terminal OCR Tester (`scripts/run_ocr.js`)

If you want to quickly test if our image-reading engine (Tesseract OCR) can read a prescription image without opening the web browser, you can run:

```bash
node scripts/run_ocr.js sample_data/sample_prescription.png
```

It will immediately process the image in the background and print all the recognized medicine names directly onto your terminal screen!
