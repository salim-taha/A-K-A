"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  DocumentListItem,
  DocumentDetail,
  SearchResult,
} from "@/lib/api";
import {
  Upload,
  FileText,
  Trash2,
  Send,
  Search,
  Bot,
  User,
  BookOpen,
  Info,
  Loader2,
  Layers,
  LogOut,
} from "lucide-react";
import Image from "next/image";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { id: number; chunk_index: number; content: string; page_number?: number }[];
}

export default function Home() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const router = useRouter();

  // Authentication & Yetki State'i
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Sekme (Tab) ve Veri State'leri
  const [activeTab, setActiveTab] = useState<"chat" | "search" | "detail">("chat");
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Arama (Search) State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Detay (Detail) State
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Sayfa yüklendiğinde Token kontrolü yap (Yetki Yoksa Login'e fırlat)
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
      loadDocuments();
      
      // Token'ı çöz ve içindeki bilgileri (email ve rol) state'e kaydet
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserEmail(payload.sub);   // sub = e-posta adresimiz
        setUserRole(payload.role);   // role = 'user' veya 'admin'
      } catch (err) {
        console.error("Token çözülemedi:", err);
      }
    }
  }, [router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Çıkış Yap Fonksiyonu
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/login");
  };

  const loadDocuments = async () => {
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err: any) {
      // Eğer API 401 (Unauthorized) dönerse token geçersizdir, çıkış yaptır.
      if (err.message.includes("401")) handleLogout();
      console.error(err);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(file);
      setFile(null);
      await loadDocuments();
      alert("Doküman başarıyla işlendi, sayfalandırıldı ve vektörleştirildi!");
    } catch (err: any) {
      if (err.message.includes("401")) handleLogout();
      alert(err.message || "Yükleme başarısız.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu dokümanı ve tüm parçalarını silmek istediğinize emin misiniz?"))
      return;
    try {
      await api.deleteDocument(id);
      await loadDocuments();
      if (docDetail?.id === id) setDocDetail(null);
    } catch (err: any) {
      if (err.message.includes("401")) handleLogout();
      alert(err.message);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || asking) return;

    const userMessage = inputQuery.trim();
    setInputQuery("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setAsking(true);

    try {
      const res = await api.ask(userMessage);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          sources: res.sources,
        },
      ]);
    } catch (err: any) {
      if (err.message.includes("401")) handleLogout();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Üzgünüm, yanıt oluşturulurken bir hata meydana geldi.",
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await api.search(searchQuery);
      setSearchResults(results);
    } catch (err: any) {
      if (err.message.includes("401")) handleLogout();
      alert(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleFetchDetail = async (id: number) => {
    setSelectedDocId(id);
    setLoadingDetail(true);
    try {
      const detail = await api.getDocumentDetail(id);
      setDocDetail(detail);
      setActiveTab("detail");
    } catch (err: any) {
      if (err.message.includes("401")) handleLogout();
      alert(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Kullanıcı doğrulanmadıysa (sayfa render edilirken kısacık bir anlığına) beyaz ekran/flicker engelleme
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-redrose-black">
        <Loader2 className="w-8 h-8 animate-spin text-redrose-red" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-redrose-black text-redrose-text font-sans">
      {/* SIDEBAR: DOKÜMAN YÖNETİMİ & KULLANICI */}
      <aside className="w-80 border-r border-redrose-border bg-redrose-dark flex flex-col justify-between p-4 shadow-[0_0_15px_rgba(230,0,0,0.1)]">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Logo Alanı */}
          <div className="flex items-center gap-2 mb-6">
            <div className="shrink-0 rounded-full shadow-[0_0_15px_rgba(229,26,36,0.3)] bg-redrose-red w-[52px] h-[52px] flex items-center justify-center">
              <Image 
                src="/redrose-logo-transparent.png" 
                alt="RedRose Logo" 
                width={52} 
                height={52} 
                // bg-white ve rounded-full ile silinen iç kısımları beyaz yuvarlakla dolduruyoruz
                className="object-contain bg-white rounded-full" 
              />
            </div>
            <div className="flex flex-col">
              <h1 className="font-bold text-sm leading-tight text-redrose-text truncate max-w-[150px]">
                {userEmail ? userEmail.split('@')[0] : "Kullanıcı"}
              </h1>
              <div className="flex gap-2 items-center mt-0.5">
                <p className="text-[10px] text-redrose-subtext tracking-wide">AI ASSISTANT</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  userRole === "admin" 
                    ? "bg-redrose-red/20 text-redrose-red border border-redrose-red/30" 
                    : "bg-gray-700/50 text-gray-300 border border-gray-600/50"
                }`}>
                  {userRole || "USER"}
                </span>
              </div>
            </div>
          </div>

          {/* Dosya Yükleme Paneli */}
          <div className="p-3 bg-redrose-black/50 border border-redrose-border/50 rounded-xl mb-6">
            <label className="text-xs font-semibold text-redrose-subtext mb-2 block">
              YENİ DOKÜMAN YÜKLE
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs text-redrose-subtext file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-redrose-red file:text-white hover:file:bg-redrose-darkred w-full mb-3 cursor-pointer"
            />
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-redrose-red hover:bg-redrose-darkred disabled:opacity-50 text-white text-xs font-medium rounded-lg transition"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? "İşleniyor..." : "Yükle & Vektörleştir"}
            </button>
          </div>

          {/* Yüklü Dokümanlar Listesi */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <span className="text-xs font-semibold text-redrose-subtext block mb-3">
              YÜKLÜ DOKÜMANLAR ({documents.length})
            </span>
            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {documents.length === 0 ? (
                <p className="text-xs text-redrose-subtext italic">
                  Henüz doküman yüklenmedi.
                </p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2.5 bg-redrose-black/40 hover:bg-redrose-black border border-redrose-border/40 rounded-lg group transition"
                  >
                    <button
                      onClick={() => handleFetchDetail(doc.id)}
                      className="flex items-center gap-2 text-left truncate flex-1"
                    >
                      <FileText className="w-4 h-4 text-redrose-red shrink-0" />
                      <span className="text-xs text-redrose-text truncate font-medium">
                        {doc.filename}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-redrose-subtext hover:text-redrose-red p-1 opacity-0 group-hover:opacity-100 transition"
                      title="Dokümanı Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Çıkış Yap Paneli (Sidebar En Alt) */}
        <div className="pt-4 border-t border-redrose-border mt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-transparent border border-redrose-border hover:border-redrose-red hover:text-redrose-red text-redrose-subtext text-xs font-medium rounded-lg transition-colors group"
          >
            <LogOut className="w-4 h-4 group-hover:text-redrose-red transition-colors" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* ANA EKRAN PANELİ (Chat / Arama / Detay) */}
      {/* ... (Bu bölümdeki eski kodların 1:1 aynı, sadece logo kısmını yukarıda düzelttim) ... */}
      <main className="flex-1 flex flex-col bg-redrose-black">
        {/* Üst Sekme Başlıkları */}
        <header className="border-b border-redrose-border px-6 py-3 flex items-center justify-between bg-redrose-dark/50">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === "chat"
                  ? "bg-redrose-red text-white"
                  : "text-redrose-subtext hover:bg-redrose-dark"
              }`}
            >
              <Bot className="w-4 h-4" />
              Akıllı Chat (RAG)
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === "search"
                  ? "bg-redrose-red text-white"
                  : "text-redrose-subtext hover:bg-redrose-dark"
              }`}
            >
              <Search className="w-4 h-4" />
              Anlamsal Arama
            </button>
            <button
              onClick={() => setActiveTab("detail")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === "detail"
                  ? "bg-redrose-red text-white"
                  : "text-redrose-subtext hover:bg-redrose-dark"
              }`}
            >
              <Layers className="w-4 h-4" />
              Doküman Detayı
            </button>
          </div>
        </header>

        {/* TAB 1: AKILLI CHAT */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-redrose-subtext">
                  <Bot className="w-12 h-12 text-redrose-border mb-3" />
                  <p className="text-sm font-medium text-redrose-text">
                    Soru sormaya başlamak için bir mesaj yazın.
                  </p>
                  <p className="text-xs text-redrose-subtext max-w-sm mt-1">
                    Yapay zeka yalnızca yüklediğiniz dokümanlardaki bilgilere
                    dayanarak cevap üretecektir.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 max-w-3xl ${
                      msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === "user"
                          ? "bg-redrose-red text-white shadow-[0_0_10px_rgba(230,0,0,0.5)]"
                          : "bg-redrose-darkred text-white border border-redrose-red"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
                    <div
                      className={`p-4 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-redrose-red text-white rounded-tr-none shadow-[0_4px_15px_rgba(230,0,0,0.2)]"
                          : "bg-redrose-dark border border-redrose-border text-redrose-text rounded-tl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Kaynakça Gösterimi (Sayfa Bilgisi Destekli) */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-redrose-border">
                          <span className="text-[11px] font-semibold text-redrose-subtext flex items-center gap-1 mb-2">
                            <BookOpen className="w-3 h-3 text-redrose-red" />
                            Kullanılan Kaynaklar ({msg.sources.length}):
                          </span>
                          <div className="space-y-2">
                            {msg.sources.map((src: any) => (
                              <div
                                key={src.id}
                                className="p-2.5 bg-redrose-black border border-redrose-border rounded text-[11px] text-redrose-subtext flex flex-col gap-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-redrose-red">
                                    Chunk #{src.chunk_index} (ID: {src.id})
                                  </span>
                                  {src.page_number && (
                                    <span className="bg-redrose-red/20 text-redrose-red px-2 py-0.5 rounded text-[10px] font-medium border border-redrose-red/30">
                                      Sayfa / Bölüm: {src.page_number}
                                    </span>
                                  )}
                                </div>
                                <p className="text-redrose-text">{src.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {asking && (
                <div className="flex gap-3 items-center text-redrose-subtext text-sm">
                  <div className="w-8 h-8 rounded-full bg-redrose-darkred/50 text-redrose-red flex items-center justify-center border border-redrose-red">
                    <Bot className="w-4 h-4 animate-pulse" />
                  </div>
                  <span>Dokümanlar taranıyor ve yanıt üretiliyor...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Formu */}
            <form
              onSubmit={handleAsk}
              className="p-4 border-t border-redrose-border bg-redrose-dark/50 flex gap-2"
            >
              <input
                type="text"
                placeholder="Dokümanlarınızla ilgili bir soru sorun..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                className="flex-1 bg-redrose-black border border-redrose-border rounded-xl px-4 py-3 text-sm text-redrose-text focus:outline-none focus:border-redrose-red transition"
              />
              <button
                type="submit"
                disabled={asking || !inputQuery.trim()}
                className="bg-redrose-red hover:bg-redrose-darkred disabled:opacity-50 text-white px-5 rounded-xl font-medium flex items-center gap-2 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: ANLAMSAL ARAMA */}
        {activeTab === "search" && (
          <div className="p-6 max-w-4xl w-full mx-auto overflow-y-auto flex-1">
            <h2 className="text-lg font-bold mb-1">Vektör Tabanlı Anlamsal Arama</h2>
            <p className="text-xs text-redrose-subtext mb-6">
              Sorgunuzun anlamsal olarak en yakın olduğu metin parçalarını pgvector ile çekin.
            </p>

            <form onSubmit={handleSearch} className="flex gap-2 mb-8">
              <input
                type="text"
                placeholder="Aranacak ifadeyi girin (Örn: Hibrit çalışma saatleri)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-redrose-dark border border-redrose-border rounded-xl px-4 py-3 text-sm text-redrose-text focus:outline-none focus:border-redrose-red"
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-redrose-red hover:bg-redrose-darkred text-white px-6 rounded-xl font-medium text-sm flex items-center gap-2"
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Arama Yap
              </button>
            </form>

            <div className="space-y-4">
              {searchResults.map((res: any, idx) => (
                <div
                  key={res.id}
                  className="p-4 bg-redrose-dark border border-redrose-border rounded-xl space-y-2"
                >
                  <div className="flex justify-between items-center text-xs text-redrose-red font-semibold">
                    <span>Sonuç #{idx + 1}</span>
                    <div className="flex gap-2 items-center">
                      {res.page_number && (
                        <span className="bg-redrose-red/20 text-redrose-red px-2 py-0.5 rounded text-[10px]">
                          Sayfa: {res.page_number}
                        </span>
                      )}
                      <span>
                        Doküman ID: {res.document_id} | Chunk #{res.chunk_index}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-redrose-text whitespace-pre-wrap">
                    {res.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DOKÜMAN DETAYI */}
        {activeTab === "detail" && (
          <div className="p-6 max-w-4xl w-full mx-auto overflow-y-auto flex-1">
            <h2 className="text-lg font-bold mb-1">Doküman Parça (Chunk) Detayları</h2>
            <p className="text-xs text-redrose-subtext mb-6">
              Sol menüden bir dokümana tıklayarak parçalarını görüntüleyebilirsiniz.
            </p>

            {loadingDetail ? (
              <div className="flex items-center gap-2 text-redrose-subtext text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Doküman yükleniyor...
              </div>
            ) : docDetail ? (
              <div className="space-y-6">
                <div className="p-4 bg-redrose-dark border border-redrose-border rounded-xl flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-redrose-text">
                      {docDetail.filename}
                    </h3>
                    <p className="text-xs text-redrose-subtext">
                      ID: {docDetail.id} | Yükleme Tarihi: {docDetail.created_at}
                    </p>
                  </div>
                  <span className="text-xs bg-redrose-red/20 text-redrose-red font-semibold px-3 py-1 rounded-full border border-redrose-red/30">
                    {docDetail.chunks.length} Parça (Chunk)
                  </span>
                </div>

                <div className="space-y-3">
                  {docDetail.chunks.map((chunk: any) => (
                    <div
                      key={chunk.id}
                      className="p-4 bg-redrose-dark/50 border border-redrose-border rounded-xl"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-redrose-red">
                          Chunk Index #{chunk.chunk_index} (ID: {chunk.id})
                        </span>
                        {chunk.page_number && (
                          <span className="text-[10px] bg-redrose-red/20 text-redrose-red px-2 py-0.5 rounded border border-redrose-red/30">
                            Sayfa: {chunk.page_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-redrose-text whitespace-pre-wrap leading-relaxed">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-redrose-subtext text-sm flex items-center gap-2">
                <Info className="w-4 h-4" />
                Lütfen detaylarını incelemek için sol panelden bir doküman seçin.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}