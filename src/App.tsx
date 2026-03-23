import React, { useState, useRef } from "react";
import { Download, Link as LinkIcon, AlertCircle, CheckCircle, Loader2, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// رابط السيرفر الخاص بك على Vercel
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
      if (!response.ok) throw new Error(data.error || "فشل جلب البيانات");
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
    
    // التحميل عبر بروكسي فيرسال لتخطي حماية الموقع
    const proxyUrl = `${BACKEND_URL}/api/download?url=${encodeURIComponent(videoInfo.downloadUrl)}&filename=${encodeURIComponent(videoInfo.filename)}&referer=${encodeURIComponent(url)}`;
    
    // فتح رابط التحميل في نافذة جديدة لبدء التنزيل
    window.location.href = proxyUrl;
    
    setTimeout(() => setDownloading(false), 5000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans" dir="rtl">
      <div className="max-w-2xl w-full">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            محمل الفيديو العالمي (Pro)
          </h1>
          <p className="text-gray-400">تحميل مباشر من govid.live وغيرها بصيغة TS/MP4</p>
        </header>

        <div className="flex gap-2 bg-[#141414] p-2 rounded-2xl border border-white/10 mb-8 focus-within:border-emerald-500/50 transition-all">
          <input 
            type="text" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ضع رابط الفيديو هنا..." 
            className="flex-1 bg-transparent p-4 outline-none text-right"
          />
          <button 
            onClick={fetchVideoInfo} 
            disabled={loading || !url} 
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : "جلب الفيديو"}
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 mb-6 flex gap-2">
              <AlertCircle /> {error}
            </motion.div>
          )}

          {videoInfo && (
            <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-[#141414] p-8 rounded-3xl border border-white/10 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-emerald-500/20 p-3 rounded-full"><Play className="text-emerald-500" /></div>
                <div className="text-right">
                  <h2 className="font-bold text-lg line-clamp-1">{videoInfo.title}</h2>
                  <p className="text-sm text-gray-500">المصدر: {videoInfo.source}</p>
                </div>
              </div>
              <button 
                onClick={handleDownload} 
                disabled={downloading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-5 rounded-2xl flex justify-center items-center gap-3 transition-transform active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                {downloading ? <Loader2 className="animate-spin" /> : <><Download /> تحميل الفيديو الآن ({videoInfo.filename})</>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <footer className="mt-20 text-gray-600 text-sm">© 2026 eng-alaa.com • جميع الحقوق محفوظة</footer>
    </div>
  );
}