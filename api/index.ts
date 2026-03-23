import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import ytdl from "ytdl-core";

const app = express();
app.use(cors());
app.use(express.json());

// مسار تجريبي للتأكد من عمل السيرفر
app.get("/api", (req, res) => res.send("السيرفر يعمل بنجاح!"));

// 1. جلب معلومات الفيديو
app.post("/api/info", async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).json({ error: "الرابط مطلوب" });

  url = url.trim();
  if (url.startsWith("=")) url = url.substring(1).trim();

  try {
    // التحقق من يوتيوب
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

    // معالج المواقع العامة (مثل govid.live) باستخدام استخراج الروابط (Regex)
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": url.includes("govid.live") ? "https://faselhd.center/" : url
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);
    let title = $("title").text() || "Video";
    
    // البحث عن روابط m3u8 أو mp4 في كود الصفحة والجافا سكريبت
    const m3u8Regex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g;
    const mp4Regex = /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g;
    
    const m3u8Match = html.match(m3u8Regex);
    const mp4Match = html.match(mp4Regex);
    
    let videoUrl = m3u8Match ? m3u8Match[0] : (mp4Match ? mp4Match[0] : null);

    if (videoUrl) {
      const isHLS = videoUrl.includes(".m3u8");
      return res.json({
        title,
        thumbnail: "",
        source: isHLS ? "HLS Stream" : "Direct Video",
        downloadUrl: videoUrl,
        filename: isHLS ? "video.ts" : "video.mp4",
        isHLS
      });
    }

    res.status(404).json({ error: "لم نتمكن من العثور على رابط فيديو مباشر." });
  } catch (error: any) {
    res.status(500).json({ error: "فشل في معالجة الرابط." });
  }
});

// 2. بروكسي التحميل (يدعم TS و MP4)
app.get("/api/download", async (req, res) => {
  const { url, filename, referer } = req.query;
  if (!url) return res.status(400).send("الرابط مطلوب");

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

    const isHLS = (url as string).includes(".m3u8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename || (isHLS ? 'video.ts' : 'video.mp4')}"`);
    res.setHeader("Content-Type", isHLS ? "video/mp2t" : "video/mp4");
    
    response.data.pipe(res);
  } catch (error) {
    res.status(500).send("فشل تحميل الفيديو.");
  }
});

export default app;