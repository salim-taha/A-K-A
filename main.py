from database import Base, engine, get_db  #Base ve engine'i database.py'den import ediyoruz
from fastapi import FastAPI, Depends,HTTPException,status,UploadFile, File #fastapi kütüphanesini import ediyoruz
import models  # Modellerin Base tarafından tanınması için import ediyoruz
from schemas import Department, DepartmentUpdate, PasswordReset, RoleUpdate, UserCreate,DocumentCreate,SearchRequest,SearchResponse,AskRequest, AskResponse,DocumentListItem,DocumentDetailResponse,ChunkSchema,Token, UserRole
from sqlalchemy.orm import Session
from services import process_and_store_file_document_with_pages,search_documents,answer_question,get_all_documents, delete_document_by_id,get_document_by_id
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Form

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
    db.commit()
    
    return {"message": "Kurucu Admin hesabı başarıyla oluşturuldu.", "email": user.email}



        

    

@app.post("/auth/register", tags=["Authentications"])
def register(user: UserCreate, db: Session = Depends(get_db), current_admin: models.User = Depends(auth.get_current_admin_user)):
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
        role="user", # Adminlerin eklediği herkes standart kullanıcı olur
        department=user.department.value,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "message": "Kullanıcı başarıyla eklendi", 
        "added_by": current_admin.email, # Hangi adminin eklediğini gösterelim
        "new_user": new_user.email,
        "department": new_user.department,
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
        data = {"sub": user.email, "id": user.id, "role": user.role, "department": user.department}
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
def list_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Kullanıcının yetkisine ve departmanına göre erişebileceği dokümanları döner.
    """
    if current_user.role in ["admin", "super admin"]:
        return get_all_documents(db)
    
    return get_all_documents(db, department=current_user.department)

@app.get("/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document_detail(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Belirli bir ID'ye sahip dokümanın ana bilgilerini ve parçalanmış metin içeriklerini döner.
    """
    document = get_document_by_id(db=db, document_id=document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID'si {document_id} olan doküman bulunamadı."
        )

    # Departman bazlı erişim kontrolü
    if current_user.role not in ["admin", "super admin"]:
        if document.department not in [current_user.department, "Genel"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu departmana ait dokümanı görüntüleme yetkiniz yok."
            )

    return document

@app.post("/documents/", status_code=status.HTTP_201_CREATED)
async def upload_any_document(
    file: UploadFile = File(...),
    department: Department = Form(Department.genel),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
): #File(...): FastAPI'ye "Bu veriyi URL'den veya JSON gövdesinden değil, HTTP isteğinin Form Verisinden (multipart/form-data) çek" talimatını verir. İçindeki ... (üç nokta) sembolü Python'da Ellipsis olarak bilinir ve Pydantic/FastAPI dünyasında "Bu alan kesinlikle zorunludur" anlamına gelir.
    """
    Kullanıcının yüklediği PDF, DOCX veya TXT dosyalarını alır, metni ayıklar ve vektörleştirerek kaydeder.
    """

    if current_user.role not in ["admin", "super admin"]:
        if department.value not in [current_user.department,"Genel"]:
            raise HTTPException(status_code=403, detail="Başka bir departmana doküman yükleyemezsiniz.")

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
            file_bytes=file_bytes,
            department = department.value
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
def search_knowledge_base(
    search_in: SearchRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Kullanıcının yetkisine ve departmanına göre anlamsal arama yapar.
    """
    # Admin/Super Admin ise filtre yok (None), değilse kendi departmanı
    user_dept = None if current_user.role in ["admin", "super admin"] else current_user.department

    results = search_documents(
        db=db,
        query=search_in.query,
        top_k=search_in.top_k,
        department=user_dept,
    )
    return results

@app.post("/ask/", response_model=AskResponse)
def ask_knowledge_base(
    ask_in: AskRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    user_dept = None if current_user.role in ["admin", "super admin"] else current_user.department
    try:
        return answer_question(db=db, query=ask_in.query, top_k=ask_in.top_k, department=user_dept)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = get_document_by_id(db=db, document_id=document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"ID'si {document_id} olan doküman bulunamadı.")

    if current_user.role not in ["admin", "super admin"] and doc.department != current_user.department:
        raise HTTPException(status_code=403, detail="Başka departmana ait dokümanı silemezsiniz.")

    delete_document_by_id(db=db, document_id=document_id)
    return {"message": f"'{doc.filename}' başarıyla silindi.", "document_id": document_id}

@app.get("/users", tags=["Admin Panel"])
def get_all_users(db: Session = Depends(get_db), current_admin: models.User = Depends(auth.get_current_admin_user)):
    users = db.query(models.User).all() # Herkesi getir
    return [{"id": u.id, "email": u.email, "role": u.role, "department": u.department} for u in users]

@app.get("/users/search", tags=["Admin Panel"])
def search_users(
    email: str,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(auth.get_current_admin_user),
):
    users = db.query(models.User).filter(models.User.email.ilike(f"%{email}%")).all()

    if not users:
        raise HTTPException(
            status_code=404,
            detail="Bu kritere uyan kullanıcı bulunamadı."
        )

    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "department": u.department,
        }
        for u in users
    ]


@app.delete("/users/{user_id}", tags=["Admin Panel"])
def delete_user( user_id: int, db:Session = Depends(get_db),current_admin: models.User = Depends(auth.get_current_admin_user)):
    user = db.query(models.User).filter(user_id==models.User.id).first()

    if not user :
        raise HTTPException (
            status_code=404,
            detail = "kullanıcı bulunamadı"
        )
    if user.email == current_admin.email:
        raise HTTPException (
            status_code=400,
            detail="Güvenlik İhlali: Aktif olarak kullandığınız kendi yönetici hesabınızı silemezsiniz!"
        )

    db.delete(user)
    db.commit()

    return {"message": f"{user.email} sistemden başarıyla silindi."}

@app.patch("/users/{user_id}/role", tags=["Admin Panel"])
def update_user (role_data : RoleUpdate ,user_id : int ,db: Session = Depends(get_db),current_admin: models.User = Depends(auth.get_current_admin_user)):
    updated_user= db.query(models.User).filter(user_id == models.User.id).first()

    if not updated_user:
        raise HTTPException(
            status_code=404,
            detail= " kullanıcı bulunamadı"
        )


    if updated_user.email == current_admin.email and role_data.new_role.value not in ["admin", "super admin"]:
        raise HTTPException(
            status_code=400, 
            detail="Kendi yönetici yetkinizi kaldıramazsınız!"
        )
    
    updated_user.role = role_data.new_role.value
    db.commit()

    return {"message": f"{updated_user.email} kullanıcısının rolü {updated_user.role} olarak güncellendi "}

@app.patch("/users/{user_id}/department", tags=["Admin Panel"])
def update_user_department(
    dept_data: DepartmentUpdate,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(auth.get_current_admin_user),
):
    updated_user = db.query(models.User).filter(models.User.id == user_id).first()

    if not updated_user:
        raise HTTPException(
            status_code=404,
            detail="Kullanıcı bulunamadı."
        )

    updated_user.department = dept_data.new_dept.value
    db.commit()

    return {
        "message": f"{updated_user.email} kullanıcısının departmanı {updated_user.department} olarak güncellendi.",
        "department": updated_user.department,
    }

@app.patch("/users/{user_id}/password", tags=["Admin Panel"])
def reset_user_password(
    pwd_data: PasswordReset,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(auth.get_current_admin_user),
):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    if len(pwd_data.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Şifre en az 4 karakter olmalıdır.")

    target_user.hashed_password = auth.get_password_hash(pwd_data.new_password.strip())
    db.commit()

    return {"message": f"{target_user.email} kullanıcısının şifresi başarıyla güncellendi."}
    

        
