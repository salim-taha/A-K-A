from datetime import timedelta,datetime,timezone
import jwt
import bcrypt
import os
from dotenv import load_dotenv
import jwt
from jwt.exceptions import InvalidTokenError
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
from requests import Session

from database import get_db
import models

load_dotenv()

SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM = "HS256"
ACCSESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Girilen şifre ile veritabanındaki şifrelenmiş (hash) şifreyi karşılaştırır."""
    # Bcrypt'in 72 karakter sınırına karşı güvenlik önlemi
    safe_password = plain_password[:72].encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    
    return bcrypt.checkpw(safe_password, hashed_bytes)

def get_password_hash(password: str) -> str:
    """Yeni şifreyi geri döndürülemez şekilde şifreler (Hash oluşturur)."""
    # Bcrypt'in 72 karakter sınırına karşı güvenlik önlemi
    safe_password = password[:72].encode('utf-8')
    
    # Modern güvenlik standardı: Rastgele bir 'tuz' (salt) üret ve şifreyle birleştir
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(safe_password, salt)
    
    return hashed_bytes.decode('utf-8')

def create_accses_token (data:dict) -> str:
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCSESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp":expire})

    encoded_jwt= jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt



def get_current_user (token: str = Depends(oauth2_scheme), db:Session = Depends(get_db)):
    credentials_exception = HTTPException ( 
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="kimlik doğrulanamadı veya oturum süresi dolmuş",
        headers={"WWW-Authenticate":"Bearer"}
    )    

    try:
        secret_key = os.getenv("AUTH_SECRET_KEY")
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])

        role: str = payload.get("role")
        email: str = payload.get("sub")
        department: str = payload.get("department")

        if email is None :
            raise credentials_exception
        
        

    except  InvalidTokenError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception

    
    return user
        
def get_current_admin_user (current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["admin", "super admin"]:
        raise HTTPException (
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Güvenlik ihlali: Bu işlem için Yönetici (Admin) yetkisine sahip olmalısınız!"
        )

    return current_user


