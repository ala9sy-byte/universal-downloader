import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api", (req, res) => {
  res.send("السيرفر يعمل بنجاح!");
});

// 1. نقطة جلب المعلومات (Scraper)
app.post("/api/info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "الرابط مطلوب" });

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://govid.live/'
      },
      timeout: 10000
    });




  const html = response.data;
    
    // تصحيح الـ Regex للبحث عن الروابط بشكل صحيح ومضمون
    const m3u8Regex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g;
    const mp4Regex = /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g;
    
    const m3u8Match = html.match(m3u8Regex);
    const mp4Match = html.match(mp4Regex);
    
    let videoUrl = m3u8Match ? m3u8Match[0] : (mp4Match ? mp4Match[0] : null);

    if (videoUrl) {
      const isHLS = videoUrl.includes(".m3u8");
      return res.json({
        title: "فيديو مستخرج بنجاح",
        downloadUrl: videoUrl,
        filename: isHLS ? "video.ts" : "video.mp4",
        source: "Govid.live",
        isHLS: isHLS
      });
    }



    res.status(404).json({ error: "لم يتم العثور على رابط فيديو مباشر. تأكد من صحة الرابط." });
  } catch (e) {
    res.status(500).json({ error: "فشل السيرفر في الوصول للموقع المصدر." });
  }
});

// 2. بروكسي التحميل (لحل مشكلة الحظر وتغيير الصيغة لـ TS)
app.get("/api/download", async (req, res) => {
  const { url, filename, referer } = req.query;
  if (!url) return res.status(400).send("رابط الفيديو مفقود");

  try {
   const videoRes = await axios({
  method: "get",
  url: url as string,
  responseType: "stream",
  headers: {
    // نخبر TypeScript هنا أن يعامل القيم كنصوص صريحة
    'Referer': (referer as string) || 'https://govid.live/',
    'User-Agent': 'Mozilla/5.0'
  }
});

    // إعداد الهيدرز لإجبار المتصفح على التحميل بالصيغة المطلوبة
    res.setHeader("Content-Disposition", `attachment; filename="${filename || 'video.ts'}"`);
    res.setHeader("Content-Type", url.toString().includes(".m3u8") ? "video/mp2t" : "video/mp4");
    
    videoRes.data.pipe(res);
  } catch (e) {
    res.status(500).send("فشل جلب الملف من المصدر. قد يكون الرابط منتهي الصلاحية.");
  }
});


export default app;