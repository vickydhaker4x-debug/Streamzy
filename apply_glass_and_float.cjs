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

            // 1. Add floating-icon to material symbols
            const symbolMatch = 'material-symbols-outlined';
            if (content.includes(symbolMatch)) {
                content = content.replace(/className="([^"]*)material-symbols-outlined([^"]*)"/g, (match, p1, p2) => {
                    if (p1.includes('floating-icon') || p2.includes('floating-icon')) {
                        return match; // Already added
                    }
                    return `className="${p1}material-symbols-outlined floating-icon${p2}"`;
                });
                changed = true;
            }

            // 2. Map existing glass backgrounds to liquid-glass
            // For lighter glass parts (like cards, headers)
            const lightGlassMatches = [
                'bg-white/10 backdrop-blur-lg border border-white/20',
                'bg-white/10 backdrop-blur-md shadow-lg border border-white/10',
                'bg-white/5 backdrop-blur-md',
                'bg-white/10 backdrop-blur-3xl',
                'bg-white/10 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/20',
                'bg-white/[0.05] backdrop-blur-lg border border-white/[0.05]',
                'bg-white/[0.12] backdrop-blur-xl shadow-xl border border-white/[0.12]',
                'bg-white/[0.08] backdrop-blur-xl shadow-lg border border-white/[0.08]',
                'bg-white/5 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10',
                'bg-white/10 backdrop-blur-md border border-white/10 shadow-lg',
                'bg-white/[0.12] backdrop-blur-md shadow-lg rounded-xl border border-[var(--color-primary)]/30',
                'bg-white/[0.15] backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_16px_0_rgba(0,0,0,0.2)]'
            ];
            
            for (const m of lightGlassMatches) {
                if (content.includes(m)) {
                    content = content.split(m).join('liquid-glass');
                    changed = true;
                }
            }

            // For darker glass parts (like bottom nav, mini player, background modals)
            const heavyGlassMatches = [
                'bg-black/40 backdrop-blur-3xl border border-white/[0.05] shadow-[0_4px_32px_rgba(0,0,0,0.4)]',
                'bg-black/40 backdrop-blur-3xl border-b border-white/[0.05] shadow-[0_4px_32px_rgba(0,0,0,0.4)]',
                'bg-black/40 backdrop-blur-3xl border-t border-white/[0.05] shadow-[0_-8px_32px_rgba(0,0,0,0.4)]',
                'bg-black/40 backdrop-blur-3xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/[0.08]',
                'bg-black/40 backdrop-blur-3xl',
                'bg-black/20 backdrop-blur-2xl border border-white/5 shadow-2xl',
                'bg-black/20 backdrop-blur-sm border border-white/5'
            ];

            for (const m of heavyGlassMatches) {
                if (content.includes(m)) {
                    content = content.split(m).join('liquid-glass-heavy');
                    changed = true;
                }
            }

            // 3. Add floating-btn to actual buttons if not present
            if (content.includes('<button')) {
                // Ensure floating-btn is in className of <button>
                content = content.replace(/<button([^>]*)className="([^"]*)"/g, (match, p1, p2) => {
                    if (p2.includes('floating-btn')) {
                        return match;
                    }
                    return `<button${p1}className="${p2} floating-btn"`;
                });
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log(`Applied Apple Glass to ${fullPath}`);
            }
        }
    }
}

processDir('./src');
