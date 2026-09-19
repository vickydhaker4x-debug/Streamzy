import fs from 'fs';
import ytSearch from 'yt-search';

async function fixMusicData() {
  const fileContent = fs.readFileSync('src/data/musicData.ts', 'utf8');
  const tracksRegex = /{\s*id:\s*'[^']+',[\s\S]*?},/g;
  
  let newContent = fileContent;
  let matches = [...fileContent.matchAll(tracksRegex)];
  
  console.log(`Found ${matches.length} tracks to check.`);
  
  let fixedCount = 0;
  for (const match of matches) {
    const trackStr = match[0];
    const titleMatch = trackStr.match(/title:\s*'([^']+)'/);
    const artistMatch = trackStr.match(/artist:\s*'([^']+)'/);
    const videoIdMatch = trackStr.match(/videoId:\s*'([^']+)'/);
    
    if (titleMatch && artistMatch && videoIdMatch) {
      const title = titleMatch[1];
      const artist = artistMatch[1];
      const oldId = videoIdMatch[1];
      
      try {
        const fetchRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${oldId}&format=json`);
        if (fetchRes.status !== 200) {
          console.log(`Dead video found: ${title} by ${artist} (${oldId})`);
          
          const searchRes = await ytSearch(`${title} ${artist} audio`);
          if (searchRes && searchRes.videos.length > 0) {
            const newId = searchRes.videos[0].videoId;
            console.log(`  -> Replacing with new video ID: ${newId}`);
            
            // replace videoId and coverUrl in this specific track block
            let newTrackStr = trackStr.replace(`videoId: '${oldId}'`, `videoId: '${newId}'`);
            newTrackStr = newTrackStr.replace(`https://i.ytimg.com/vi/${oldId}/hqdefault.jpg`, `https://i.ytimg.com/vi/${newId}/hqdefault.jpg`);
            
            newContent = newContent.replace(trackStr, newTrackStr);
            fixedCount++;
          }
        }
      } catch (err) {
        console.error(`Error checking ${title}: ${err.message}`);
      }
    }
  }
  
  if (fixedCount > 0) {
    fs.writeFileSync('src/data/musicData.ts', newContent);
    console.log(`Fixed ${fixedCount} tracks successfully.`);
  } else {
    console.log('No broken tracks found or fixed.');
  }
}

fixMusicData();
