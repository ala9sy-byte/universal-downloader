import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import ytdl from "ytdl-core";

const app = express();

// إعدادات CORS للسماح لموقعك على هوستينجر بالاتصال بالسيرفر
app.use(cors());
app.use(express.json());

// مسار اختباري للتأكد من أن "المخ" يعمل
app.get("/api", (req, res) => {
  res.send("!السيرفر يعمل بنجاح - المخ جاهز للاستخراج");
});

// --- 1. نقطة جلب المعلومات (POST /api/info) ---
app.post("/api/info", async (req, res) => {
  let { url } = req.body;

  if (!url) return res.status(400).json({ error: "الرابط مطلوب" });

  // تنظيف الرابط من الفراغات أو علامة "=" الزائدة
  url = url.trim();
  if (url.startsWith("=")) url = url.substring(1).trim();

  try {
    // أ: دعم روابط يوتيوب
    if (ytdl.validateURL(url)) {
      const info = await ytdl.getInfo(url);
      const format = ytdl.chooseFormat(info.formats, { quality: "highestvideo", filter: "audioandvideo" });
      return res.json({
        title: info.videoDetails.title,
        thumbnail: info.videoDetails.thumbnails[0].url,
        source: "YouTube",
        downloadUrl: format.url,
        filename: `${info.videoDetails.title.replace(/[^a-z0-9]/gi, '_')}.mp4`,
        isHLS: false
      });
    }

    // ب: استخراج الفيديو من govid.live أو أي موقع عام
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": url.includes("govid.live") ? "https://faselhd.center/" : url
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const title = $("title").text().trim() || "Video Content";

    // بحث ذكي عن روابط m3u8 أو mp4 داخل الأكواد
    const m3u8Regex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g;
    const mp4Regex = /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g;
    
    const m3u8Match = html.match(m3u8Regex);
    const mp4Match = html.match(mp4Regex);
    
    // الأولوية لروابط m3u8 (HLS) ثم mp4
    let videoUrl = m3u8Match ? m3u8Match[0] : (mp4Match ? mp4Match[0] : null);

    if (videoUrl) {
      const isHLS = videoUrl.includes(".m3u8");
      return res.json({
        title,
        thumbnail: "",
        source: isHLS ? "HLS Stream" : "Direct Video",
        downloadUrl: videoUrl,
        filename: isHLS ? "video.ts" : "video.mp4",
        isHLS: isHLS
      });
    }

    // إذا لم يجد السيرفر رابطاً مباشراً، يبحث في الـ iframes
    res.status(404).json({ error: "لم نتمكن من العثور على رابط فيديو مباشر في هذه الصفحة." });

  } catch (error: any) {
    console.error("Scraping error:", error.message);
    res.status(500).json({ error: "فشل السيرفر في الوصول للموقع المطلوب." });
  }
});

// --- 2. بروكسي التحميل الفعلي (GET /api/download) ---
app.get("/api/download", async (req, res) => {
  const { url, filename, referer } = req.query;

  if (!url) return res.status(400).send("الرابط مطلوب للتحميل");

  try {
    const response = await axios({
      method: "get",
      url: url as string,
      responseType: "stream",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": (referer as string) || "https://govid.live/"
      },
      timeout: 30000 // مهلة كافية للملفات الكبيرة
    });

    // إعداد الهيدرز لإجبار المتصفح على التحميل
    const isHLS = (url as string).includes(".m3u8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename || (isHLS ? 'video.ts' : 'video.mp4')}"`);
    res.setHeader("Content-Type", isHLS ? "video/mp2t" : "video/mp4");
    
    response.data.pipe(res);
  } catch (error: any) {
    console.error("Download proxy error:", error.message);
    res.status(500).send("فشل في جلب ملف الفيديو من المصدر.");
  }
});

// تصدير التطبيق ليعمل على Vercel
export default app;