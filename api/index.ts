import express from "express";
import { createServer as createViteServer } from "vite";
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

async function startServer() {
  const app = express();
  const PORT = 3000;
  const BASE_PATH = "/vi2"; // المسار الفرعي الخاص بك 

  app.use(cors());
  app.use(express.json());

  // API to get video info
  app.post(`${BASE_PATH}/api/info`, async (req, res) => {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: "الرابط مطلوب" });
    url = url.trim();
    if (url.startsWith("=")) url = url.substring(1).trim();

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

      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": url },
        timeout: 10000
      });
      const $ = cheerio.load(response.data);
      let videoUrl = "";
      let title = $("title").text() || "Video";

      $("video source, video").each((_, el) => {
        const src = $(el).attr("src");
        if (src && (src.includes(".mp4") || src.includes(".m3u8"))) { videoUrl = src; return false; }
      });

      if (!videoUrl) {
        const scripts = $("script").map((_, el) => $(el).html()).get();
        for (const script of scripts) {
          if (!script) continue;
          const match = script.match(/["']?file["']?\s*:\s*["'](https?:\/\/[^"']+\.(mp4|m3u8|webm)[^"']*)["']/gi);
          if (match) { videoUrl = match[0].match(/https?:\/\/[^"']+/i)![0].replace(/\\\//g, "/"); break; }
        }
      }

      if (videoUrl) {
        if (videoUrl.startsWith("//")) videoUrl = "https:" + videoUrl;
        const isHLS = videoUrl.includes(".m3u8");
        return res.json({ title, source: isHLS ? "HLS Stream" : "Generic", downloadUrl: videoUrl, filename: `${title.replace(/[^a-z0-9]/gi, '_')}.${isHLS ? 'm3u8' : 'mp4'}`, isHLS });
      }

      res.json({ title, source: "Embed", downloadUrl: url, filename: "video.mp4", isEmbed: true });
    } catch (error: any) {
      res.status(500).json({ error: "فشل في معالجة الرابط." });
    }
  });

  // Proxy download
  app.get(`${BASE_PATH}/api/download`, async (req, res) => {
    const { url, filename, isHLS, referer } = req.query;
    if (!url) return res.status(400).send("الرابط مطلوب");
    const finalReferer = (referer as string) || "https://govid.live/";

    if (isHLS === "true") {
      try {
        const response = await axios.get(url as string, { headers: { "Referer": finalReferer } });
        const parser = new Parser();
        parser.push(response.data);
        parser.end();

        if (parser.manifest.playlists?.length > 0) {
          let pUrl = parser.manifest.playlists[0].uri;
          if (!pUrl.startsWith("http")) pUrl = new URL(pUrl, url as string).href;
          return res.redirect(`${BASE_PATH}/api/download?url=${encodeURIComponent(pUrl)}&filename=${filename}&isHLS=true&referer=${encodeURIComponent(finalReferer)}`);
        }

        res.setHeader("Content-Disposition", `attachment; filename="${(filename as string).replace('.m3u8', '.ts')}"`);
        for (const seg of parser.manifest.segments) {
          const sRes = await axios({ method: "get", url: new URL(seg.uri, url as string).href, responseType: "stream", headers: { "Referer": finalReferer } });
          await new Promise((r) => { sRes.data.pipe(res, { end: false }); sRes.data.on("end", r); });
        }
        return res.end();
      } catch (e) { return res.status(500).send("خطأ HLS"); }
    }

    const response = await axios({ method: "get", url: url as string, responseType: "stream", headers: { "Referer": finalReferer } });
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.data.pipe(res);
  });

  // Puppeteer logic for govid.live
  app.get(`${BASE_PATH}/api/download-mp4`, async (req, res) => {
    const { url } = req.query;
    try {
      const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      const page = await browser.newPage();
      let m3u8Url = "";
      await page.setRequestInterception(true);
      page.on("request", (r) => { if (r.url().includes(".m3u8")) m3u8Url = r.url(); r.continue(); });
      await page.goto(url as string, { waitUntil: "networkidle2" });
      await browser.close();
      if (!m3u8Url) return res.status(404).send("لم يتم العثور على الرابط");
      res.redirect(`${BASE_PATH}/api/download?url=${encodeURIComponent(m3u8Url)}&filename=video.mp4&isHLS=true&referer=https://govid.live/`);
    } catch (e) { res.status(500).send("خطأ متصفح"); }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(BASE_PATH, express.static(distPath)); // خدمة الملفات من المجلد الفرعي 
    app.get(`${BASE_PATH}/*`, (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => { console.log(`Server running on http://localhost:${PORT}${BASE_PATH}`); });
}

startServer();