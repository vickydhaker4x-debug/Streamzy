const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;

            const fixes = [
                ['bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]/90 backdrop-blur-xl border border-white/[0.08] shadow-lg', 'bg-white/10 backdrop-blur-lg border border-white/20 shadow-lg'],
                ['bg-[#1b252c]', 'bg-white/10 backdrop-blur-md shadow-lg border border-white/10'],
                ['hover:bg-[#25333c]', 'hover:bg-white/20 hover:scale-105'],
                ['bg-[#16171b]', 'bg-black/20 backdrop-blur-sm border border-white/5'],
                ['bg-[#28272d]', 'bg-white/10 backdrop-blur-md border border-white/10 shadow-lg'],
                ['hover:bg-white/[0.04]', 'hover:bg-white/[0.1] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 rounded-xl'],
                ['bg-white/[0.08]', 'bg-white/[0.12] backdrop-blur-md shadow-lg rounded-xl border border-[var(--color-primary)]/30'],
            ];

            for (const [key, value] of fixes) {
                if (content.includes(key)) {
                    content = content.split(key).join(value);
                    changed = true;
                }
            }

            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log(`Cleaned ${fullPath}`);
            }
        }
    }
}

processDir('./src');
