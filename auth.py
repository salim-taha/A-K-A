from datetime import timedelta,datetime,timezone
import jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM = "HS256"
ACCSESS_TOKEN_EXPIRE_MINUTES = 60



pwd_content = CryptContext(schemes=["bcrypt"], deprecated ="auto")

def verify_password (plain_password: str , hashed_password: str ) -> bool: #girilen şifreyle sistemdekini karşılaştırır
    return pwd_content.verify(plain_password,hashed_password)

def get_password_hash (password: str) -> str:
    return pwd_content.hash(password)

def create_accses_token (data:dict) -> str:
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCSESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp":expire})

    encoded_jwt= jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt



    