[redrose_teknoloji_rag_ai_readme.md](https://github.com/user-attachments/files/35413624/redrose_teknoloji_rag_ai_readme.md)
# RedRose Teknoloji — Kurumsal RAG AI Bilgi Tabanı & Akıllı Asistan

**RedRose RAG AI**, kurum içi dokümanları (PDF, DOCX, TXT) anlamlandıran, karmaşık tabloların satır-sütun bütünlüğünü koruyarak vektörleştiren ve **departman bazlı erişim izolasyonu** sunan tam kapsamlı (Full-Stack) bir kurumsal bilgi yönetimi ve yapay zeka asistanı platformudur.

---

## Öne Çıkan Özellikler

* **Gelişmiş Tablo ve Düzen Korumalı Doküman Ayrıştırma:**
  * **PDF Dosyaları:** `pymupdf4llm` entegrasyonu ile PDF sayfalarındaki başlıklar, listeler ve çok sütunlu karmaşık tablolar doğrudan temiz Markdown formatına (`| Sütun |`) dönüştürülür.
  * **Word (`.docx`) Dosyaları:** Belge gövdesindeki paragraf ve tablolar sırası bozulmadan işlenerek Markdown tablo yapısına çevrilir.
  * **Akıllı Tablo Başlığı Taşıma:** Uzun tablolar parçalara (`chunk`) bölündüğünde, tablo ortasından başlayan devam parçalarının üstüne otomatik olarak ilgili tablonun sütun başlıkları eklenir.
* **Anlamsal Arama (Semantic Search) ve Akıllı Chat (RAG):**
  * OpenAI Embedding modeli (`1536` boyutlu vektörler) ve PostgreSQL `pgvector` kosinüs benzerliği (`cosine_distance`) ile yüksek doğruluklu bilgi erişimi sağlanır.
  * `gpt-4o-mini` tabanlı Akıllı Chat, yalnızca yetkili dokümanlardaki bağlama sadık kalarak yanıt üretir ve her cevabın altında **doküman adı, departman etiketi, sayfa numarası ve chunk bilgisini** kaynak kartı olarak sunar.
* **Departman Bazlı Erişim İzolasyonu:**
  * Kullanıcılar yalnızca kendi departmanlarına ait dokümanlar ile tüm kuruma açık olan **`Genel`** departmanı dokümanları üzerinde arama ve sorgulama yapabilir.
* **Rol Tabanlı Yetkilendirme ve Yönetim Paneli (Admin Panel):**
  * JWT (`HS256`) tabanlı kimlik doğrulama ve `bcrypt` şifreleme altyapısı.
  * Yöneticiler arayüz üzerinden yeni kullanıcı ekleyebilir, kullanıcıların rol (`Admin` / `User`) ve departman bilgilerini güncelleyebilir, şifre sıfırlama işlemi yapabilir ve dokümanların parça (`chunk`) detaylarını inceleyebilir.

---

## Teknoloji Yığını

| Katman | Kullanılan Teknolojiler |
| :--- | :--- |
| **Frontend** | Next.js (App Router), React, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend** | Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic |
| **Veritabanı & Vektör** | PostgreSQL, `pgvector` |
| **Yapay Zeka & NLP** | OpenAI API (`gpt-4o-mini` & Embeddings), LangChain Text Splitters |
| **Doküman İşleme** | `pymupdf` (`fitz`), `pymupdf4llm`, `python-docx` |
| **Güvenlik** | PyJWT, Passlib (`bcrypt`), CORS Middleware |

---

## Proje Dizin Yapısı

```text
A-K-A/
├── backend/                  # FastAPI Sunucu Uygulaması
│   ├── main.py               # API rotaları (Auth, Documents, Search, Ask, Admin)
│   ├── models.py             # SQLAlchemy veritabanı modelleri (User, Document, DocumentChunk)
│   ├── schemas.py            # Pydantic istek/yanıt doğrulama şemaları
│   ├── services.py           # Doküman ayrıştırma, tablo-duyarlı chunking, vektör arama ve RAG
│   ├── auth.py               # JWT üretimi, doğrulama ve rol kontrolleri
│   ├── database.py           # PostgreSQL bağlantı ve oturum yönetimi
│   └── .env                  # Ortam değişkenleri (API anahtarları ve DB URL)
│
└── frontend/                 # Next.js İstemci Uygulaması
    ├── app/
    │   └── page.tsx          # Ana arayüz (Chat, Anlamsal Arama, Doküman Yönetimi, Admin Paneli)
    ├── lib/
    │   └── api.ts            # Backend API istemci fonksiyonları
    └── package.json
```

---

## Kurulum ve Çalıştırma

### Gereksinimler
* **Python** 3.10+
* **Node.js** 18+
* **PostgreSQL** (ve üzerinde aktif edilmiş `pgvector` eklentisi)
* **OpenAI API Key**

### 1. Veritabanı Hazırlığı
PostgreSQL üzerinde veritabanınızı oluşturun ve `pgvector` eklentisini etkinleştirin:

```sql
CREATE DATABASE redrose_rag;
\c redrose_rag
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Backend Kurulumu

Proje dizininde sanal ortam oluşturun, bağımlılıkları yükleyin ve `.env` dosyasını yapılandırın:

```bash
python -m venv venv
# Windows için:
venv\Scripts\activate
# macOS / Linux için:
source venv/bin/activate

pip install fastapi uvicorn sqlalchemy psycopg2-binary pgvector python-jose pyjwt passlib[bcrypt] python-multipart python-dotenv openai langchain-openai langchain-text-splitters pymupdf pymupdf4llm python-docx
```

Backend kök dizininde `.env` dosyasını oluşturun (`SECRET_KEY` RFC 7518 standardı gereği en az 32 byte olmalıdır):

```env
DATABASE_URL=postgresql://kullanici_adi:sifre@localhost:5432/redrose_rag
OPENAI_API_KEY=sk-proj-...
SECRET_KEY=b47e9a2c8d1f5036e89a4b7c2d0f1e6a9c3b8d5e7f2a4c6d8e0b1a3f5c7d9e2b
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

Backend sunucusunu başlatın:

```bash
uvicorn main:app --reload
```
API dokümantasyonuna (Swagger UI) `http://127.0.0.1:8000/docs` adresinden ulaşabilirsiniz.

### 3. Frontend Kurulumu

Yeni bir terminal açarak frontend dizinine geçin, paketleri kurun ve geliştirme sunucusunu başlatın:

```bash
npm install
npm run dev
```
Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışacaktır.

---

## Temel API Uç Noktaları

| Metod | Uç Nokta | Yetki | Açıklama |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Herkese Açık | Yeni kullanıcı kaydı oluşturur |
| `POST` | `/auth/login` | Herkese Açık | Kullanıcı girişi yapar ve JWT erişim token'ı döner |
| `POST` | `/documents/upload` | Giriş Yapmış | PDF/DOCX/TXT yükler, departman atar ve vektörleştirir |
| `GET` | `/documents/` | Giriş Yapmış | Kullanıcının yetkili olduğu dokümanları listeler |
| `GET` | `/documents/{id}` | Giriş Yapmış | Dokümana ait tüm metin/tablo parçalarını (`chunks`) getirir |
| `DELETE` | `/documents/{id}` | Admin / Yetkili | Dokümanı ve ilişkili vektör parçalarını siler |
| `POST` | `/search/` | Giriş Yapmış | Departman izolasyonlu anlamsal vektör araması yapar |
| `POST` | `/ask/` | Giriş Yapmış | Kaynak referanslı RAG tabanlı Akıllı Chat yanıtı üretir |
| `GET` | `/users/` | Admin | Sistemdeki tüm kullanıcıları listeler |
| `PATCH` | `/users/{id}/role` | Admin | Kullanıcının rolünü (`admin` / `user`) günceller |
| `PATCH` | `/users/{id}/department` | Admin | Kullanıcının departmanını günceller |
| `PATCH` | `/users/{id}/password` | Admin | Kullanıcı için yeni şifre tanımlar |
| `DELETE` | `/users/{id}` | Admin | Kullanıcı hesabını sistemden siler |
