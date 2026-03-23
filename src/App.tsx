import React, { useState } from "react";
import { Download, Link as LinkIcon, AlertCircle, Loader2, Play } from "lucide-react";

// استبدل هذا الرابط برابط Vercel الخاص بك دائماً
const BACKEND_URL = "https://universal-downloader-virid.vercel.app";

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchVideoInfo = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed");
      setVideoInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!videoInfo) return;
    setDownloading(true);
    // التحميل عبر البروكسي لتجاوز حماية المواقع (مثل govid)
    const downloadLink = `${BACKEND_URL}/api/download?url=${encodeURIComponent(videoInfo.downloadUrl)}&filename=${encodeURIComponent(videoInfo.filename)}&referer=${encodeURIComponent(url)}`;
    window.location.href = downloadLink;
    setTimeout(() => setDownloading(false), 5000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center" dir="rtl">
      <h1 className="text-4xl font-bold mt-20 mb-10">محمل الفيديو العالمي</h1>
      
      <div className="w-full max-w-2xl bg-[#141414] p-4 rounded-2xl flex gap-2 border border-white/10">
        <input 
          type="text" 
          value={url} 
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ضع رابط الفيديو هنا..." 
          className="flex-1 bg-transparent p-2 outline-none"
        />
        <button onClick={fetchVideoInfo} disabled={loading} className="bg-emerald-500 px-6 py-2 rounded-xl text-black font-bold">
          {loading ? <Loader2 className="animate-spin" /> : "جلب"}
        </button>
      </div>

      {error && <div className="mt-4 text-red-400 bg-red-500/10 p-4 rounded-xl">{error}</div>}

      {videoInfo && (
        <div className="mt-10 bg-[#141414] p-8 rounded-3xl border border-white/10 w-full max-w-2xl text-center">
          <h2 className="text-xl font-bold mb-6">{videoInfo.title}</h2>
          <button 
            onClick={handleDownload} 
            disabled={downloading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl flex justify-center items-center gap-2"
          >
            {downloading ? <Loader2 className="animate-spin" /> : <><Download /> تحميل الفيديو الآن ({videoInfo.filename})</>}
          </button>
        </div>
      )}
    </div>
  );
}