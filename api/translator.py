"""
translator.py — English story → Parsia DSL (.story format)

Uses the Google Gemini API (gemini-2.5-flash) to translate
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
import story_compiler as compiler

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
• Include exactly one SCENE declaration.
• Include every CHARACTER declaration before actions.
• Every character that performs an action MUST be ENTERed before their first action.
• Every entered character should EXIT by the end unless the story explicitly says they stay.
• Keep output faithful to user story events and ordering.
• No blank lines inside indented blocks.
• Output ONLY the raw Parsia source — no markdown fences, no explanations.

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

REPAIR_PROMPT = """\
You are repairing Parsia DSL code so it compiles successfully.

Output only corrected Parsia source code (no markdown, no explanation).
Keep the same story intent, characters, and scene as much as possible.
Fix only what is needed for grammar/semantic correctness.

Original English story:
{story}

Current broken Parsia code:
{broken_source}

Compiler/semantic error:
{error}

Return corrected Parsia DSL now:
"""

ENRICH_PROMPT = """\
You are improving Parsia DSL coverage for a story.

The current Parsia code compiles, but it misses story details.
Return improved Parsia DSL that still compiles.

Rules:
- Keep exactly one SCENE and valid CHARACTER declarations.
- Keep story order.
- Include meaningful actions for major events in the story.
- If the story has dialogue cues (said/replied/asked), include matching SAY lines.
- Ensure important named characters are ENTERed before acting.
- Keep code concise but complete; avoid inventing unrelated events.
- Output raw Parsia source only.

Original story:
{story}

Current Parsia source:
{source}

Detected coverage gaps:
{issues}

Return improved Parsia DSL now:
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


def _normalize_source(text: str) -> str:
    """Normalize model output while preserving significant indentation."""
    text = _strip_fences(text).replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.rstrip() for ln in text.split("\n")]
    return "\n".join(lines).strip()


def _extract_gemini_text(data: dict) -> str:
    """Extract first text candidate from Gemini response."""
    candidates = data.get("candidates") or []
    for cand in candidates:
        parts = (cand.get("content") or {}).get("parts") or []
        for part in parts:
            txt = part.get("text")
            if txt and txt.strip():
                return txt

    pf = data.get("promptFeedback")
    if pf:
        raise RuntimeError(f"Gemini returned no text candidate. promptFeedback={pf}")
    raise RuntimeError(f"Unexpected response shape from Gemini API: {data}")


def _call_gemini(prompt: str, token: str, max_new_tokens: int, temperature: float) -> str:
    """Call Gemini and return normalized text output."""
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_new_tokens,
        }
    }

    url = f"{GEMINI_API_URL}?key={token}"
    response = requests.post(url, headers=headers, json=payload, timeout=45)

    if response.status_code != 200:
        raise RuntimeError(f"Gemini API error {response.status_code}: {response.text}")

    data = response.json()
    return _normalize_source(_extract_gemini_text(data))


def _validate_parsia_source(source: str) -> tuple[bool, str]:
    """Compile translated source to ensure parser + semantic correctness."""
    try:
        compiler.compile_source(source)
        return True, ""
    except (compiler.LexerError, compiler.ParseError, compiler.SemanticError, compiler.RuntimeError_) as exc:
        return False, str(exc)
    except Exception as exc:
        return False, f"Unexpected compile validation error: {exc}"


def _build_repair_prompt(story: str, broken_source: str, error: str) -> str:
    return REPAIR_PROMPT.format(
        story=story.strip(),
        broken_source=broken_source.strip(),
        error=error.strip(),
    )


def _extract_name_candidates(text: str) -> list[str]:
    """Extract probable character names from narrative text."""
    import string

    text_no_quotes = re.sub(r'"[^"]*"|\'[^\']*\'', ' ', text)
    names: list[str] = []
    seen: set[str] = set()

    for m in re.finditer(r'\bnamed\s+([A-Z][a-zA-Z]+)\b', text_no_quotes):
        n = m.group(1)
        if n not in seen:
            names.append(n)
            seen.add(n)

    skip = {
        'I', 'In', 'The', 'A', 'An', 'At', 'On', 'It', 'He', 'She', 'They',
        'His', 'Her', 'Then', 'And', 'But', 'So', 'When', 'After', 'Before',
        'Suddenly', 'Finally', 'Meanwhile', 'Later', 'Soon', 'Once', 'There',
        'Hello', 'Hi', 'Hey', 'Thanks', 'Goodbye', 'Bye', 'Castle', 'Forest',
        'City', 'Village', 'Desert', 'Mountain', 'Ocean', 'Sea', 'Moonlit',
        'Courtyard', 'Fountain', 'Stars', 'Dawn', 'Perhaps'
    }

    for w in text_no_quotes.split():
        clean = w.strip(string.punctuation)
        if not clean or clean in seen or clean in skip:
            continue
        if clean[0].isupper() and len(clean) > 2 and clean.isalpha():
            names.append(clean)
            seen.add(clean)
        if len(names) >= 6:
            break

    return names


def _count_story_dialogue_cues(text: str) -> int:
    return len(re.findall(r'\b(said|replied|asked|whispered|murmured|shouted|told)\b', text.lower()))


def _count_source_actions(source: str) -> dict:
    lines = [ln.strip() for ln in source.splitlines() if ln.strip()]
    return {
        "enter": sum(1 for ln in lines if ln.startswith("ENTER ")),
        "exit": sum(1 for ln in lines if ln.startswith("EXIT ")),
        "say": sum(1 for ln in lines if " SAY \"" in ln),
        "emote": sum(1 for ln in lines if " EMOTE " in ln),
        "move": sum(1 for ln in lines if " MOVE " in ln),
    }


def _coverage_issues(story: str, source: str) -> list[str]:
    """Heuristic quality checks to avoid under-generated scripts."""
    issues: list[str] = []
    action_counts = _count_source_actions(source)
    names = _extract_name_candidates(story)
    story_dialogue = _count_story_dialogue_cues(story)

    if len(names) >= 2 and action_counts["enter"] < 2:
        issues.append("At least two named characters appear in story, but fewer than two ENTER actions exist.")

    if story_dialogue >= 2 and action_counts["say"] < min(3, story_dialogue):
        issues.append("Story has multiple dialogue cues, but generated SAY actions are too few.")

    if action_counts["emote"] == 0 and re.search(r'\b(smiled|laughed|shyly|startled|thought|worried|happy|sad)\b', story.lower()):
        issues.append("Story has emotional cues, but no EMOTE actions were generated.")

    total_actions = sum(action_counts.values())
    sentence_count = max(1, len([s for s in re.split(r'(?<=[.!?])\s+', story.strip()) if s.strip()]))
    min_actions = min(10, max(4, sentence_count // 2 + 2))
    if total_actions < min_actions:
        issues.append(f"Generated action count ({total_actions}) is too low for story length ({sentence_count} sentences).")

    return issues


def _build_enrich_prompt(story: str, source: str, issues: list[str]) -> str:
    pretty = "\n".join(f"- {i}" for i in issues)
    return ENRICH_PROMPT.format(
        story=story.strip(),
        source=source.strip(),
        issues=pretty,
    )


def _local_translate(english_story: str) -> str:
    """
    Rule-based fallback translator — works without any API token.
    Extracts names, dialogue and emotes from the English text.
    """
    text = english_story.strip()
    sentences = re.split(r'(?<=[.!?])\s+', text)
    names = _extract_name_candidates(text)

    # Default characters if none found
    if not names:
        names = ['Hero', 'Villain']

    # ── Scene name heuristic from location keywords, then capitalized fallback ──
    text_lower = text.lower()
    scene = 'MainScene'
    scene_keywords = {
        'forest': 'Forest',
        'castle': 'Castle',
        'city': 'City',
        'village': 'Village',
        'desert': 'Desert',
        'mountain': 'Mountain',
        'space': 'Space',
        'lab': 'Lab',
        'school': 'School',
        'ocean': 'Ocean',
        'sea': 'Sea',
    }
    for key, value in scene_keywords.items():
        if key in text_lower:
            scene = value
            break

    if scene == 'MainScene':
        text_no_quotes = re.sub(r'"[^"]*"|\'[^\']*\'', ' ', text)
        scene_match = re.search(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', text_no_quotes)
        if scene_match:
            scene = re.sub(r'\s+', '', scene_match.group(1))
    if scene in names:
        scene = 'MainScene'

    # ── Detect quoted / implied dialogue ──
    quotes = re.findall(r'"([^"]+)"', text)
    if not quotes:
        quotes = re.findall(r"'([^']+)'", text)

    dialogue_pairs: list[tuple[str | None, str]] = []
    dialogue_re = re.compile(
        r'(?:\b([A-Z][a-zA-Z]+)\b[^.!?]{0,40})?\b(said|replied|asked|whispered|murmured|shouted)\s*:?[\s]+([^.!?]{6,140})',
        flags=re.IGNORECASE,
    )
    for m in dialogue_re.finditer(text):
        speaker = m.group(1)
        quote = m.group(3).strip(" :;,-")
        if quote:
            dialogue_pairs.append((speaker, quote))

    for _, q in dialogue_pairs:
        if q and q not in quotes:
            quotes.append(q)

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

    # Dialogue — use explicit speaker from text when available.
    for i, q in enumerate(quotes[:6]):
        speaker = None
        if i < len(dialogue_pairs):
            raw_speaker = dialogue_pairs[i][0]
            if raw_speaker in names:
                speaker = raw_speaker
        if not speaker:
            speaker = names[i % len(names)]
        safe_q = q.replace('"', "'")[:80]
        lines.append(f'{speaker} SAY "{safe_q}"')

    # Emotes
    for i, emote in enumerate(detected_emotes[:2]):
        speaker = names[i % len(names)]
        lines.append(f'{speaker} EMOTE {emote}')

    if any(k in text_lower for k in ['walked', 'walks', 'paced']):
        lines.append(f'{names[0]} MOVE RIGHT 1')
    if len(names) > 1 and any(k in text_lower for k in ['stood up', 'approached', 'moved closer']):
        lines.append(f'{names[1]} MOVE LEFT 1')
    if any(k in text_lower for k in ['together', 'until dawn', 'silence', 'pause']):
        lines.append('WAIT 1')

    # Movement
    if len(names) >= 2:
        lines.append(f'{names[0]} MOVE RIGHT 2')
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
        local = _normalize_source(_local_translate(english_story))
        local_valid, _ = _validate_parsia_source(local)
        if local_valid:
            return local
        # Deterministic minimal fallback for safety.
        safe = "\n".join([
            "SCENE MainScene",
            "CHARACTER Hero",
            "ENTER Hero",
            "Hero SAY \"Hello\"",
            "EXIT Hero",
        ])
        return safe

    try:
        candidate = _call_gemini(
            prompt=_build_prompt(english_story),
            token=token,
            max_new_tokens=max_new_tokens,
            temperature=0.15,
        )

        for _ in range(3):
            is_valid, error = _validate_parsia_source(candidate)
            if not is_valid:
                candidate = _call_gemini(
                    prompt=_build_repair_prompt(english_story, candidate, error),
                    token=token,
                    max_new_tokens=max_new_tokens,
                    temperature=0.05,
                )
                continue

            issues = _coverage_issues(english_story, candidate)
            if not issues:
                return candidate

            candidate = _call_gemini(
                prompt=_build_enrich_prompt(english_story, candidate, issues),
                token=token,
                max_new_tokens=max_new_tokens,
                temperature=0.1,
            )

        final_valid, final_error = _validate_parsia_source(candidate)
        if final_valid:
            return candidate
        error = final_error
    except Exception:
        # Fall through to deterministic fallback below.
        pass

    # Last-resort deterministic fallback if Gemini keeps failing.
    local = _normalize_source(_local_translate(english_story))
    local_valid, _ = _validate_parsia_source(local)
    if local_valid:
        return local

    raise RuntimeError("Translation could not be validated after retries")
