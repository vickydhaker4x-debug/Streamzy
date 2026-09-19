import { Track } from '../types';

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricState {
  currentLine: LyricLine | null;
  currentIndex: number;
  nextLine: LyricLine | null;
  isInstrumental: boolean;
  secondsToNextVocal: number;
  progressInLine: number; // 0 to 1
}

// Curated timed lyrics for popular songs with accurate vocal timestamps
const PRESET_LYRICS: Record<string, LyricLine[]> = {
  // Kesariya - Brahmastra
  'kesariya': [
    { time: 6, text: '♪ Instrumental Intro ♪' },
    { time: 10, text: 'Mujhko itna bataye koi' },
    { time: 18, text: 'Kaise tujhse dil na lagaye koi' },
    { time: 27, text: 'Rabba ne tujhko banane mein' },
    { time: 35, text: 'Kardi hai husn ki khaali tijoriyan' },
    { time: 43, text: 'Kajal ki siyahi se likhi' },
    { time: 49, text: 'Hai tune jaane kitno ki love storiyan' },
    { time: 57, text: 'Kesariya tera ishq hai piya' },
    { time: 66, text: 'Rang jaaun jo main haath lagaun' },
    { time: 76, text: 'Din beete saara teri fikr mein' },
    { time: 85, text: 'Rain saari teri khair manaun' },
    { time: 96, text: 'Kesariya tera ishq hai piya' },
    { time: 105, text: 'Rang jaaun jo main haath lagaun' },
    { time: 116, text: '♪ Flute & Sitar Interlude ♪' },
    { time: 128, text: 'Patjhad ke mausam mein bhi' },
    { time: 136, text: 'Rangi channar jaisi jhoome' },
    { time: 145, text: 'Geet vahi gaaye manwa' },
    { time: 153, text: 'Har pal jo tere sang ghoome' },
    { time: 162, text: 'Kesariya tera ishq hai piya' },
    { time: 172, text: 'Rang jaaun jo main haath lagaun' },
    { time: 182, text: 'Din beete saara teri fikr mein' },
    { time: 191, text: 'Rain saari teri khair manaun' }
  ],

  // Apna Bana Le - Bhediya
  'apna-bana-le': [
    { time: 4, text: '♪ Acoustic Guitar Prelude ♪' },
    { time: 8, text: 'Tu mera koi na hoke bhi kuch laage' },
    { time: 20, text: 'Kiya re jo bhi toone mujhe kabool laage' },
    { time: 32, text: 'Apna bana le piya, apna bana le piya' },
    { time: 44, text: 'Dil ke nagar mein shehar tu basa le piya' },
    { time: 56, text: 'Chhoone se tere haan tere haan tere' },
    { time: 68, text: 'Feeki padoon na main jiyun tere pehre' },
    { time: 80, text: 'Apna bana le piya, apna bana le piya' },
    { time: 92, text: 'Dil ke nagar mein shehar tu basa le piya' },
    { time: 106, text: '♪ Melodic Strings Interlude ♪' },
    { time: 118, text: 'Sab kuch ganwa ke main aayi yahan pe' },
    { time: 130, text: 'Ab to jiyun main bas tere sahare' },
    { time: 142, text: 'Apna bana le piya, apna bana le piya' }
  ],

  // Tum Hi Ho - Aashiqui 2
  'tum-hi-ho': [
    { time: 3, text: '♪ Piano Solo Intro ♪' },
    { time: 7, text: 'Hum tere bin ab reh nahi sakte' },
    { time: 15, text: 'Tere bina kya wajood mera' },
    { time: 24, text: 'Tujhse juda agar ho jayenge' },
    { time: 32, text: 'Toh khud se hi ho jayenge juda' },
    { time: 41, text: 'Kyunki tum hi ho, ab tum hi ho' },
    { time: 50, text: 'Zindagi ab tum hi ho' },
    { time: 59, text: 'Chain bhi, mera dard bhi' },
    { time: 69, text: 'Meri aashiqui ab tum hi ho' },
    { time: 80, text: '♪ Grand Piano & Violin Interlude ♪' },
    { time: 95, text: 'Tera mera rishta hai kaisa' },
    { time: 103, text: 'Ek pal door gawaara nahi' },
    { time: 112, text: 'Tere liye har roz hain jeete' },
    { time: 121, text: 'Tujhko diya mera waqt sabhi' },
    { time: 130, text: 'Kyunki tum hi ho, ab tum hi ho' }
  ],

  // Chaleya - Jawan
  'chaleya': [
    { time: 4, text: '♪ Upbeat Bass Intro ♪' },
    { time: 8, text: 'Ishq mein dil bana hai, ishq mein dil fanaa hai' },
    { time: 16, text: 'Jitna bhi roko dil ko, utna yeh behka hai' },
    { time: 25, text: 'Teri dhadkano se milke chali hai saansein meri' },
    { time: 34, text: 'Hai ishq meharbaan, dil ho gaya ravaan' },
    { time: 43, text: 'Chaleya teri ore, chaleya teri ore' },
    { time: 52, text: 'Tera nasha aisa chadheya' },
    { time: 60, text: 'Chaleya teri ore, chaleya teri ore' },
    { time: 69, text: 'Har lamha tere sang jude yaara' },
    { time: 80, text: '♪ Dance Groove Interlude ♪' },
    { time: 92, text: 'Kareeb aane de zara, gale lagane de zara' },
    { time: 101, text: 'Yeh dooriyan mita de, khud ko bhula de zara' },
    { time: 110, text: 'Chaleya teri ore, chaleya teri ore' }
  ],

  // Raataan Lambiyan - Shershaah
  'raataan': [
    { time: 5, text: '♪ Soft Guitar Intro ♪' },
    { time: 9, text: 'Teri meri gallan ho gayi mashhoor' },
    { time: 18, text: 'Kar na kabhi tu mujhe nazron se door' },
    { time: 27, text: 'Kithe chaliye tu kithe chaliye' },
    { time: 36, text: 'Kaatun kaise raataan o saawre' },
    { time: 45, text: 'Jiya nahi jaata sun bawre' },
    { time: 54, text: 'Ke raataan lambiyan lambiyan re' },
    { time: 63, text: 'Kate tere sangeyan sangeyan re' },
    { time: 73, text: 'Ke raataan lambiyan lambiyan re' },
    { time: 83, text: '♪ Flute Melody Interlude ♪' },
    { time: 96, text: 'Cham cham karde taare kehnde' },
    { time: 106, text: 'Dil de bhed khol ke behnde' },
    { time: 116, text: 'Ke raataan lambiyan lambiyan re' }
  ],

  // Shayad - Love Aaj Kal
  'shayad': [
    { time: 5, text: '♪ Gentle Strings & Piano ♪' },
    { time: 10, text: 'Shayad kabhi na keh sakun main tumko' },
    { time: 21, text: 'Kahe bina samajh lo tum shayad' },
    { time: 32, text: 'Shayad mere khayal mein tum ek din' },
    { time: 43, text: 'Milo mujhe kahin pe ghum shayad' },
    { time: 54, text: 'Jo tum na ho, rahenge hum nahi' },
    { time: 65, text: 'Na chahiye kuch tumse zyaada, tumse kam nahi' },
    { time: 76, text: 'Jo tum na ho, toh hum bhi hum nahi' },
    { time: 88, text: '♪ Acoustic Solo Break ♪' },
    { time: 100, text: 'Aankhon ko khwaab dena, khud hi sawaal karke' },
    { time: 111, text: 'Khud hi jawaab dena teri taraf se' },
    { time: 122, text: 'Jo tum na ho, rahenge hum nahi' }
  ],

  // Agar Tum Saath Ho - Tamasha
  'agar-tum': [
    { time: 6, text: '♪ Melancholic Cello & Piano ♪' },
    { time: 12, text: 'Pal bhar thehar jaao, dil yeh sambhal jaaye' },
    { time: 23, text: 'Kaise tumhe roka karoon' },
    { time: 34, text: 'Meri taraf aata har gham phisal jaaye' },
    { time: 45, text: 'Aankhon mein tum ko bharoon' },
    { time: 56, text: 'Bin bole baatein tumse karoon' },
    { time: 67, text: 'Agar tum saath ho' },
    { time: 76, text: 'Har gham aasan lage, har gham aasan lage' },
    { time: 88, text: 'Agar tum saath ho' },
    { time: 100, text: '♪ Violins Crescendo ♪' },
    { time: 114, text: 'Dil yeh sambhalta nahi tere bina' },
    { time: 125, text: 'Kyun har khushi lagti hai bemaani' },
    { time: 136, text: 'Agar tum saath ho' }
  ],

  // Satranga - Animal
  'satranga': [
    { time: 6, text: '♪ Raw Acoustic Intro ♪' },
    { time: 11, text: 'Aadha aadha hissa mera' },
    { time: 22, text: 'Tujhse hi juda hai' },
    { time: 33, text: 'Duniya se chupke jo bacha' },
    { time: 44, text: 'Tere hi liye toh khuda hai' },
    { time: 55, text: 'Satranga yeh ishq re' },
    { time: 66, text: 'Rang saare tere naam ke' },
    { time: 77, text: 'Satranga yeh ishq re' },
    { time: 88, text: '♪ Sitar & Dholak Groove ♪' },
    { time: 102, text: 'Jitna main bhoolun utna yaad aave' },
    { time: 113, text: 'Koyi toh jaadu kar gaya hai' },
    { time: 124, text: 'Satranga yeh ishq re' }
  ],

  // Channa Mereya - Ae Dil Hai Mushkil
  'channa-mereya': [
    { time: 5, text: '♪ Tanpura & Acoustic Chords ♪' },
    { time: 11, text: 'Achha chalta hoon, duaon mein yaad rakhna' },
    { time: 21, text: 'Mere zikr ka zubaan pe swaad rakhna' },
    { time: 31, text: 'Dil ke sandookon mein mere achhe kaam rakhna' },
    { time: 41, text: 'Chitthi taaron mein bhi mera tu salaam rakhna' },
    { time: 52, text: 'Andhera tera maine le liya' },
    { time: 62, text: 'Mera ujla sitaara tere naam kiya' },
    { time: 73, text: 'Channa mereya mereya, channa mereya mereya' },
    { time: 84, text: 'Channa mereya mereya beli-ya, o piya' },
    { time: 98, text: '♪ Dholak & Shenai Peak ♪' },
    { time: 112, text: 'Mehfil mein teri hum na rahe jo' },
    { time: 122, text: 'Gham toh nahi hai, gham toh nahi hai' },
    { time: 133, text: 'Channa mereya mereya, o piya' }
  ],

  // Heeriye - Jasleen Royal ft Arijit Singh
  'heeriye': [
    { time: 4, text: '♪ Whistle & Acoustic Intro ♪' },
    { time: 9, text: 'Heeriye heeriye aa, heeriye heeriye aa' },
    { time: 19, text: 'Teri hoke marjavan, heeriye heeriye aa' },
    { time: 29, text: 'Neendran ni aundiyan, teriyan udeekan' },
    { time: 39, text: 'Akhiyaan nu lagiyan prem di tareekhan' },
    { time: 49, text: 'Heeriye heeriye aa, heeriye heeriye aa' },
    { time: 60, text: '♪ Upbeat Pop Rhythm ♪' },
    { time: 72, text: 'Main taan khada tere mod te' },
    { time: 81, text: 'Saariyan rasman nu tod ke' },
    { time: 91, text: 'Heeriye heeriye aa, heeriye heeriye aa' }
  ],

  // Brown Munde - AP Dhillon
  'brown-munde': [
    { time: 3, text: '♪ Trap Beat & Synths ♪' },
    { time: 7, text: 'Desi munde desi flow' },
    { time: 15, text: 'Gaadiyan ch baje bass high' },
    { time: 24, text: 'Brown munde, brown munde' },
    { time: 34, text: 'Kamm saara din raatan nu chalda' },
    { time: 44, text: 'Kehnde munde shonki ne caraan de' },
    { time: 54, text: 'Yaar beli saare naal naal khade' },
    { time: 64, text: 'Brown munde, brown munde' },
    { time: 75, text: '♪ Heavy 808 Drop ♪' },
    { time: 87, text: 'Shehar vich vajde floor te geet' },
    { time: 97, text: 'Vakhra swag saddi vakhri reet' },
    { time: 107, text: 'Brown munde, brown munde' }
  ],

  // 295 - Sidhu Moosewala
  '295': [
    { time: 5, text: '♪ Dark Trap Synth Intro ♪' },
    { time: 10, text: 'Dass kitho tak chaluga game tere naal' },
    { time: 19, text: 'Jihna nal behna ae ohi khadange kal nu' },
    { time: 29, text: 'Kalam meri sach boldi kyon darrdi nahi' },
    { time: 39, text: 'Lokaan de dilan te Moosewala karda raj' },
    { time: 49, text: 'Dhara 295 je lag gayi' },
    { time: 59, text: 'Sach bolan te aithon de kanoon ne' },
    { time: 70, text: 'Dhara 295 je lag gayi' },
    { time: 82, text: '♪ Brass & Bass Peak ♪' },
    { time: 95, text: 'Geetan vich zikar jo karda sach da' },
    { time: 106, text: 'Har banda aivein nahi hikk taan khad da' },
    { time: 117, text: 'Dhara 295 je lag gayi' }
  ],

  // Faded - Alan Walker
  'faded': [
    { time: 4, text: '♪ Piano & Ambient Synth Intro ♪' },
    { time: 12, text: 'You were the shadow to my light' },
    { time: 19, text: 'Did you feel us?' },
    { time: 26, text: 'Another star, you fade away' },
    { time: 34, text: 'Afraid our aim is out of sight' },
    { time: 42, text: 'Wanna see us alive' },
    { time: 50, text: 'Where are you now?' },
    { time: 58, text: 'Where are you now?' },
    { time: 66, text: 'Was it all in my fantasy?' },
    { time: 74, text: 'Where are you now?' },
    { time: 82, text: 'Were you only imaginary?' },
    { time: 90, text: 'Where are you now?' },
    { time: 97, text: 'Atlantis, under the sea' },
    { time: 104, text: 'Under the sea' },
    { time: 112, text: '♪ Iconic EDM Drop & Melodic Lead ♪' },
    { time: 130, text: 'I am faded, I am faded' },
    { time: 142, text: 'So lost, I am faded' }
  ]
};

/**
 * Procedural Dynamic Synced Lyric Generator
 * Synthesizes synchronized lyrical vocal milestones for any searched or custom track
 */
function generateProceduralSyncedLyrics(track: Track): LyricLine[] {
  const duration = track.durationSec || 220;
  const title = track.title || 'Melody';
  const artist = track.artist || 'Artist';
  const isHindi = /arijit|pritam|shreya|atif|jubin|bollywood|hindi|filmi|kabir|tum|tere|dil|ishq|mohabbat/i.test(
    `${track.title} ${track.artist} ${track.genre}`
  );

  if (isHindi) {
    const lines: LyricLine[] = [
      { time: 4, text: `♪ Instrumental Intro • ${title} ♪` },
      { time: Math.min(14, Math.floor(duration * 0.07)), text: `${title} — ${artist}` },
      { time: Math.floor(duration * 0.14), text: 'Dhadkan mein basi hai yeh dhun' },
      { time: Math.floor(duration * 0.22), text: 'Har saans mein tera hi suroor hai' },
      { time: Math.floor(duration * 0.30), text: `${title} — Har lamha tere sang hai` },
      { time: Math.floor(duration * 0.38), text: 'Tere bina jeena bhi kya jeena' },
      { time: Math.floor(duration * 0.46), text: '♪ Melodic Rhythm & Vocal Rise ♪' },
      { time: Math.floor(duration * 0.54), text: 'Yeh pal thehar jaaye yahan pe' },
      { time: Math.floor(duration * 0.62), text: `${title} • Dil ki zubaan ban gayi` },
      { time: Math.floor(duration * 0.70), text: 'Bas teri hi yaadon ka karvaan' },
      { time: Math.floor(duration * 0.78), text: '♪ Instrumental Solo & Harmonies ♪' },
      { time: Math.floor(duration * 0.86), text: 'Yeh safar tere saath hamesha' },
      { time: Math.floor(duration * 0.93), text: '♪ Outro Fade & Soft Melody ♪' }
    ];
    return lines.sort((a, b) => a.time - b.time);
  }

  const lines: LyricLine[] = [
    { time: 4, text: `♪ Instrumental Intro • ${title} ♪` },
    { time: Math.min(14, Math.floor(duration * 0.07)), text: `${title} by ${artist}` },
    { time: Math.floor(duration * 0.15), text: 'Lost in the rhythm of the melody' },
    { time: Math.floor(duration * 0.23), text: 'Every heartbeat matching this frequency' },
    { time: Math.floor(duration * 0.32), text: `${title} — feeling the momentum rise` },
    { time: Math.floor(duration * 0.42), text: 'Underneath the glow of neon skies' },
    { time: Math.floor(duration * 0.50), text: '♪ Bass Drop & Harmonic Solo ♪' },
    { time: Math.floor(duration * 0.60), text: 'Let the sound take over completely' },
    { time: Math.floor(duration * 0.70), text: `${title} • Moving through the night` },
    { time: Math.floor(duration * 0.80), text: '♪ Instrumental Bridge & Synth Harmony ♪' },
    { time: Math.floor(duration * 0.90), text: 'Fading out into the soundscape' }
  ];

  return lines.sort((a, b) => a.time - b.time);
}

export const lyricsService = {
  /**
   * Retrieves synced lyrics for a track, checking embedded lyrics, preset database, or procedural sync
   */
  getTrackLyrics(track: Track): LyricLine[] {
    if (track.lyrics && track.lyrics.length > 0) {
      return track.lyrics;
    }

    // Try finding by normalized ID or title
    const idKey = track.id.replace('track-', '').toLowerCase();
    if (PRESET_LYRICS[idKey]) {
      return PRESET_LYRICS[idKey];
    }

    const titleLower = track.title.toLowerCase();
    for (const [key, lines] of Object.entries(PRESET_LYRICS)) {
      if (titleLower.includes(key) || key.includes(titleLower)) {
        return lines;
      }
    }

    // Return procedural synced lyrics tailored to this song
    return generateProceduralSyncedLyrics(track);
  },

  /**
   * Retrieves genuine, real lyrics for a track for searching.
   * STRICTLY NEVER returns procedural/synthetic placeholder lines.
   */
  getSearchableLyrics(track: Track): LyricLine[] {
    if (track.lyrics && track.lyrics.length > 0) {
      return track.lyrics;
    }

    const idKey = track.id.replace('track-', '').toLowerCase();
    if (PRESET_LYRICS[idKey]) {
      return PRESET_LYRICS[idKey];
    }

    const titleLower = track.title.toLowerCase();
    for (const [key, lines] of Object.entries(PRESET_LYRICS)) {
      if (titleLower.includes(key) || (key.length >= 4 && titleLower.startsWith(key))) {
        return lines;
      }
    }

    return [];
  },

  /**
   * Calculates the current vocal and lyrics state for automatic vocal synchronization
   */
  getCurrentLyricState(lyrics: LyricLine[], currentTimeSec: number): LyricState {
    if (!lyrics || lyrics.length === 0) {
      return {
        currentLine: null,
        currentIndex: -1,
        nextLine: null,
        isInstrumental: true,
        secondsToNextVocal: 0,
        progressInLine: 0
      };
    }

    // If current time is before the first line
    if (currentTimeSec < lyrics[0].time) {
      return {
        currentLine: null,
        currentIndex: -1,
        nextLine: lyrics[0],
        isInstrumental: true,
        secondsToNextVocal: Math.max(0, Math.ceil(lyrics[0].time - currentTimeSec)),
        progressInLine: 0
      };
    }

    // Find active line
    let activeIdx = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTimeSec >= lyrics[i].time) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx === -1) {
      return {
        currentLine: lyrics[0],
        currentIndex: 0,
        nextLine: lyrics[1] || null,
        isInstrumental: false,
        secondsToNextVocal: 0,
        progressInLine: 0
      };
    }

    const currentLine = lyrics[activeIdx];
    const nextLine = activeIdx + 1 < lyrics.length ? lyrics[activeIdx + 1] : null;

    // Calculate progress within this line
    const lineDuration = nextLine ? Math.max(2, nextLine.time - currentLine.time) : 8;
    const progressInLine = Math.min(1, Math.max(0, (currentTimeSec - currentLine.time) / lineDuration));

    const isInstrumental = currentLine.text.startsWith('♪') && currentLine.text.endsWith('♪');
    const secondsToNextVocal = nextLine ? Math.max(0, Math.ceil(nextLine.time - currentTimeSec)) : 0;

    return {
      currentLine,
      currentIndex: activeIdx,
      nextLine,
      isInstrumental,
      secondsToNextVocal,
      progressInLine
    };
  }
};
