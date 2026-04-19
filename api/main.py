import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
except ImportError:
    pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.middleware import SlowAPIMiddleware
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    _limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
    _RATE_LIMITING = True
except ImportError:
    _limiter = None
    _RATE_LIMITING = False

try:
    import stripe as _stripe
    _stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    _STRIPE = bool(_stripe.api_key)
except ImportError:
    _stripe = None
    _STRIPE = False

import story_compiler as compiler

if __package__:
    from .translator import translate_to_parsia
    from .asset_generator import generate_assets
    from .auth import router as auth_router
else:
    # Fallback for direct execution from inside the api/ directory.
    from translator import translate_to_parsia
    from asset_generator import generate_assets
    from auth import router as auth_router

app = FastAPI(title="Parsia Compiler API", version="1.0.0")

# Mount auth router
app.include_router(auth_router)

if _RATE_LIMITING:
    app.state.limiter = _limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CompileRequest(BaseModel):
    source: str


class TranslateRequest(BaseModel):
    story: str


class TranslateAndCompileRequest(BaseModel):
    story: str


class GenerateAssetsRequest(BaseModel):
    scene: str
    characters: list[str]
    seed_offset: int = 0


class CheckoutRequest(BaseModel):
    plan: str          # "creator" | "pro" | "edu"
    user_email: str
    success_url: str = "https://parsia.app?checkout=success"
    cancel_url: str = "https://parsia.app?checkout=cancel"


# Stripe price IDs — set these in your dashboard and add to .env
_STRIPE_PRICES = {
    "creator": os.getenv("STRIPE_PRICE_CREATOR", ""),
    "pro":     os.getenv("STRIPE_PRICE_PRO", ""),
    "edu":     os.getenv("STRIPE_PRICE_EDU", ""),
}


_compile_count = 0
_translate_count = 0


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/stats")
def stats():
    return {"compiles": _compile_count, "translates": _translate_count}


@app.post("/compile")
def compile_story(req: CompileRequest):
    global _compile_count
    _compile_count += 1
    try:
        result = compiler.compile_source(req.source)
        return result
    except (compiler.LexerError, compiler.ParseError, compiler.SemanticError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except compiler.RuntimeError_ as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/translate")
def translate_story(req: TranslateRequest):
    """Translate an English story into Parsia DSL source code."""
    global _translate_count
    _translate_count += 1
    try:
        parsia_source = translate_to_parsia(req.story)
        return {"source": parsia_source}
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/translate-and-compile")
def translate_and_compile(req: TranslateAndCompileRequest):
    """Translate an English story to Parsia DSL, then compile it to animation JSON."""
    global _translate_count
    _translate_count += 1
    try:
        parsia_source = translate_to_parsia(req.story)
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        result = compiler.compile_source(parsia_source)
        return {"source": parsia_source, "animation": result}
    except (compiler.LexerError, compiler.ParseError, compiler.SemanticError) as e:
        raise HTTPException(
            status_code=400,
            detail={"error": str(e), "generated_source": parsia_source},
        )
    except compiler.RuntimeError_ as e:
        raise HTTPException(
            status_code=422,
            detail={"error": str(e), "generated_source": parsia_source},
        )


@app.post("/checkout")
def create_checkout(req: CheckoutRequest):
    """Create a Stripe Checkout Session and return the redirect URL."""
    if not _STRIPE:
        raise HTTPException(status_code=503, detail="Billing not configured — set STRIPE_SECRET_KEY in .env")
    price_id = _STRIPE_PRICES.get(req.plan)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"Unknown plan '{req.plan}' or price not configured")
    try:
        session = _stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            customer_email=req.user_email,
            success_url=req.success_url + "&session_id={CHECKOUT_SESSION_ID}",
            cancel_url=req.cancel_url,
            metadata={"plan": req.plan},
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/generate-assets")
def generate_assets_endpoint(req: GenerateAssetsRequest):
    """Generate a background image and character sprites for a Parsia scene."""
    try:
        result = generate_assets(
            scene_name=req.scene,
            characters=req.characters,
            seed_offset=req.seed_offset,
        )
        return result
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
