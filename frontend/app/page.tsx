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
  Shield,
  UserPlus,
  Building2,
  KeyRound,
} from "lucide-react";
import Image from "next/image";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SearchResult[];
}

interface AppUser {
  id: number;
  email: string;
  role: string;
  department: string;
}

const API_BASE = "http://127.0.0.1:8000";

const AVAILABLE_ROLES = [
  { value: "super admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "user", label: "User" },
];

const AVAILABLE_DEPARTMENTS = ["Genel", "İK", "Yazılım", "Finans", "Satış"];

const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case "super admin":
      return "bg-purple-500/20 text-purple-400 border border-purple-500/30";
    case "admin":
      return "bg-redrose-red/20 text-redrose-red border border-redrose-red/30";
    case "editor":
      return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    default:
      return "bg-gray-700/50 text-gray-300 border border-gray-600/50";
  }
};

const getDepartmentBadgeStyle = (dept: string) => {
  switch (dept) {
    case "Yazılım":
      return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    case "İK":
      return "bg-pink-500/20 text-pink-400 border border-pink-500/30";
    case "Finans":
      return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    case "Satış":
      return "bg-orange-500/20 text-orange-400 border border-orange-500/30";
    default:
      return "bg-zinc-700/50 text-zinc-300 border border-zinc-600/50";
  }
};

export default function Home() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [userDepartment, setUserDepartment] = useState<string>("Genel");
  const router = useRouter();

  const isAdmin = userRole === "admin" || userRole === "super admin";

  // Kullanıcının dosya yüklerken seçebileceği departmanlar
  const uploadableDepartments = isAdmin
    ? AVAILABLE_DEPARTMENTS
    : Array.from(new Set([userDepartment || "Genel", "Genel"]));

  // Authentication & Yetki State'i
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Sekme (Tab) ve Veri State'leri
  const [activeTab, setActiveTab] = useState<"chat" | "search" | "detail" | "admin">("chat");
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadDepartment, setUploadDepartment] = useState<string>("Genel");

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

  // Admin Paneli State'leri
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserDepartment, setNewUserDepartment] = useState("Genel");
  const [addingUser, setAddingUser] = useState(false);

  // Sayfa yüklendiğinde Token kontrolü yap
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
      loadDocuments();

      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserEmail(payload.sub || "");
        setUserRole(payload.role || "user");
        setUserDepartment(payload.department || "Genel");
      } catch (err) {
        console.error("Token çözülemedi:", err);
      }
    }
  }, [router]);

  // Admin sekmesine geçildiğinde kullanıcıları otomatik çek
  useEffect(() => {
    if (activeTab === "admin" && isAdmin) {
      loadUsers();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Çıkış Yap Fonksiyonu
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/login");
  };

  // --- DOKÜMAN & RAG FONKSİYONLARI ---
  const loadDocuments = async () => {
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err: any) {
      if (err.message.includes("401")) handleLogout();
      console.error(err);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(file, uploadDepartment);
      setFile(null);
      await loadDocuments();
      alert(`Doküman '${uploadDepartment}' departmanına başarıyla yüklendi ve vektörleştirildi!`);
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

  // --- ADMİN PANELİ FONKSİYONLARI ---
  const loadUsers = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Kullanıcılar yüklenemedi:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword.trim()) return;
    const token = localStorage.getItem("access_token");
    setAddingUser(true);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          password: newUserPassword,
          department: newUserDepartment,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserDepartment("Genel");
        await loadUsers();
        alert("Yeni kullanıcı başarıyla eklendi!");
      } else {
        alert(data.detail || "Kullanıcı eklenemedi.");
      }
    } catch {
      alert("Sunucuya bağlanılamadı.");
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async (id: number, email: string) => {
    if (!confirm(`${email} kullanıcısını silmek istediğinize emin misiniz?`)) return;
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } else {
        const data = await res.json();
        alert(data.detail || "Silme işlemi başarısız.");
      }
    } catch {
      alert("Sunucuya bağlanılamadı.");
    }
  };

  const handleRoleChange = async (id: number, newRole: string) => {
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(`${API_BASE}/users/${id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_role: newRole }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
        );
      } else {
        const data = await res.json();
        alert(data.detail || "Rol değiştirilemedi.");
      }
    } catch {
      alert("Sunucuya bağlanılamadı.");
    }
  };

  const handleDepartmentChange = async (id: number, newDepartment: string) => {
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(`${API_BASE}/users/${id}/department`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_dept: newDepartment }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, department: newDepartment } : u))
        );
      } else {
        const data = await res.json();
        alert(data.detail || "Departman değiştirilemedi.");
      }
    } catch {
      alert("Sunucuya bağlanılamadı.");
    }
  };

  const handleResetPassword = async (id: number, email: string) => {
    const newPassword = prompt(`${email} kullanıcısı için yeni şifreyi girin:`);
    if (!newPassword || !newPassword.trim()) return;

    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_BASE}/users/${id}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPassword.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Şifre güncellendi.");
      } else {
        alert(data.detail || "Şifre güncellenemedi.");
      }
    } catch {
      alert("Sunucuya bağlanılamadı.");
    }
  };

  // Flicker engelleme
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-redrose-black">
        <Loader2 className="w-8 h-8 animate-spin text-redrose-red" />
      </div>
    );
  }

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

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
                className="object-contain bg-white rounded-full"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="font-bold text-sm leading-tight text-redrose-text truncate max-w-[160px]">
                {userEmail ? userEmail.split("@")[0] : "Kullanıcı"}
              </h1>
              <div className="flex flex-wrap gap-1.5 items-center mt-1">
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${getRoleBadgeStyle(
                    userRole
                  )}`}
                >
                  {userRole || "USER"}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${getDepartmentBadgeStyle(
                    userDepartment
                  )}`}
                >
                  {userDepartment}
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
              className="text-xs text-redrose-subtext file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-redrose-red file:text-white hover:file:bg-redrose-darkred w-full mb-2.5 cursor-pointer"
            />
            <div className="mb-3">
              <label className="text-[10px] font-semibold text-redrose-subtext mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                ERİŞİM DEPARTMANI
              </label>
              <select
                value={uploadDepartment}
                onChange={(e) => setUploadDepartment(e.target.value)}
                className="w-full bg-redrose-black border border-redrose-border hover:border-redrose-red text-redrose-text text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-redrose-red transition cursor-pointer"
              >
                {uploadableDepartments.map((dept) => (
                  <option key={dept} value={dept} className="bg-redrose-dark text-redrose-text">
                    {dept}
                  </option>
                ))}
              </select>
            </div>
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
                  Erişebileceğiniz doküman bulunmuyor.
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
                      <div className="flex flex-col truncate">
                        <span className="text-xs text-redrose-text truncate font-medium">
                          {doc.filename}
                        </span>
                        {doc.department && (
                          <span
                            className={`text-[9px] w-fit mt-0.5 px-1.5 py-0.2 rounded font-medium ${getDepartmentBadgeStyle(
                              doc.department
                            )}`}
                          >
                            {doc.department}
                          </span>
                        )}
                      </div>
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

      {/* ANA EKRAN PANELİ (Chat / Arama / Detay / Admin) */}
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

            {/* SADECE ADMIN VE SUPER ADMIN'E GÖRÜNEN YÖNETİM PANELİ SEKMESİ */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === "admin"
                    ? "bg-redrose-red text-white"
                    : "text-redrose-subtext hover:bg-redrose-dark"
                }`}
              >
                <Shield className="w-4 h-4" />
                Yönetim Paneli
              </button>
            )}
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
                    Yapay zeka yalnızca erişim yetkiniz olan dokümanlardaki bilgilere
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

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-redrose-border">
                          <span className="text-[11px] font-semibold text-redrose-subtext flex items-center gap-1 mb-2">
                            <BookOpen className="w-3 h-3 text-redrose-red" />
                            Kullanılan Kaynaklar ({msg.sources.length}):
                          </span>
                          <div className="space-y-2">
                            {msg.sources.map((src) => (
                              <div
                                key={src.id}
                                className="p-2.5 bg-redrose-black border border-redrose-border rounded text-[11px] text-redrose-subtext flex flex-col gap-1.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <FileText className="w-3.5 h-3.5 text-redrose-red shrink-0" />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        src.document_id &&
                                        handleFetchDetail(src.document_id)
                                      }
                                      className="font-semibold text-redrose-text hover:text-redrose-red truncate transition text-left"
                                      title="Doküman detayını görüntüle"
                                    >
                                      {src.document_filename ||
                                        `Doküman #${src.document_id}`}
                                    </button>
                                    {src.department && (
                                      <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${getDepartmentBadgeStyle(
                                          src.department
                                        )}`}
                                      >
                                        {src.department}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] text-redrose-subtext">
                                      Chunk #{src.chunk_index}
                                    </span>
                                    {src.page_number && (
                                      <span className="bg-redrose-red/20 text-redrose-red px-2 py-0.5 rounded text-[10px] font-medium border border-redrose-red/30">
                                        Sayfa: {src.page_number}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-redrose-text leading-relaxed">
                                  {src.content}
                                </p>
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
              {searchResults.map((res, idx) => (
                <div
                  key={res.id}
                  className="p-4 bg-redrose-dark border border-redrose-border rounded-xl space-y-2"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-redrose-red font-semibold shrink-0">
                        Sonuç #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          res.document_id && handleFetchDetail(res.document_id)
                        }
                        className="text-redrose-text hover:text-redrose-red font-medium truncate transition text-left"
                        title="Doküman detayını görüntüle"
                      >
                        {res.document_filename || `Doküman #${res.document_id}`}
                      </button>
                      {res.department && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${getDepartmentBadgeStyle(
                            res.department
                          )}`}
                        >
                          {res.department}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 items-center text-redrose-subtext shrink-0">
                      {res.page_number && (
                        <span className="bg-redrose-red/20 text-redrose-red px-2 py-0.5 rounded text-[10px]">
                          Sayfa: {res.page_number}
                        </span>
                      )}
                      <span>Chunk #{res.chunk_index}</span>
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-redrose-text">
                        {docDetail.filename}
                      </h3>
                      {docDetail.department && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${getDepartmentBadgeStyle(
                            docDetail.department
                          )}`}
                        >
                          {docDetail.department}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-redrose-subtext mt-0.5">
                      ID: {docDetail.id} | Yükleme Tarihi: {docDetail.created_at}
                    </p>
                  </div>
                  <span className="text-xs bg-redrose-red/20 text-redrose-red font-semibold px-3 py-1 rounded-full border border-redrose-red/30">
                    {docDetail.chunks.length} Parça (Chunk)
                  </span>
                </div>

                <div className="space-y-3">
                  {docDetail.chunks.map((chunk) => (
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

        {/* TAB 4: YÖNETİM PANELİ (SADECE ADMIN & SUPER ADMIN) */}
        {activeTab === "admin" && isAdmin && (
          <div className="p-6 max-w-5xl w-full mx-auto overflow-y-auto flex-1 space-y-6">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-redrose-red" />
                Kullanıcı & Yetki Yönetimi
              </h2>
              <p className="text-xs text-redrose-subtext mt-1">
                Sisteme yeni kullanıcı ekleyin, e-posta ile arayın, rollerini ve departmanlarını güncelleyin veya hesapları kaldırın.
              </p>
            </div>

            {/* Yeni Kullanıcı Ekleme Formu */}
            <form
              onSubmit={handleAddUser}
              className="p-4 bg-redrose-dark border border-redrose-border rounded-xl flex flex-wrap gap-3 items-end"
            >
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-semibold text-redrose-subtext block mb-1">
                  YENİ KULLANICI E-POSTA
                </label>
                <input
                  type="email"
                  required
                  placeholder="ornek@redrose.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-redrose-black border border-redrose-border rounded-lg px-3 py-2 text-xs text-redrose-text focus:outline-none focus:border-redrose-red"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-[11px] font-semibold text-redrose-subtext block mb-1">
                  GEÇİCİ ŞİFRE
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-redrose-black border border-redrose-border rounded-lg px-3 py-2 text-xs text-redrose-text focus:outline-none focus:border-redrose-red"
                />
              </div>
              <div className="w-40">
                <label className="text-[11px] font-semibold text-redrose-subtext block mb-1">
                  DEPARTMAN
                </label>
                <select
                  value={newUserDepartment}
                  onChange={(e) => setNewUserDepartment(e.target.value)}
                  className="w-full bg-redrose-black border border-redrose-border rounded-lg px-3 py-2 text-xs text-redrose-text focus:outline-none focus:border-redrose-red cursor-pointer"
                >
                  {AVAILABLE_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept} className="bg-redrose-dark text-redrose-text">
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={addingUser}
                className="bg-redrose-red hover:bg-redrose-darkred disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition"
              >
                {addingUser ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Kullanıcı Ekle
              </button>
            </form>

            {/* E-Posta Arama Çubuğu */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-redrose-subtext" />
              </div>
              <input
                type="text"
                placeholder="E-posta adresine göre kullanıcı ara..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-redrose-dark border border-redrose-border rounded-xl text-sm text-redrose-text focus:outline-none focus:border-redrose-red transition"
              />
            </div>

            {/* Kullanıcılar Tablosu */}
            <div className="bg-redrose-dark rounded-xl border border-redrose-border overflow-hidden">
              {loadingUsers ? (
                <div className="p-8 flex items-center justify-center gap-2 text-redrose-subtext text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-redrose-red" />
                  Kullanıcılar yükleniyor...
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-redrose-black/60 border-b border-redrose-border text-redrose-subtext text-xs">
                      <th className="p-3.5 font-semibold">ID</th>
                      <th className="p-3.5 font-semibold">E-Posta</th>
                      <th className="p-3.5 font-semibold">Departman</th>
                      <th className="p-3.5 font-semibold">Rol</th>
                      <th className="p-3.5 font-semibold text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-redrose-border/50 text-sm">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-redrose-black/40 transition">
                        <td className="p-3.5 text-redrose-subtext text-xs">#{u.id}</td>
                        <td className="p-3.5 font-medium text-redrose-text">{u.email}</td>
                        <td className="p-3.5">
                          <select
                            value={u.department || "Genel"}
                            onChange={(e) => handleDepartmentChange(u.id, e.target.value)}
                            className="bg-redrose-black border border-redrose-border hover:border-redrose-red text-redrose-text text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-redrose-red transition cursor-pointer"
                          >
                            {AVAILABLE_DEPARTMENTS.map((dept) => (
                              <option
                                key={dept}
                                value={dept}
                                className="bg-redrose-dark text-redrose-text"
                              >
                                {dept}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getRoleBadgeStyle(
                              u.role
                            )}`}
                          >
                            {u.role === "admin" || u.role === "super admin" ? (
                              <Shield className="w-3 h-3" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              disabled={u.email === userEmail}
                              className="bg-redrose-black border border-redrose-border hover:border-redrose-red text-redrose-text text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-redrose-red transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {AVAILABLE_ROLES.map((r) => (
                                <option
                                  key={r.value}
                                  value={r.value}
                                  className="bg-redrose-dark text-redrose-text"
                                >
                                  {r.label}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleResetPassword(u.id, u.email)}
                              className="p-1.5 text-redrose-subtext hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
                              title="Yeni Şifre Ata"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              disabled={u.email === userEmail}
                              className="p-1.5 text-redrose-subtext hover:text-redrose-red hover:bg-redrose-red/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Kullanıcıyı Sil"
                            >

                            
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!loadingUsers && filteredUsers.length === 0 && (
                <div className="p-6 text-center text-xs text-redrose-subtext">
                  Arama kriterine uyan kullanıcı bulunamadı.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}