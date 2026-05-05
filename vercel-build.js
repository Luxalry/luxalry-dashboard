import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs-extra';
import path from 'path';

const FILE_PATH = './admin/dashboard-mini.js';

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

async function buildForVercel() {
    console.log('🚀 بدء عملية البناء والتشفير الخاصة بـ Vercel...');

    try {
        if (!fs.existsSync(FILE_PATH)) {
            console.error(`❌ لم يتم العثور على الملف: ${FILE_PATH}`);
            process.exit(1);
        }

        const code = await fs.readFile(FILE_PATH, 'utf8');
        
        console.log('🔒 جاري تشفير كود الجافاسكربت (أداء عالي)...');
        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
        const obfuscatedCode = obfuscationResult.getObfuscatedCode();
        await fs.writeFile(FILE_PATH, obfuscatedCode);

        // Minify CSS
        if (fs.existsSync(CSS_PATH)) {
            console.log('🎨 جاري ضغط ملف CSS لتسريع التحميل...');
            let css = await fs.readFile(CSS_PATH, 'utf8');
            // إزالة التعليقات والمسافات الزائدة لتقليل حجم CSS بنسبة 20%
            let minifiedCss = css.replace(/\/\*[\s\S]*?\*\//g, '')
                                 .replace(/\s+/g, ' ')
                                 .replace(/\s*([{}:;,>+~])\s*/g, '$1')
                                 .trim();
            await fs.writeFile(CSS_PATH, minifiedCss);
            console.log('✅ تم ضغط CSS بنجاح!');
        }

        console.log('✅ اكتملت جميع مهام البناء بنجاح! الموقع جاهز للنشر.');
    } catch (error) {
        console.error('❌ حدث خطأ أثناء التشفير:', error.message);
        process.exit(1);
    }
}

buildForVercel();
