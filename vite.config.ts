import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // تحميل متغيرات البيئة من ملف .env
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // التعديل الجذري: تحديد المسار ليعمل داخل مجلد vi2 في الاستضافة العادية
    base: '/vi2/', 

    plugins: [
      react(),
      tailwindcss(),
    ],

    define: {
      // تعريف مفتاح الـ API ليكون متاحاً في ملف App.tsx
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        // تسهيل استدعاء الملفات باستخدام الرمز @
        '@': path.resolve(__dirname, './src'),
      },
    },

    build: {
      // التأكد من أن المخرجات تذهب لمجلد dist لرفعها لاحقاً
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
  };
});