import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const DEFAULT_API = (import.meta.env.VITE_PY_API_URL) ? import.meta.env.VITE_PY_API_URL : 'http://localhost:8001';

const offensive_emojis = [
    "🍆","🍑","🍌","🌮","🍒","💦","👅","👄","👙","🩲","🩳","💋","👠","👢","👗","🤤","😏","😈","😩","🥵","🥶","🙈","👁️‍🗨️",
    "🖕","🤬","😡","🤢","🤮","😤","💩","🙄","😒","😠","👎","🤯","😾","😿","👿",
    "🔪","🩸","⚰️","⚱️","💣","🔫","🧨","🧠","🪓","🧷","🧯","🗡️","💀","☠️","🦴",
    "🍺","🍻","🍷","🍸","🍹","🥂","🥃","🚬","💉","💊","🪩","🧪","🧴","🍾","🔞",
    "🙃","😹","🤡","😼","🐷","🐽","👹","👺","🤠","🤪","🫦","💀",
    "🏴‍☠️","🚫","☢️","☣️","⚠️","⛔","🏴","🪖","🪆","🏹","🕋","⛪","🕍","🕉️","✡️","☪️","✝️","🔯",
    "🧑‍🦽","🧑‍🦯","🧑‍🦼","🧍‍♂️","🧍‍♀️","🤰","🤱","🧓","👵","👴",
    "🏻","🏼","🏽","🏾","🏿"
];

// Basic offensive words list for client-side pre-check (using more specific patterns)
const offensive_words = [
    'fuck', 'fucking', 'fucker', 'fucked', 'motherfucker',
    'shit', 'shitty', 'bullshit',
    'bitch', 'bitches', 'bitching',
    'asshole', 'assholes', // More specific than just 'ass'
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
    'prick', 'pricks'
];

function containsOffensiveEmoji(text) {
    if (!text) return false;
    for (const em of offensive_emojis) {
        if (text.includes(em)) return true;
    }
    return false;
}

function containsOffensiveWord(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase().trim();
    
    // Don't flag empty or very short text
    if (lowerText.length < 3) return false;
    
    for (const word of offensive_words) {
        // Use word boundary to match whole words only
        // This prevents "good" from matching "goo" or "class" from matching "ass"
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lowerText)) {
            console.log(`Offensive word detected: ${word} in "${text}"`);
            return true;
        }
    }
    return false;
}

// Standalone function to check offensive content (call this on submit)
export const checkOffensiveContent = async (text) => {
    console.log('🔍 [OffensiveCheck] Checking text on submit:', text?.substring(0, 50));
    
    if (!text || text.trim().length === 0) {
        return { isOffensive: false, confidence: 0 };
    }

    // First check client-side
    const hasEmoji = containsOffensiveEmoji(text);
    const hasWord = containsOffensiveWord(text);
    
    if (hasEmoji || hasWord) {
        console.log('⚠️ [OffensiveCheck] Client-side detection - Offensive content found');
        return { isOffensive: true, confidence: 1.0, source: 'client' };
    }

    // Then check with API
    try {
        console.log('🔍 [OffensiveCheck] Calling API...');
        const res = await axios.post(`${DEFAULT_API}/check_offensive`, 
            { text: text },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        const data = res.data;
        console.log('✅ [OffensiveCheck] API Response:', data);
        
        return { 
            isOffensive: !!data.offensive, 
            confidence: data.confidence || 0,
            sanitized: data.sanitized_text,
            source: 'api'
        };
    } catch (err) {
        console.error('❌ [OffensiveCheck] API Error:', err);
        // If API fails, use client-side result
        return { isOffensive: hasEmoji || hasWord, confidence: hasEmoji || hasWord ? 1.0 : 0, source: 'fallback' };
    }
};

const OffensiveTextInput = ({ value, onChange, placeholder, rows = 4, name, disabled }) => {
    const [text, setText] = useState(value || '');

    useEffect(() => {
        setText(value || '');
    }, [value]);

    const handleChange = (e) => {
        const v = e.target.value;
        setText(v);
        // Just update the text, no validation here
        if (onChange) {
            onChange(v);
        }
    };

    return (
        <div>
            <textarea
                name={name}
                className="form-control"
                value={text}
                onChange={handleChange}
                placeholder={placeholder}
                rows={rows}
                disabled={disabled}
            />
        </div>
    );
};

export default OffensiveTextInput;
