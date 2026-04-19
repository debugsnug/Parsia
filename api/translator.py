"""
translator.py — English story → Parsia DSL (.story format)

Uses the Google Gemini API (gemini-1.5-flash) to translate
a plain-English story description into valid Parsia source code.

Usage:
    from translator import translate_to_parsia
    parsia_code = translate_to_parsia("A knight enters the castle and greets the queen.")

Environment variable required:
    GEMINI_API_KEY — your Google Gemini API token
"""

import os
import re
import requests

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

# ---------------------------------------------------------------------------
# Strict system prompt — teaches the model the full Parsia grammar
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a compiler front-end that converts English story descriptions into \
Parsia DSL source code. Parsia is a strict, whitespace-sensitive scripting \
language for animation sequences.

═══════════════════════════════════════════════
PARSIA GRAMMAR RULES  (follow EXACTLY)
═══════════════════════════════════════════════

1. DECLARATIONS  — must appear before any action that uses them.
   SCENE <SceneName>
   CHARACTER <CharacterName>
   task <taskname>:
       <body>

2. STAGE ACTIONS
   ENTER <CharacterName>
   EXIT <CharacterName>
   <CharacterName> SAY "<text>"
   <CharacterName> MOVE LEFT|RIGHT|UP|DOWN <integer>
   <CharacterName> EMOTE happy|sad|angry|scared|surprised|thinking|wave|jump
   WAIT <seconds>

3. VARIABLES & CONTROL FLOW  (Python-style 4-space indentation)
   let <var> = <expr>
   set <var> = <expr>
   if <condition>:
       <body>
   else:
       <body>
   loop <integer>:
       <body>
   repeat:
       <body>
   until <condition>
   do <taskname>
   return <value>
   print <value>

═══════════════════════════════════════════════
STRICT KEYWORD RULES
═══════════════════════════════════════════════
• SCENE, CHARACTER, ENTER, EXIT, SAY, MOVE, EMOTE, WAIT, LOOP — ALL CAPS.
• task, let, set, if, else, loop, repeat, until, do, return, print — lowercase.
• EMOTE MUST be followed by exactly one emotion: happy sad angry scared surprised thinking wave jump. Example: 'Hero EMOTE happy' (do NOT omit the emotion!)
• MOVE directions must be one of: LEFT RIGHT UP DOWN
• Character names must match exactly as declared with CHARACTER.
• A character cannot SAY, MOVE, or EMOTE before ENTER, and cannot act after EXIT.
• No blank lines inside indented blocks.
• Output ONLY the raw Parsia source — no markdown fences, no explanations.
• EVERY line inside the scene MUST start with a valid keyword or a character name followed by a valid keyword (SAY, EMOTE, MOVE). Do NOT output a single character's name on a line by itself.

═══════════════════════════════════════════════
EXAMPLE
═══════════════════════════════════════════════
Input:
  In a dark forest, a hero arrives, says hello, feels happy, then leaves.

Output:
SCENE DarkForest
CHARACTER Hero

ENTER Hero
Hero SAY "Hello"
Hero EMOTE happy
EXIT Hero
═══════════════════════════════════════════════
Now translate the following English story into Parsia DSL.\
"""


def _build_prompt(english_story: str) -> str:
    """Combine system prompt with user story."""
    return (
        f"{SYSTEM_PROMPT}\n\n"
        f"English story:\n{english_story.strip()}\n\n"
        f"Parsia DSL output:"
    )


def _strip_fences(text: str) -> str:
    """Remove markdown code fences if the model emits them anyway."""
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())
    text = re.sub(r"\n?```$", "", text.strip())
    return text.strip()


def _local_translate(english_story: str) -> str:
    """
    Rule-based fallback translator — works without any API token.
    Extracts names, dialogue and emotes from the English text.
    """
    import string

    text = english_story.strip()
    sentences = re.split(r'(?<=[.!?])\s+', text)

    # ── Extract proper nouns (capitalized words not at sentence start) ──
    all_words = text.split()
    names: list[str] = []
    seen: set[str] = set()
    skip = {'I', 'In', 'The', 'A', 'An', 'At', 'On', 'It', 'He', 'She', 'They',
            'His', 'Her', 'Then', 'And', 'But', 'So', 'When', 'After', 'Before',
            'Suddenly', 'Finally', 'Meanwhile', 'Later', 'Soon', 'Once', 'There'}
    for i, w in enumerate(all_words):
        clean = w.strip(string.punctuation)
        if (clean and clean[0].isupper() and len(clean) > 2
                and clean not in skip and clean.isalpha()):
            if clean not in seen:
                seen.add(clean)
                names.append(clean)
        if len(names) >= 4:
            break

    # Default characters if none found
    if not names:
        names = ['Hero', 'Villain']

    # ── Scene name from first capitalised noun phrase ──
    scene_match = re.search(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', text)
    scene = re.sub(r'\s+', '', scene_match.group(1)) if scene_match else 'MainScene'
    if scene in names:
        scene = 'MainScene'

    # ── Detect quoted dialogue ──
    quotes = re.findall(r'"([^"]+)"', text)
    if not quotes:
        quotes = re.findall(r"'([^']+)'", text)
    if not quotes:
        # Pull last full sentence as fallback dialogue
        last = sentences[-1].strip().rstrip('.!?') if sentences else 'Hello'
        quotes = [last[:60]]

    # ── Detect emotes ──
    emote_map = {
        'happy': ['happy', 'smile', 'laugh', 'joy', 'cheer', 'delight'],
        'sad': ['sad', 'cry', 'weep', 'sorrow', 'grief', 'mourn'],
        'angry': ['angry', 'rage', 'furious', 'mad', 'shout', 'yell'],
        'scared': ['scared', 'fear', 'terrified', 'afraid', 'horror'],
        'surprised': ['surprised', 'shock', 'astonish', 'startl', 'amaz'],
        'thinking': ['think', 'ponder', 'wonder', 'consider', 'reflect'],
        'wave': ['wave', 'greet', 'farewell', 'goodbye', 'welcome'],
        'jump': ['jump', 'leap', 'spring', 'bounce', 'hop'],
    }
    text_lower = text.lower()
    detected_emotes: list[str] = []
    for emote, keywords in emote_map.items():
        if any(k in text_lower for k in keywords):
            detected_emotes.append(emote)

    # ── Build Parsia source ──
    lines: list[str] = [f'SCENE {scene}']
    for name in names:
        lines.append(f'CHARACTER {name}')
    lines.append('')

    char1 = names[0]
    char2 = names[1] if len(names) > 1 else None

    lines.append(f'ENTER {char1}')
    if char2:
        lines.append(f'ENTER {char2}')
    lines.append('')

    # Dialogue — alternate between characters
    for i, q in enumerate(quotes[:4]):
        speaker = names[i % len(names)]
        safe_q = q.replace('"', "'")[:80]
        lines.append(f'{speaker} SAY "{safe_q}"')

    # Emotes
    for i, emote in enumerate(detected_emotes[:2]):
        speaker = names[i % len(names)]
        lines.append(f'{speaker} EMOTE {emote}')

    # Movement
    if len(names) >= 2:
        lines.append(f'{names[0]} MOVE RIGHT 3')
        lines.append(f'WAIT 1')
        lines.append(f'{names[1]} MOVE LEFT 2')

    lines.append('')
    if char2:
        lines.append(f'EXIT {char2}')
    lines.append(f'EXIT {char1}')

    return '\n'.join(lines)


def translate_to_parsia(english_story: str, max_new_tokens: int = 512) -> str:
    """
    Translate an English story into Parsia DSL source code.
    Uses Google Gemini when GEMINI_API_KEY is set, otherwise falls back
    to a local rule-based translator so the feature always works.
    """
    token = os.environ.get("GEMINI_API_KEY", "").strip()
    if not token:
        return _local_translate(english_story)

    prompt = _build_prompt(english_story)

    headers = {
        "Content-Type": "application/json",
    }

    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,          # low temp → deterministic, rule-following
            "maxOutputTokens": max_new_tokens
        }
    }

    url = f"{GEMINI_API_URL}?key={token}"
    response = requests.post(url, headers=headers, json=payload, timeout=30)

    if response.status_code != 200:
        raise RuntimeError(
            f"Gemini API error {response.status_code}: {response.text}"
        )

    data = response.json()

    try:
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise RuntimeError(f"Unexpected response shape from Gemini API: {data}")

    return _strip_fences(raw)
