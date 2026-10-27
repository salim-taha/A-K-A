const API_BASE_URL = "http://127.0.0.1:8000";

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

export const api = {
  async uploadDocument(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/documents/`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || "Dosya yüklenirken bir hata oluştu.");
    }
    return res.json();
  },

  async getDocuments(): Promise<DocumentListItem[]> {
    const res = await fetch(`${API_BASE_URL}/documents/`);
    if (!res.ok) throw new Error("Doküman listesi alınamadı.");
    return res.json();
  },

  async getDocumentDetail(id: number): Promise<DocumentDetail> {
    const res = await fetch(`${API_BASE_URL}/documents/${id}`);
    if (!res.ok) throw new Error("Doküman detayları alınamadı.");
    return res.json();
  },

  async deleteDocument(id: number) {
    const res = await fetch(`${API_BASE_URL}/documents/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Doküman silinemedi.");
    return res.json();
  },

  async search(query: string, topK: number = 3): Promise<SearchResult[]> {
    const res = await fetch(`${API_BASE_URL}/search/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: topK }),
    });
    if (!res.ok) throw new Error("Arama yapılırken hata oluştu.");
    return res.json();
  },

  async ask(query: string, topK: number = 3): Promise<AskResponse> {
    const res = await fetch(`${API_BASE_URL}/ask/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: topK }),
    });
    if (!res.ok) throw new Error("Soru cevaplanırken bir hata oluştu.");
    return res.json();
  },
};