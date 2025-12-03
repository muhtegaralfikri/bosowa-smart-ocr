## 🗄️ 5. Database Schema (MySQL via Prisma)

We adhere to a **Single Table Design** pattern to handle the dynamic nature of OCR documents. Instead of separate tables for Invoices/Letters, we use a single `documents` table with nullable metadata columns and a `JSON` column for raw AI output.

### Table: `documents`
This is the core table. All uploaded files and their extraction results reside here.

| Column Name  | Data Type      | Constraints      | Description                                                                 |
| :---         | :---           | :---             | :---                                                                        |
| `id`         | `VARCHAR(36)`  | PK, UUID, Not Null| Unique Identifier (UUIDv4). Avoids auto-increment enumeration attacks.      |
| `file_name`  | `VARCHAR(255)` | Not Null         | Original filename uploaded by user.                                         |
| `file_path`  | `VARCHAR(255)` | Not Null         | Relative path to storage (e.g., `uploads/xyz.jpg`).                         |
| `mime_type`  | `VARCHAR(100)` | Not Null         | File type (e.g., `image/png`).                                              |
| `type`       | `ENUM`         | Default: `LAINNYA`| `INVOICE`, `SURAT_RESMI`, `SURAT_JALAN`, `LAINNYA`.                         |
| `status`     | `ENUM`         | Default: `PENDING`| `PENDING` (AI processed), `VERIFIED` (User checked), `REJECTED`.            |
| `invoice_no` | `VARCHAR(191)` | Nullable         | Extracted Invoice Number.                                                   |
| `letter_no`  | `VARCHAR(191)` | Nullable         | Extracted Letter Number (Nomor Surat).                                      |
| `doc_date`   | `DATETIME`     | Nullable         | The date found *inside* the document content.                               |
| `sender`     | `VARCHAR(191)` | Nullable         | Name of the sender/company extracted from header.                           |
| `amount`     | `DECIMAL(65,30)`| Nullable        | Total amount (specifically for Invoices).                                   |
| `raw_ocr`    | `JSON`         | Nullable         | **CRITICAL:** Stores the full JSON response from Python PaddleOCR.          |
| `created_at` | `DATETIME`     | Default: `NOW()` | Upload timestamp.                                                           |
| `updated_at` | `DATETIME`     | Auto Update      | Last modification timestamp.                                                |

### Prisma Schema (`schema.prisma`)
Ensure your `schema.prisma` matches this contract:

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
  PENDING
  VERIFIED
  REJECTED
}

model Document {
  id        String    @id @default(uuid())
  fileName  String
  filePath  String    @map("file_path")
  mimeType  String    @map("mime_type")
  
  // Classification
  type      DocType   @default(LAINNYA)
  status    DocStatus @default(PENDING)

  // Extracted Metadata (Nullable)
  invoiceNo String?   @map("invoice_no")
  letterNo  String?   @map("letter_no")
  docDate   DateTime? @map("doc_date")
  sender    String?
  amount    Decimal?
  
  // The Source of Truth
  rawOcr    Json?     @map("raw_ocr")

  // Audit
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  @@map("documents")
}