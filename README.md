# PDF Editor

A lightweight, modern web-based PDF editor built with **React** and **Vite**. This application provides a seamless client-side solution for modifying PDF documents directly in the browser without relying on heavy external server-side processing.

 Load, view, and read existing PDF documents dynamically. Add custom text layers, overlays, and annotations anywhere on the document. Rapid rendering and editing built entirely within the browser for high security and performance. Built on Vite for near-instant hot module replacement (HMR) and optimized production builds.

*   **Frontend:** React (JavaScript)
*   **Build Tool:** Vite
*   **Containerization:** Docker & Docker Compose (Ready for consistent environment setups)
*   **Linting:** ESLint

Make sure you have [Node.js](https://nodejs.org) installed on your machine.

   ```bash
   git clone https://github.com
   cd PDF-EDITOR
   ```

   ```bash
   npm install
   ```

   ```bash
   npm run dev
   ```
   *Open `http://localhost:5173` in your browser to view the application.*

This project includes Docker configurations for easy environment orchestration.

```bash
docker-compose up --build
```
