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

## 🗄️ 5. Rancangan Skema Data (MySQL)
Sederhana: 1 tabel utama `documents` untuk menyimpan file dan hasil OCR mentah + metadata yang bisa diedit user.

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| id | CHAR(36) | PK, UUID v4 (hindari auto-increment) |
| type | ENUM(INVOICE, SURAT_JALAN, SURAT_RESMI, LAINNYA) | Jenis dokumen |
| status | ENUM(PENDING, VERIFIED, REJECTED) | Tahapan verifikasi |
| file_name | VARCHAR | Nama file upload |
| file_path | VARCHAR | Lokasi file di server (mis. `uploads/...`) |
| mime_type | VARCHAR | `image/jpeg`, dll. |
| invoice_no | VARCHAR NULL | Nomor invoice (opsional) |
| letter_no | VARCHAR NULL | Nomor surat (opsional) |
| doc_date | DATETIME NULL | Tanggal di dokumen |
| sender | VARCHAR NULL | Pengirim surat |
| amount | DECIMAL(18,2) NULL | Total invoice (opsional) |
| raw_ocr | JSON NULL | Simpan respons mentah dari Python |
| created_at | DATETIME | Default `CURRENT_TIMESTAMP` |
| updated_at | DATETIME | `ON UPDATE CURRENT_TIMESTAMP` |

DDL MySQL cepat:
```sql
CREATE TABLE documents (
  id CHAR(36) PRIMARY KEY,
  type ENUM('INVOICE','SURAT_JALAN','SURAT_RESMI','LAINNYA') NOT NULL DEFAULT 'LAINNYA',
  status ENUM('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  invoice_no VARCHAR(100),
  letter_no VARCHAR(100),
  doc_date DATETIME,
  sender VARCHAR(255),
  amount DECIMAL(18,2),
  raw_ocr JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## ⚙️ 6. Implementasi Kode (Prisma + NestJS + MySQL)
Contoh `prisma/schema.prisma` untuk MySQL (ikuti `DATABASE_URL` di `apps/backend/.env`):
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum DocType {
  INVOICE
  SURAT_RESMI
  SURAT_JALAN
  LAINNYA
}

enum DocStatus {
  PENDING   // Baru di-scan AI, belum dicek manusia
  VERIFIED  // Sudah divalidasi/diedit manusia
  REJECTED  // Gambar buram/tidak terbaca
}

model Document {
  id        String    @id @default(uuid())
  fileName  String
  filePath  String    @map("file_path")
  mimeType  String    @map("mime_type")
  type      DocType   @default(LAINNYA)
  status    DocStatus @default(PENDING)
  invoiceNo String?   @map("invoice_no")
  letterNo  String?   @map("letter_no")
  docDate   DateTime? @map("doc_date")
  sender    String?
  amount    Decimal?
  rawOcr    Json?     @map("raw_ocr")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  @@map("documents")
}
```

Langkah integrasi di backend NestJS:
1. `cd apps/backend && npm i -D prisma && npx prisma init --datasource-provider mysql` lalu tempel schema di atas.
2. `npx prisma db push` untuk membuat tabel di MySQL.
3. `npm i @prisma/client` lalu buat service/repo untuk simpan hasil OCR: setelah `OcrService.processImage` menerima respons Python, simpan `rawOcr` (JSON) dan metadata file ke tabel `documents`.
4. Untuk upload file fisik, simpan di folder `uploads/` dan catat `file_path` + `mime_type` sesuai Multer.
