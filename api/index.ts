import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import ytdl from "ytdl-core";

const app = express();
app.use(cors());
app.use(express.json());

// مسار الاختبار لضمان عمل السيرفر
app.get("/api", (req, res) => res.send("!السيرفر يعمل بنجاح"));

// 1. استخراج معلومات الفيديو
app.post("/api", async (req, res) => {
  let { url } = req.body;
  
  // تنظيف4444  الرابط من علامة "=" التي تظهر في صورتك
  if (url && url.startsWith("=")) url = url.substring(1).trim();
  
  if (!url) return res.status(400).json({ error: "الرابط مطلوب" });

  try {
    // دعم يوتيوب من كودك الأصلي
    if (ytdl.validateURL(url)) {
      const info = await ytdl.getInfo(url);
      const format = ytdl.chooseFormat(info.formats, { quality: "highestvideo", filter: "audioandvideo" });
      return res.json({
        title: info.videoDetails.title,
        thumbnail: info.videoDetails.thumbnails[0].url,
        source: "YouTube",
        downloadUrl: format.url,
        filename: `${info.videoDetails.title}.mp4`
      });
    }

    // سكرابر متقدم يدعم govid.live والمواقع العامة
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": url.includes("govid.live") ? "https://faselhd.center/" : url
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const title = $("title").text() || "Video";

    // البحث عن روابط الفيديو (m3u8, mp4) باستخدام Regex
    const m3u8Regex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g;
    const mp4Regex = /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g;
    
    const videoUrl = html.match(m3u8Regex)?.[0] || html.match(mp4Regex)?.[0];

    if (videoUrl) {
      const isHLS = videoUrl.includes(".m3u8");
      return res.json({
        title,
        source: isHLS ? "HLS Stream" : "Direct Video",
        downloadUrl: videoUrl,
        filename: isHLS ? "video.ts" : "video.mp4",
        isHLS
      });
    }

    res.status(404).json({ error: "لم نتمكن من العثور على رابط مباشر." });
  } catch (e) {
    res.status(500).json({ error: "فشل السيرفر في معالجة الرابط." });
  }
});

// 2. بروكسي التحميل الفعلي
app.get("/api/download", async (req, res) => {
  const { url, filename, referer } = req.query;
  try {
    const response = await axios({
      method: "get",
      url: url as string,
      responseType: "stream",
      headers: { 
        "User-Agent": "Mozilla/5.0",
        "Referer": (referer as string) || "https://govid.live/"
      }
    });

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", (url as string).includes(".m3u8") ? "video/mp2t" : "video/mp4");
    response.data.pipe(res);
  } catch (e) {
    res.status(500).send("خطأ في جلب ملف التحميل.");
  }
});

export default app;