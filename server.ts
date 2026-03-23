import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import axios from "axios";
import ytdl from "@distube/ytdl-core";

// إعداد الإضافات والمسارات
puppeteer.use(StealthPlugin());
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// دالة تشغيل المتصفح المتوافقة مع Render
async function getBrowser() {
    return await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        headless: true
    });
}

// 1. جلب معلومات الفيديو (API Info)
app.post("/api/info", async (req, res) => {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: "الرابط مطلوب" });

    try {
        // إذا كان الرابط يوتيوب
        if (ytdl.validateURL(url)) {
            const info = await ytdl.getInfo(url);
            const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });
            return res.json({
                title: info.videoDetails.title,
                thumbnail: info.videoDetails.thumbnails[0].url,
                source: "YouTube",
                downloadUrl: format.url,
                filename: `${info.videoDetails.title}.mp4`,
                isHLS: false
            });
        }

        // إذا كان الرابط من govid أو غيره (استخدام Puppeteer)
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // البحث عن روابط m3u8 في السورس
        const content = await page.content();
        const m3u8Match = content.match(/https?:\/\/[^"']+\.m3u8[^"']*/);
        const pageTitle = await page.title();

        await browser.close();

        if (m3u8Match) {
            return res.json({
                title: pageTitle || "Video Stream",
                thumbnail: "", 
                source: "HLS Stream",
                downloadUrl: m3u8Match[0],
                filename: "video.mp4",
                isHLS: true
            });
        }

        res.status(404).json({ error: "لم نتمكن من العثور على رابط فيديو مباشر" });

    } catch (error: any) {
        console.error("Error Info:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. مسار التحميل العادي (Proxy Download)
app.get("/api/download", async (req, res) => {
    const { url, filename, referer } = req.query;
    try {
        const response = await axios({
            method: 'get',
            url: url as string,
            responseType: 'stream',
            headers: { 'Referer': referer as string || '' }
        });
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send("خطأ في تحميل الملف");
    }
});

// 3. مسار تحويل HLS إلى MP4 (Download MP4) لروابط govid
app.get("/api/download-mp4", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL required");

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');

    // استخدام FFmpeg للتحويل المباشر وضخه للمتصفح
    ffmpeg(url as string)
        .format('mp4')
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions('-movflags frag_keyframe+empty_moov')
        .on('error', (err) => console.error('FFmpeg Error:', err))
        .pipe(res, { end: true });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});