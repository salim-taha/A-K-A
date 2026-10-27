from sqlalchemy.orm import Session #SQLAlchemy'nin Session sınıfını import ediyoruz. Bu sınıf, veritabanı ile etkileşim kurmamızı sağlar. Örneğin, veri ekleme, silme, güncelleme ve sorgulama işlemlerini gerçekleştirmek için kullanılır.
from langchain_text_splitters import RecursiveCharacterTextSplitter #LangChain kütüphanesinden RecursiveCharacterTextSplitter sınıfını import ediyoruz. Bu sınıf, uzun metinleri daha küçük parçalara (chunk) bölmek için kullanılır. Özellikle RAG (Retrieval-Augmented Generation) sistemlerinde, büyük belgeleri yönetilebilir parçalara ayırmak için idealdir.
from langchain_openai import OpenAIEmbeddings,ChatOpenAI #LangChain kütüphanesinden OpenAIEmbeddings sınıfını import ediyoruz. Bu sınıf, metinleri vektörlere dönüştürmek için OpenAI'nin embedding modellerini kullanır. Vektörler, metinlerin anlamını sayısal bir formatta temsil eder ve benzerlik aramaları için kullanılır.
from models import Document, DocumentChunk #models.py dosyasından Document ve DocumentChunk sınıflarını import ediyoruz. Bu sınıflar, veritabanındaki "documents" ve "document_chunks" tablolarını temsil eder ve SQLAlchemy ORM ile etkileşim kurmamızı sağlar.
import os #Python'un standart kütüphanesinden os modülünü import ediyoruz. Bu modül, işletim sistemi ile etkileşim kurmamızı sağlar. Örneğin, ortam değişkenlerini okumak veya dosya yollarını yönetmek için kullanılır.
from dotenv import load_dotenv #dotenv kütüphanesinden load_dotenv fonksiyonunu import ediyoruz. Bu fonksiyon, .env dosyasındaki ortam değişkenlerini yüklememizi sağlar. Böylece, API anahtarları veya veritabanı bağlantı bilgileri gibi hassas verileri kod içinde açıkça yazmak yerine, güvenli bir şekilde yönetebiliriz.
import openai
from langchain_core.prompts import ChatPromptTemplate
from pypdf import PdfReader
from docx import Document as DocxDocument
import io


load_dotenv()

embeddings_model = OpenAIEmbeddings (
    model = "text-embedding-3-small",
    openai_api_key = os.getenv("OPENAI_API_KEY") #Ortam değişkenlerinden OPENAI_API_KEY değerini alır. Bu, OpenAI API'sine erişim sağlamak için gerekli olan gizli anahtardır. os.getenv() fonksiyonu, belirtilen ortam değişkeninin değerini döndürür. Eğer değişken tanımlı değilse None döner.
)

def process_and_store_document(db: Session, filename: str, content: str):
    # 1. Adım: Dokümanı Ana Tabloya Kaydet
    db_document = Document(filename=filename) #Yeni bir Document nesnesi oluşturur ve filename parametresini atar. Bu nesne, veritabanındaki "documents" tablosuna karşılık gelir.
    db.add(db_document) #Oluşturulan Document nesnesini veritabanına ekler. Ancak henüz veritabanına yazılmaz; bu işlem commit() çağrıldığında gerçekleşir.
    db.commit() #Bekleyen işlemleri onaylar ve veritabanına kalıcı olarak yazar. Bu noktada, db_document nesnesi veritabanına kaydedilir ve ona bir id atanır.
    db.refresh(db_document) #Veritabanına kaydedilen db_document nesnesini günceller. Bu, veritabanı tarafından otomatik olarak atanan id ve created_at gibi alanların db_document nesnesine yansıtılmasını sağlar.

   # 2. Adım: Metni Parçalara Ayır (Chunking)
    text_splitter =  RecursiveCharacterTextSplitter(
        chunk_size = 400, #Her bir parçanın (chunk) maksimum karakter sayısı. Örneğin 4000 karakterlik bir paragrafı 400'er karakterlik 10 parçaya böler.
        chunk_overlap= 50, #Parçalar arasında kaç karakterlik örtüşme (overlap) olacağını belirler. Örneğin bir parçanın son 50 karakteri, bir sonraki parçanın ilk 50 karakteri ile aynı olur. Bu, bağlamın korunmasına yardımcı olur.
        length_function=len, #Parçalama işlemi sırasında karakter sayısını ölçmek için Python'un built-in len() fonksiyonunu kullanır.
        is_separator_regex=False, #Parçalama sırasında özel bir ayırıcı (separator) regex kullanıp kullanmayacağını belirler. False ise, metni sadece karakter sayısına göre böler.
   )
    chunks = text_splitter.split_text(content) #split_text() fonksiyonu, ham metni alır ve belirlenen chunk_size ve chunk_overlap parametrelerine göre metni parçalara böler. Sonuç olarak, her bir parça (chunk) ayrı bir string olarak chunks listesinde saklanır.

    # 3. Adım: Her Parça İçin Embedding Üret ve Veritabanına Ekle
    for index, chunk_content in enumerate(chunks): #
        # Embedding üretimi (1536 boyutlu vektör döner)
        vector = embeddings_model.embed_query(chunk_content) #embed_query() fonksiyonu, verilen metin parçasını (chunk_content) alır ve OpenAI'nin embedding modelini kullanarak bu metni 1536 boyutlu bir vektöre dönüştürür. Bu vektör, metnin anlamını sayısal bir formatta temsil eder ve benzerlik aramaları için kullanılabilir.

        db_chunk = DocumentChunk(
            document_id=db_document.id, #Bu parçanın hangi ana dokümana ait olduğunu belirtir. db_document.id, veritabanına kaydedilen ana dokümanın benzersiz kimlik numarasıdır.
            content=chunk_content, #Parçalanmış metin içeriği. Bu, kullanıcının yüklediği ham metnin bir parçasıdır.
            chunk_index=index, #Parçanın sıralamadaki konumu. enumerate() fonksiyonu sayesinde her bir parçaya otomatik olarak bir index atanır.
            embedding=vector #Üretilen embedding vektörü. Bu vektör, metin parçasının anlamını sayısal olarak temsil eder ve veritabanında saklanır.
        )
        db.add(db_chunk)

    db.commit()
    db.refresh(db_document) #Veritabanına kaydedilen db_document nesnesini günceller. Bu, veritabanı tarafından otomatik olarak atanan id ve created_at gibi alanların db_document nesnesine yansıtılmasını sağlar.

    return db_document

def search_documents(db: Session, query: str, top_k: int = 3):
    """
    Kullanıcı sorgusuna en benzer metin parçalarını pgvector kullanarak veritabanından bulur.
    """
    # 1. Adım: Kullanıcının yazdığı metin sorusunu OpenAI embedding modeline gönderip 1536 boyutlu sayısal vektör elde ediyoruz.
    query_vector = embeddings_model.embed_query(query)
    
    # 2. Adım: pgvector'ün sağladığı .cosine_distance() fonksiyonu ile veritabanındaki tüm chunk'ları 
    # sorgu vektörüne olan mesafelerine göre küçükten büyüğe (en yakından en uzağa) sıralıyoruz.
    results = db.query(DocumentChunk).order_by(
        DocumentChunk.embedding.cosine_distance(query_vector)
    ).limit(top_k).all()  # En yüksek benzerliğe sahip ilk 'top_k' kadar sonucu seçiyoruz.
    
    # 3. Adım: Bulunan en alakalı parçaları liste olarak geri döndürüyoruz.
    return results       

# OpenAI Chat modelini tanımlıyoruz (Hızlı ve maliyetsiz olduğu için gpt-4o-mini idealdir)
chat_model = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.0,  # Düşük temperature, modelin uydurma (hallüsinasyon) yapmasını engeller, metne sadık kalır
    openai_api_key=os.getenv("OPENAI_API_KEY")
)

def answer_question(db: Session, query: str, top_k: int = 3):
    """
    Kullanıcının sorusuna, veritabanındaki ilgili dokümanları bağlam olarak kullanarak 
    ve kullanıcının sorgu diline uygun olarak yanıt üretir (Çok Dilli Destek).
    """
    # 1. Adım: Benzerlik araması yaparak en ilgili metin parçalarını (context) buluyoruz
    relevant_chunks = search_documents(db=db, query=query, top_k=top_k)
    
    if not relevant_chunks:
        return {
            "answer": "Üzgünüm, bu soruyla ilgili veritabanımda herhangi bir doküman bulamadım. / I couldn't find any documents related to this question.",
            "sources": []
        }

    # 2. Adım: Bulunan parçaların metin içeriklerini alt alta birleştirerek tek bir bağlam oluşturuyoruz
    context_text = "\n\n---\n\n".join([chunk.content for chunk in relevant_chunks])

    # 3. Adım: Çok dilli (Multilingual) Destekli Prompt Şablonu
    template = """
    You are a strict, precise, and highly analytical AI Knowledge Assistant.
    Your ONLY source of truth is the "Context" provided below. You are strictly forbidden from using your pre-trained knowledge.

    CRITICAL RULES:
    1. Answer the question using ONLY the facts explicitly stated in the Context.
    2. DO NOT guess, DO NOT infer, and DO NOT fill in missing details with outside knowledge.
    3. TRAP ALERT: The user might ask about a detail (e.g., a specific year, a specific name, a financial fee) related to a topic in the Context. If the general topic is there but the EXACT detail is missing, you MUST reject the question.
    4. If the exact answer is not in the Context, reply EXACTLY with: "I'm sorry, but this specific information is not available in the provided documents." (Translate this rejection to the user's language).
    5. Always respond in the EXACT SAME LANGUAGE as the user's question.

    Context:
    {context}

    User's Question: {question}

    Answer:
    """
    
    prompt_template = ChatPromptTemplate.from_template(template)
    
    # Promptu dolduruyoruz
    formatted_prompt = prompt_template.format(context=context_text, question=query)

    # 4. Adım: OpenAI modeline isteği gönderip yanıtı alıyoruz
    response = chat_model.invoke(formatted_prompt)
    answer_text = response.content

    # 5. Adım: Üretilen cevabı ve kaynakçayı dönüyoruz
    return {
        "answer": answer_text,
        "sources": relevant_chunks
    }
def process_and_store_file_document_with_pages(db: Session, filename: str, file_bytes: bytes):
    """
    Sayfa bilgileri korunaraka dokümanı parçalayan ve veritabanına kaydeden fonksiyon.
    """
    # 1. Ana dokümanı kaydet
    db_document = Document(filename=filename)
    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    # 2. Sayfa bazlı metinleri al
    pages_data = extract_text_with_pages(filename, file_bytes)
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=400,
        chunk_overlap=50,
        length_function=len,
    )

    global_chunk_index = 0
    for page_item in pages_data:
        page_num = page_item["page_number"]
        page_text = page_item["content"]
        
        chunks = text_splitter.split_text(page_text)
        for chunk_content in chunks:
            vector = embeddings_model.embed_query(chunk_content)
            
            db_chunk = DocumentChunk(
                document_id=db_document.id,
                content=chunk_content,
                chunk_index=global_chunk_index,
                page_number=page_num,  # Sayfa numarasını kaydediyoruz
                embedding=vector
            )
            db.add(db_chunk)
            global_chunk_index += 1

    db.commit()
    db.refresh(db_document)
    return db_document

def extract_text_with_pages(filename: str, file_bytes: bytes):
    """
    Dosya türüne göre metni ve ait olduğu sayfa/bölüm numaralarını liste olarak döner.
    Her eleman: {"content": str, "page_number": int}
    """
    ext = filename.lower().split(".")[-1]
    pages_data = []

    # 1. PDF Dosyaları İçin (Sayfa bazlı takip)
    if ext == "pdf":
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        for idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text()
            if text and text.strip():
                pages_data.append({"content": text, "page_number": idx})

    # 2. Word (DOCX) Dosyaları İçin (Paragraf bazlı / yaklaşık sayfa veya bölüm takibi)
    elif ext == "docx":
        docx_file = io.BytesIO(file_bytes)
        doc = DocxDocument(docx_file)
        current_text = ""
        page_approx = 1
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                current_text += paragraph.text + "\n"
                # Her 1500 karakterde bir tahmini sayfa/bölüm ilerletilebilir veya tümü tek sayfa sayılabilir
                if len(current_text) > 1500:
                    pages_data.append({"content": current_text, "page_number": page_approx})
                    current_text = ""
                    page_approx += 1
        if current_text.strip():
            pages_data.append({"content": current_text, "page_number": page_approx})

    # 3. Düz Metin (TXT) Dosyaları İçin
    elif ext == "txt":
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")
        pages_data.append({"content": text, "page_number": 1})

    else:
        raise ValueError("Desteklenmeyen dosya formatı.")

    return pages_data



def get_all_documents(db: Session):
    """
    Veritabanına yüklenmiş olan tüm ana dokümanların listesini döner.
    """
    return db.query(Document).all()

def delete_document_by_id(db: Session, document_id: int):
    """
    Belirtilen ID'ye sahip dokümanı ve ona bağlı olan tüm metin parçalarını (chunks) veritabanından siler.
    """
    # 1. Dokümanın veritabanında var olup olmadığını kontrol ediyoruz
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        return None
    
    # Not: Veritabanı modelinde ForeignKey üzerinde 'cascade="all, delete"' tanımlıysa 
    # Document silindiğinde bağlı DocumentChunk'lar da otomatik silinir. 
    # Garanti olması için önce chunk'ları sonra dokümanı silebiliriz veya direkt dokümanı silebiliriz.
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    db.delete(document)
    db.commit()
    
    return document

def get_document_by_id(db: Session, document_id: int):
    """
    Belirtilen ID'ye sahip dokümanı ve ona bağlı tüm metin parçalarını (chunks) veritabanından getirir.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    return document
