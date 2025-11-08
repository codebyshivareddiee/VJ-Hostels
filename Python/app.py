from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from typing import Optional
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Offensive Text Detection API")

# Initialize OpenAI client (will read OPENAI_API_KEY from environment)
openai_client = None
api_key = os.getenv("OPENAI_API_KEY")
if api_key and api_key != "your-api-key-here":
    try:
        openai_client = OpenAI(api_key=api_key)
        print("✅ OpenAI client initialized successfully")
    except Exception as e:
        print(f"⚠️ OpenAI initialization failed: {e}")
        print("⚠️ Falling back to keyword-based detection only")
else:
    print("⚠️ OPENAI_API_KEY not set in .env file")
    print("⚠️ Using keyword-based detection only")

# Allow local frontend development origin; in production configure properly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CheckRequest(BaseModel):
    text: str


class CheckResponse(BaseModel):
    offensive: bool
    confidence: float
    sanitized_text: str


# Emoji list to sanitize (from user requirements)
offensive_emojis = [
    "🍆","🍑","🍌","🌮","🍒","💦","👅","👄","👙","🩲","🩳","💋","👠","👢","👗","🤤","😏","😈","😩","🥵","🥶","🙈","👁️‍🗨️",
    "🖕","🤬","😡","🤢","🤮","😤","💩","🙄","😒","😠","👎","🤯","😾","😿","👿",
    "🔪","🩸","⚰️","⚱️","💣","🔫","🧨","🧠","🪓","🧷","🧯","🗡️","💀","☠️","🦴",
    "🍺","🍻","🍷","🍸","🍹","🥂","🥃","🚬","💉","💊","🪩","🧪","🧴","🍾","🔞",
    "🙃","😹","🤡","😼","🐷","🐽","👹","👺","🤠","🤪","🫦","💀",
    "🏴‍☠️","🚫","☢️","☣️","⚠️","⛔","🏴","🪖","🪆","🏹","🕋","⛪","🕍","🕉️","✡️","☪️","✝️","🔯",
    "🧑‍🦽","🧑‍🦯","🧑‍🦼","🧍‍♂️","🧍‍♀️","🤰","🤱","🧓","👵","👴",
    "🏻","🏼","🏽","🏾","🏿"
]

# Basic offensive words for additional checking (using more specific patterns to avoid false positives)
offensive_words = [
    'fuck', 'fucking', 'fucker', 'fucked', 'motherfucker', 'fuckyou',
    'shit', 'shitty', 'bullshit',
    'bitch', 'bitches', 'bitching',
    'asshole', 'assholes',  # More specific than just 'ass' to avoid false positives
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
]


# No need for local model anymore - using OpenAI


def contains_offensive_word(text: str) -> bool:
    """Check if text contains offensive words using word boundaries to avoid false positives"""
    if not text or len(text.strip()) < 3:
        return False
    lower_text = text.lower().strip()
    import re
    for word in offensive_words:
        # Use word boundary to match whole words only
        # This prevents "good" from matching if "goo" was in list, or "class" from matching "ass"
        pattern = r'\b' + re.escape(word) + r'\b'
        match = re.search(pattern, lower_text)
        if match:
            print(f"Offensive word detected: '{word}' in text: '{text[:50]}...'")
            return True
    return False


def contains_offensive_emoji(text: str) -> bool:
    """Check if text contains any offensive emoji"""
    if not text:
        return False
    for emoji in offensive_emojis:
        if emoji in text:
            print(f"Offensive emoji detected: '{emoji}' in text")
            return True
    return False


def sanitize_text(text: str) -> str:
    # Remove offensive emojis by simple replacement
    sanitized = text
    for em in offensive_emojis:
        sanitized = sanitized.replace(em, '')
    # Collapse multiple spaces
    sanitized = ' '.join(sanitized.split())
    return sanitized


def predict_offensive_openai(text: str) -> Optional[dict]:
    """Use OpenAI Moderation API to detect offensive content"""
    if openai_client is None:
        return None
    
    try:
        response = openai_client.moderations.create(
            model="omni-moderation-latest",
            input=text
        )
        
        result = response.results[0]
        
        # Check if any category is flagged
        is_flagged = result.flagged
        
        # Get highest category score for confidence
        category_scores = result.category_scores
        max_score = max([
            category_scores.harassment,
            category_scores.harassment_threatening,
            category_scores.hate,
            category_scores.hate_threatening,
            category_scores.self_harm,
            category_scores.self_harm_instructions,
            category_scores.self_harm_intent,
            category_scores.sexual,
            category_scores.sexual_minors,
            category_scores.violence,
            category_scores.violence_graphic
        ])
        
        return {"offensive": is_flagged, "confidence": float(max_score)}
    
    except Exception as e:
        print(f"Error during OpenAI moderation: {e}")
        import traceback
        traceback.print_exc()
        return None


@app.on_event("startup")
def startup_event():
    print("🚀 Server starting up...")
    if openai_client:
        print("✅ Using OpenAI Moderation API")
    else:
        print("⚠️ Using keyword-only detection (OpenAI not configured)")


@app.post("/check_offensive", response_model=CheckResponse)
def check_offensive(req: CheckRequest):
    text = req.text or ""
    
    # FIRST: Check for offensive emojis (highest priority)
    has_offensive_emoji = contains_offensive_emoji(text)
    
    # Sanitize emojis for further checking
    sanitized = sanitize_text(text)
    
    # SECOND: Check for offensive keywords
    has_offensive_word = contains_offensive_word(text)
    
    # THIRD: Use OpenAI Moderation API for accurate ML-based detection
    pred = predict_offensive_openai(sanitized)
    
    if pred is not None:
        is_offensive_ml = bool(pred.get('offensive', False))
        confidence_ml = float(pred.get('confidence', 0.0))
        
        # If ANY check flags it (emoji OR keyword OR ML), consider offensive
        is_offensive = has_offensive_emoji or has_offensive_word or is_offensive_ml
        
        # Use highest confidence: emoji/keyword = 1.0, otherwise ML confidence
        confidence = 1.0 if (has_offensive_emoji or has_offensive_word) else confidence_ml
        
        print(f"Text: '{text[:50]}...' | Emoji: {has_offensive_emoji} | Keywords: {has_offensive_word} | ML: {is_offensive_ml} ({confidence_ml:.2f}) | Final: {is_offensive}")
        
        return {"offensive": is_offensive, "confidence": confidence, "sanitized_text": sanitized}
    else:
        # If model not available, fallback to keyword and emoji detection
        is_offensive = has_offensive_emoji or has_offensive_word
        print(f"ML unavailable | Emoji: {has_offensive_emoji} | Keywords: {has_offensive_word} | Final: {is_offensive}")
        return {"offensive": is_offensive, "confidence": 1.0 if is_offensive else 0.0, "sanitized_text": sanitized}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
