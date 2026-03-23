import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import ytdl from "ytdl-core";
import { Parser } from "m3u8-parser";

const app = express();

// CORS configuration for Hostinger
app.use(cors({
  origin: ["https://eng-alaa.com", "http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// API to get video info
app.post("/api/info", async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).json({ error: "الرابط مطلوب" });

  url = url.trim();
  if (url.startsWith("=")) url = url.substring(1).trim();

  try {
    // 1. Check YouTube
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

    // 2. Generic Scraper
    const response = await axios.get(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": url
      },
      maxRedirects: 5,
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    
    let videoUrl = "";
    let title = $("title").text() || "Video";

    // Look for <video> tags
    $("video source, video").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && (src.includes(".mp4") || src.includes(".m3u8") || src.includes(".webm"))) {
        videoUrl = src;
        return false;
      }
    });

    // Look for common patterns in scripts
    if (!videoUrl) {
      const scripts = $("script").map((_, el) => $(el).html()).get();
      for (const script of scripts) {
        if (!script) continue;
        
        // Improved Regex for govid.live and others
        const patterns = [
          /["']?file["']?\s*[:=]\s*["'](https?:\/\/[^"']+\.(mp4|m3u8|webm|googlevideo|googleusercontent)[^"']*)["']/gi,
          /["']?source["']?\s*[:=]\s*["'](https?:\/\/[^"']+\.(mp4|m3u8|webm|googlevideo|googleusercontent)[^"']*)["']/gi,
          /["'](https?:\/\/[^"']+\.(mp4|m3u8|webm|googlevideo|googleusercontent)[^"']*)["']/gi
        ];

        for (const pattern of patterns) {
          const matches = script.matchAll(pattern);
          for (const match of matches) {
            const foundUrl = match[1].replace(/\\\//g, "/");
            if (foundUrl.includes(".mp4")) {
              videoUrl = foundUrl;
              break;
            }
            if (!videoUrl) videoUrl = foundUrl;
          }
          if (videoUrl && videoUrl.includes(".mp4")) break;
        }
        if (videoUrl) break;
      }
    }

    // Handle iframe embeds
    if (!videoUrl) {
      const iframes = $("iframe").map((_, el) => $(el).attr("src")).get();
      for (let iframeSrc of iframes) {
        if (iframeSrc && (iframeSrc.includes("govid.live") || iframeSrc.includes("embed") || iframeSrc.includes("player"))) {
          if (iframeSrc.startsWith("//")) iframeSrc = "https:" + iframeSrc;
          else if (iframeSrc.startsWith("/")) {
            const urlObj = new URL(url);
            iframeSrc = urlObj.origin + iframeSrc;
          }

          try {
            const iframeResponse = await axios.get(iframeSrc, {
              headers: { "User-Agent": userAgent, "Referer": url },
              timeout: 5000
            });
            const $iframe = cheerio.load(iframeResponse.data);
            
            $iframe("video source, video, iframe").each((_, el) => {
              const src = $iframe(el).attr("src") || $iframe(el).attr("data-src");
              if (src && (src.includes(".mp4") || src.includes(".m3u8") || src.includes(".webm") || src.includes("googlevideo"))) {
                videoUrl = src;
                return false;
              }
            });

            if (!videoUrl) {
              const iframeScripts = $iframe("script").map((_, el) => $iframe(el).html()).get();
              for (const script of iframeScripts) {
                if (!script) continue;
                const match = script.match(/(?:file|src|source|url)["']?\s*[:=]\s*["'](https?:\/\/[^"']+\.(mp4|m3u8|webm|googlevideo|googleusercontent)[^"']*)["']/i);
                if (match) {
                  videoUrl = match[1].replace(/\\\//g, "/");
                  break;
                }
              }
            }
          } catch (e) {}
          if (videoUrl) break;
        }
      }
    }

    if (videoUrl) {
      if (videoUrl.startsWith("//")) videoUrl = "https:" + videoUrl;
      const isHLS = videoUrl.includes(".m3u8") || videoUrl.includes("manifest");
      return res.json({
        title,
        source: isHLS ? "HLS Stream" : "Generic",
        downloadUrl: videoUrl,
        filename: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${isHLS ? 'm3u8' : 'mp4'}`,
        isHLS
      });
    }

    res.status(404).json({ error: "لم نتمكن من العثور على رابط فيديو مباشر." });
  } catch (error: any) {
    res.status(500).json({ error: "فشل في معالجة الرابط." });
  }
});

// Proxy download
app.get("/api/download", async (req, res) => {
  const { url, filename, isHLS, referer } = req.query;
  if (!url) return res.status(400).json({ error: "الرابط مطلوب" });

  const finalFilename = (filename as string) || "video.mp4";
  const finalReferer = (referer as string) || "https://govid.live/";

  if (isHLS === "true") {
    try {
      const response = await axios.get(url as string, {
        headers: { "User-Agent": userAgent, "Referer": finalReferer },
        timeout: 15000
      });

      const parser = new Parser();
      parser.push(response.data);
      parser.end();

      const manifest = parser.manifest;

      if (manifest.playlists && manifest.playlists.length > 0) {
        const sortedPlaylists = [...manifest.playlists].sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));
        let playlistUrl = sortedPlaylists[0].uri;
        if (!playlistUrl.startsWith("http")) {
          playlistUrl = new URL(playlistUrl, url as string).href;
        }
        return res.redirect(`/api/download?url=${encodeURIComponent(playlistUrl)}&filename=${encodeURIComponent(finalFilename)}&isHLS=true&referer=${encodeURIComponent(finalReferer)}`);
      }

      if (manifest.segments && manifest.segments.length > 0) {
        res.setHeader("Content-Disposition", `attachment; filename="${finalFilename.replace(/\.m3u8$/, '.ts').replace(/\.mp4$/, '.ts')}"`);
        res.setHeader("Content-Type", "video/mp2t");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        for (const segment of manifest.segments) {
          let segmentUrl = segment.uri;
          if (!segmentUrl.startsWith("http")) {
            segmentUrl = new URL(segmentUrl, url as string).href;
          }

          try {
            const segResponse = await axios({
              method: "get",
              url: segmentUrl,
              responseType: "stream",
              headers: { "User-Agent": userAgent, "Referer": finalReferer },
              timeout: 20000
            });

            await new Promise((resolve) => {
              segResponse.data.pipe(res, { end: false });
              segResponse.data.on("end", resolve);
              segResponse.data.on("error", () => resolve(null));
            });
          } catch (err) {}
        }
        return res.end();
      }
      return res.status(400).json({ error: "لم يتم العثور على قطع فيديو." });
    } catch (error: any) {
      return res.status(500).json({ error: "فشل في تحميل بث HLS." });
    }
  }

  try {
    const response = await axios({
      method: "get",
      url: url as string,
      responseType: "stream",
      headers: { "User-Agent": userAgent, "Referer": finalReferer }
    });

    res.setHeader("Content-Disposition", `attachment; filename="${finalFilename}"`);
    response.data.pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: "فشل في تحميل الفيديو." });
  }
});

// Dedicated endpoint for govid.live MP4 download
app.get("/api/download-mp4", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "الرابط مطلوب" });

  const referer = "https://govid.live/";

  try {
    // We use the same scraper logic to find the m3u8 link
    const response = await axios.get(url as string, {
      headers: { "User-Agent": userAgent, "Referer": referer },
      timeout: 10000
    });
    const $ = cheerio.load(response.data);
    let m3u8Url = "";

    const scripts = $("script").map((_, el) => $(el).html()).get();
    for (const script of scripts) {
      if (!script) continue;
      const match = script.match(/(?:file|src|source|url|hls)["']?\s*[:=]\s*["'](https?:\/\/[^"']+\.(m3u8)[^"']*)["']/i);
      if (match) {
        m3u8Url = match[1].replace(/\\\//g, "/");
        break;
      }
    }

    if (!m3u8Url) {
      // Check iframes
      const iframes = $("iframe").map((_, el) => $(el).attr("src")).get();
      for (let iframeSrc of iframes) {
        if (iframeSrc && (iframeSrc.includes("govid.live") || iframeSrc.includes("embed"))) {
          if (iframeSrc.startsWith("//")) iframeSrc = "https:" + iframeSrc;
          const iframeResponse = await axios.get(iframeSrc, {
            headers: { "User-Agent": userAgent, "Referer": url as string },
            timeout: 5000
          });
          const $iframe = cheerio.load(iframeResponse.data);
          const iframeScripts = $iframe("script").map((_, el) => $iframe(el).html()).get();
          for (const script of iframeScripts) {
            if (!script) continue;
            const match = script.match(/(?:file|src|source|url|hls)["']?\s*[:=]\s*["'](https?:\/\/[^"']+\.(m3u8)[^"']*)["']/i);
            if (match) {
              m3u8Url = match[1].replace(/\\\//g, "/");
              break;
            }
          }
          if (m3u8Url) break;
        }
      }
    }

    if (!m3u8Url) {
      return res.status(404).json({ error: "لم نتمكن من العثور على رابط البث المباشر." });
    }

    const filename = "govid_video.mp4";
    return res.redirect(`/api/download?url=${encodeURIComponent(m3u8Url)}&filename=${encodeURIComponent(filename)}&isHLS=true&referer=${encodeURIComponent(referer)}`);
  } catch (error: any) {
    res.status(500).json({ error: "فشل في جلب الرابط." });
  }
});

// For local development
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
