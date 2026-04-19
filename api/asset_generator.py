"""
asset_generator.py — Generate visual assets for a Parsia scene.

Uses the Hugging Face Inference API (Stable Diffusion v1-5) to produce:
  • One background image per SCENE
  • One front-facing character sprite per CHARACTER

Seed system
-----------
Each character's seed is derived deterministically from its name so that
the same character always produces the same base appearance across calls.
The scene background seed is derived from the scene name.

    seed = _name_to_seed("Hero")   # → stable int, same every time

Callers may also supply an explicit global seed_offset to shift the
entire set (useful for "regenerate with variation" UX).

Environment variable required:
    HF_API_TOKEN — your Hugging Face API token

Returned structure (from generate_assets):
{
  "scene":      "<scene_name>",
  "background": {"seed": int, "image_b64": "<base64 PNG>"},
  "characters": {
      "<name>": {"seed": int, "image_b64": "<base64 PNG>"},
      ...
  }
}
"""

import base64
import hashlib
import os
import concurrent.futures
from typing import Optional

import requests

# ---------------------------------------------------------------------------
# Model endpoint
# ---------------------------------------------------------------------------

HF_SD_URL = (
    "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5"
)

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

BACKGROUND_PROMPT = (
    "A wide-angle cartoon storybook background scene of {scene_desc}, "
    "vibrant colors, flat illustration style, no characters, no text, "
    "highly detailed, child-friendly animation background art"
)

BACKGROUND_NEGATIVE = (
    "people, characters, text, watermark, blurry, photorealistic, dark, scary"
)

CHARACTER_PROMPT = (
    "A front-facing full-body cartoon character portrait of {char_desc}, "
    "centered, white background, clean outlines, flat colors, "
    "storybook illustration style, no shadows, no background elements"
)

CHARACTER_NEGATIVE = (
    "background, scenery, multiple characters, text, watermark, blurry, "
    "cropped, side view, back view, realistic, photographic"
)

# ---------------------------------------------------------------------------
# Seed utilities
# ---------------------------------------------------------------------------

_SEED_MODULUS = 2**32  # SD seeds are 32-bit unsigned ints


def _name_to_seed(name: str) -> int:
    """
    Derive a deterministic 32-bit seed from a name string.
    Same name → same seed, every time, regardless of call order.
    """
    digest = hashlib.sha256(name.lower().strip().encode()).digest()
    # Take the first 4 bytes as a big-endian unsigned int
    return int.from_bytes(digest[:4], "big") % _SEED_MODULUS


def _apply_offset(seed: int, offset: int) -> int:
    return (seed + offset) % _SEED_MODULUS


# ---------------------------------------------------------------------------
# Scene / character name → natural-language description
# ---------------------------------------------------------------------------

def _scene_to_desc(scene_name: str) -> str:
    """
    CamelCase / PascalCase scene name → spaced English phrase.
    'DarkForest' → 'dark forest'
    'AncientCastle' → 'ancient castle'
    """
    import re
    spaced = re.sub(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", scene_name)
    return spaced.lower()


def _char_to_desc(char_name: str) -> str:
    """
    CamelCase character name → natural English.
    'HeroKnight' → 'hero knight'
    """
    import re
    spaced = re.sub(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", char_name)
    return spaced.lower()


# ---------------------------------------------------------------------------
# Single image generation
# ---------------------------------------------------------------------------

def _generate_image(
    prompt: str,
    negative_prompt: str,
    seed: int,
    token: str,
    width: int = 512,
    height: int = 512,
) -> str:
    """
    Call the HF Inference API and return a base64-encoded PNG string.

    Raises:
        RuntimeError on non-200 responses.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": prompt,
        "parameters": {
            "negative_prompt": negative_prompt,
            "num_inference_steps": 30,
            "guidance_scale": 7.5,
            "width": width,
            "height": height,
            "seed": seed,
        },
        "options": {
            "wait_for_model": True,
        },
    }

    response = requests.post(HF_SD_URL, headers=headers, json=payload, timeout=180)

    if response.status_code != 200:
        raise RuntimeError(
            f"HF Stable Diffusion API error {response.status_code}: {response.text[:400]}"
        )

    # HF returns raw PNG bytes for image generation models
    return base64.b64encode(response.content).decode("utf-8")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_assets(
    scene_name: str,
    characters: list[str],
    seed_offset: int = 0,
    background_width: int = 768,
    background_height: int = 512,
    sprite_width: int = 256,
    sprite_height: int = 512,
) -> dict:
    """
    Generate a background image and character sprites for a Parsia scene.

    Args:
        scene_name:        SCENE identifier from the .story file.
        characters:        List of CHARACTER names from the .story file.
        seed_offset:       Integer added to every seed (for variation regeneration).
        background_width:  Width of the background image in pixels.
        background_height: Height of the background image in pixels.
        sprite_width:      Width of each character sprite in pixels.
        sprite_height:     Height of each character sprite in pixels.

    Returns:
        Dict with keys "scene", "background", and "characters".

    Raises:
        EnvironmentError: HF_API_TOKEN is not set.
        RuntimeError:     The HF API returned an error for any asset.
    """
    token = os.environ.get("HF_API_TOKEN", "").strip()
    if not token:
        raise EnvironmentError(
            "HF_API_TOKEN environment variable is not set. "
            "Get a token from https://huggingface.co/settings/tokens"
        )

    if not characters:
        raise ValueError("At least one CHARACTER name must be provided.")

    # ── Build seeds ──────────────────────────────────────────────────────────
    bg_seed = _apply_offset(_name_to_seed(scene_name), seed_offset)
    char_seeds = {
        name: _apply_offset(_name_to_seed(name), seed_offset)
        for name in characters
    }

    # ── Build prompts ────────────────────────────────────────────────────────
    bg_prompt = BACKGROUND_PROMPT.format(scene_desc=_scene_to_desc(scene_name))
    char_prompts = {
        name: CHARACTER_PROMPT.format(char_desc=_char_to_desc(name))
        for name in characters
    }

    # ── Generate all images in parallel ─────────────────────────────────────
    # Task list: (key, prompt, negative, seed, width, height)
    tasks: list[tuple] = [
        (
            "__background__",
            bg_prompt,
            BACKGROUND_NEGATIVE,
            bg_seed,
            background_width,
            background_height,
        )
    ] + [
        (
            name,
            char_prompts[name],
            CHARACTER_NEGATIVE,
            char_seeds[name],
            sprite_width,
            sprite_height,
        )
        for name in characters
    ]

    results: dict[str, str] = {}
    errors: list[str] = []

    def _run(task):
        key, prompt, neg, seed, w, h = task
        try:
            img_b64 = _generate_image(prompt, neg, seed, token, w, h)
            return key, img_b64, None
        except Exception as exc:
            return key, None, str(exc)

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(tasks)) as pool:
        futures = [pool.submit(_run, t) for t in tasks]
        for future in concurrent.futures.as_completed(futures):
            key, img_b64, err = future.result()
            if err:
                errors.append(f"{key}: {err}")
            else:
                results[key] = img_b64

    if errors:
        raise RuntimeError(
            f"Asset generation failed for {len(errors)} item(s):\n" + "\n".join(errors)
        )

    # ── Assemble response ────────────────────────────────────────────────────
    return {
        "scene": scene_name,
        "background": {
            "seed": bg_seed,
            "prompt": bg_prompt,
            "image_b64": results["__background__"],
        },
        "characters": {
            name: {
                "seed": char_seeds[name],
                "prompt": char_prompts[name],
                "image_b64": results[name],
            }
            for name in characters
        },
    }
