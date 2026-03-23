import React, { useState, useEffect, useRef } from "react";
import { Download, Link as LinkIcon, AlertCircle, CheckCircle, Loader2, Play, Copy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Hls from "hls.js";

// رابط السيرفر الخاص بك على Vercel - لا تقم بتغييره
const BACKEND_URL = "https://universal-downloader-virid.vercel.app";

interface VideoInfo {
  title: string;
  thumbnail: string;
  source: string;
  downloadUrl: string;
  filename: string;
  isHLS?: boolean;
  isEmbed?: boolean;
}

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoInfo?.downloadUrl && videoInfo.isHLS && videoRef.current) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(videoInfo.downloadUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(() => {});
        });
      } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = videoInfo.downloadUrl;
      }
    }
  }, [videoInfo]);

  const fetchVideoInfo = async () => {
    if (!url) return;
    
    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      // إرسال الطلب لسيرفر Vercel
      const response = await fetch(`${BACKEND_URL}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "فشل في جلب معلومات الفيديو");
      setVideoInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo) return;
    
    if (videoInfo.isEmbed) {
      window.open(videoInfo.downloadUrl, "_blank");
      return;
    }

    setDownloading(true);
    try {
      // التحميل عبر البروكسي لضمان عمله من أي مصدر وبأي صيغة (MP4, TS, etc)
      const proxyUrl = `${BACKEND_URL}/api/download?url=${encodeURIComponent(videoInfo.downloadUrl)}&filename=${encodeURIComponent(videoInfo.filename)}&referer=${encodeURIComponent(url)}`;
      
      const link = document.createElement("a");
      link.href = proxyUrl;
      link.setAttribute("download", videoInfo.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError("فشل في بدء التحميل. حاول مرة أخرى.");
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  const copyToClipboard = () => {
    if (!videoInfo) return;
    navigator.clipboard.writeText(videoInfo.downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30" dir="rtl">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-2xl mb-6 border border-emerald-500/20">
            <Download className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            محمل الفيديو الذكي
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            تحميل مباشر وسريع من أي موقع عبر سيرفرك الخاص.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative group mb-12">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500" />
          <div className="relative flex items-center bg-[#141414] border border-white/10 rounded-2xl p-2 focus-within:border-emerald-500/50 transition-all duration-300">
            <div className="px-4 text-gray-500"><LinkIcon className="w-5 h-5" /></div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ضع رابط الفيديو هنا..."
              className="flex-1 bg-transparent border-none outline-none py-4 text-lg placeholder:text-gray-600 text-right"
              onKeyDown={(e) => e.key === "Enter" && fetchVideoInfo()}
            />
            <button
              onClick={fetchVideoInfo}
              disabled={loading || !url}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-semibold px-8 py-4 rounded-xl transition-all duration-300 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Play className="w-5 h-5 fill-current rotate-180" /> جلب المعلومات</>}
            </button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 mb-8">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          {videoInfo && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="bg-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="md:flex flex-row-reverse">
                <div className="md:w-1/3 bg-black/40 aspect-video md:aspect-auto flex items-center justify-center relative group">
                  {videoInfo.isEmbed ? (
                    <iframe src={videoInfo.downloadUrl} className="w-full h-full border-none" allowFullScreen />
                  ) : (
                    <video ref={videoRef} src={!videoInfo.isHLS ? videoInfo.downloadUrl : undefined} controls className="w-full h-full object-contain" />
                  )}
                </div>
                <div className="p-8 md:w-2/3 flex flex-col justify-between text-right">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 line-clamp-2 leading-tight">{videoInfo.title}</h2>
                    <div className="flex items-center gap-1 text-emerald-500 text-sm mb-6">
                        <CheckCircle className="w-4 h-4" /> جاهز للتحميل من {videoInfo.source}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={handleDownload} disabled={downloading} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 shadow-lg shadow-emerald-500/20">
                      {downloading ? <><Loader2 className="w-6 h-6 animate-spin" /> جاري التنزيل...</> : <><Download className="w-6 h-6" /> {videoInfo.isEmbed ? "فتح المصدر" : "تحميل الفيديو"}</>}
                    </button>
                    <button onClick={copyToClipboard} className="sm:w-auto px-6 bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl transition-all duration-300">
                      {copied ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <Copy className="w-6 h-6" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-10 text-center text-gray-600 text-sm border-t border-white/5">
        <p>© 2026 محمل الفيديو • eng-alaa.com</p>
      </footer>
    </div>
  );
}