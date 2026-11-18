from datetime import datetime
from typing import List 
from pydantic import BaseModel
from enum import Enum

# --- 1. ORTAK CHUNK (PARÇA) ŞEMASI ---
# Tüm detay ve kaynak gösterimlerinde ortak olarak kullanılan tek parça modeli
class ChunkSchema(BaseModel):
    id: int
    content: str
    chunk_index: int
    page_number: int | None = None

    class Config:
        from_attributes = True #Bu ayar, veritabanından gelen karmaşık ORM nesnelerini alıp frontend'in anlayacağı JSON formatına çevirmekle görevlidir. Pydantic'e "Sana sözlük değil, veritabanı nesnesi vereceğim, onu oku" demek için , DB den Frontend'e veri aktarımında kullanılır. Bu sayede, veritabanı modelleri ile Pydantic şemaları arasında sorunsuz bir dönüşüm sağlanır. 

# --- 2. DOKÜMAN İŞLEMLERİ ŞEMALARI ---
class DocumentCreate(BaseModel):
    filename: str
    content: str

class DocumentListItem(BaseModel):
    id: int
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentDetailResponse(BaseModel):
    id: int
    filename: str
    created_at: datetime
    chunks: List[ChunkSchema] = []  # Ortak chunk şeması kullanıldı

    class Config:
        from_attributes = True

# --- 3. ARAMA (SEARCH) ŞEMALARI ---
class SearchRequest(BaseModel):
    query: str
    top_k: int = 3

class SearchResponse(BaseModel):
    id: int
    document_id: int
    content: str
    chunk_index: int

    class Config:
        from_attributes = True

# --- 4. AKILLI SORU-CEVAP (ASK / RAG) ŞEMALARI ---
class AskRequest(BaseModel):
    query: str
    top_k: int = 3

class AskResponse(BaseModel):
    answer: str
    sources: List[ChunkSchema]  # Kaynakçalar için de ortak chunk şeması kullanıldı

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    password: str
    email: str

class Token(BaseModel):
    access_token:str
    token_type:str

class UserRole(str,Enum):
    super_admin = "super admin"
    admin = "admin"
    editor = "editor"
    user = "user"

class RoleUpdate(BaseModel):
    new_role: UserRole