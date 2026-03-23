import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import ytdl from "ytdl-core";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/info", async (req, res) => {
  const { url } = req.body;
  try {
    if (ytdl.validateURL(url)) {
      const info = await ytdl.getInfo(url);
      return res.json({ title: info.videoDetails.title, downloadUrl: ytdl.chooseFormat(info.formats, {quality:'highest'}).url, filename: "video.mp4" });
    }
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const videoUrl = $("video source").attr("src") || $("video").attr("src");
    res.json({ title: $("title").text(), downloadUrl: videoUrl, filename: "video.mp4", isHLS: videoUrl?.includes(".m3u8") });
  } catch (e) { res.status(500).json({ error: "فشل استخراج الرابط" }); }
});

app.get("/api/download", async (req, res) => {
  const { url, filename, referer } = req.query;
  try {
    const response = await axios({ method: "get", url: url as string, responseType: "stream", headers: { "Referer": referer as string } });
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.data.pipe(res);
  } catch (e) { res.status(500).send("خطأ في التحميل"); }
});

export default app;