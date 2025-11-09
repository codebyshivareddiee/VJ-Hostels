const axios = require('axios');
const OpenAI = require('openai');

// Initialize OpenAI client if API key is available
let openaiClient = null;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (openaiApiKey && openaiApiKey !== 'your-api-key-here') {
    try {
        openaiClient = new OpenAI({ apiKey: openaiApiKey });
        console.log('✅ OpenAI client initialized for offensive content detection');
    } catch (error) {
        console.error('⚠️ Failed to initialize OpenAI client:', error.message);
    }
} else {
    console.log('⚠️ OPENAI_API_KEY not set - using keyword-only detection');
}

// Offensive emojis list
const offensive_emojis = [
    "🍆", "🍑", "🍌", "🌮", "🍒", "💦", "👅", "👄", "👙", "🩲", "🩳", "💋", "👠", "👢", "👗", "🤤", "😏", "😈", "😩", "🥵", "🥶", "🙈", "👁️‍🗨️",
    "🖕", "🤬", "😡", "🤢", "🤮", "😤", "💩", "🙄", "😒", "😠", "👎", "🤯", "😾", "😿", "👿",
    "🔪", "🩸", "⚰️", "⚱️", "💣", "🔫", "🧨", "🧠", "🪓", "🧷", "🧯", "🗡️", "💀", "☠️", "🦴",
    "🍺", "🍻", "🍷", "🍸", "🍹", "🥂", "🥃", "🚬", "💉", "💊", "🪩", "🧪", "🧴", "🍾", "🔞",
    "🙃", "😹", "🤡", "😼", "🐷", "🐽", "👹", "👺", "🤠", "🤪", "🫦", "💀",
    "🏴‍☠️", "🚫", "☢️", "☣️", "⚠️", "⛔", "🏴", "🪖", "🪆", "🏹", "🕋", "⛪", "🕍", "🕉️", "✡️", "☪️", "✝️", "🔯",
    "🧑‍🦽", "🧑‍🦯", "🧑‍🦼", "🧍‍♂️", "🧍‍♀️", "🤰", "🤱", "🧓", "👵", "👴",
    "🏻", "🏼", "🏽", "🏾", "🏿"
];

// Offensive words list
const offensive_words = [
    'fuck', 'fucking', 'fucker', 'fucked', 'motherfucker',
    'shit', 'shitty', 'bullshit',
    'bitch', 'bitches', 'bitching',
    'asshole', 'assholes',
    'bastard', 'bastards',
    'crap', 'crappy',
    'dick', 'dickhead',
    'piss', 'pissed', 'pissing',
    'cock', 'cocks',
    'pussy', 'pussies',
    'slut', 'sluts', 'slutty',
    'whore', 'whores',
    'fag', 'faggot', 'fags',
    'nigger', 'nigga',
    'cunt', 'cunts',
    'prick', 'pricks',
    'damn', 'damned',
    'hell'
];

/**
 * Check if text contains offensive emojis
 */
function containsOffensiveEmoji(text) {
    if (!text) return false;
    for (const emoji of offensive_emojis) {
        if (text.includes(emoji)) {
            return true;
        }
    }
    return false;
}

/**
 * Check if text contains offensive words
 */
function containsOffensiveWord(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase().trim();
    
    // Don't flag empty or very short text
    if (lowerText.length < 3) return false;
    
    for (const word of offensive_words) {
        // Use word boundary to match whole words only
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lowerText)) {
            console.log(`Offensive word detected: ${word} in "${text}"`);
            return true;
        }
    }
    return false;
}

/**
 * Check if text is gibberish/random text
 * Detects patterns like "dgrthebtr", "asdfghjkl", etc.
 */
function isGibberish(text) {
    if (!text || text.trim().length < 5) return false;
    
    const cleanText = text.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanText.length < 5) return false;
    
    // Check for keyboard patterns
    const keyboardPatterns = [
        'qwerty', 'asdfgh', 'zxcvbn', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
        'abcdef', 'ghijkl', 'mnopqr', 'stuvwx'
    ];
    
    for (const pattern of keyboardPatterns) {
        if (cleanText.includes(pattern)) {
            return true;
        }
    }
    
    // Check for repeated characters (e.g., "aaaaaaa", "hahahaha")
    const repeatedCharPattern = /(.)\1{4,}/;
    if (repeatedCharPattern.test(cleanText)) {
        return true;
    }
    
    // Check for lack of vowels (gibberish often has few vowels)
    const vowels = cleanText.match(/[aeiou]/g);
    const vowelRatio = vowels ? vowels.length / cleanText.length : 0;
    if (vowelRatio < 0.15 && cleanText.length > 8) {
        return true;
    }
    
    return false;
}

/**
 * Use OpenAI Moderation API for fast ML-based detection
 * Returns { isOffensive: boolean, confidence: number } or null if unavailable
 */
async function checkWithOpenAI(text) {
    if (!openaiClient) {
        return null;
    }

    try {
        const startTime = Date.now();
        const response = await openaiClient.moderations.create({
            model: "omni-moderation-latest",
            input: text,
        });

        const result = response.results[0];
        const isFlagged = result.flagged;
        
        // Get highest category score for confidence
        const scores = result.category_scores;
        const maxScore = Math.max(
            scores.harassment || 0,
            scores['harassment/threatening'] || 0,
            scores.hate || 0,
            scores['hate/threatening'] || 0,
            scores['self-harm'] || 0,
            scores['self-harm/instructions'] || 0,
            scores['self-harm/intent'] || 0,
            scores.sexual || 0,
            scores['sexual/minors'] || 0,
            scores.violence || 0,
            scores['violence/graphic'] || 0
        );

        const elapsed = Date.now() - startTime;
        console.log(`⚡ OpenAI moderation check completed in ${elapsed}ms - Flagged: ${isFlagged}`);

        return { isOffensive: isFlagged, confidence: maxScore };
    } catch (error) {
        console.error('❌ OpenAI moderation error:', error.message);
        return null;
    }
}

/**
 * Main function to check for offensive content
 * Returns { isOffensive: boolean, reason: string }
 */
async function checkOffensiveContent(text) {
    try {
        const startTime = Date.now();
        console.log('🔍 [Server] Checking text for offensive content:', text?.substring(0, 50));
        
        if (!text || text.trim().length === 0) {
            return { isOffensive: false, reason: null };
        }

        // FAST checks first (instant, no API calls)
        if (containsOffensiveEmoji(text)) {
            console.log('⚠️ [Server] Offensive emoji detected (instant)');
            return { isOffensive: true, reason: 'Contains offensive emojis' };
        }

        if (containsOffensiveWord(text)) {
            console.log('⚠️ [Server] Offensive word detected (instant)');
            return { isOffensive: true, reason: 'Contains offensive language' };
        }

        if (isGibberish(text)) {
            console.log('⚠️ [Server] Gibberish text detected (instant)');
            return { isOffensive: true, reason: 'Contains gibberish or random text' };
        }

        // Use OpenAI for advanced detection (FAST - typically 200-500ms)
        if (openaiClient) {
            const openaiResult = await checkWithOpenAI(text);
            if (openaiResult && openaiResult.isOffensive) {
                const elapsed = Date.now() - startTime;
                console.log(`⚠️ [Server] OpenAI detected offensive content (total: ${elapsed}ms)`);
                return { 
                    isOffensive: true, 
                    reason: 'Contains inappropriate content',
                    confidence: openaiResult.confidence 
                };
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`✅ [Server] No offensive content detected (${elapsed}ms)`);
        return { isOffensive: false, reason: null };

    } catch (error) {
        console.error('❌ [Server] Error checking offensive content:', error);
        // On error, be lenient and allow the content
        return { isOffensive: false, reason: null };
    }
}

module.exports = {
    checkOffensiveContent,
    containsOffensiveEmoji,
    containsOffensiveWord,
    isGibberish,
    checkWithOpenAI
};
