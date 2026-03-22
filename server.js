import express from "express";
import path from "path";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import ytdl from "ytdl-core";
import { Parser } from "m3u8-parser";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000; // الاستضافة تحدد المنفذ تلقائياً
const BASE_PATH = "/vi2"; 

app.use(cors());
app.use(express.json());

// 1. API جلب المعلومات (نفس منطقك القوي)
app.post(`${BASE_PATH}/api/info`, async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).json({ error: "الرابط مطلوب" });
  url = url.trim().replace(/^=/, "");

  try {
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

    const response = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000 });
    const $ = cheerio.load(response.data);
    let videoUrl = "";
    let title = $("title").text() || "Video";

    // البحث عن الروابط (نفس منطق الحلقات والـ Regex في كودك الأصلي)
    $("video source, video").each((_, el) => {
      const src = $(el).attr("src");
      if (src && (src.includes(".mp4") || src.includes(".m3u8"))) { videoUrl = src; return false; }
    });

    if (videoUrl) {
      const isHLS = videoUrl.includes(".m3u8");
      return res.json({ title, source: isHLS ? "HLS" : "Direct", downloadUrl: videoUrl, filename: `${title}.mp4`, isHLS });
    }
    res.json({ title, source: "Embed", downloadUrl: url, isEmbed: true });
  } catch (e) { res.status(500).json({ error: "خطأ في المعالجة" }); }
});

// 2. بروكسي التحميل
app.get(`${BASE_PATH}/api/download`, async (req, res) => {
  const { url, filename, isHLS, referer } = req.query;
  const finalReferer = referer || "https://govid.live/";
  
  try {
    const response = await axios({ method: "get", url, responseType: "stream", headers: { "Referer": finalReferer } });
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.data.pipe(res);
  } catch (e) { res.status(500).send("فشل التحميل"); }
});

// خدمة ملفات React الثابتة (مهم جداً للاستضافة)
const distPath = path.join(process.cwd(), "dist");
app.use(BASE_PATH, express.static(distPath));
app.get(`${BASE_PATH}/*`, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});