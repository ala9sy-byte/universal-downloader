import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api", (req, res) => res.send("!المخ يعمل ومستعد للاستخراج"));

app.post("/api/info", async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).json({ error: "الرابط مطلوب" });

  // تنظيف الرابط من علامة = الزائدة وأي فراغات
  url = url.trim().replace(/^=/, "");

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://faselhd.center/" // ضروري جداً لتخطي حماية govid
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);
    const title = $("title").text().trim() || "Video Content";

    // بحث شامل (Regex) في كامل نص الصفحة وليس فقط في الوسوم
    const m3u8Regex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g;
    const mp4Regex = /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g;
    
    // البحث في النصوص المشفرة والمخفية أيضاً
    const allMatches = html.match(m3u8Regex) || html.match(mp4Regex) || [];
    let videoUrl = allMatches.length > 0 ? allMatches[0].replace(/\\/g, "") : null;

    if (videoUrl) {
      const isHLS = videoUrl.includes(".m3u8");
      return res.json({
        title,
        downloadUrl: videoUrl,
        filename: isHLS ? "video.ts" : "video.mp4",
        source: "Govid Premium",
        isHLS: isHLS
      });
    }

    // إذا لم يجد شيئاً، يرسل 404 مع رسالة واضحة
    res.status(404).json({ error: "لم نتمكن من العثور على فيديو. تأكد أن الرابط يعمل في المتصفح." });
  } catch (error) {
    res.status(500).json({ error: "فشل الاتصال بموقع الفيديو." });
  }
});

export default app;