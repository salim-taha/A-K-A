const API_BASE_URL = "http://127.0.0.1:8000";

// --- MEVCUT TİP TANIMLAMALARIN ---
export interface DocumentListItem {
  id: number;
  filename: string;
  created_at: string;
}

export interface ChunkDetail {
  id: number;
  chunk_index: number;
  content: string;
}

export interface DocumentDetail {
  id: number;
  filename: string;
  created_at: string;
  chunks: ChunkDetail[];
}

export interface SearchResult {
  id: number;
  document_id: number;
  content: string;
  chunk_index: number;
}

export interface AskResponse {
  answer: string;
  sources: ChunkDetail[];
}

// --- YENİ: GÜVENLİK VE FETCH YARDIMCISI ---

/**
 * Tarayıcının hafızasından token'ı alır ve her isteğin başlığına ekler.
 */
const getAuthHeaders = (): HeadersInit => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
};

/**
 * Standart fetch işlemini sarmalayan, token ekleyen ve 401 hatalarını yakalayan fonksiyon.
 */
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Eğer token geçersizse page.tsx'in yakalayıp login'e atması için 401 fırlatıyoruz
  if (response.status === 401) {
    throw new Error("401 Unauthorized");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Sunucu hatası.");
  }

  return response.json();
}

// --- GÜNCELLENMİŞ API İŞLEMLERİ ---

export const api = {
  async uploadDocument(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return fetchWithAuth("/documents/", {
      method: "POST",
      body: formData,
    });
  },

  async getDocuments(): Promise<DocumentListItem[]> {
    return fetchWithAuth("/documents/");
  },

  async getDocumentDetail(id: number): Promise<DocumentDetail> {
    return fetchWithAuth(`/documents/${id}`);
  },

  async deleteDocument(id: number) {
    return fetchWithAuth(`/documents/${id}`, {
      method: "DELETE",
    });
  },

  async search(query: string, topK: number = 3): Promise<SearchResult[]> {
    return fetchWithAuth("/search/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: topK }),
    });
  },

  async ask(query: string, topK: number = 3): Promise<AskResponse> {
    return fetchWithAuth("/ask/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: topK }),
    });
  },
};