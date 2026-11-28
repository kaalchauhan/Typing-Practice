// ---------------------------------------------------------------------------
// Sources: all are free, open (CC BY-SA) and can be read straight from the
// browser. Each level draws from several sources with different writing styles.
// ---------------------------------------------------------------------------
const SOURCES = {
  wikipedia: { name: 'Wikipedia', host: 'en.wikipedia.org', mode: 'topics' },
  simple: { name: 'Simple English Wikipedia', host: 'simple.wikipedia.org', mode: 'topics' },
  wikinews: { name: 'Wikinews', host: 'en.wikinews.org', mode: 'random' },
  wikibooks: { name: 'Wikibooks', host: 'en.wikibooks.org', mode: 'random' },
  wikivoyage: { name: 'Wikivoyage', host: 'en.wikivoyage.org', mode: 'random' }
};

// Topics are grouped by theme, and every random search takes one topic from
// several different themes, so passages do not all come from one subject.
const LEVELS = {
  easy: {
    sources: ['simple', 'wikibooks', 'wikivoyage', 'wikipedia'],
    themes: {
      animals: ['Dog', 'Cat', 'Horse', 'Elephant', 'Lion', 'Tiger', 'Penguin', 'Owl', 'Whale', 'Frog', 'Bee', 'Butterfly', 'Bird', 'Fish'],
      nature: ['Tree', 'Flower', 'River', 'Mountain', 'Forest', 'Desert', 'Volcano', 'Ocean', 'Rainbow', 'Snow', 'Rain', 'Wind', 'Water'],
      space: ['Earth', 'Sun', 'Moon', 'Solar System', 'Planet', 'Star', 'Comet', 'Mars'],
      body: ['Heart', 'Brain', 'Sleep', 'Teeth', 'Skin', 'Blood', 'Exercise', 'Vitamin'],
      food: ['Rice', 'Bread', 'Milk', 'Apple', 'Banana', 'Honey', 'Cheese', 'Egg', 'Potato', 'Chocolate'],
      places: ['School', 'Library', 'Hospital', 'Market', 'Farm', 'Village', 'Park', 'Museum', 'Bridge'],
      machines: ['Bicycle', 'Train', 'Airplane', 'Ship', 'Clock', 'Telephone', 'Computer', 'Camera', 'Electricity', 'Robot'],
      arts_sports: ['Music', 'Piano', 'Football', 'Cricket', 'Chess', 'Painting', 'Dance', 'Swimming', 'Olympic Games'],
      society: ['Law', 'Court', 'Police', 'Money', 'Bank', 'Election', 'Flag', 'Family'],
      history: ['Pyramid', 'Castle', 'Knight', 'Ancient Egypt', 'Ancient Rome', 'Pirate']
    }
  },
  moderate: {
    sources: ['wikipedia', 'wikinews', 'simple', 'wikibooks', 'wikivoyage'],
    themes: {
      science: ['Photosynthesis', 'Plate tectonics', 'Ocean current', 'Water cycle', 'Gravity', 'Magnetism', 'Evolution', 'DNA', 'Periodic table'],
      geography: ['Amazon River', 'Sahara', 'Himalayas', 'Great Barrier Reef', 'Rainforest', 'Coral reef', 'Nile', 'Mount Fuji', 'Iceland', 'Antarctica'],
      technology: ['World Wide Web', 'Internet', 'Smartphone', 'Renewable energy', 'Solar power', 'Wind power', 'Electric car', 'Robotics', 'Artificial intelligence', 'Satellite'],
      culture: ['Jazz', 'Cinema', 'Photography', 'Television', 'Radio', 'Opera', 'Theatre', 'Painting', 'Literature', 'Poetry'],
      food: ['Coffee', 'Tea', 'Chocolate', 'Wine', 'Pizza', 'Spice', 'Sushi', 'Cheese', 'Rice'],
      sports: ['Marathon', 'Cricket', 'Association football', 'Tennis', 'Chess', 'Basketball', 'Swimming', 'Cycling', 'Golf', 'Rugby union'],
      landmarks: ['London Underground', 'Taj Mahal', 'Great Wall of China', 'Eiffel Tower', 'Statue of Liberty', 'Venice', 'Tokyo', 'Machu Picchu', 'Colosseum', 'Petra'],
      law_society: ['Contract', 'Lease', 'Property law', 'Copyright', 'Trademark', 'Jury', 'Law', 'Democracy', 'Citizenship', 'Public transport', 'Urban planning'],
      health: ['Vaccination', 'Nutrition', 'Medicine', 'Hospital', 'Pharmacy', 'First aid', 'Mental health', 'Public health'],
      business: ['Supermarket', 'Bank', 'Insurance', 'Advertising', 'Tourism', 'Airline', 'Railway', 'Shipping', 'Agriculture', 'Trade']
    },
    minDensity: 0.005,
    maxDensity: 0.02
  },
  hard: {
    sources: ['wikipedia', 'wikinews', 'wikibooks'],
    themes: {
      history: ['Industrial Revolution', 'French Revolution', 'Renaissance', 'World War I', 'World War II', 'Cold War', 'Roman Empire', 'Ancient Egypt', 'Mughal Empire', 'British Raj'],
      law_politics: ['United Nations', 'European Union', 'Constitution of India', 'Constitution of the United States', 'Magna Carta', 'Supreme Court of the United States', 'Supreme Court of India', 'Universal Declaration of Human Rights', 'Common law', 'International law', 'Tort', 'Human rights'],
      science_space: ['Apollo 11', 'Space Race', 'International Space Station', 'Hubble Space Telescope', 'Theory of relativity', 'Albert Einstein', 'Isaac Newton', 'Charles Darwin', 'Marie Curie', 'CERN'],
      economy: ['Federal Reserve', 'Stock market', 'Great Depression', 'Silicon Valley', 'Microsoft', 'Google', 'Linux', 'Patent', 'World Bank'],
      places_engineering: ['Panama Canal', 'Suez Canal', 'Titanic', 'Mount Everest', 'New York City', 'Golden Gate Bridge', 'Channel Tunnel', 'Burj Khalifa', 'Hoover Dam'],
      culture: ['Olympic Games', 'Rock and roll', 'The Beatles', 'Jazz', 'Printing press', 'Hollywood', 'Nobel Prize', 'Academy Awards', 'Bollywood', 'FIFA World Cup']
    },
    minDensity: 0.025,
    maxDensity: 0.055
  }
};

// Reading-difficulty guard, so "Easy" is really plain text (short everyday
// words, short sentences) and not just text without numbers.
const READABILITY = {
  easy: { maxAvgWord: 5.0, maxLongShare: 0.07, maxAvgSentence: 22, minFlesch: 50 },
  moderate: { maxAvgWord: 6.0, maxLongShare: 0.16 },
  hard: { maxFlesch: 65 }
};

const TARGET_WORDS = 400;
const MIN_WORDS = 375;
const MAX_WORDS = 425;
const WINDOWS_PER_PAGE = 3;     // several passages can come from one long article
const PAGES_PER_SOURCE = 3;     // articles downloaded per source, per round
const WANTED_PASSAGES = 12;     // stop searching once we have this many
const MAX_ROUNDS = 2;           // random mode keeps trying new topics until there are enough
const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });

export class PassageRateLimitError extends Error {}

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function readabilityOk(level, stats) {
  const rule = READABILITY[level];
  if (!rule) return true;
  const avgWord = stats.letters / stats.words;
  const longShare = stats.longWords / stats.words;
  const avgSentence = stats.words / stats.sentences;
  const flesch = 206.835 - 1.015 * avgSentence - 84.6 * (stats.syllables / stats.words);
  if (rule.maxAvgWord && avgWord > rule.maxAvgWord) return false;
  if (rule.maxLongShare && longShare > rule.maxLongShare) return false;
  if (rule.maxAvgSentence && avgSentence > rule.maxAvgSentence) return false;
  if (rule.minFlesch && flesch < rule.minFlesch) return false;
  if (rule.maxFlesch && flesch > rule.maxFlesch) return false;
  return true;
}

function excerpts(extract = '', level, settings, limit = WINDOWS_PER_PAGE) {
  let text = extract
    .replace(/^\s*=+[^\n]+=+\s*$/gm, ' ')
    .replace(/\[\d+\]|\[citation needed\]/gi, '')
    .replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐‑‒–—−]/g, '-')
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  const easy = level === 'easy';
  if (easy) {
    text = text.replace(/\s*\([^()]*\)/g, '')
      .replace(/"/g, '')
      .replace(/[?!]/g, '.')
      .replace(/\s+-\s+|[;:]\s*/g, ', ')
      .replace(/([a-z])-(?=[a-z])/gi, '$1 ');
  }

  const parts = Array.from(sentences.segment(text), ({ segment }) => {
    const sentence = segment.trim();
    const words = sentence.split(/\s+/);
    const cleanWords = words.map(word => word.replace(/[^a-z]/gi, ''));
    return {
      sentence,
      allowed: /[a-z]/i.test(sentence) && (easy ? /^[a-z ,.]+$/i.test(sentence) : /^[\x20-\x7E]+$/.test(sentence) && !/[\\{}]/.test(sentence)),
      wordCount: words.length,
      numbers: words.filter(word => /\d/.test(word)).length,
      quotes: (sentence.match(/"/g) || []).length,
      letters: cleanWords.reduce((sum, word) => sum + word.length, 0),
      longWords: cleanWords.filter(word => word.length >= 10).length,
      syllables: cleanWords.reduce((sum, word) => sum + countSyllables(word), 0)
    };
  });

  const findBest = (from) => {
    let best = null;
    for (let start = from; start < parts.length; start++) {
      const stats = { words: 0, sentences: 0, letters: 0, longWords: 0, syllables: 0 };
      let numbers = 0;
      let quotes = 0;
      for (let end = start; end < parts.length; end++) {
        const part = parts[end];
        stats.words += part.wordCount;
        if (!part.allowed || stats.words > MAX_WORDS) break;
        stats.sentences++;
        stats.letters += part.letters;
        stats.longWords += part.longWords;
        stats.syllables += part.syllables;
        numbers += part.numbers;
        quotes += part.quotes;
        if (stats.words < MIN_WORDS) continue;

        const density = (numbers + quotes) / stats.words;
        if (!easy && (!numbers || !quotes || density < settings.minDensity || density > settings.maxDensity)) continue;
        if (!readabilityOk(level, stats)) continue;

        const distance = Math.abs(stats.words - TARGET_WORDS);
        if (!best || distance < best.distance) best = { start, end, distance };
        if (distance === 0) break;
      }
      if (best?.distance === 0) break;
    }
    return best;
  };

  // Collect several separate, non-overlapping passages from the same text
  const found = [];
  let from = 0;
  while (found.length < limit && from < parts.length) {
    const best = findBest(from);
    if (!best) break;
    found.push(parts.slice(best.start, best.end + 1).map(part => part.sentence).join(' '));
    from = best.end + 1;
  }
  return found;
}

async function getPages(host, params, signal) {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    prop: 'extracts|info|pageprops', ppprop: 'disambiguation', explaintext: '1', ...params
  });
  const response = await fetch(url, {
    credentials: 'omit',
    headers: { 'Api-User-Agent': 'TypingPractice/1.0 (https://lively-selkie-62ae82.netlify.app)' },
    signal
  });
  if (response.status === 429) throw new PassageRateLimitError();
  if (!response.ok) throw new Error('Request failed');
  const data = await response.json();
  if (data.error) throw new Error('Source could not return passages');
  return data.query?.pages ?? [];
}

function shuffle(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const isUsablePage = page => page.pageid && page.pageprops?.disambiguation === undefined &&
  !/^(List|Lists|Index|Category|Template) ?(of|:)/i.test(page.title);

// One topic from each of several different themes
function pickTopics(settings, tried, count) {
  const themes = shuffle(Object.keys(settings.themes));
  const picks = [];
  for (const theme of themes) {
    const choices = settings.themes[theme].filter(name => !tried.has(name));
    if (!choices.length) continue;
    picks.push(choices[Math.floor(Math.random() * choices.length)]);
    if (picks.length === count) break;
  }
  return picks;
}

// Finds usable passages from one source (one wiki)
async function searchSource(key, level, topic, settings, tried, signal) {
  const source = SOURCES[key];
  let pages;
  if (topic) {
    pages = await getPages(source.host, {
      generator: 'search', gsrsearch: topic, gsrnamespace: '0', gsrlimit: '12', prop: 'info|pageprops'
    }, signal);
    pages = pages.sort((first, second) => (first.index ?? 0) - (second.index ?? 0));
  } else if (source.mode === 'topics') {
    const picks = pickTopics(settings, tried, PAGES_PER_SOURCE + 1);
    if (!picks.length) return [];
    picks.forEach(name => tried.add(name));
    pages = await getPages(source.host, { titles: picks.join('|'), redirects: '1', prop: 'info|pageprops' }, signal);
  } else {
    pages = await getPages(source.host, {
      generator: 'random', grnnamespace: '0', grnlimit: '12', prop: 'info|pageprops'
    }, signal);
  }
  pages = pages.filter(isUsablePage).slice(0, topic ? PAGES_PER_SOURCE + 1 : PAGES_PER_SOURCE + 2);

  // Full article text. Wikimedia returns full text for one article per request,
  // so these are fetched side by side.
  const downloads = await Promise.allSettled(pages.map(async page => {
    const [full] = await getPages(source.host, { pageids: String(page.pageid), exsectionformat: 'wiki' }, signal);
    return { page, full, texts: excerpts(full?.extract, level, settings) };
  }));

  let rateLimited = false;
  const lists = [];
  downloads.forEach(download => {
    if (download.status === 'rejected') {
      if (signal?.aborted) throw download.reason;
      if (download.reason instanceof PassageRateLimitError) rateLimited = true;
      return;
    }
    const { page, full, texts } = download.value;
    if (!texts.length) return;
    lists.push(shuffle(texts).map((text, number) => {
      const url = new URL(`https://${source.host}/w/index.php`);
      const revision = full?.lastrevid || page.lastrevid;
      url.searchParams.set(revision ? 'oldid' : 'curid', revision || page.pageid);
      url.hash = `passage-${page.pageid}-${number + 1}`; // keeps every passage link unique
      return { title: page.title, text, level, wiki: source.host, sourceName: source.name, url: url.href, wordCount: text.split(' ').length };
    }));
  });
  if (!lists.length && rateLimited) throw new PassageRateLimitError();
  return lists;
}

// Take turns between lists, so neighbouring results differ
function interleave(lists) {
  const out = [];
  const longest = Math.max(0, ...lists.map(list => list.length));
  for (let turn = 0; turn < longest; turn++) {
    lists.forEach(list => { if (list[turn]) out.push(list[turn]); });
  }
  return out;
}

export async function findOnlinePassages(level, topic, signal) {
  const settings = LEVELS[level];
  const passages = [];
  const seen = new Set();
  const tried = new Set();
  let rateLimited = false;
  let succeeded = false;

  for (let round = 0; round < (topic ? 1 : MAX_ROUNDS); round++) {
    const outcomes = await Promise.allSettled(
      settings.sources.map(key => searchSource(key, level, topic, settings, tried, signal))
    );
    if (signal?.aborted) throw signal.reason;

    // One list per source, each with its articles taking turns
    const perSource = [];
    outcomes.forEach(outcome => {
      if (outcome.status === 'rejected') {
        if (outcome.reason instanceof PassageRateLimitError) rateLimited = true;
        return;
      }
      succeeded = true;
      perSource.push(interleave(outcome.value));
    });

    const merged = topic
      ? interleave(perSource)                       // best-matching article of each source first
      : shuffle(perSource.flat());                  // random mix of sources and themes
    merged.forEach(passage => {
      const key = passage.title + passage.text.slice(0, 40);
      if (!seen.has(key)) { seen.add(key); passages.push(passage); }
    });
    if (passages.length >= WANTED_PASSAGES) break;
  }

  if (!passages.length && !succeeded) {
    if (rateLimited) throw new PassageRateLimitError();
    throw new Error('Passage sources unavailable');
  }
  return passages;
}
