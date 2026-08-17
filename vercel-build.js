import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs-extra';
import path from 'path';

const JS_FILES = [
    './admin/dashboard-mini.js',
    './admin/login-mini.js'
];

const isVercel = process.env.VERCEL === '1';
if (isVercel && !process.env.PUBLIC_API_BASE_URL) {
    console.error('❌ BUILD FAILED: PUBLIC_API_BASE_URL is required in Vercel environments.');
    process.exit(1);
}
const API_BASE_URL = process.env.PUBLIC_API_BASE_URL || 'http://api.luxalry.ma';

// إعدادات التعتيم (عالية الأداء - High Performance)
const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: true,
    debugProtectionInterval: 0,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayEncoding: [],
    stringArrayThreshold: 0.75
};

const CSS_PATH = './assets/css/style-mini.css';
const DIST_DIR = './dist';

async function buildForVercel() {
    console.log('🚀 بدء عملية البناء والتشفير الخاصة بـ Vercel...');

    try {
        // Ensure dist directories exist
        await fs.ensureDir(path.join(DIST_DIR, 'admin'));
        await fs.ensureDir(path.join(DIST_DIR, 'assets', 'css'));

        for (const file of JS_FILES) {
            if (!fs.existsSync(file)) {
                console.error(`❌ لم يتم العثور على الملف: ${file}`);
                continue;
            }

            let code = await fs.readFile(file, 'utf8');
            
            console.log(`🔒 جاري تشفير كود الجافاسكربت: ${file}...`);
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
            const obfuscatedCode = obfuscationResult.getObfuscatedCode();
            
            // Write to dist folder to protect canonical source
            const distPath = path.join(DIST_DIR, file);
            await fs.writeFile(distPath, obfuscatedCode);
            console.log(`✅ تم كتابة الملف المشفر إلى: ${distPath}`);
        }

        console.log('⚙️ إنشاء ملف الإعدادات config.js...');
        const configPath = path.join(DIST_DIR, 'admin', 'config.js');
        const configContent = `window.APP_CONFIG = ${JSON.stringify({ API_BASE_URL: API_BASE_URL })};`;
        await fs.writeFile(configPath, configContent);
        console.log(`✅ تم إنشاء ${configPath} بنجاح.`);

        // Minify CSS
        if (fs.existsSync(CSS_PATH)) {
            console.log('🎨 جاري ضغط ملف CSS لتسريع التحميل...');
            let css = await fs.readFile(CSS_PATH, 'utf8');
            // إزالة التعليقات والمسافات الزائدة لتقليل حجم CSS بنسبة 20%
            let minifiedCss = css.replace(/\/\*[\s\S]*?\*\//g, '')
                                 .replace(/\s+/g, ' ')
                                 .replace(/\s*([{}:;,>+~])\s*/g, '$1')
                                 .trim();
            const distCssPath = path.join(DIST_DIR, CSS_PATH);
            await fs.writeFile(distCssPath, minifiedCss);
            console.log(`✅ تم ضغط CSS وحفظه في: ${distCssPath}`);
        }

        console.log('✅ اكتملت جميع مهام البناء بنجاح! الموقع جاهز للنشر.');
    } catch (error) {
        console.error('❌ حدث خطأ أثناء التشفير:', error.message);
        process.exit(1);
    }
}

buildForVercel();
