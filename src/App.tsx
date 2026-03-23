import React, { useState } from "react";
import { Download, Link as LinkIcon, Loader2, Play } from "lucide-react";

// رابط Vercel الخاص بك - المصدر الوحيد للبيانات
const BACKEND_URL = "https://universal-downloader-virid.vercel.app";

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVideoInfo = async () => {
    setLoading(true);
    setError(null);
    try {
     const res = await fetch(`${BACKEND_URL}/api`, { 
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url }),
});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVideoInfo(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!videoInfo) return;
    // التحميل عبر البروكسي لتجنب الحجب
    const downloadUrl = `${BACKEND_URL}/api/download?url=${encodeURIComponent(videoInfo.downloadUrl)}&filename=${encodeURIComponent(videoInfo.filename)}&referer=${encodeURIComponent(url)}`;
    window.location.href = downloadUrl;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center" dir="rtl">
      <h1 className="text-4xl font-bold mt-20 mb-8">محمل الفيديو العالمي</h1>
      
      <div className="w-full max-w-2xl flex gap-2 bg-[#141414] p-2 rounded-2xl border border-white/10">
        <input 
          className="flex-1 bg-transparent p-4 outline-none"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ضع رابط الفيديو هنا..."
        />
        <button onClick={fetchVideoInfo} disabled={loading} className="bg-emerald-500 px-8 rounded-xl text-black font-bold hover:bg-emerald-400 transition-all">
          {loading ? <Loader2 className="animate-spin" /> : "جلب"}
        </button>
      </div>

      {error && <p className="mt-4 text-red-400">{error}</p>}

      {videoInfo && (
        <div className="mt-10 bg-[#141414] p-8 rounded-3xl border border-white/10 w-full max-w-2xl text-center shadow-2xl">
          <h2 className="text-xl mb-6 font-bold">{videoInfo.title}</h2>
          <button onClick={handleDownload} className="w-full bg-emerald-500 p-4 rounded-xl text-black font-black flex justify-center items-center gap-2">
            <Download /> تحميل الفيديو ({videoInfo.filename})
          </button>
        </div>
      )}
    </div>
  );
}