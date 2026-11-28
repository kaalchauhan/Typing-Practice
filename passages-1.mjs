const LEVELS = {
  easy: {
    wiki: 'simple',
    topics: ['Earth', 'Solar System', 'Butterfly', 'Bird', 'Sun', 'Wind', 'Water', 'Dog', 'Tree', 'Flower']
  },
  moderate: {
    wiki: 'en',
    topics: ['Moon', 'London Underground', 'Ocean current', 'Urban planning', 'Public transport', 'Plate tectonics', 'World Wide Web', 'Earth Day', 'Jazz', 'English language'],
    minDensity: 0.005,
    maxDensity: 0.02
  },
  hard: {
    wiki: 'en',
    topics: ['Apollo 11', 'Olympic Games', 'World Wide Web', 'United Nations', 'New York City', 'Rock and roll', 'The Beatles', 'Jazz', 'Earth Day', 'Printing press'],
    minDensity: 0.025,
    maxDensity: 0.055
  }
};

const TARGET_WORDS = 400;
const MIN_WORDS = 375;
const MAX_WORDS = 425;
const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });

export class PassageRateLimitError extends Error {}

function excerpt(extract = '', level, settings) {
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
    return {
      sentence,
      allowed: /[a-z]/i.test(sentence) && (easy ? /^[a-z ,.]+$/i.test(sentence) : /^[\x20-\x7E]+$/.test(sentence) && !/[\\{}]/.test(sentence)),
      wordCount: words.length,
      numbers: words.filter(word => /\d/.test(word)).length,
      quotes: (sentence.match(/"/g) || []).length
    };
  });
  let best = null;
  for (let start = 0; start < parts.length; start++) {
    let wordCount = 0;
    let numbers = 0;
    let quotes = 0;
    for (let end = start; end < parts.length; end++) {
      const part = parts[end];
      wordCount += part.wordCount;
      if (!part.allowed || wordCount > MAX_WORDS) break;
      numbers += part.numbers;
      quotes += part.quotes;
      if (wordCount < MIN_WORDS) continue;

      const density = (numbers + quotes) / wordCount;
      if (!easy && (!numbers || !quotes || density < settings.minDensity || density > settings.maxDensity)) continue;

      const distance = Math.abs(wordCount - TARGET_WORDS);
      if (!best || distance < best.distance) best = { start, end, distance };
      if (distance === 0) break;
    }
    if (best?.distance === 0) break;
  }
  return best ? parts.slice(best.start, best.end + 1).map(part => part.sentence).join(' ') : null;
}

async function getPages(wiki, params, signal) {
  const url = new URL(`https://${wiki}.wikipedia.org/w/api.php`);
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
  if (!response.ok) throw new Error('Wikipedia request failed');
  const data = await response.json();
  if (data.error) throw new Error('Wikipedia could not return passages');
  return data.query?.pages ?? [];
}

async function findOnWiki(wiki, level, topic, settings, signal) {
  const lookup = topic
    ? { generator: 'search', gsrsearch: topic, gsrnamespace: '0', gsrlimit: '10' }
    : { titles: settings.topics.join('|'), redirects: '1' };
  const pages = (await getPages(wiki, { ...lookup, exintro: '1', exlimit: 'max' }, signal))
    .filter(page => page.pageid && page.pageprops?.disambiguation === undefined && !/^List of /i.test(page.title))
    .sort((first, second) => (first.index ?? 0) - (second.index ?? 0));

  const matches = pages.map(page => ({ page, text: excerpt(page.extract, level, settings) }));
  const hasExcerpt = matches.some(match => match.text);
  const needsMoreText = (hasExcerpt ? (topic ? matches.slice(0, 2) : []) : matches)
    .filter(match => !match.text).slice(0, hasExcerpt ? 1 : 3);
  for (const match of needsMoreText) {
    try {
      const [page] = await getPages(wiki, { pageids: String(match.page.pageid), exsectionformat: 'wiki' }, signal);
      match.text = excerpt(page?.extract, level, settings);
      if (match.text) {
        match.page.lastrevid = page.lastrevid;
        break;
      }
    } catch (error) {
      if (!hasExcerpt) throw error;
    }
  }

  return matches.flatMap(({ page, text }, index) => {
    if (!text) return [];
    const url = new URL(`https://${wiki}.wikipedia.org/w/index.php`);
    url.searchParams.set(page.lastrevid ? 'oldid' : 'curid', page.lastrevid || page.pageid);
    return [{
      title: page.title,
      text,
      level,
      wiki,
      url: url.href,
      wordCount: text.split(' ').length,
      rank: topic ? index : Math.random()
    }];
  }).sort((first, second) => first.rank - second.rank);
}

export async function findOnlinePassages(level, topic, signal) {
  const settings = LEVELS[level];
  const passages = await findOnWiki(settings.wiki, level, topic, settings, signal);
  if (passages.length || level !== 'easy' || !topic) return passages;
  return findOnWiki('en', level, topic, settings, signal);
}
