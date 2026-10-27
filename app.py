import streamlit as st
import requests

# FastAPI Backend Adresi
API_URL = "http://127.0.0.1:8000"

# Sayfa Yapılandırması
st.set_page_config(
    page_title="RedRose Knowledge Assistant",
    page_icon="🌹",
    layout="wide"
)

# Başlık ve Açıklama
st.title("🌹 RedRose AI Knowledge Assistant")
st.caption("RAG Tabanlı Doküman Arama ve Akıllı Soru-Cevap Asistanı")

# --- SIDEBAR: DOKÜMAN YÖNETİMİ ---
with st.sidebar:
    st.header("📄 Doküman Yönetimi")
    
    # 1. Doküman Yükleme
    st.subheader("Yeni Doküman Yükle")
    uploaded_file = st.file_uploader("PDF, DOCX veya TXT seçin", type=["pdf", "docx", "txt"])
    
    if uploaded_file is not None:
        if st.button("Dokümanı İşle ve Kaydet", use_container_width=True):
            with st.spinner("Metinler çıkarılıyor ve vektörleştiriliyor..."):
                files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                try:
                    res = requests.post(f"{API_URL}/documents/", files=files)
                    if res.status_code == 201:
                        st.success(f"'{uploaded_file.name}' başarıyla kaydedildi!")
                        st.rerun()
                    else:
                        st.error(f"Hata: {res.json().get('detail', 'Bilinmeyen hata')}")
                except Exception as e:
                    st.error(f"Sunucuya bağlanılamadı: {e}")

    st.divider()

    # 2. Yüklü Dokümanları Listeleme ve Silme
    st.subheader("Yüklü Dokümanlar")
    try:
        docs_res = requests.get(f"{API_URL}/documents/")
        if docs_res.status_code == 200:
            docs = docs_res.json()
            if docs:
                for doc in docs:
                    col1, col2 = st.columns([3, 1])
                    with col1:
                        st.write(f"**ID {doc['id']}:** {doc['filename']}")
                    with col2:
                        if st.button("🗑️", key=f"del_{doc['id']}", help="Dokümanı Sil"):
                            del_res = requests.delete(f"{API_URL}/documents/{doc['id']}")
                            if del_res.status_code == 200:
                                st.toast(f"ID {doc['id']} silindi!", icon="✅")
                                st.rerun()
                            else:
                                st.error("Silinemedi.")
            else:
                st.info("Henüz yüklenmiş bir doküman yok.")
        else:
            st.error("Doküman listesi alınamadı.")
    except Exception as e:
        st.warning("Backend sunucusuna ulaşılamıyor. FastAPI'nin çalıştığından emin olun.")


# --- ANA EKRAN SEKMELERİ ---
tab1, tab2, tab3 = st.tabs(["💬 Akıllı Soru-Cevap (RAG Chat)", "🔍 Anlamsal Arama (Search)", "🔎 Doküman Detay İnceleme"])

# --- TAB 1: AKILLI CHAT (RAG) ---
with tab1:
    st.markdown("Yüklediğiniz dokümanlara dayanarak yapay zekaya sorular sorabilirsiniz.")
    
    # Chat geçmişini oturumda saklıyoruz
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Geçmiş mesajları ekrana basıyoruz
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            if "sources" in message and message["sources"]:
                with st.expander("📚 Kullanılan Kaynak Metin Parçaları"):
                    for src in message["sources"]:
                        st.caption(f"**Chunk #{src['chunk_index']} (ID: {src['id']}):**")
                        st.text(src["content"])

    # Kullanıcı soru girdiğinde
    if prompt := st.chat_input("Dokümanlarınızla ilgili bir soru sorun..."):
        # Kullanıcı mesajını göster ve kaydet
        st.chat_message("user").markdown(prompt)
        st.session_state.messages.append({"role": "user", "content": prompt})

        # API'ye İstek Atma
        with st.chat_message("assistant"):
            with st.spinner("Dokümanlar taranıyor ve yanıt üretiliyor..."):
                try:
                    res = requests.post(
                        f"{API_URL}/ask/",
                        json={"query": prompt, "top_k": 3}
                    )
                    if res.status_code == 200:
                        data = res.json()
                        answer = data["answer"]
                        sources = data.get("sources", [])

                        st.markdown(answer)
                        if sources:
                            with st.expander("📚 Kullanılan Kaynak Metin Parçaları"):
                                for src in sources:
                                    st.caption(f"**Chunk #{src['chunk_index']} (ID: {src['id']}):**")
                                    st.text(src["content"])

                        # Yanıtı oturuma kaydet
                        st.session_state.messages.append({
                            "role": "assistant",
                            "content": answer,
                            "sources": sources
                        })
                    else:
                        st.error("Bir hata oluştu.")
                except Exception as e:
                    st.error(f"Baglantı hatası: {e}")

# --- TAB 2: ANLAMSAL ARAMA (SEARCH) ---
with tab2:
    st.markdown("Veritabanındaki vektör benzerliği en yüksek metin parçalarını arayın.")
    search_query = st.text_input("Arama Sorgusu", placeholder="Örn: Hibrit çalışma saatleri nelerdir?")
    top_k_search = st.slider("Getirilecek Parça Sayısı (Top K)", min_value=1, max_value=10, value=3)

    if st.button("Arama Yap", type="primary"):
        if search_query.strip():
            with st.spinner("Vektör benzerliği hesaplanıyor..."):
                try:
                    res = requests.post(
                        f"{API_URL}/search/",
                        json={"query": search_query, "top_k": top_k_search}
                    )
                    if res.status_code == 200:
                        results = res.json()
                        if results:
                            st.subheader(f"En Alakalı {len(results)} Sonuç:")
                            for idx, item in enumerate(results, 1):
                                with st.container(border=True):
                                    st.write(f"**Sonuç #{idx}** (Doküman ID: {item['document_id']} | Chunk Index: {item['chunk_index']})")
                                    st.write(item["content"])
                        else:
                            st.warning("Uyumlu bir içerik bulunamadı.")
                    else:
                        st.error("Arama sırasında hata oluştu.")
                except Exception as e:
                    st.error(f"Bağlantı hatası: {e}")

# --- TAB 3: DOKÜMAN DETAY İNCELEME ---
with tab3:
    st.markdown("Bir dokümanın veritabanında kaç parçaya bölündüğünü ve içeriklerini inceleyin.")
    doc_id_input = st.number_input("İncelenecek Doküman ID'si", min_value=1, step=1)
    
    if st.button("Doküman İçeriğini Getir"):
        try:
            res = requests.get(f"{API_URL}/documents/{doc_id_input}")
            if res.status_code == 200:
                doc_detail = res.json()
                st.success(f"Doküman Bulundu: **{doc_detail['filename']}**")
                st.caption(f"Yüklenme Tarihi: {doc_detail['created_at']}")
                
                st.subheader("Parçalanmış Metin İçerikleri (Chunks):")
                for chunk in doc_detail.get("chunks", []):
                    with st.expander(f"Chunk #{chunk['chunk_index']} (ID: {chunk['id']})"):
                        st.text(chunk["content"])
            elif res.status_code == 404:
                st.warning(f"ID'si {doc_id_input} olan doküman bulunamadı.")
            else:
                st.error("Bir hata oluştu.")
        except Exception as e:
            st.error(f"Bağlantı hatası: {e}")