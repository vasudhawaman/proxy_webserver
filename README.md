# 🔒 Proxy Server

A powerful Node.js-based proxy server with a built-in browser extension that ensures safer browsing by inspecting websites for potential threats in real-time.

---

## 📌 Features

- ✅ Detects malicious URLs using the **Google Safe Browsing API**
- 🛡️ Scans for missing **critical HTTP security headers**
- 🔐 Performs **SSL/TLS certificate validation**
- 🧬 Parses and analyzes the **HTML content** to detect malicious scripts or behaviors
- 🚫 Flags websites using **HTTP instead of HTTPS**
- 📊 Calculates a comprehensive **security score and risk level**
- 🌐 Responsive and intuitive **frontend UI**
- ⚙️ Built entirely with **core Node.js modules** — no frameworks like Express

---
### ⚙️ Setup and Usage Instructions

This section guides you through setting up and using the proxy server and its accompanying Chrome extension.
### **1. Server Setup**

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/vasudhawaman/proxy_webserver.git .
    ```
2.  **Generate SSL Certificates**:
    Under the `certs` folder (in backend/src) generate a **rootCA.crt** and its corresponding **rootCA.key** using a tool like OpenSSL. These certificates are crucial for handling HTTPS traffic.
3.  **Configure Environment Variables**:
    Create a `.env` file in the `backend` folder based on the provided `.env.example`. Make sure to add your Google Safe Browse API key and define the server's port. You can get a free API key from the [Google Cloud Console](https://console.cloud.google.com).
4.  **Install Dependencies and Start the Server**:
    Navigate to the `backend` directory, install the required npm packages, and start the server. Node.js must be installed on your machine.
    ```bash
    cd backend
    npm i
    node --watch src/index.js
    ```
    This command starts the proxy server, which is now ready to handle incoming requests.

---

### **2. Chrome Extension Setup**

1.  **Trust the Root Certificate**:
    Before using the extension, you must add your `rootCA.crt` as a trusted certificate in Chrome. Go to `chrome://settings/security`, find **Manage certificates**, and import the certificate under the **Custom** or **Authorities** tab. This allows the browser to trust the HTTPS connections handled by your proxy.
2.  **Load the Extension**:
    Go to `chrome://extensions`, enable **Developer mode**, and click on **Load unpacked**. Select the `chrome-extension` folder from the cloned repository to load the extension.

---

### **3. Using the Extension**

1.  **Activate the Proxy**:
    Click the extension icon and toggle on **"Active Proxy"**. Once enabled, all your web requests will be redirected through the proxy server for analysis.
2.  **Customize Your Scan**:
    * **HTML Parser**: You have the option to enable the **HTML parser** to check for malicious code within web pages. Note that this may increase the response time.
    * **Manual URL Input**: You can also manually input a full URL (including the protocol, e.g., `https://example.com`) directly into the extension for a standalone security check.
3.  **Reviewing the Results**:
    After a check, you will be redirected to a results page.
    * For standard Browse, you can **continue** to the website or choose to mark it as **safe** or **unsafe**.
    * For manual URL inputs, the "continue" option is not available, but you can still mark the site's safety status.
4.  **Managing Feedback**:
    Click the **"Get Feedback"** button to view a list of all websites you have manually marked as safe or unsafe.
    * **Safe Websites**: The proxy will not perform any checks on websites marked as safe, allowing you to browse them directly.
    * **Unsafe Websites**: You will be blocked from accessing any websites marked as unsafe.
5.  **Resetting the List**:
    This list of marked websites will persist until you deactivate and then reactivate the proxy.
---

## 🧪 How It Works

### 1. Request Interception

Once the proxy is activated via the Chrome extension, any request made by the user is redirected to the proxy server.

### 2. Protocol Handling

- **For HTTP**:
  - The proxy directly forwards the HTTP request to the actual destination server.
  - It captures the response and performs multiple security checks before displaying the results to the user.

- **For HTTPS** (Man-in-the-Middle Simulation):
  - Chrome sends a `CONNECT` request to the proxy to initiate a TLS tunnel.
  - The proxy dynamically spins up a secure HTTPS server with a **fake certificate**, signed by a trusted **custom root CA** (pre-installed in the browser).
  - This fake server impersonates the destination while internally communicating with the real server.
  - The proxy decrypts the actual HTTPS response, performs security checks, and relays results to the user.

### 3. Security Checks Performed

- 🔍 **Google Safe Browsing Check**  
  Verifies the URL against Google's database of malicious or deceptive sites.

- 🔒 **HTTP Security Header Analysis**  
  Ensures presence of essential headers like:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-XSS-Protection`
  - `X-Content-Type-Options`

- 🔐 **SSL/TLS Certificate Inspection**  
  Checks the validity, chain of trust, and configuration of the target site’s SSL certificate.

- 🧠 **HTML Parsing for Malicious Content**  
  Analyzes the page’s HTML to detect:
  - Suspicious iframes
  - Known phishing patterns
  - Obfuscated or inline scripts

### 4. Result Display

After all checks are complete:
- A dynamic **EJS-powered results page** is rendered.
- Users can:
  - View security analysis results
  - Choose to continue browsing or go back
  - Optionally mark a website as safe or unsafe for future visits

---

## 🧰 Tech Stack

| Layer       | Technology Used                                               |
|-------------|---------------------------------------------------------------|
| **Backend** | Node.js (core modules only – `http`, `https`, `fs`, `path`)   |
| **Frontend (Extension)**| HTML, CSS (Vanilla)                                           |
| **Templating** | EJS                                                        |
| **Security**| Google Safe Browsing API, node-forge (for certificate generation) |
| **Env Config** | dotenv                                                     |

---

## 👥 Team Members

- 👨‍🏫 **Vasudha Waman** – Project Mentor  
- 🧑‍💻 **Aneekesh Yadav** – Team Leader, Backend Logic & Integration  
- 🧑‍💻 **Veer Doria** – Core Functionality, API Integration  
- 🎨 **Anish De** – UI/UX Design, Frontend Development

---

## 🚀 Future Goals

1. 🕵️ **Implement JavaScript Parsing**  
   Analyze inline and external JavaScript to detect obfuscated or malicious code, phishing attempts, and suspicious behavior.

2. 🌐 **Cross-Browser Extension Support**  
   Extend compatibility beyond Chrome to other browsers like Firefox, Edge, and Brave using WebExtension APIs.

3. 📱 **Mobile Compatibility**  
   Adapt the system to work on smartphones, either through mobile proxy configuration or a standalone mobile app.

4. ☁️ **Public Deployment**  
   Host the project on a reliable server or cloud platform so that users can access it without local setup.


---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
