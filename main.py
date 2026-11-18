from database import Base, engine, get_db  #Base ve engine'i database.py'den import ediyoruz
from fastapi import FastAPI, Depends,HTTPException,status,UploadFile, File #fastapi kütüphanesini import ediyoruz
import models  # Modellerin Base tarafından tanınması için import ediyoruz
from schemas import RoleUpdate, UserCreate,DocumentCreate,SearchRequest,SearchResponse,AskRequest, AskResponse,DocumentListItem,DocumentDetailResponse,ChunkSchema,Token
from sqlalchemy.orm import Session
from services import process_and_store_file_document_with_pages,search_documents,answer_question,get_all_documents, delete_document_by_id,get_document_by_id
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

import auth #PyJWT ve şifreleme fonksiyonlarını içerir

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

@app.post("/auth/set-up-first-admin", tags=["Authentications"])
def setup_first_admin(user: UserCreate, db: Session = Depends(get_db)):
    user_count = db.query(models.User).count()
    if user_count > 0 :
        raise HTTPException(
            status_code= status.HTTP_403_FORBIDDEN,
            detail="Sistemde zaten kullanıcılar var. Kurulum rotası kilitlendi!"
        )

    hashed_pwd = auth.get_password_hash(user.password)

    new_admin = models.User(
        email=user.email,
        hashed_password=hashed_pwd,
        role="admin"

    )
    db.add(new_admin)
    db.commit
    
    return {"message": "Kurucu Admin hesabı başarıyla oluşturuldu.", "email": user.email}



        

    

@app.post("/auth/register", tags=["Authentications"])
def register(user: UserCreate, db: Session = Depends(get_db), current_admin: dict = Depends(auth.get_current_admin_user)):
    """Yeni kullanıcı kaydını SADECE yöneticiler (admin) yapabilir."""
    
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu e-posta adresi zaten kullanımda."
        )
    
    hashed_pwd = auth.get_password_hash(user.password)
    
    new_user = models.User(
        email=user.email,
        hashed_password=hashed_pwd,
        role="user" # Adminlerin eklediği herkes standart kullanıcı olur
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "message": "Kullanıcı başarıyla eklendi", 
        "added_by": current_admin["sub"], # Hangi adminin eklediğini gösterelim
        "new_user": new_user.email
    }

@app.post("/auth/login", response_model=Token, tags=["Authentications"] )
def login(form_data:OAuth2PasswordRequestForm= Depends(), db:Session= Depends(get_db)):
    
    user =db.query(models.User).filter(form_data.username == models.User.email).first()
    
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail="E posta veya şifre hatalı",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = auth.create_accses_token( #Payload (data) eklenir [sub]
        data = {"sub": user.email, "id": user.id, "role": user.role}
    )

    return {"access_token": access_token, "token_type": "bearer"}



    
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

@app.get("/documents/{document_id}", response_model=DocumentDetailResponse) #kırmızı olan doc_id path parameterdir, değişken bir yapıda olduğu süslü parantezle belirtilir.
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
async def upload_any_document(file: UploadFile = File(...), db: Session = Depends(get_db)): #File(...): FastAPI'ye "Bu veriyi URL'den veya JSON gövdesinden değil, HTTP isteğinin Form Verisinden (multipart/form-data) çek" talimatını verir. İçindeki ... (üç nokta) sembolü Python'da Ellipsis olarak bilinir ve Pydantic/FastAPI dünyasında "Bu alan kesinlikle zorunludur" anlamına gelir.
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
        file_bytes = await file.read() #Dosyayı belleğe okuma (read()) işlemi zaman alacaktır. await kelimesi Python'a şunu söyler: "Dosyanın baytlara (bytes) çevrilme işlemini başlat. Bu satırda işlemi duraklat (pause), git başka işlerin varsa onları hallet. Dosyanın okunması tamamen bittiğinde beni uyandır ve bir sonraki satırdan kod işlemeye devam etsin."
        
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

    except Exception as e: #Ne tür bir hata çıkarsa çıksın (Exception), bunu yakala ve 'e' isimli değişkene hapset"
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

@app.get("/users", tags=["Admin Panel"])
def get_all_users(db: Session = Depends(get_db), current_admin: dict = Depends(auth.get_current_admin_user)):
    users = db.query(models.User).all() # Herkesi getir
    return [{"id": u.id, "email": u.email, "role": u.role} for u in users]

@app.get("/users/search", tags=["Admin Panel"])
def search_users(email: str,db:Session = Depends(get_db), current_admin: dict = Depends(auth.get_current_admin_user)):
    show_user = db.query(models.User).filter(models.User.email.ilike(f"%{email}%")).all()

    if not show_user :
        raise HTTPException(
            status_code=404,
            detail="BU kritere uyan kullanıcı bulunamadı"
        )

    showed = [
        {
            "id": show_user.id, 
            "email": show_user.email, 
            "role": show_user.role
        }
    ]

    return showed


@app.delete("/users/{user_id}", tags=["Admin Panel"])
def delete_user( user_id: int, db:Session = Depends(get_db),current_admin: dict = Depends(auth.get_current_admin_user)):
    user = db.query(models.User).filter(user_id==models.User.id).first()

    if not user :
        raise HTTPException (
            status_code=404,
            detail = "kullanıcı bulunamadı"
        )
    if user.email == current_admin["sub"]:
        raise HTTPException (
            status_code=400,
            detail="Güvenlik İhlali: Aktif olarak kullandığınız kendi yönetici hesabınızı silemezsiniz!"
        )

    db.delete(user)
    db.commit()

    return {"message": f"{user.email} sistemden başarıyla silindi."}

@app.patch("/users/{user_id}/role", tags=["Admin Panel"])
def update_user (role_data : RoleUpdate ,user_id : int ,db: Session = Depends(get_db),current_admin: dict = Depends(auth.get_current_admin_user)):
    updated_user= db.query(models.User).filter(user_id == models.User.id).first()

    if not updated_user:
        raise HTTPException(
            status_code=404,
            detail= " kullanıcı bulunamadı"
        )

    if updated_user.email == current_admin["sub"] and role_data.new_role =="user":
        raise HTTPException(
            status_code=400, 
            detail="Kendi yönetici yetkinizi kaldıramazsınız!"
        )
    
    updated_user.role = role_data.new_role 
    db.commit()

    return {"message": f"{updated_user.email} kullanıcısının rolü {role_data.new_role} olarak güncellendi "}

