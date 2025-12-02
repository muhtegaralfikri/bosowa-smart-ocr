# 🛠️ Technical Stack & Architecture Specification

## 🏗️ Architecture Pattern
**Type:** Modular Monorepo (Manual Implementation)
**OS Environment:** Windows (PowerShell)
**Data Flow:** `Frontend (Crop)` -> `Backend (Proxy)` -> `Python (OCR Processing)`

---

## 🐍 1. AI & OCR Service (The Intelligence Layer)
This service is responsible for raw image processing. It is strictly isolated from the business logic.

* **Language:** Python 3.10+
* **Framework:** `FastAPI` (Asynchronous Server Gateway Interface)
* **Server:** `Uvicorn` (Lightning-fast ASGI server)
* **Core Engine:** `PaddleOCR` (v2.7+ via `paddlepaddle` backend)
* **Key Libraries:**
    * `python-multipart` (Required for File Uploads)
    * `shutil` (File handling)
* **Running Port:** `8000`
* **Base URL:** `http://127.0.0.1:8000`
* **CRITICAL CONSTRAINT:**
    * Due to recent library conflicts, `PaddleOCR` **MUST** be initialized with `use_angle_cls=False`.
    * Inference calls must also pass `cls=False` (e.g., `ocr_engine.ocr(path, cls=False)`).

---

## 🛡️ 2. Main Backend (The Orchestrator)
This service acts as the API Gateway, handling validation, file forwarding, and (future) database interactions.

* **Runtime:** Node.js (Latest LTS)
* **Framework:** NestJS (v10+)
* **Language:** TypeScript
* **API Paradigm:** REST API
* **Communication Client:** `@nestjs/axios` (Axios) for inter-service communication.
* **Data Handling:** `form-data` library (to construct multipart requests to Python).
* **Running Port:** `4000` (Changed from default 3000 to avoid conflict).
* **Linting/Formatting:**
    * ESLint rules are relaxed (`no-explicit-any`: off, `prettier`: warn) to speed up prototyping.
* **Folder Structure:** Modular pattern (e.g., `src/ocr/` contains Controller, Service, and Module).

---

## ⚛️ 3. Frontend (The User Interface)
The interface focuses on preprocessing the image (cropping) to ensure high OCR accuracy before upload.

* **Framework:** Next.js 14+ (App Router directory structure: `src/app`)
* **Language:** TypeScript (`.tsx`)
* **Styling:** Tailwind CSS (Utility-first)
* **Key Library:** `react-image-crop`
    * **Requirement:** Users MUST crop the image on the client-side.
    * **Output:** The cropped area is converted to a `Blob`/`File` object before being sent to the backend.
* **Running Port:** `3000`
* **API Consumption:** Calls `http://localhost:4000/ocr/scan` (NestJS), never calls Python directly.

---

## 📡 4. Inter-Service Communication Contract

### Endpoint: Image Processing
* **Step 1:** Frontend POSTs `multipart/form-data` to NestJS (`:4000`).
* **Step 2:** NestJS validates file type.
* **Step 3:** NestJS streams the buffer via Axios to FastAPI (`:8000`).
* **Step 4:** FastAPI saves temp file -> Runs PaddleOCR -> Returns JSON.
* **Step 5:** NestJS relays JSON response to Frontend.

### JSON Response Format (Standardized)
```json
{
  "status": "success",
  "data": [
    {
      "text": "INVOICE/2024/001",
      "confidence": 0.987
    },
    {
      "text": "Rp 500.000",
      "confidence": 0.950
    }
  ]
}