from database import Base, engine, get_db  #Base ve engine'i database.py'den import ediyoruz
from fastapi import FastAPI, Depends,HTTPException,status,UploadFile, File #fastapi kütüphanesini import ediyoruz
import models  # Modellerin Base tarafından tanınması için import ediyoruz
from schemas import DocumentCreate,SearchRequest,SearchResponse,AskRequest, AskResponse,DocumentListItem,DocumentDetailResponse,ChunkSchema
from sqlalchemy.orm import Session
from services import process_and_store_document, process_and_store_file_document_with_pages,search_documents,answer_question,get_all_documents, delete_document_by_id,get_document_by_id
from fastapi.middleware.cors import CORSMiddleware

# Tablolar veritabanında yoksa oluştur
Base.metadata.create_all(bind=engine) #Bu satır, veritabanında tabloların oluşturulmasını sağlar. Eğer tablolar zaten varsa, bu satır herhangi bir değişiklik yapmaz.


app = FastAPI(
    title="RedRose Knowledge Assistant API",
    description="RAG tabanlı doküman arama asistanı MVP projesi",
    version="1.0.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
  return {
    "mesaj": "RedRose API'ye Hoş Geldiniz!",
    "durum": "Sistem aktif",
    "veritabani_baglantisi": "Hazır",
  }

@app.get("/documents/", response_model=list[DocumentListItem])
def list_documents(db: Session = Depends(get_db)):
    """
    Sisteme yüklenmiş tüm dokümanların listesini döner.
    """
    documents = get_all_documents(db)
    return documents

@app.get("/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document_detail(document_id: int, db: Session = Depends(get_db)):
    """
    Belirli bir ID'ye sahip dokümanın ana bilgilerini ve parçalanmış metin içeriklerini döner.
    """
    document = get_document_by_id(db=db, document_id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID'si {document_id} olan doküman bulunamadı."
        )
    return document

@app.post("/documents/", status_code=status.HTTP_201_CREATED)
async def upload_any_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Kullanıcının yüklediği PDF, DOCX veya TXT dosyalarını alır, metni ayıklar ve vektörleştirerek kaydeder.
    """
    allowed_extensions = (".pdf", ".docx", ".txt")
    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yalnızca .pdf, .docx ve .txt uzantılı dosyalar kabul edilmektedir."
        )
    
    try:
        # Dosya içeriğini bellekte bayt olarak oku
        file_bytes = await file.read()
        
        # Servis katmanını tetikle
        db_document = process_and_store_file_document_with_pages(
            db=db,
            filename=file.filename,
            file_bytes=file_bytes
        )
        
        return {
            "message": f"'{file.filename}' başarıyla yüklendi, metne dönüştürüldü ve veritabanına kaydedildi.",
            "document_id": db_document.id,
            "filename": db_document.filename
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/search/", response_model=list[SearchResponse])
def search_knowledge_base(search_in: SearchRequest, db: Session = Depends(get_db)):
    """
    Kullanıcıdan gelen arama isteğini alır, servis katmanına iletir ve en alakalı sonuçları döner.
    """
    # Servis fonksiyonunu çağırarak veritabanından en yakın parçaları çekiyoruz
    results = search_documents(
        db=db, 
        query=search_in.query, 
        top_k=search_in.top_k
    )
    
    # Bulunan sonuçları FastAPI otomatik olarak SearchResponse şemasına dönüştürüp kullanıcıya iletir
    return results

@app.post("/ask/", response_model=AskResponse)
def ask_knowledge_base(ask_in: AskRequest, db: Session = Depends(get_db)):
    """
    Kullanıcıdan gelen soruyu alır, ilgili dokümanları bulur ve LLM ile akıllı bir yanıt üretir.
    """
    try:
        result = answer_question(db=db, query=ask_in.query, top_k=ask_in.top_k)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=str(e)
        )  

@app.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    """
    Belirli bir ID'ye sahip dokümanı ve ilgili vektör parçalarını sistemden siler.
    """
    deleted_doc = delete_document_by_id(db=db, document_id=document_id)
    if not deleted_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID'si {document_id} olan doküman bulunamadı."
        )
    
    return {
        "message": f"'{deleted_doc.filename}' adlı doküman ve ilişkili tüm vektör parçaları başarıyla silindi.",
        "document_id": document_id
    }  

