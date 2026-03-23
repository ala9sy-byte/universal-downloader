import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

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
            '--single-process'
        ],
        // المسار الافتراضي لكروم في سيرفرات ريندر
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        headless: true
    });
}

// مثال لـ Route التحميل (أكمل بقية المنطق الخاص بك هنا)
app.post("/api/info", async (req, res) => {
    const { url } = req.body;
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });
        // منطق استخراج الرابط...
        await browser.close();
        res.json({ success: true, message: "تم جلب البيانات" });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});