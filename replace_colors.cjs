const fs = require('fs');
const path = require('path');

const replaceMap = {
    'bg-[#0e0e12]': 'bg-black/30 backdrop-blur-3xl border border-white/[0.02]',
    'bg-[#131317]': 'bg-transparent',
    'bg-[#1b1b1f]': 'bg-white/[0.04] backdrop-blur-2xl border border-white/[0.05] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]',
    'bg-[#1f1f23]': 'bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]',
    'bg-[#2a292e]': 'bg-white/[0.1] backdrop-blur-2xl border border-white/[0.1] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]',
    'bg-[#353439]': 'bg-white/[0.15] backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]'
};

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            for (const [key, value] of Object.entries(replaceMap)) {
                if (content.includes(key)) {
                    content = content.split(key).join(value);
                    changed = true;
                }
            }
            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDir('./src');
