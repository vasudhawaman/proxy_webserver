# 🔒 Proxy Server

A Node.js-based proxy server that checks if a website is safe to visit. It integrates with the Google Safe Browsing API and performs security header analysis to help users browse safely.

## 📌 Features

- ✅ Detects malicious URLs using **Google Safe Browsing API**
- 🛡️ Analyzes websites for missing **critical HTTP security headers**
- 🚫 Flags websites that use **HTTP instead of HTTPS**
- 📊 Calculates a **security score** and risk level
- 🌐 Clean and responsive frontend UI
- 🧠 Built using core Node.js modules — no frameworks like Express used

## ⚙️ Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/vasudhawaman/proxy_webserver.git .
   ```
2. **Move to Backend Folder**
   ```bash
   cd backend
   ```
3. **Install Dependencies**
   ```bash
   npm install ejs dotenv
   ```
4. **Create a .env file under backend folder and add your API key and PORT number**
   ```ini
   GOOGLE_API_KEY=your_google_safe_browsing_api_key
   PORT=port_number
   ```
5. **Start the Server**
   ```bash
   node --watch server.js
   ```

## 🧪 How It Works

1. The user visits `localhost:PORT` in their browser, which sends a `GET` request to the `/` endpoint.  
   The server responds with the homepage (`index.html`).

2. The browser then makes additional `GET` requests for static assets like the background image and `style.css`, which the server also serves.

3. The user enters a target URL into the input field on the homepage.  
   On submission, a `POST` request is sent to the `/isSafe` endpoint, including the target URL in the form data.

4. The proxy server extracts the URL and begins the following checks:

   - 🔍 **Google Safe Browsing Check:**  
     It queries the Google Safe Browsing API to determine whether the URL is flagged as malicious.  
     - If marked unsafe, the server responds immediately with a warning.

   - 🌐 **Protocol Check:**  
     If the URL uses HTTP instead of HTTPS, the server flags it as insecure and sends an appropriate response to the user.
     
   - 📡 **Security Header & SSL Analysis:**  
     If the URL is marked safe and uses HTTPS, the server sends a browser-like request to the target website. It also verifies the presence of a valid SSL/TLS certificate before proceeding with security header checks.

     - Upon receiving the response headers, it checks for the presence of the following essential security headers:
       - `Content-Security-Policy`
       - `Strict-Transport-Security`
       - `X-Frame-Options`
       - `X-XSS-Protection`
       - `X-Content-Type-Options`

5. Based on how many of these headers are present, the server calculates a **security score** and returns a result page with:
   - The calculated score
   - A safety message
   - A list of missing headers (if any)

## 🧰 Tech Stack

- **Node.js** – Core backend logic using built-in `http`, `https`, `fs`, and `path` modules (no frameworks like Express)
- **EJS** – Templating engine used to render dynamic result pages based on server-side data
- **Google Safe Browsing API** – Used to verify whether the entered URL is malicious or unsafe
- **dotenv** – Loads sensitive configuration (like API keys) from `.env` files into environment variables
- **HTML & CSS (Vanilla)** – Used to build a clean, responsive user interface without any frontend frameworks

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

## 👥 Team Members

1. **Vasudha Waman** – Mentor and project guide  
2. **Aneekesh** – Team leader; contributed to backend logic and integration  
3. **Veer** – Focused on backend functionality and API integration  
4. **Anish** – Handled UI development and styling with HTML/CSS

## 🚀 Future Targets

1. Enhance security by parsing incoming HTML and JavaScript to detect suspicious content such as iframes, phishing scripts, or embedded threats.
2. Implement a more robust SSL/TLS certificate validation mechanism, including expiry checks and certificate chain analysis.
3. Improve the design, responsiveness, and overall user experience of the dynamic result page.
4. Add logging and history tracking to maintain records of inspected URLs, timestamps, and safety assessments for auditing or reporting purposes.

