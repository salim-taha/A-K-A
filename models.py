from datetime import datetime
from database import Base
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text,Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector  # pgvector SQLAlchemy entegrasyonu


class Document(Base):
    __tablename__ = "documents"

    # Modern Mapped ve mapped_column kullanımı
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255)) #nullable default olarak False olduğu için, bu alan boş bırakılamaz.
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # İlişki tanımı (relationship)
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", #DocumentChunk sınıfındaki document alanı ile iletişim kurar.
        cascade="all, delete-orphan" #all ile tüm ilişik parçalara erişilir, delete-orphan ile ana doküman silindiğinde ilişkili parçalar da silinir python bazında gerçekleşir.
    )

    department: Mapped[str] = mapped_column(String(50),default="Genel")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), #ondelete=cascade sql bazında doküman silindiğinde ilişkili parçaların da silinmesini sağlar.
        nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Sayfa veya bölüm bilgisi (Metinsel ifadeler için Text)
    page_number: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 1536 boyutlu OpenAI embedding vektörü (pgvector Vector tipi)
    embedding: Mapped[Vector | None] = mapped_column(Vector(1536), nullable=True)

    # İlişki tanımı
    document: Mapped["Document"] = relationship(back_populates="chunks")

    @property
    def document_filename(self) -> str:
        return self.document.filename if self.document else "Bilinmeyen Döküman"

    @property
    def department(self) -> str:
        return self.document.department if self.document else "Genel"

    
class User(Base):
    __tablename__ = "users" # PostgreSQL'de tablo isimlerinde genelde küçük harf tercih edilir

    # ID için performans açısından genelde otomatik artan int veya UUID tercih edilir
    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    
    # Bcrypt hashleri genelde 60 karakterdir, Text veya String kullanılabilir
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="user")

    department: Mapped[str] = mapped_column(String(50),default="Genel")

