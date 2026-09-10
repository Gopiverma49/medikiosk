# MediKiosk Mobile Access Guide (Option 1: Local Wi-Fi Network)

This guide explains **how running your project on your mobile phone via local Wi-Fi works**, how the network communication happens under the hood, and how to set it up step-by-step.

---

## 1. How Does It Work Under the Hood?

```
+--------------------------+                         +--------------------------+
|       YOUR LAPTOP        |                         |        YOUR PHONE        |
|  (Running Dev Servers)   |                         |     (Mobile Browser)     |
|                          |                         |                          |
|  * FastAPI Backend: 8000 |       Local Wi-Fi       |  * Chrome / Safari       |
|  * Next.js Frontend: 3000|<=======================>|  * Opens:                |
|  * Local IP: 192.168.x.x |   (Router / Hotspot)    |    http://192.168.x.x:3000|
+--------------------------+                         +--------------------------+
```

### The Concept:
1. **Local Area Network (LAN):** When your laptop and phone connect to the same Wi-Fi router (or mobile hotspot), the router assigns each device a unique private IP address (like `192.168.1.15`).
2. **`localhost` vs `0.0.0.0`:**
   - By default, dev servers listen on `localhost` (`127.0.0.1`), which means *"only accept connections coming from inside this laptop"*.
   - When we configure the servers to listen on `0.0.0.0`, it tells your laptop: *"accept connections from any device on my local Wi-Fi network"*.
3. **Seamless API Proxy:**
   - When you load the frontend on your phone (`http://192.168.x.x:3000`), Next.js serves the mobile-responsive web pages to your phone.
   - Any backend API requests (fetching tokens, patient triage, AI summaries) are routed directly between the phone and your laptop's backend server.

---

## 2. Step-by-Step Setup Guide

### Step 1: Connect Both Devices to the Same Wi-Fi
- Make sure your laptop and your smartphone are connected to the **same Wi-Fi network**.
- *(Alternative)*: If no Wi-Fi router is available, turn on **Personal Hotspot** on your phone and connect your laptop to your phone's hotspot.

---

### Step 2: Find Your Laptop's Local IP Address
1. Open PowerShell or Command Prompt on your laptop.
2. Run:
   ```powershell
   ipconfig
   ```
3. Look for **Wireless LAN adapter Wi-Fi** and find the line:
   ```text
   IPv4 Address. . . . . . . . . . . : 192.168.X.XXX
   ```
   *(Example: `192.168.1.24` or `192.168.29.105`)*

---

### Step 3: Run Everything in 1 Command
Simply run:
```powershell
npm run dev:all
```
*(Or double-click `start_medikiosk.bat` on Windows)*

This automatically starts:
1. **FastAPI Backend** (listening on `0.0.0.0:8000`)
2. **Next.js Frontend** (listening on `0.0.0.0:3000`)
3. **Connectivity Suite** (prints both Local Wi-Fi & Public HTTPS Tunnel QR codes)

---

### Step 4: Open the App on Your Phone
1. **Option 1 (Fastest):** Scan the **Local Wi-Fi QR Code** in your terminal using your phone camera (when connected to the same Wi-Fi / Hotspot).
2. **Option 2 (Anywhere):** Scan the **Public HTTPS Tunnel QR Code** in your terminal to open MediKiosk over 4G/5G or external networks with valid SSL.

---

### Step 5 (Optional): Install as a Mobile App (PWA Experience)
To use MediKiosk in full screen without the browser URL bar:
- **On Android (Chrome):** Tap the **3 vertical dots** menu (top-right) -> Tap **"Add to Home screen"** or **"Install app"**.
- **On iPhone (Safari):** Tap the **Share** button (box with arrow) -> Tap **"Add to Home Screen"**.

Now you get an app icon on your phone that launches MediKiosk like a native app.

---

## 3. Advantages & Limitations

### Advantages:
- **Zero cost & no accounts needed:** No cloud hosting or domain purchases required.
- **Real-time Live Reload:** When you edit code on your laptop, the changes update immediately on your phone screen.
- **Fast & Private:** All clinical data and testing remain strictly inside your local network.

### Things to Keep in Mind:
1. **Laptop must stay on:** The laptop is acting as the server, so keep it awake and running.
2. **Windows Firewall Prompt:** If Windows Firewall pops up asking for permission when starting Python or Node.js, click **"Allow access"** on Private networks.
3. **Microphone Permissions:** Modern mobile browsers restrict audio/microphone input on non-HTTPS origins by default, unless using `localhost` or explicitly allowed in Chrome flags (`chrome://flags/#unsafely-treat-insecure-origin-as-secure`). If you need voice intake on phone later, we can enable an HTTPS tunnel.

---

## 4. Troubleshooting Common Issues

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| Phone says "Site can't be reached" | Devices on different networks | Verify both phone and laptop are on the exact same Wi-Fi. |
| Connection times out | Windows Firewall blocking port 3000/8000 | Check Windows Defender Firewall -> Allow Node.js & Python through private network. |
| Wrong IP address used | Used public IP instead of local IPv4 | Run `ipconfig` and look for the `192.168.x.x` or `10.x.x.x` address. |
