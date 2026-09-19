const fs = require('fs');
const https = require('https');

const data = fs.readFileSync('src/data/musicData.ts', 'utf8');
const videoIds = [...data.matchAll(/videoId:\s*'([^']+)'/g)].map(m => m[1]);

async function checkVideo(id) {
  return new Promise((resolve) => {
    https.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`, (res) => {
      resolve({ id, status: res.statusCode });
    }).on('error', () => resolve({ id, status: 500 }));
  });
}

async function run() {
  console.log(`Checking ${videoIds.length} videos...`);
  const uniqueIds = [...new Set(videoIds)];
  for (const id of uniqueIds) {
    const result = await checkVideo(id);
    if (result.status !== 200) {
      console.log(`Dead video: ${id} (Status: ${result.status})`);
    }
  }
}

run();
