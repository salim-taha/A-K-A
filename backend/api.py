from fastapi import FastAPI

app = FastAPI()

@app.get("/") # "/ ana adresi temsile eder
def ana_sayfa():
    return {"mesaj" : "Merhaba, FastAPI ile oluşturulmuş bir API'ye hoş geldiniz!   Bu API, OpenAI'nin GPT-3.5 modelini kullanarak metin tabanlı yanıtlar üretebilir."}
    