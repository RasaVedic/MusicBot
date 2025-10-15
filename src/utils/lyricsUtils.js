const logger = require('../modules/@rasavedic').createModuleLogger('LyricsUtils');
const lyricsFinder = require('lyrics-finder');

const LRCLIB_API_BASE = 'https://lrclib.net/api';
const LYRICS_OVH_API_BASE = 'https://api.lyrics.ovh/v1';

// Rate limiting configuration
const RETRY_DELAYS = [1000, 2000, 4000];
const API_CALL_DELAY = 500;

/**
 * Sleep for a specified duration
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic for rate limiting
 */
async function fetchWithRetry(url, options = {}, retries = RETRY_DELAYS.length) {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, options);

            if (response.status === 429 && i < retries) {
                const delay = RETRY_DELAYS[i];
                logger.debug(`Rate limited, retrying after ${delay}ms...`);
                await sleep(delay);
                continue;
            }

            return response;
        } catch (error) {
            if (i < retries) {
                const delay = RETRY_DELAYS[i];
                logger.debug(`Request failed, retrying after ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            throw error;
        }
    }
}

/**
 * Search lyrics from LRCLIB API
 */
async function searchLRCLIB(trackName, artistName, albumName = null, duration = null) {
    try {
        const params = new URLSearchParams({
            track_name: trackName,
            artist_name: artistName
        });

        if (albumName) params.append('album_name', albumName);
        if (duration) params.append('duration', Math.floor(duration / 1000));

        const response = await fetchWithRetry(`${LRCLIB_API_BASE}/get?${params.toString()}`, {
            headers: {
                'User-Agent': 'RasaVedic-MusicBot/1.5.0'
            }
        });

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`LRCLIB API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            source: 'LRCLIB',
            plainLyrics: data.plainLyrics || null,
            syncedLyrics: data.syncedLyrics || null,
            trackName: data.trackName,
            artistName: data.artistName,
            albumName: data.albumName,
            duration: data.duration,
            instrumental: data.instrumental || false
        };
    } catch (error) {
        logger.error('LRCLIB search error', error);
        return null;
    }
}

/**
 * Search lyrics from Lyrics.ovh API
 */
async function searchLyricsOvh(artistName, trackName) {
    try {
        const artist = encodeURIComponent(artistName);
        const title = encodeURIComponent(trackName);

        const response = await fetchWithRetry(`${LYRICS_OVH_API_BASE}/${artist}/${title}`);

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Lyrics.ovh API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            source: 'Lyrics.ovh',
            plainLyrics: data.lyrics || null,
            syncedLyrics: null,
            trackName: trackName,
            artistName: artistName,
            albumName: null,
            duration: null,
            instrumental: false
        };
    } catch (error) {
        logger.error('Lyrics.ovh search error', error);
        return null;
    }
}

/**
 * Check if text contains Hindi characters
 */
function containsHindi(text) {
    if (!text) return false;
    const hindiRegex = /[\u0900-\u097F]/;
    return hindiRegex.test(text);
}

/**
 * Check if text contains Hinglish (Romanized Hindi)
 */
function containsHinglish(text) {
    if (!text) return false;

    const hinglishPatterns = [
        /\b(tujhe|tumhe|mujhe|humko|hamko|kya|hai|ho|tha|thi|the|hain|na|hi|to|bhi|se|ne|ko|ka|ki|ke|par|mein|pe)\b/gi,
        /\b(pyaar|ishq|mohabbat|dil|jaan|saanson|naina|khushi|gum|dard|judai|milna|mila|dekha|sunna|karna|hona|aana|jana)\b/gi,
        /\b(yaad|baat|raat|din|waqt|pal|lamhe|zindagi|duniya|aasmaan|sitaare|chaand|suraj|badal|baarish|hawa|pani)\b/gi,
        /\b(ooo|aaa|ohho|hooo|yeah|baby|love|main|tu|woh|mera|tera|apna|sajna|sajni|mohabbat|dost|yaara)\b/gi,
    ];

    return hinglishPatterns.some(pattern => pattern.test(text));
}

/**
 * Detect language of lyrics
 */
function detectLyricsLanguage(lyrics) {
    if (!lyrics) return 'unknown';

    const hasHindi = containsHindi(lyrics);
    const hasHinglish = containsHinglish(lyrics);

    if (hasHindi) return 'hindi';
    if (hasHinglish) return 'hinglish';

    return 'english';
}

/**
 * Simple lyrics-finder with better error handling
 */
async function searchLyricsFinder(trackName, artistName) {
    try {
        const lyrics = await lyricsFinder(artistName, trackName) || await lyricsFinder(trackName, '');

        if (lyrics && !lyrics.includes('Sorry') && !lyrics.includes('Not found')) {
            const language = detectLyricsLanguage(lyrics);
            return {
                source: 'LyricsFinder',
                plainLyrics: lyrics,
                syncedLyrics: null,
                trackName: trackName,
                artistName: artistName,
                albumName: null,
                duration: null,
                instrumental: false,
                language: language
            };
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Direct Google search for lyrics (Fallback method)
 */
async function searchGoogleDirect(trackName, artistName) {
    try {
        const query = encodeURIComponent(`"${trackName}" "${artistName}" lyrics`);
        const url = `https://www.google.com/search?q=${query}`;

        const response = await fetchWithRetry(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            }
        });

        if (!response.ok) return null;

        const html = await response.text();

        // Multiple patterns to extract lyrics from Google search
        const patterns = [
            /<div[^>]*class="ujudUb[^>]*>([\s\S]*?)<\/div>/g,
            /<div[^>]*class="bbVIQb[^>]*>([\s\S]*?)<\/div>/g,
            /<span[^>]*class="ILfuVd[^>]*>([\s\S]*?)<\/span>/g,
            /<div[^>]*class="hwc7pd[^>]*>([\s\S]*?)<\/div>/g,
            /<div[^>]*data-lyricid[^>]*>([\s\S]*?)<\/div>/g,
            /<div[^>]*class="Lyrics__Container[^>]*>([\s\S]*?)<\/div>/g,
        ];

        let lyricsText = '';

        for (const pattern of patterns) {
            const matches = html.match(pattern);
            if (matches) {
                for (const match of matches.slice(0, 6)) {
                    const text = match
                        .replace(/<[^>]*>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (text.length > 30 && !text.includes('Google') && !text.includes('Search')) {
                        lyricsText += text + '\n\n';
                    }
                }
            }
        }

        if (lyricsText.length > 150) {
            const language = detectLyricsLanguage(lyricsText);
            return {
                source: 'Google Direct',
                plainLyrics: lyricsText,
                syncedLyrics: null,
                trackName: trackName,
                artistName: artistName,
                albumName: null,
                duration: null,
                instrumental: false,
                language: language
            };
        }

        return null;
    } catch (error) {
        logger.debug('Google direct search failed');
        return null;
    }
}

/**
 * Search from LyricsBell (Bollywood focused)
 */
async function searchLyricsBell(trackName, artistName) {
    try {
        // Create SEO-friendly URL
        const seoName = `${trackName}-${artistName}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        const url = `https://www.lyricsbell.com/${seoName}/`;

        const response = await fetchWithRetry(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) return null;

        const html = await response.text();

        // Extract lyrics from LyricsBell
        const lyricsPattern = /<div[^>]*class="lyricsbox"[^>]*>([\s\S]*?)<\/div>/i;
        const match = html.match(lyricsPattern);

        if (match && match[1]) {
            let lyrics = match[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .trim();

            if (lyrics.length > 100) {
                const language = detectLyricsLanguage(lyrics);
                return {
                    source: 'LyricsBell',
                    plainLyrics: lyrics,
                    syncedLyrics: null,
                    trackName: trackName,
                    artistName: artistName,
                    albumName: null,
                    duration: null,
                    instrumental: false,
                    language: language
                };
            }
        }

        return null;
    } catch (error) {
        logger.debug('LyricsBell search failed');
        return null;
    }
}

/**
 * Search from QuickLyrics (Fast fallback)
 */
async function searchQuickLyrics(trackName, artistName) {
    try {
        const query = encodeURIComponent(`${trackName} ${artistName}`);
        const url = `https://quicklyrics.vercel.app/api/lyrics?q=${query}`;

        const response = await fetchWithRetry(url, {
            headers: {
                'User-Agent': 'RasaVedic-MusicBot/1.5.0'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();

        if (data && data.lyrics) {
            const language = detectLyricsLanguage(data.lyrics);
            return {
                source: 'QuickLyrics',
                plainLyrics: data.lyrics,
                syncedLyrics: null,
                trackName: data.title || trackName,
                artistName: data.artist || artistName,
                albumName: null,
                duration: null,
                instrumental: false,
                language: language
            };
        }

        return null;
    } catch (error) {
        logger.debug('QuickLyrics search failed');
        return null;
    }
}

/**
 * Main Hinglish/Hindi lyrics search function - SIMPLIFIED
 */
async function searchHinglishLyrics(trackName, artistName) {
    try {
        logger.debug(`Searching Hinglish/Hindi lyrics for: ${trackName} - ${artistName}`);

        // Simplified sources that actually work
        const hinglishSources = [
            { name: 'LyricsFinder', func: () => searchLyricsFinder(trackName, artistName) },
            { name: 'Google Direct', func: () => searchGoogleDirect(trackName, artistName) },
            { name: 'QuickLyrics', func: () => searchQuickLyrics(trackName, artistName) },
            { name: 'LyricsBell', func: () => searchLyricsBell(trackName, artistName) },
        ];

        for (let i = 0; i < hinglishSources.length; i++) {
            const source = hinglishSources[i];

            if (i > 0) {
                await sleep(500);
            }

            try {
                logger.debug(`Trying source: ${source.name}`);
                const result = await source.func();

                if (result && result.plainLyrics && result.plainLyrics.length > 50) {
                    logger.info(`✅ Lyrics found from: ${result.source} (${result.language})`);
                    return result;
                }
            } catch (error) {
                logger.debug(`❌ ${source.name} failed`);
                continue;
            }
        }

        return null;
    } catch (error) {
        logger.error('Hinglish lyrics search error', error);
        return null;
    }
}

/**
 * Check if song is likely Hindi/Bollywood
 */
function isIndianSong(trackName, artistName) {
    const indianArtists = [
        'arjit', 'arijit', 'kumar', 'khan', 'kapoor', 'singh', 'sharma', 'rai', 'bachchan',
        'lata', 'asha', 'sonu', 'shreya', 'sunidhi', 'neha', 'atif', 'badshah', 'diljit',
        'guru', 'yo yo', 'honey', 'tulsi', 'kailash', 'jubin', 'darshan', 'steve',
        'kk', 'udit', 'alka', 'kishore', 'rafi', 'mukesh', 'hemant', 'pritam'
    ];

    const searchText = `${trackName} ${artistName}`.toLowerCase();
    return indianArtists.some(artist => searchText.includes(artist));
}

/**
 * Main function to search lyrics from multiple sources
 */
async function searchLyrics(trackName, artistName, albumName = null, duration = null) {
    logger.debug(`Searching lyrics for: ${trackName} by ${artistName}`);

    try {
        // Try standard sources first
        const standardResults = await Promise.allSettled([
            searchLRCLIB(trackName, artistName, albumName, duration),
            searchLyricsOvh(artistName, trackName)
        ]);

        // Check standard sources
        for (const result of standardResults) {
            if (result.status === 'fulfilled' && result.value && result.value.plainLyrics) {
                logger.info(`Lyrics found from ${result.value.source}`);
                return result.value;
            }
        }

        // Always try Hinglish sources for better coverage
        logger.debug('Trying Hinglish sources...');
        const hinglishResult = await searchHinglishLyrics(trackName, artistName);
        if (hinglishResult) {
            return hinglishResult;
        }

        // Last resort: try with just the track name
        if (artistName && artistName !== 'Unknown') {
            logger.debug('Trying with track name only...');
            const trackOnlyResult = await searchHinglishLyrics(trackName, '');
            if (trackOnlyResult) {
                return trackOnlyResult;
            }
        }

        logger.warn(`No lyrics found for: ${trackName} by ${artistName}`);
        return null;

    } catch (error) {
        logger.error('Search lyrics error:', error);
        return null;
    }
}

module.exports = {
    searchLyrics,
    searchLRCLIB,
    searchLyricsOvh,
    searchHinglishLyrics,
    containsHindi,
    containsHinglish,
    detectLyricsLanguage,
    isIndianSong
};