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

            // Fix double backdrop-blur-2xl and shadow classes where hover was split
            // The regex replacement resulted in things like:
            // hover:bg-white/[0.1] backdrop-blur-2xl border border-white/[0.1] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]
            // We want hover states to just change background, or be combined correctly.
            // Since backdrop blur and shadow are already applied to the base, we can just strip the duplicate base classes that got inserted with hover:

            const fixes = [
                ['hover:bg-white/[0.1] backdrop-blur-2xl border border-white/[0.1] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]', 'hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105'],
                ['hover:bg-white/[0.04] backdrop-blur-2xl border border-white/[0.05] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]', 'hover:bg-white/[0.06] hover:scale-[1.02] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)]'],
                ['hover:bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]', 'hover:bg-white/[0.1] hover:border-white/[0.15] hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)] hover:scale-105'],
                ['hover:bg-white/[0.15] backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]', 'hover:bg-white/[0.2] hover:scale-105 hover:shadow-[0_12px_24px_0_rgba(0,0,0,0.3)]'],
                ['border border-white/[0.02]/85', ''], // cleanup stray
                ['border border-white/[0.02]/90', ''], // cleanup stray
                ['bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)] flex', 'bg-white/[0.05] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10 flex'],
                ['bg-white/[0.1] backdrop-blur-2xl border border-white/[0.1] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]', 'bg-white/10 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/20'],
                ['bg-white/[0.04] backdrop-blur-2xl border border-white/[0.05] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]', 'bg-white/5 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10'],
                ['bg-black/30 backdrop-blur-3xl border border-white/[0.02]', 'bg-black/20 backdrop-blur-2xl border border-white/5 shadow-2xl'],
                ['bg-[#1f1f23]', 'bg-white/[0.08] backdrop-blur-xl shadow-lg border border-white/[0.08]'],
                ['bg-[#2a292e]', 'bg-white/[0.12] backdrop-blur-xl shadow-xl border border-white/[0.12]'],
                ['bg-[#1b1b1f]', 'bg-white/[0.05] backdrop-blur-lg border border-white/[0.05]']
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

processDir('./src/components');
