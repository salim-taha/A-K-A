# RedRose RAG AI Knowledge Assistant 🌹🤖

RedRose Teknoloji için geliştirilmiş bu proje, kullanıcıların sisteme yüklediği dokümanlar (PDF, DOCX, TXT) üzerinde semantik arama yapabilmesini ve bu dokümanların içeriklerine dayalı olarak yapay zeka destekli, halüsinasyondan arındırılmış (strict-context) cevaplar alabilmesini sağlayan bir RAG (Retrieval-Augmented Generation) asistanıdır.

## 🚀 Teknolojiler (Tech Stack)

**Backend:**

* FastAPI (Asenkron RESTful API)

* PostgreSQL & pgvector (Vektörel Veritabanı)

* SQLAlchemy 2.0 & Pydantic (ORM ve Veri Doğrulama)

* LangChain & OpenAI API (Yapay Zeka Orkestrasyonu)

* Modeller: `text-embedding-3-small`, `gpt-4o-mini`

**Frontend:**

* Next.js (React Framework)

* Node.js / npm

## 🔒 Veri Mahremiyeti ve Güvenlik (Data Privacy)

Sistem tasarlanırken veri güvenliği ön planda tutulmuştur:

* **Fiziksel Dosya Barındırılmaz:** Yüklenen orijinal dokümanlara public (dışa açık) erişim verilmez. Dosyalar sadece bellekte (RAM) okunur ve sunucuda barındırılmaz.

* **Loglarda Tutulmaz:** Dosya içerikleri ve işlenen metin parçaları (chunk) sunucu loglarında (kayıtlarında) gizli tutulur ve ekrana basılmaz.

* **Üçüncü Tarafa Sınırlı Gönderim:** Orijinal dosyalar OpenAI'a gönderilmez. Sadece sistemin oluşturduğu metin parçacıkları (chunk), embedding ve generation işlemleri için şifreli olarak OpenAI API'sine iletilir. Model yaratıcılığı (`temperature=0.0`) kısıtlanarak halüsinasyon engellenir.

## ⚙️ Kurulum ve Çalıştırma Rehberi

Uygulamanın tam kapasite çalışabilmesi için Backend ve Frontend sistemlerinin birlikte ayağa kaldırılması gerekir.

### Ön Koşullar (Prerequisites)

* Python 3.10+

* Node.js v18.x+

* PostgreSQL ve `pgvector` eklentisi

* Geçerli bir OpenAI API Anahtarı

### 1. Backend (FastAPI) Kurulumu

Projeyi klonlayın ve ana dizine girin:

```
git clone https://github.com/kullanici_adiniz/RedRose-RAG-Assistant.git
cd RedRose-RAG-Assistant

```

Sanal ortam (virtual environment) oluşturun ve aktif edin:

```
# Windows için
python -m venv venv
.\venv\Scripts\activate

# macOS/Linux için
python3 -m venv venv
source venv/bin/activate

```

Gerekli Python kütüphanelerini yükleyin:

```
pip install -r requirements.txt

```

Ana dizinde bir `.env` dosyası oluşturun ve bilgilerinizi girin:

```
OPENAI_API_KEY="sk-proj-senin-api-anahtarin"
DATABASE_URL="postgresql://kullanici_adi:sifre@localhost:5432/veritabani_adi"

```

Veritabanında `pgvector` eklentisini aktif ettiğinizden emin olun:

```
CREATE EXTENSION IF NOT EXISTS vector;

```

Backend sunucusunu başlatın:

```
uvicorn main:app --reload

```

*(Backend API'si http://localhost:8000 adresinde çalışmaya başlayacaktır. http://localhost:8000/docs adresinden Swagger UI'a ulaşabilirsiniz.)*

### 2. Frontend (Next.js) Kurulumu

Yeni bir terminal sekmesi açın ve frontend klasörüne gidin (Frontend klasör adınız neyse onu yazın, örn: `frontend`):

```
cd frontend

```

Gerekli npm paketlerini yükleyin:

```
npm install

```

Frontend dizininde `.env.local` adında bir dosya oluşturup API adresini belirtin:

```
NEXT_PUBLIC_API_URL=http://localhost:8000

```

Frontend geliştirme sunucusunu başlatın:

```
npm run dev

```

*(Arayüz http://localhost:3000 adresinde çalışmaya başlayacaktır.)*

## 📡 API Uç Noktaları (Endpoints)

| **Metot** | **Uç Nokta (Endpoint)** | **Açıklama** | 
| `GET` | `/documents/` | Yüklenen tüm dokümanların listesini döner. | 
| `GET` | `/documents/{id}` | Belirli bir dokümanın üst bilgilerini ve parçalanmış metin (chunk) listesini döner. | 
| `POST` | `/documents/` | Yeni bir doküman (.pdf, .docx, .txt) yükler, vektörleştirir ve kaydeder. | 
| `POST` | `/search/` | Kullanıcı sorgusunu vektörel olarak arar, en yakın metin parçalarını LLM maliyeti olmadan döner. | 
| `POST` | `/ask/` | RAG sorgusu yapar. Soruya en uygun belgeleri bulur ve GPT modelini kullanarak doğal dilde bağlamsal cevap üretir. | 
| `DELETE` | `/documents/{id}` | İlgili dokümanı ve tüm metin parçalarını veritabanından kalıcı olarak siler. | 

*Developed by RedRose Teknoloji Intern Team*