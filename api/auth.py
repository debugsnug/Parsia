"""
Parsia Authentication & Admin Module
─────────────────────────────────────
• Users stored in SQLite (parsia_users.db) with bcrypt-hashed passwords
• Email OTP verification via SMTP (or Supabase if configured)
• JWT session tokens
• Admin endpoints for user management & analytics
"""

import os
import re
import uuid
import hmac
import json
import hashlib
import secrets
import sqlite3
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Depends, Request
from pydantic import BaseModel, EmailStr

try:
    import bcrypt
    _BCRYPT = True
except ImportError:
    _BCRYPT = False

try:
    import jwt as pyjwt
    _JWT = True
except ImportError:
    _JWT = False

# ── Config ────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "parsia-jwt-secret-change-in-production-" + secrets.token_hex(16))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24
ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "parsia-admin-2024")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@parsia.app")

DB_PATH = os.path.join(os.path.dirname(__file__), "parsia_users.db")

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Database ─────────────────────────────────────────────
def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init_db():
    conn = _get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            name        TEXT DEFAULT '',
            role        TEXT DEFAULT 'user',
            is_verified INTEGER DEFAULT 0,
            is_disabled INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now')),
            last_login  TEXT,
            login_count INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS otp_codes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT NOT NULL,
            email       TEXT NOT NULL,
            code        TEXT NOT NULL,
            purpose     TEXT DEFAULT 'verify_email',
            expires_at  TEXT NOT NULL,
            used        INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            actor       TEXT,
            action      TEXT NOT NULL,
            target      TEXT,
            details     TEXT,
            ip_address  TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            token       TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now')),
            expires_at  TEXT NOT NULL,
            is_active   INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS feedback (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            rating      INTEGER NOT NULL,
            category    TEXT DEFAULT 'general',
            message     TEXT DEFAULT '',
            user_email  TEXT DEFAULT '',
            page_url    TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS issue_reports (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category    TEXT DEFAULT 'bug',
            title       TEXT NOT NULL,
            body        TEXT NOT NULL,
            severity    TEXT DEFAULT 'medium',
            user_email  TEXT DEFAULT '',
            user_agent  TEXT DEFAULT '',
            page_url    TEXT DEFAULT '',
            status      TEXT DEFAULT 'open',
            created_at  TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()


_init_db()


# ── Crypto helpers ───────────────────────────────────────
def hash_password(plain: str) -> str:
    """Hash password using bcrypt (cost factor 12) with SHA-256 pre-hash."""
    # SHA-256 pre-hash to handle passwords > 72 bytes (bcrypt limit)
    sha256_hash = hashlib.sha256(plain.encode('utf-8')).hexdigest()
    if _BCRYPT:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(sha256_hash.encode('utf-8'), salt).decode('utf-8')
    else:
        # Fallback: PBKDF2-HMAC-SHA256 if bcrypt not installed
        salt = secrets.token_hex(16)
        dk = hashlib.pbkdf2_hmac('sha256', sha256_hash.encode(), salt.encode(), 100000)
        return f"pbkdf2${salt}${dk.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    """Verify password against stored hash."""
    sha256_hash = hashlib.sha256(plain.encode('utf-8')).hexdigest()
    if _BCRYPT and hashed.startswith('$2'):
        return bcrypt.checkpw(sha256_hash.encode('utf-8'), hashed.encode('utf-8'))
    elif hashed.startswith('pbkdf2$'):
        _, salt, stored_dk = hashed.split('$')
        dk = hashlib.pbkdf2_hmac('sha256', sha256_hash.encode(), salt.encode(), 100000)
        return hmac.compare_digest(dk.hex(), stored_dk)
    return False


def create_jwt(user_id: str, email: str, role: str = "user") -> str:
    """Create a JWT session token."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    if _JWT:
        return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    else:
        # Simple fallback token
        token_data = json.dumps({"sub": user_id, "email": email, "role": role, "exp": str(payload["exp"])})
        sig = hmac.new(JWT_SECRET.encode(), token_data.encode(), hashlib.sha256).hexdigest()
        import base64
        return base64.urlsafe_b64encode(token_data.encode()).decode() + "." + sig


def decode_jwt(token: str) -> dict:
    """Decode and verify a JWT token."""
    if _JWT:
        try:
            return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except pyjwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    else:
        try:
            import base64
            parts = token.rsplit(".", 1)
            data = base64.urlsafe_b64decode(parts[0]).decode()
            sig = hmac.new(JWT_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(sig, parts[1]):
                raise HTTPException(status_code=401, detail="Invalid token")
            return json.loads(data)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")


def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])


def send_otp_email(to_email: str, otp_code: str, purpose: str = "verify"):
    """Send OTP via SMTP email."""
    # Read SMTP config lazily so .env changes take effect on reload
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@parsia.app")

    if not smtp_user or not smtp_pass or "PUT_YOUR" in smtp_pass:
        print(f"\n{'='*50}")
        print(f"[Parsia OTP] SMTP not configured!")
        print(f"  Email: {to_email}")
        print(f"  OTP Code: {otp_code}")
        print(f"  Purpose: {purpose}")
        print(f"  → Set SMTP_USER and SMTP_PASS in api/.env")
        print(f"{'='*50}\n")
        return True  # Silently succeed for demo

    subject = "Parsia — Your Verification Code" if purpose == "verify" else "Parsia — Password Reset Code"
    html_body = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;background:#0a0f1c;color:#e0e8f0;padding:40px 32px;border-radius:16px;border:1px solid rgba(0,201,177,.2)">
        <div style="text-align:center;margin-bottom:24px">
            <div style="font-size:28px;font-weight:900;letter-spacing:.12em;background:linear-gradient(135deg,#00c9b1,#fff);-webkit-background-clip:text;-webkit-text-fill-color:transparent">PARSIA</div>
            <div style="font-size:11px;color:#7a8ba3;letter-spacing:.15em;margin-top:4px">ANIMATION ENGINE</div>
        </div>
        <div style="text-align:center;margin-bottom:20px">
            <div style="font-size:14px;color:#c0cad8;margin-bottom:16px">
                {'Verify your email to complete registration' if purpose == 'verify' else 'Use this code to reset your password'}
            </div>
            <div style="background:rgba(0,201,177,.08);border:2px solid rgba(0,201,177,.3);border-radius:12px;padding:20px;display:inline-block">
                <span style="font-family:monospace;font-size:36px;font-weight:900;letter-spacing:.5em;color:#00c9b1">{otp_code}</span>
            </div>
            <div style="font-size:11px;color:#5a6a7a;margin-top:12px">Code expires in 10 minutes</div>
        </div>
        <div style="font-size:10px;color:#4a5a6a;text-align:center;border-top:1px solid rgba(255,255,255,.06);padding-top:16px">
            If you didn't request this, ignore this email.<br>
            Parsia v1.0 · Compiler Design Project · Amrita Vishwa Vidyapeetham
        </div>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(f"Your Parsia verification code: {otp_code}", "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        print(f"[Parsia OTP] Sending {purpose} code to {to_email} via {smtp_host}:{smtp_port}...")
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print(f"[Parsia OTP] ✓ Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"[Parsia OTP] ✕ Email send FAILED: {e}")
        print(f"[Parsia OTP]   Host: {smtp_host}:{smtp_port}, User: {smtp_user}")
        return False


# ── Validation ───────────────────────────────────────────
def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength. Returns (is_valid, message)."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one digit"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    return True, "OK"


def validate_email_format(email: str) -> bool:
    return re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email) is not None


# ── Request models ───────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyOtpRequest(BaseModel):
    email: str
    code: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


class ResendOtpRequest(BaseModel):
    email: str


# ── Auth dependency ──────────────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    return decode_jwt(token)


def require_admin(x_admin_key: Optional[str] = Header(None)):
    if not x_admin_key or not hmac.compare_digest(x_admin_key, ADMIN_SECRET):
        raise HTTPException(status_code=403, detail="Admin access required")
    return True


# ── Log helper ───────────────────────────────────────────
def _audit(actor: str, action: str, target: str = "", details: str = "", ip: str = ""):
    conn = _get_db()
    conn.execute(
        "INSERT INTO audit_log (actor, action, target, details, ip_address) VALUES (?, ?, ?, ?, ?)",
        (actor, action, target, details, ip)
    )
    conn.commit()
    conn.close()


# ═══════════════════════════════════════════════════════════
#  PUBLIC AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════

@router.post("/register")
def register(req: RegisterRequest, request: Request):
    """Register a new user. Sends OTP to email for verification."""
    email = req.email.strip().lower()
    if not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    valid, msg = validate_password(req.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    conn = _get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=409, detail="Email already registered. Please sign in instead.")

    user_id = str(uuid.uuid4())
    hashed = hash_password(req.password)

    conn.execute(
        "INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)",
        (user_id, email, hashed, req.name.strip())
    )
    conn.commit()

    # Generate and send OTP
    otp = generate_otp()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    conn.execute(
        "INSERT INTO otp_codes (user_id, email, code, purpose, expires_at) VALUES (?, ?, ?, 'verify_email', ?)",
        (user_id, email, otp, expires)
    )
    conn.commit()
    conn.close()

    send_otp_email(email, otp, "verify")
    _audit("system", "user_registered", email, ip=request.client.host if request.client else "")

    return {
        "message": "Account created. Please check your email for the verification code.",
        "email": email,
        "requires_otp": True
    }


@router.post("/verify-otp")
def verify_otp(req: VerifyOtpRequest, request: Request):
    """Verify email OTP after registration."""
    email = req.email.strip().lower()
    conn = _get_db()

    # Find the latest unused OTP for this email
    row = conn.execute(
        """SELECT otp_codes.*, users.id as uid, users.role FROM otp_codes
           JOIN users ON users.id = otp_codes.user_id
           WHERE otp_codes.email = ? AND otp_codes.used = 0 AND otp_codes.purpose = 'verify_email'
           ORDER BY otp_codes.created_at DESC LIMIT 1""",
        (email,)
    ).fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="No pending verification for this email")

    # Check expiry
    if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
        conn.close()
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # Verify code (timing-safe comparison)
    if not hmac.compare_digest(req.code.strip(), row["code"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid verification code")

    # Mark OTP as used, verify user
    conn.execute("UPDATE otp_codes SET used = 1 WHERE id = ?", (row["id"],))
    conn.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (row["uid"],))
    conn.commit()

    # Create session
    token = create_jwt(row["uid"], email, row["role"])
    session_id = str(uuid.uuid4())
    expires = (datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)).isoformat()
    conn.execute(
        "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
        (session_id, row["uid"], token, expires)
    )
    conn.execute(
        "UPDATE users SET last_login = datetime('now'), login_count = login_count + 1 WHERE id = ?",
        (row["uid"],)
    )
    conn.commit()

    user = conn.execute("SELECT * FROM users WHERE id = ?", (row["uid"],)).fetchone()
    conn.close()

    _audit("system", "email_verified", email, ip=request.client.host if request.client else "")

    return {
        "message": "Email verified successfully!",
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "is_verified": True,
        }
    }


@router.post("/login")
def login(req: LoginRequest, request: Request):
    """Sign in with email and password."""
    email = req.email.strip().lower()

    conn = _get_db()

    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="No account found with this email. Please sign up first.")

    if not verify_password(req.password, user["password"]):
        conn.close()
        _audit("system", "login_failed", email, "wrong password", request.client.host if request.client else "")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user["is_disabled"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Account is disabled. Contact admin.")

    if not user["is_verified"]:
        # Resend OTP
        otp = generate_otp()
        expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        conn.execute(
            "INSERT INTO otp_codes (user_id, email, code, purpose, expires_at) VALUES (?, ?, ?, 'verify_email', ?)",
            (user["id"], email, otp, expires)
        )
        conn.commit()
        conn.close()
        send_otp_email(email, otp, "verify")
        return {
            "message": "Email not verified. A new verification code has been sent.",
            "requires_otp": True,
            "email": email
        }

    # Create JWT
    token = create_jwt(user["id"], email, user["role"])
    session_id = str(uuid.uuid4())
    expires = (datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)).isoformat()
    conn.execute(
        "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
        (session_id, user["id"], token, expires)
    )
    conn.execute(
        "UPDATE users SET last_login = datetime('now'), login_count = login_count + 1 WHERE id = ?",
        (user["id"],)
    )
    conn.commit()
    conn.close()

    _audit("system", "user_login", email, ip=request.client.host if request.client else "")

    return {
        "message": "Signed in successfully!",
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "is_verified": True,
        }
    }


@router.post("/resend-otp")
def resend_otp(req: ResendOtpRequest):
    """Resend verification OTP."""
    email = req.email.strip().lower()
    conn = _get_db()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="Email not found")

    otp = generate_otp()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    conn.execute(
        "INSERT INTO otp_codes (user_id, email, code, purpose, expires_at) VALUES (?, ?, ?, 'verify_email', ?)",
        (user["id"], email, otp, expires)
    )
    conn.commit()
    conn.close()

    send_otp_email(email, otp, "verify")
    return {"message": "New verification code sent to your email."}


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    """Send password reset OTP."""
    email = req.email.strip().lower()
    conn = _get_db()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        conn.close()
        # Don't reveal if email exists
        return {"message": "If this email is registered, a reset code has been sent."}

    otp = generate_otp()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    conn.execute(
        "INSERT INTO otp_codes (user_id, email, code, purpose, expires_at) VALUES (?, ?, ?, 'reset_password', ?)",
        (user["id"], email, otp, expires)
    )
    conn.commit()
    conn.close()

    send_otp_email(email, otp, "reset")
    return {"message": "If this email is registered, a reset code has been sent."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    """Reset password using OTP."""
    email = req.email.strip().lower()
    conn = _get_db()

    row = conn.execute(
        """SELECT otp_codes.*, users.id as uid FROM otp_codes
           JOIN users ON users.id = otp_codes.user_id
           WHERE otp_codes.email = ? AND otp_codes.used = 0 AND otp_codes.purpose = 'reset_password'
           ORDER BY otp_codes.created_at DESC LIMIT 1""",
        (email,)
    ).fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="No pending reset for this email")

    if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
        conn.close()
        raise HTTPException(status_code=400, detail="Reset code has expired")

    if not hmac.compare_digest(req.code.strip(), row["code"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid reset code")

    valid, msg = validate_password(req.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    hashed = hash_password(req.new_password)
    conn.execute("UPDATE users SET password = ? WHERE id = ?", (hashed, row["uid"]))
    conn.execute("UPDATE otp_codes SET used = 1 WHERE id = ?", (row["id"],))
    conn.commit()
    conn.close()

    return {"message": "Password reset successfully. You can now sign in."}


@router.get("/me")
def get_me(user=Depends(get_current_user)):
    """Get current user profile."""
    conn = _get_db()
    u = conn.execute("SELECT * FROM users WHERE id = ?", (user["sub"],)).fetchone()
    conn.close()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u["name"],
        "role": u["role"],
        "is_verified": bool(u["is_verified"]),
        "created_at": u["created_at"],
        "last_login": u["last_login"],
        "login_count": u["login_count"],
    }


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.patch("/me/update")
def update_me(req: UpdateProfileRequest, user=Depends(get_current_user)):
    """Update current user's display name and bio."""
    conn = _get_db()
    try:
        # Add bio column if it doesn't exist yet (migration)
        try:
            conn.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
            conn.commit()
        except Exception:
            pass
        conn.execute(
            "UPDATE users SET name = ?, bio = ? WHERE id = ?",
            (req.name or '', req.bio or '', user["sub"]),
        )
        conn.commit()
        u = conn.execute("SELECT * FROM users WHERE id = ?", (user["sub"],)).fetchone()
        return {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}
    finally:
        conn.close()


@router.post("/me/change-password")
def change_password(req: ChangePasswordRequest, user=Depends(get_current_user)):
    """Change the authenticated user's password."""
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
    conn = _get_db()
    try:
        u = conn.execute("SELECT * FROM users WHERE id = ?", (user["sub"],)).fetchone()
        if not u:
            raise HTTPException(status_code=404, detail="User not found.")
        if not verify_password(req.old_password, u["password"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        new_hash = hash_password(req.new_password)
        conn.execute("UPDATE users SET password = ? WHERE id = ?", (new_hash, user["sub"]))
        conn.commit()
        return {"message": "Password updated successfully."}
    finally:
        conn.close()


@router.delete("/me")
def delete_me(user=Depends(get_current_user)):
    """Permanently delete the authenticated user's account."""
    conn = _get_db()
    try:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user["sub"],))
        conn.execute("DELETE FROM otp_codes WHERE user_id = ?", (user["sub"],))
        conn.execute("DELETE FROM users WHERE id = ?", (user["sub"],))
        conn.commit()
        return {"message": "Account deleted."}
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════
#  ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════

@router.get("/admin/stats")
def admin_stats(_=Depends(require_admin)):
    """Get system statistics."""
    conn = _get_db()
    total_users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    verified_users = conn.execute("SELECT COUNT(*) FROM users WHERE is_verified = 1").fetchone()[0]
    disabled_users = conn.execute("SELECT COUNT(*) FROM users WHERE is_disabled = 1").fetchone()[0]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_registrations = conn.execute(
        "SELECT COUNT(*) FROM users WHERE created_at LIKE ?", (f"{today}%",)
    ).fetchone()[0]
    total_logins = conn.execute("SELECT SUM(login_count) FROM users").fetchone()[0] or 0
    active_sessions = conn.execute(
        "SELECT COUNT(*) FROM sessions WHERE is_active = 1 AND expires_at > datetime('now')"
    ).fetchone()[0]
    conn.close()
    return {
        "total_users": total_users,
        "verified_users": verified_users,
        "disabled_users": disabled_users,
        "today_registrations": today_registrations,
        "total_logins": total_logins,
        "active_sessions": active_sessions,
    }


@router.get("/admin/users")
def admin_list_users(
    page: int = 1,
    limit: int = 50,
    search: str = "",
    _=Depends(require_admin)
):
    """List all users with pagination."""
    conn = _get_db()
    offset = (page - 1) * limit

    if search:
        query = "SELECT * FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        s = f"%{search}%"
        users = conn.execute(query, (s, s, limit, offset)).fetchall()
        total = conn.execute(
            "SELECT COUNT(*) FROM users WHERE email LIKE ? OR name LIKE ?", (s, s)
        ).fetchone()[0]
    else:
        users = conn.execute(
            "SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)
        ).fetchall()
        total = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    conn.close()
    return {
        "users": [{
            "id": u["id"],
            "email": u["email"],
            "name": u["name"],
            "role": u["role"],
            "is_verified": bool(u["is_verified"]),
            "is_disabled": bool(u["is_disabled"]),
            "created_at": u["created_at"],
            "last_login": u["last_login"],
            "login_count": u["login_count"],
        } for u in users],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.patch("/admin/users/{user_id}/toggle")
def admin_toggle_user(user_id: str, _=Depends(require_admin)):
    """Enable/disable a user account."""
    conn = _get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    new_state = 0 if user["is_disabled"] else 1
    conn.execute("UPDATE users SET is_disabled = ? WHERE id = ?", (new_state, user_id))
    conn.commit()
    conn.close()

    action = "user_disabled" if new_state else "user_enabled"
    _audit("admin", action, user["email"])
    return {"message": f"User {'disabled' if new_state else 'enabled'}", "is_disabled": bool(new_state)}


@router.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: str, _=Depends(require_admin)):
    """Delete a user account permanently."""
    conn = _get_db()
    user = conn.execute("SELECT email FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM otp_codes WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    _audit("admin", "user_deleted", user["email"])
    return {"message": "User deleted"}


@router.patch("/admin/users/{user_id}/role")
def admin_set_role(user_id: str, role: str = "user", _=Depends(require_admin)):
    """Change user role (user/admin)."""
    if role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
    conn = _get_db()
    conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
    conn.commit()
    conn.close()
    _audit("admin", "role_changed", user_id, f"role={role}")
    return {"message": f"Role set to {role}"}


@router.get("/admin/audit")
def admin_audit_log(
    page: int = 1,
    limit: int = 100,
    _=Depends(require_admin)
):
    """Get audit log."""
    conn = _get_db()
    offset = (page - 1) * limit
    logs = conn.execute(
        "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset)
    ).fetchall()
    total = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    conn.close()
    return {
        "logs": [{
            "id": l["id"],
            "actor": l["actor"],
            "action": l["action"],
            "target": l["target"],
            "details": l["details"],
            "ip": l["ip_address"],
            "time": l["created_at"],
        } for l in logs],
        "total": total,
    }


@router.post("/admin/login")
def admin_login(secret_key: str = ""):
    """Admin login with secret key."""
    if not hmac.compare_digest(secret_key, ADMIN_SECRET):
        raise HTTPException(status_code=403, detail="Invalid admin key")
    token = create_jwt("admin", "admin@parsia.app", "admin")
    return {"token": token, "message": "Admin access granted"}
