import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import ytdl from "ytdl-core";
import { Parser } from "m3u8-parser";

const app = express();
app.use(cors());
app.use(express.json());

// API جلب المعلومات - بدون بادئة /vi2
app.post("/api/info", async (req, res) => {
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

    $("video source, video").each((_, el) => {
      const src = $(el).attr("src");
      if (src && (src.includes(".mp4") || src.includes(".m3u8"))) { videoUrl = src; return false; }
    });

    if (videoUrl) {
      if (videoUrl.startsWith("//")) videoUrl = "https:" + videoUrl;
      const isHLS = videoUrl.includes(".m3u8");
      return res.json({ title, source: isHLS ? "HLS" : "Direct", downloadUrl: videoUrl, filename: `${title}.mp4`, isHLS });
    }
    res.json({ title, source: "Embed", downloadUrl: url, isEmbed: true });
  } catch (e) { res.status(500).json({ error: "فشل المعالجة" }); }
});

// بروكسي التحميل
app.get("/api/download", async (req, res) => {
  const { url, filename, referer } = req.query;
  try {
    const response = await axios({ method: "get", url: url as string, responseType: "stream", headers: { "Referer": referer as string } });
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.data.pipe(res);
  } catch (e) { res.status(500).send("فشل التحميل"); }
});

// تصدير التطبيق لـ Vercel بدلاً من app.listen
export default app;