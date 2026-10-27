import os #env dosyası üzerindeki gizli değişkenleri (şifre, port vb.) sistem belleğine almak için kullanılır.
from dotenv import load_dotenv
from sqlalchemy import create_engine #Python uygulaması ile PostgreSQL veritabanı arasındaki ana iletişim köprüsünü (motoru) kurar.
from sqlalchemy.orm import declarative_base, sessionmaker #Python'daki sınıflarımızı (class) SQL tablolarına dönüştürmek (ORM) ve veritabanı ile "oturum" (session) başlatmak için kullanılır.

load_dotenv() #Proje klasöründeki .env dosyasını bulur ve içindeki gizli değişkenleri (şifre, port vb.) sistem belleğine alır.

DATABASE_URL = os.getenv("DATABASE_URL") #.env dosyasında tanımladığımız veritabanı URL'sini alır ve kod içinde kullanmak üzere bir değişkene atar.

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) #Uygulamanın veritabanında yapacağı her bir işlem (veri okuma, ekleme) için geçici "oturumlar" üreten bir fabrikadır. bind bağlamak anlamına gelir. Yani bu oturumlar, hangi veritabanı motoruna (engine) bağlanacağını bilir. autocommit=False ile her işlemden sonra otomatik olarak veritabanına kaydetme yapılmaz, autoflush=False ile de veritabanına yazmadan önce geçici değişikliklerin temizlenmesi engellenir.

Base = declarative_base() #Bu değişken, models.py dosyasında oluşturduğumuz tablolar (Document ve DocumentChunk) için bir ata sınıftır (şablon). SQLAlchemy, bu Base sınıfından türetilen her Python sınıfını algılar ve bunları veritabanında otomatik olarak SQL tablolarına dönüştürür.

# FastAPI uç noktalarında veritabanı oturumunu yönetmek için bağımlılık (dependency)
def get_db(): #FastAPI'ye gelen her yeni API isteği (örneğin kullanıcının bir dosya yüklemesi) için güvenli bir veritabanı bağlantısı açıp kapatan fonksiyondur.
  db = SessionLocal() #Yeni bir oturum başlatır.
  try:
    yield db #Açılan oturumu, işlemi yapacak olan API rotasına teslim eder (FastAPI'de return yerine yield kullanmak, işlem bitince bu fonksiyona geri dönülmesini sağlar ve devam edip finally bloğunu çalıştırır).
  finally:
    db.close() #Kodun en kritik kısmıdır. API isteği başarılı da olsa, hata verip çökse de (try-finally bloğu sayesinde) en sonunda veritabanı bağlantısının kesinlikle kapatılmasını sağlar. Eğer bağlantılar kapatılmazsa, veritabanı şişer, yeni bağlantı kabul etmez ve sistem kilitlenir.