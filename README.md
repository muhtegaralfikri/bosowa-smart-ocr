# Bosowa Smart OCR System

## 1. Project Overview
This project is an intelligent document processing system designed to digitize physical letters and invoices. It uses a **Microservices-like Monorepo Architecture** (without Docker) consisting of a Frontend, a Main Backend, and a specialized Python AI Service.

### Key Objectives
- Extract text from images (Surat/Invoice) using OCR.
- Allow users to crop images before processing to increase accuracy.
- Parse specific data fields (Dates, Invoice Numbers) from raw OCR text.

---

## 2. Architecture & Tech Stack

The system runs on **3 separate ports** on the local machine.

### A. Python OCR Service (The Brain) - Port 8000
- **Framework:** FastAPI
- **Engine:** PaddleOCR (Lightweight, supports angled text)
- **Role:** Receives an image file, performs OCR, and returns raw text/coordinates JSON.
- **Constraints:** Must use `venv` (Virtual Environment). No Docker.

### B. Backend API (The Orchestrator) - Port 4000
- **Framework:** NestJS (Node.js)
- **Role:** - Acts as the API Gateway.
  - Handles file uploads from Frontend.
  - Forwards images to Python Service using `HttpService` (Axios).
  - Cleaning/Parsing logic (Regex) applied to raw OCR data.
- **Database:** (To be implemented later)

### C. Frontend (The Interface) - Port 3000
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Key Library:** `react-image-crop`
- **Flow:** User Uploads Image -> User Crops Image -> Send to Backend -> Display Filled Form.

**Progress Checklist**
- [x] Phase 1 - Python OCR Service
- [x] Phase 2 - Backend API wiring
- [x] Phase 3 - Frontend upload/crop UI

---

## 3. Directory Structure (Monorepo)

The project MUST follow this exact structure. Do not deviate.

```text
bosowa-smart-ocr/
├── README.md
├── .gitignore               # Global gitignore
├── apps/
│   ├── ocr-engine/          # [Python] FastAPI Service
│   │   ├── venv/            # Virtual Env (Ignored)
│   │   ├── src/
│   │   │   ├── main.py      # Entry Point
│   │   │   └── utils.py
│   │   ├── requirements.txt
│   │   └── .env
│   │
│   ├── backend/             # [NestJS] Main API
│   │   ├── src/
│   │   │   ├── app.module.ts
│   │   │   ├── main.ts      # Listen on Port 4000
│   │   │   └── ocr/         # OCR Module (Controller/Service)
│   │   ├── eslint.config.mjs # Relaxed Lint Rules
│   │   └── package.json
│   │
│   └── frontend/            # [Next.js] UI
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   │   └── ImageCropper.tsx
│       │   └── services/
│       └── package.json
4. Implementation Details (Step-by-Step for AI)
Phase 1: Python Service (apps/ocr-engine)
Environment: Use python -m venv venv.

Dependencies: fastapi, uvicorn, python-multipart, paddlepaddle, paddleocr.

Core Logic (main.py):

Initialize PaddleOCR(use_angle_cls=False, lang='en'). Note: use_angle_cls MUST be False to avoid recent library bugs.

Create POST endpoint /process-ocr.

Accept UploadFile. Save to a temp folder, process, then delete.

Return JSON structure: data: [{ text: "...", confidence: 0.9 }].

Phase 2: Backend Service (apps/backend)
Setup: NestJS Standard.

Configuration:

Enable CORS in main.ts.

Set port to 4000.

ESLint: Disable strict rules in eslint.config.mjs (no-explicit-any, prettier warn only).

Module: Create OcrModule.

Service:

Import HttpModule (Axios).

Method processImage(file: Multer.File):

Construct FormData.

POST to http://127.0.0.1:8000/process-ocr.

Return data to Controller.

Phase 3: Frontend (apps/frontend)
Setup: Next.js App Router.

Components:

ImageUpload: Simple file input.

ImageCropper: Modal to crop image using react-image-crop BEFORE uploading.

ResultForm: Display the extracted text in editable inputs.

Integration: Fetch to http://localhost:4000/ocr/scan.

5. API Contracts
Python Service Endpoint
URL: POST http://127.0.0.1:8000/process-ocr

Body: multipart/form-data -> key: file

Response:

JSON

{
  "status": "success",
  "data": [
    { "text": "NO. INVOICE: INV/2023/001", "confidence": 0.98 },
    { "text": "TANGGAL: 12-12-2023", "confidence": 0.95 }
  ]
}
NestJS Endpoint (Client Facing)
URL: POST http://localhost:4000/ocr/scan

Body: multipart/form-data -> key: file

Response: (Proxied from Python, potentially cleaned)

6. How to Run (Development)
Open 3 separate terminals:

Environment files (copy before running):
- Backend: `apps/backend/.env` (see `.env.example` with `PORT=4000`, `PYTHON_SERVICE_URL=http://127.0.0.1:8000`)
- Frontend: `apps/frontend/.env.local` (see `.env.local.example` with `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`)

Python Engine:

Bash

cd apps/ocr-engine
.\venv\Scripts\Activate
uvicorn src.main:app --reload --port 8000
Backend:

Bash

cd apps/backend
npm run start:dev
Frontend:

Bash

cd apps/frontend
npm run dev

---

### Strategi Penggunaan untuk Anda (The "Shadow Strategist" Move)

Sekarang, setelah Anda menyimpan file ini sebagai `README.md` di folder utama, cara menyuruh AI (Cursor/ChatGPT) mengerjakannya adalah sebagai berikut:

**Prompt 1 (Fokus Python):**
> *"Read the README.md file specifically section Phase 1. I have created the folder structure. Please generate the complete `apps/ocr-engine/src/main.py` and `requirements.txt` respecting the `use_angle_cls=False` constraint."*

**Prompt 2 (Fokus Backend):**
> *"Now refer to Phase 2 in README.md. I have initialized the NestJS app. Help me configure `main.ts` for port 4000 and create the `OcrService` to proxy requests to the Python service."*

**Prompt 3 (Fokus Frontend):**
> *"Refer to Phase 3. Create a Next.js page that allows user to upload an image, crop it using `react-image-crop`, and send it to the backend."*
