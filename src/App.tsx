import React, { useState, useEffect, useRef } from "react";
import { Download, Link as LinkIcon, AlertCircle, CheckCircle, Loader2, Play, Copy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Hls from "hls.js";

// رابط السيرفر الخاص بك على Vercel
const BACKEND_URL = "https://universal-downloader-virid.vercel.app";

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoInfo?.downloadUrl && videoInfo.isHLS && videoRef.current) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(videoInfo.downloadUrl);
        hls.attachMedia(videoRef.current);
      }
    }
  }, [videoInfo]);

  const fetchVideoInfo = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
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
    // التحميل عبر البروكسي لضمان دعم كل الصيغ بما فيها .ts
    const proxyUrl = `${BACKEND_URL}/api/download?url=${encodeURIComponent(videoInfo.downloadUrl)}&filename=${encodeURIComponent(videoInfo.filename)}&referer=${encodeURIComponent(url)}`;
    window.location.href = proxyUrl;
    setTimeout(() => setDownloading(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6" dir="rtl">
      <main className="max-w-3xl mx-auto py-20 text-center">
        <h1 className="text-4xl font-bold mb-8">محمل الفيديو العالمي</h1>
        
        <div className="flex gap-2 bg-[#141414] p-2 rounded-2xl border border-white/10 mb-8">
          <input 
            type="text" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ضع رابط الفيديو هنا..." 
            className="flex-1 bg-transparent p-4 outline-none text-right"
          />
          <button onClick={fetchVideoInfo} disabled={loading} className="bg-emerald-500 px-8 rounded-xl text-black font-bold">
            {loading ? <Loader2 className="animate-spin" /> : "جلب"}
          </button>
        </div>

        <AnimatePresence>
          {videoInfo && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="bg-[#141414] p-6 rounded-3xl border border-white/10">
              <h2 className="text-xl mb-4">{videoInfo.title}</h2>
              <button onClick={handleDownload} disabled={downloading} className="w-full bg-emerald-500 p-4 rounded-xl text-black font-bold flex justify-center gap-2">
                <Download /> {downloading ? "جاري التحميل..." : "تحميل الفيديو الآن"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}