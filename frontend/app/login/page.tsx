"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  
  // Form durumları (state)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Form gönderildiğinde çalışacak fonksiyon
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // DİKKAT: FastAPI OAuth2 standardı gereği JSON değil, Form Data bekler!
      const formData = new URLSearchParams();
      formData.append("username", email); // Email'i "username" alanına koyuyoruz
      formData.append("password", password);

      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
      }

      // Token'ı başarıyla aldıysak tarayıcının yerel hafızasına (localStorage) kaydediyoruz
      localStorage.setItem("access_token", data.access_token);
      
      // Kullanıcıyı ana sayfaya (RAG Asistanına) yönlendir
      router.push("/");
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-redrose-black p-4">
      {/* Giriş Kartı */}
      <div className="w-full max-w-md bg-redrose-dark border border-redrose-border rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        
        {/* Üstteki Hafif Kırmızı Parlama Efekti */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-redrose-red rounded-full blur-[80px] opacity-20 pointer-events-none"></div>

        {/* Logo */}
        <div className="flex justify-center mb-6 relative z-10">
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
        </div>

        {/* Başlıklar */}
        <div className="text-center mb-8 relative z-10">
          <h2 className="text-2xl font-bold text-redrose-text tracking-wide">RedRose'a Giriş Yap</h2>
          <p className="text-sm text-redrose-subtext mt-2">Yapay Zeka Destekli Doküman Asistanı</p>
        </div>

        {/* Hata Mesajı Alanı */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-redrose-black border border-redrose-red/50 text-redrose-red text-sm text-center">
            {error}
          </div>
        )}

        {/* Giriş Formu */}
        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-medium text-redrose-subtext mb-1.5">
              E-posta Adresi
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@sirket.com"
              className="w-full bg-redrose-black border border-redrose-border rounded-lg px-4 py-3 text-redrose-text placeholder-redrose-subtext/50 focus:outline-none focus:border-redrose-red focus:ring-1 focus:ring-redrose-red transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-redrose-subtext mb-1.5">
              Şifre
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-redrose-black border border-redrose-border rounded-lg px-4 py-3 text-redrose-text placeholder-redrose-subtext/50 focus:outline-none focus:border-redrose-red focus:ring-1 focus:ring-redrose-red transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-redrose-red hover:bg-redrose-darkred disabled:bg-redrose-border disabled:text-redrose-subtext text-white font-semibold py-3.5 rounded-lg transition-all flex justify-center items-center gap-2 mt-4 shadow-lg shadow-redrose-red/20"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Giriş Yapılıyor...
              </>
            ) : (
              "Giriş Yap"
            )}
          </button>
        </form>

      </div>
    </div>
  );
}