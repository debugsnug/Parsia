import sys
import json
import re
import io

# Force UTF-8 encoding for Windows consoles - Fixes UnicodeEncodeError
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Any, List, Optional, Dict

# ╔══════════════════════════════════════════════════════════════════╗
# ║              PARSIA  v1.0                            ║
# ║   Full Pipeline: Lexer → Parser → Semantic → IR → Optimizer     ║
# ║                  → Code Generator                               ║
# ╚══════════════════════════════════════════════════════════════════╝


# ══════════════════════════════════════════
# PHASE 0 — TOKEN TYPES
# ══════════════════════════════════════════

class TT(Enum):
    # Literals
    NUMBER     = auto()
    STRING     = auto()
    IDENT      = auto()

    # Keywords – story
    SCENE      = auto()
    CHARACTER  = auto()
    ENTER      = auto()
    EXIT       = auto()
    SAY        = auto()
    MOVE       = auto()
    WAIT       = auto()
    EMOTE      = auto()

    # Keywords – control flow
    TASK       = auto()
    DO         = auto()
    IF         = auto()
    ELSE       = auto()
    LOOP       = auto()
    REPEAT     = auto()   # REPEAT UNTIL <cond>
    RETURN     = auto()
    LET        = auto()
    SET        = auto()
    PRINT      = auto()

    # Directions
    LEFT       = auto()
    RIGHT      = auto()
    UP         = auto()
    DOWN       = auto()

    # Operators
    PLUS       = auto()
    MINUS      = auto()
    STAR       = auto()
    SLASH      = auto()
    EQ_EQ      = auto()
    BANG_EQ    = auto()
    LT         = auto()
    GT         = auto()
    LT_EQ      = auto()
    GT_EQ      = auto()
    AND        = auto()
    OR         = auto()
    NOT        = auto()
    ASSIGN     = auto()   # =

    # Punctuation
    COLON      = auto()
    LPAREN     = auto()
    RPAREN     = auto()
    COMMA      = auto()
    NEWLINE    = auto()
    INDENT     = auto()
    DEDENT     = auto()
    EOF        = auto()


KEYWORDS: Dict[str, TT] = {
    "SCENE": TT.SCENE, "CHARACTER": TT.CHARACTER, "ENTER": TT.ENTER,
    "EXIT": TT.EXIT, "SAY": TT.SAY, "MOVE": TT.MOVE, "WAIT": TT.WAIT,
    "EMOTE": TT.EMOTE, "task": TT.TASK, "do": TT.DO, "if": TT.IF,
    "else": TT.ELSE, "loop": TT.LOOP, "repeat": TT.REPEAT,
    "return": TT.RETURN, "let": TT.LET, "set": TT.SET, "print": TT.PRINT,
    "and": TT.AND, "or": TT.OR, "not": TT.NOT,
    "LEFT": TT.LEFT, "RIGHT": TT.RIGHT, "UP": TT.UP, "DOWN": TT.DOWN,
}


@dataclass
class Token:
    type: TT
    value: Any
    line: int
    col: int

    def __repr__(self):
        return f"Token({self.type.name}, {self.value!r}, L{self.line}:C{self.col})"


# ══════════════════════════════════════════
# PHASE 1 — LEXER  (Lexical Analysis)
# ══════════════════════════════════════════
# Converts raw source text into a flat stream of Tokens.
# Handles: strings, numbers, identifiers, operators, indent/dedent tracking.

class LexerError(Exception):
    def __init__(self, msg, line, col):
        super().__init__(f"🔴 LexerError at L{line}:C{col} — {msg}")
        self.line = line; self.col = col

class Lexer:
    def __init__(self, source: str):
        self.source = source
        self.pos = 0
        self.line = 1
        self.col = 1
        self.indent_stack = [0]
        self.tokens: List[Token] = []
        self.pending_dedents = 0

    # ── character helpers ──────────────────
    def peek(self, offset=0) -> str:
        p = self.pos + offset
        return self.source[p] if p < len(self.source) else "\0"

    def advance(self) -> str:
        ch = self.source[self.pos]
        self.pos += 1
        if ch == "\n":
            self.line += 1; self.col = 1
        else:
            self.col += 1
        return ch

    def match(self, expected: str) -> bool:
        if self.peek() == expected:
            self.advance(); return True
        return False

    def make(self, tt: TT, val=None) -> Token:
        return Token(tt, val, self.line, self.col)

    # ── main scan ─────────────────────────
    def tokenize(self) -> List[Token]:
        lines = self.source.splitlines(keepends=True)
        for raw_line in lines:
            self._scan_line(raw_line)
        # flush remaining dedents
        while len(self.indent_stack) > 1:
            self.indent_stack.pop()
            self.tokens.append(self.make(TT.DEDENT))
        self.tokens.append(self.make(TT.EOF))
        return self.tokens

    def _scan_line(self, raw_line: str):
        # Strip trailing newline for indent counting
        stripped = raw_line.rstrip("\n\r")

        # Blank / comment-only lines → skip (no NEWLINE emitted)
        content = stripped.lstrip()
        if not content or content.startswith("#"):
            return

        # Measure indent
        indent = len(stripped) - len(content)
        prev_indent = self.indent_stack[-1]

        if indent > prev_indent:
            self.indent_stack.append(indent)
            self.tokens.append(Token(TT.INDENT, indent, self.line, 1))
        else:
            while indent < self.indent_stack[-1]:
                self.indent_stack.pop()
                self.tokens.append(Token(TT.DEDENT, None, self.line, 1))
            if indent != self.indent_stack[-1]:
                raise LexerError(f"Inconsistent indentation (got {indent}, expected {self.indent_stack[-1]})", self.line, 1)

        # Scan tokens on this line
        self._scan_content(content)
        self.tokens.append(Token(TT.NEWLINE, None, self.line, len(stripped)))

    def _scan_content(self, text: str):
        i = 0
        while i < len(text):
            ch = text[i]

            # Whitespace
            if ch in " \t":
                i += 1; continue

            # Comment
            if ch == "#":
                break

            # String literal
            if ch == '"':
                j = i + 1
                while j < len(text) and text[j] != '"':
                    j += 1
                if j >= len(text):
                    raise LexerError("Unterminated string", self.line, i + 1)
                val = text[i+1:j]
                self.tokens.append(Token(TT.STRING, val, self.line, i + 1))
                i = j + 1
                continue

            # Number
            if ch.isdigit() or (ch == '-' and i + 1 < len(text) and text[i+1].isdigit()):
                j = i + (1 if ch == '-' else 0)
                while j < len(text) and (text[j].isdigit() or text[j] == '.'):
                    j += 1
                self.tokens.append(Token(TT.NUMBER, float(text[i:j]), self.line, i + 1))
                i = j
                continue

            # Identifier / keyword
            if ch.isalpha() or ch == '_':
                j = i
                while j < len(text) and (text[j].isalnum() or text[j] == '_'):
                    j += 1
                word = text[i:j]
                tt = KEYWORDS.get(word, TT.IDENT)
                self.tokens.append(Token(tt, word, self.line, i + 1))
                i = j
                continue

            # Two-char operators
            two = text[i:i+2]
            if two == "==":
                self.tokens.append(Token(TT.EQ_EQ, "==", self.line, i + 1)); i += 2; continue
            if two == "!=":
                self.tokens.append(Token(TT.BANG_EQ, "!=", self.line, i + 1)); i += 2; continue
            if two == "<=":
                self.tokens.append(Token(TT.LT_EQ, "<=", self.line, i + 1)); i += 2; continue
            if two == ">=":
                self.tokens.append(Token(TT.GT_EQ, ">=", self.line, i + 1)); i += 2; continue

            # Single-char operators / punctuation
            singles = {
                '+': TT.PLUS, '-': TT.MINUS, '*': TT.STAR, '/': TT.SLASH,
                '<': TT.LT, '>': TT.GT, '=': TT.ASSIGN, ':': TT.COLON,
                '(': TT.LPAREN, ')': TT.RPAREN, ',': TT.COMMA,
            }
            if ch in singles:
                self.tokens.append(Token(singles[ch], ch, self.line, i + 1))
                i += 1; continue

            raise LexerError(f"Unexpected character '{ch}'", self.line, i + 1)


# ══════════════════════════════════════════
# PHASE 2 — AST NODE DEFINITIONS
# ══════════════════════════════════════════
# Abstract Syntax Tree nodes produced by the Parser.

# ASTNode is a plain (non-dataclass) base so subclasses can freely
# place `line` at the end with a default without hitting the
# "non-default argument follows default argument" restriction.
class ASTNode:
    pass

# ── Declarations ──────────────────────────
@dataclass
class Program(ASTNode):
    body: List[ASTNode]
    line: int = field(default=0, repr=False)

@dataclass
class SceneDecl(ASTNode):
    name: str
    line: int = field(default=0, repr=False)

@dataclass
class CharacterDecl(ASTNode):
    name: str
    line: int = field(default=0, repr=False)

@dataclass
class TaskDecl(ASTNode):
    name: str
    body: List[ASTNode]
    line: int = field(default=0, repr=False)

# ── Statements ────────────────────────────
@dataclass
class EnterStmt(ASTNode):
    character: str
    line: int = field(default=0, repr=False)

@dataclass
class ExitStmt(ASTNode):
    character: str
    line: int = field(default=0, repr=False)

@dataclass
class SayStmt(ASTNode):
    character: str
    text: str
    line: int = field(default=0, repr=False)

@dataclass
class MoveStmt(ASTNode):
    character: str
    direction: str
    steps: Any        # expr node
    line: int = field(default=0, repr=False)

@dataclass
class WaitStmt(ASTNode):
    duration: Any     # expr node
    line: int = field(default=0, repr=False)

@dataclass
class EmoteStmt(ASTNode):
    character: str
    emotion: str
    line: int = field(default=0, repr=False)

@dataclass
class DoStmt(ASTNode):
    task: str
    line: int = field(default=0, repr=False)

@dataclass
class LetStmt(ASTNode):
    name: str
    value: Any        # expr node
    line: int = field(default=0, repr=False)

@dataclass
class SetStmt(ASTNode):
    name: str
    value: Any
    line: int = field(default=0, repr=False)

@dataclass
class PrintStmt(ASTNode):
    value: Any
    line: int = field(default=0, repr=False)

@dataclass
class IfStmt(ASTNode):
    condition: Any
    then_body: List[ASTNode]
    else_body: List[ASTNode]
    line: int = field(default=0, repr=False)

@dataclass
class LoopStmt(ASTNode):
    count: Any
    body: List[ASTNode]
    line: int = field(default=0, repr=False)

@dataclass
class RepeatStmt(ASTNode):
    body: List[ASTNode]
    condition: Any    # repeat UNTIL condition
    line: int = field(default=0, repr=False)

@dataclass
class ReturnStmt(ASTNode):
    value: Any
    line: int = field(default=0, repr=False)

# ── Expressions ───────────────────────────
@dataclass
class NumberLit(ASTNode):
    value: float
    line: int = field(default=0, repr=False)

@dataclass
class StringLit(ASTNode):
    value: str
    line: int = field(default=0, repr=False)

@dataclass
class VarRef(ASTNode):
    name: str
    line: int = field(default=0, repr=False)

@dataclass
class BinOp(ASTNode):
    op: str
    left: Any
    right: Any
    line: int = field(default=0, repr=False)

@dataclass
class UnaryOp(ASTNode):
    op: str
    operand: Any
    line: int = field(default=0, repr=False)

@dataclass
class CallExpr(ASTNode):
    task: str
    line: int = field(default=0, repr=False)


# ══════════════════════════════════════════
# PHASE 3 — PARSER  (Syntax Analysis)
# ══════════════════════════════════════════
# Recursive-descent parser. Consumes the token stream and builds an AST.

class ParseError(Exception):
    def __init__(self, msg, token: Token):
        super().__init__(f"🟠 ParseError at L{token.line}:C{token.col} — {msg} (got {token.type.name} '{token.value}')")
        self.token = token

class Parser:
    def __init__(self, tokens: List[Token]):
        self.tokens = [t for t in tokens if t.type not in (TT.NEWLINE,)]
        # We keep NEWLINE for statement boundaries — actually let's keep them
        self.tokens = tokens
        self.pos = 0

    # ── token helpers ──────────────────────
    def cur(self) -> Token:
        return self.tokens[self.pos]

    def peek(self, offset=1) -> Token:
        p = self.pos + offset
        return self.tokens[p] if p < len(self.tokens) else self.tokens[-1]

    def advance(self) -> Token:
        t = self.tokens[self.pos]
        if self.pos < len(self.tokens) - 1:
            self.pos += 1
        return t

    def expect(self, tt: TT) -> Token:
        t = self.cur()
        if t.type != tt:
            raise ParseError(f"Expected {tt.name}", t)
        return self.advance()

    def match(self, *types: TT) -> bool:
        return self.cur().type in types

    def skip_newlines(self):
        while self.cur().type == TT.NEWLINE:
            self.advance()

    # ── top level ─────────────────────────
    def parse(self) -> Program:
        body = []
        self.skip_newlines()
        while not self.match(TT.EOF):
            stmt = self.parse_stmt()
            if stmt:
                body.append(stmt)
            self.skip_newlines()
        return Program(body=body, line=1)

    def parse_block(self) -> List[ASTNode]:
        """Parse an indented block of statements."""
        stmts = []
        self.expect(TT.INDENT)
        self.skip_newlines()
        while not self.match(TT.DEDENT, TT.EOF):
            s = self.parse_stmt()
            if s:
                stmts.append(s)
            self.skip_newlines()
        if self.match(TT.DEDENT):
            self.advance()
        return stmts

    def parse_stmt(self) -> Optional[ASTNode]:
        self.skip_newlines()
        t = self.cur()
        line = t.line

        if t.type == TT.NEWLINE:
            self.advance(); return None

        if t.type == TT.SCENE:
            return self.parse_scene()
        if t.type == TT.CHARACTER:
            return self.parse_character()
        if t.type == TT.TASK:
            return self.parse_task()
        if t.type == TT.ENTER:
            return self.parse_enter()
        if t.type == TT.EXIT:
            return self.parse_exit()
        if t.type == TT.WAIT:
            return self.parse_wait()
        if t.type == TT.DO:
            return self.parse_do()
        if t.type == TT.LET:
            return self.parse_let()
        if t.type == TT.SET:
            return self.parse_set()
        if t.type == TT.PRINT:
            return self.parse_print()
        if t.type == TT.IF:
            return self.parse_if()
        if t.type == TT.LOOP:
            return self.parse_loop()
        if t.type == TT.REPEAT:
            return self.parse_repeat()
        if t.type == TT.RETURN:
            return self.parse_return()

        # Character action: IDENT SAY / MOVE / EMOTE
        if t.type == TT.IDENT and self.peek().type in (TT.SAY, TT.MOVE, TT.EMOTE):
            return self.parse_char_action()

        raise ParseError("Unexpected token", t)

    # ── declarations ──────────────────────
    def parse_scene(self) -> SceneDecl:
        line = self.cur().line
        self.expect(TT.SCENE)
        name = self.expect(TT.IDENT).value
        self._end_stmt()
        return SceneDecl(name=name, line=line)

    def parse_character(self) -> CharacterDecl:
        line = self.cur().line
        self.expect(TT.CHARACTER)
        name = self.expect(TT.IDENT).value
        self._end_stmt()
        return CharacterDecl(name=name, line=line)

    def parse_task(self) -> TaskDecl:
        line = self.cur().line
        self.expect(TT.TASK)
        name = self.expect(TT.IDENT).value
        self.expect(TT.COLON)
        self._end_stmt()
        body = self.parse_block()
        return TaskDecl(name=name, body=body, line=line)

    # ── story statements ──────────────────
    def parse_enter(self) -> EnterStmt:
        line = self.cur().line
        self.expect(TT.ENTER)
        name = self.expect(TT.IDENT).value
        self._end_stmt()
        return EnterStmt(character=name, line=line)

    def parse_exit(self) -> ExitStmt:
        line = self.cur().line
        self.expect(TT.EXIT)
        name = self.expect(TT.IDENT).value
        self._end_stmt()
        return ExitStmt(character=name, line=line)

    def parse_wait(self) -> WaitStmt:
        line = self.cur().line
        self.expect(TT.WAIT)
        dur = self.parse_expr()
        self._end_stmt()
        return WaitStmt(duration=dur, line=line)

    def parse_char_action(self):
        line = self.cur().line
        char_name = self.advance().value  # IDENT
        action = self.advance()           # SAY / MOVE / EMOTE

        if action.type == TT.SAY:
            text_tok = self.expect(TT.STRING)
            self._end_stmt()
            return SayStmt(character=char_name, text=text_tok.value, line=line)

        if action.type == TT.MOVE:
            dir_tok = self.advance()
            if dir_tok.type not in (TT.LEFT, TT.RIGHT, TT.UP, TT.DOWN):
                raise ParseError("Expected direction (LEFT/RIGHT/UP/DOWN)", dir_tok)
            steps = self.parse_expr()
            self._end_stmt()
            return MoveStmt(character=char_name, direction=dir_tok.value, steps=steps, line=line)

        if action.type == TT.EMOTE:
            emotion = self.expect(TT.IDENT).value
            self._end_stmt()
            return EmoteStmt(character=char_name, emotion=emotion, line=line)

        raise ParseError("Unknown character action", action)

    # ── control flow ──────────────────────
    def parse_do(self) -> DoStmt:
        line = self.cur().line
        self.expect(TT.DO)
        name = self.expect(TT.IDENT).value
        self._end_stmt()
        return DoStmt(task=name, line=line)

    def parse_let(self) -> LetStmt:
        line = self.cur().line
        self.expect(TT.LET)
        name = self.expect(TT.IDENT).value
        self.expect(TT.ASSIGN)
        val = self.parse_expr()
        self._end_stmt()
        return LetStmt(name=name, value=val, line=line)

    def parse_set(self) -> SetStmt:
        line = self.cur().line
        self.expect(TT.SET)
        name = self.expect(TT.IDENT).value
        self.expect(TT.ASSIGN)
        val = self.parse_expr()
        self._end_stmt()
        return SetStmt(name=name, value=val, line=line)

    def parse_print(self) -> PrintStmt:
        line = self.cur().line
        self.expect(TT.PRINT)
        val = self.parse_expr()
        self._end_stmt()
        return PrintStmt(value=val, line=line)

    def parse_if(self) -> IfStmt:
        line = self.cur().line
        self.expect(TT.IF)
        cond = self.parse_expr()
        self.expect(TT.COLON)
        self._end_stmt()
        then_body = self.parse_block()
        else_body = []
        self.skip_newlines()
        if self.match(TT.ELSE):
            self.advance()
            self.expect(TT.COLON)
            self._end_stmt()
            else_body = self.parse_block()
        return IfStmt(condition=cond, then_body=then_body, else_body=else_body, line=line)

    def parse_loop(self) -> LoopStmt:
        line = self.cur().line
        self.expect(TT.LOOP)
        count = self.parse_expr()
        self.expect(TT.COLON)
        self._end_stmt()
        body = self.parse_block()
        return LoopStmt(count=count, body=body, line=line)

    def parse_repeat(self) -> RepeatStmt:
        line = self.cur().line
        self.expect(TT.REPEAT)
        self.expect(TT.COLON)
        self._end_stmt()
        body = self.parse_block()
        # expect UNTIL <expr>
        self.skip_newlines()
        until_tok = self.cur()
        if until_tok.type != TT.IDENT or until_tok.value != "until":
            raise ParseError("Expected 'until' after repeat block", until_tok)
        self.advance()
        cond = self.parse_expr()
        self._end_stmt()
        return RepeatStmt(body=body, condition=cond, line=line)

    def parse_return(self) -> ReturnStmt:
        line = self.cur().line
        self.expect(TT.RETURN)
        val = self.parse_expr()
        self._end_stmt()
        return ReturnStmt(value=val, line=line)

    # ── expressions (Pratt-style precedence) ──
    PREC = {
        TT.OR: 1, TT.AND: 2,
        TT.EQ_EQ: 3, TT.BANG_EQ: 3,
        TT.LT: 4, TT.GT: 4, TT.LT_EQ: 4, TT.GT_EQ: 4,
        TT.PLUS: 5, TT.MINUS: 5,
        TT.STAR: 6, TT.SLASH: 6,
    }
    OP_NAMES = {
        TT.PLUS: "+", TT.MINUS: "-", TT.STAR: "*", TT.SLASH: "/",
        TT.EQ_EQ: "==", TT.BANG_EQ: "!=",
        TT.LT: "<", TT.GT: ">", TT.LT_EQ: "<=", TT.GT_EQ: ">=",
        TT.AND: "and", TT.OR: "or",
    }

    def parse_expr(self, min_prec=0) -> Any:
        left = self.parse_unary()
        while self.cur().type in self.PREC and self.PREC[self.cur().type] > min_prec:
            op_tok = self.advance()
            op = self.OP_NAMES[op_tok.type]
            right = self.parse_expr(self.PREC[op_tok.type])
            left = BinOp(op=op, left=left, right=right, line=op_tok.line)
        return left

    def parse_unary(self) -> Any:
        t = self.cur()
        if t.type == TT.NOT:
            self.advance()
            return UnaryOp(op="not", operand=self.parse_unary(), line=t.line)
        if t.type == TT.MINUS:
            self.advance()
            return UnaryOp(op="-", operand=self.parse_unary(), line=t.line)
        return self.parse_primary()

    def parse_primary(self) -> Any:
        t = self.cur()
        if t.type == TT.NUMBER:
            self.advance()
            return NumberLit(value=t.value, line=t.line)
        if t.type == TT.STRING:
            self.advance()
            return StringLit(value=t.value, line=t.line)
        if t.type == TT.IDENT:
            # Could be var or task-call-as-expr
            if self.peek().type == TT.LPAREN:
                name = self.advance().value
                self.expect(TT.LPAREN)
                self.expect(TT.RPAREN)
                return CallExpr(task=name, line=t.line)
            self.advance()
            return VarRef(name=t.value, line=t.line)
        if t.type == TT.LPAREN:
            self.advance()
            expr = self.parse_expr()
            self.expect(TT.RPAREN)
            return expr
        raise ParseError("Expected expression", t)

    def _end_stmt(self):
        """Consume trailing NEWLINE (or EOF). Allows optional trailing newline."""
        while self.cur().type == TT.NEWLINE:
            self.advance()


# ══════════════════════════════════════════
# PHASE 4 — SEMANTIC ANALYSER
# ══════════════════════════════════════════
# Walks the AST and checks:
#   • Characters declared before use
#   • Characters on-stage before actions
#   • Variables declared before use
#   • Tasks defined before called
#   • Direction validity
#   • Type compatibility (basic)

class SemanticError(Exception):
    def __init__(self, msg, line=0):
        super().__init__(f"🔴 SemanticError at L{line} — {msg}")

class SemanticAnalyser:
    VALID_DIRECTIONS = {"LEFT", "RIGHT", "UP", "DOWN"}
    VALID_EMOTIONS   = {"happy", "sad", "angry", "scared", "surprised", "thinking", "wave", "jump"}

    def __init__(self):
        self.characters: Dict[str, dict] = {}   # name → {on_stage}
        self.variables: Dict[str, str]   = {}   # name → "num"|"str"
        self.tasks:     set              = set()
        self.scene: Optional[str]        = None
        self.warnings:  List[str]        = []
        self.current_task: Optional[str] = None
        self.in_task_body: bool          = False  # skip on_stage checks inside tasks

    def analyse(self, program: Program):
        # Pre-pass: collect all task names so forward-calls are ok
        for node in program.body:
            if isinstance(node, TaskDecl):
                self.tasks.add(node.name)
        for node in program.body:
            self._visit(node)

    def _visit(self, node: ASTNode):
        method = f"_visit_{type(node).__name__}"
        visitor = getattr(self, method, self._generic_visit)
        visitor(node)

    def _generic_visit(self, node):
        pass

    def _visit_SceneDecl(self, n: SceneDecl):
        if self.scene:
            self.warnings.append(f"L{n.line}: Scene redeclared (was '{self.scene}', now '{n.name}')")
        self.scene = n.name

    def _visit_CharacterDecl(self, n: CharacterDecl):
        if n.name in self.characters:
            raise SemanticError(f"Character '{n.name}' already declared", n.line)
        self.characters[n.name] = {"on_stage": False}

    def _visit_TaskDecl(self, n: TaskDecl):
        # Tasks execute at call-time, not definition-time, so we cannot know
        # which characters are on stage when the task runs. We still check
        # declarations and variable usage, but skip on_stage enforcement.
        saved_task    = self.current_task
        saved_in_task = self.in_task_body
        self.current_task  = n.name
        self.in_task_body  = True
        for stmt in n.body:
            self._visit(stmt)
        self.current_task  = saved_task
        self.in_task_body  = saved_in_task

    def _visit_EnterStmt(self, n: EnterStmt):
        self._require_declared(n.character, n.line)
        if not self.in_task_body:
            if self.characters[n.character]["on_stage"]:
                self.warnings.append(f"L{n.line}: '{n.character}' is already on stage")
            self.characters[n.character]["on_stage"] = True

    def _visit_ExitStmt(self, n: ExitStmt):
        self._require_declared(n.character, n.line)
        if not self.in_task_body:
            if not self.characters[n.character]["on_stage"]:
                self.warnings.append(f"L{n.line}: '{n.character}' exits but wasn't on stage")
            self.characters[n.character]["on_stage"] = False

    def _visit_SayStmt(self, n: SayStmt):
        if self.in_task_body:
            self._require_declared(n.character, n.line)
        else:
            self._require_on_stage(n.character, n.line)

    def _visit_MoveStmt(self, n: MoveStmt):
        if self.in_task_body:
            self._require_declared(n.character, n.line)
        else:
            self._require_on_stage(n.character, n.line)
        if n.direction not in self.VALID_DIRECTIONS:
            raise SemanticError(f"Invalid direction '{n.direction}'", n.line)
        self._check_expr(n.steps, n.line)

    def _visit_WaitStmt(self, n: WaitStmt):
        self._check_expr(n.duration, n.line)

    def _visit_EmoteStmt(self, n: EmoteStmt):
        if self.in_task_body:
            self._require_declared(n.character, n.line)
        else:
            self._require_on_stage(n.character, n.line)
        if n.emotion not in self.VALID_EMOTIONS:
            self.warnings.append(f"L{n.line}: Unknown emotion '{n.emotion}'. Known: {self.VALID_EMOTIONS}")

    def _visit_DoStmt(self, n: DoStmt):
        if n.task not in self.tasks:
            raise SemanticError(f"Undefined task '{n.task}'", n.line)

    def _visit_LetStmt(self, n: LetStmt):
        if n.name in self.variables:
            raise SemanticError(f"Variable '{n.name}' already declared (use 'set' to update)", n.line)
        inferred = self._infer_type(n.value)
        self.variables[n.name] = inferred

    def _visit_SetStmt(self, n: SetStmt):
        if n.name not in self.variables:
            raise SemanticError(f"Variable '{n.name}' not declared (use 'let' to declare)", n.line)
        self._check_expr(n.value, n.line)

    def _visit_PrintStmt(self, n: PrintStmt):
        self._check_expr(n.value, n.line)

    def _visit_IfStmt(self, n: IfStmt):
        self._check_expr(n.condition, n.line)
        for s in n.then_body: self._visit(s)
        for s in n.else_body: self._visit(s)

    def _visit_LoopStmt(self, n: LoopStmt):
        self._check_expr(n.count, n.line)
        for s in n.body: self._visit(s)

    def _visit_RepeatStmt(self, n: RepeatStmt):
        for s in n.body: self._visit(s)
        self._check_expr(n.condition, n.line)

    def _visit_ReturnStmt(self, n: ReturnStmt):
        if not self.current_task:
            raise SemanticError("'return' outside of a task", n.line)
        self._check_expr(n.value, n.line)

    # ── helpers ───────────────────────────
    def _require_declared(self, name: str, line: int):
        if name not in self.characters:
            raise SemanticError(f"Character '{name}' not declared", line)

    def _require_on_stage(self, name: str, line: int):
        self._require_declared(name, line)
        if not self.characters[name]["on_stage"]:
            raise SemanticError(f"Character '{name}' is not on stage yet (use ENTER {name})", line)

    def _check_expr(self, expr, line: int):
        if isinstance(expr, VarRef):
            if expr.name not in self.variables:
                raise SemanticError(f"Undefined variable '{expr.name}'", line)
        elif isinstance(expr, CallExpr):
            if expr.task not in self.tasks:
                raise SemanticError(f"Undefined task '{expr.task}'", line)
        elif isinstance(expr, BinOp):
            self._check_expr(expr.left, line)
            self._check_expr(expr.right, line)
        elif isinstance(expr, UnaryOp):
            self._check_expr(expr.operand, line)

    def _infer_type(self, expr) -> str:
        if isinstance(expr, NumberLit): return "num"
        if isinstance(expr, StringLit): return "str"
        if isinstance(expr, VarRef):
            return self.variables.get(expr.name, "any")
        return "any"


# ══════════════════════════════════════════
# PHASE 5 — INTERMEDIATE REPRESENTATION (IR)
# ══════════════════════════════════════════
# Three-Address Code (TAC) / flat instruction list.
# Each IRInstr has an opcode + up to 3 operands.
# This is simpler to optimize than the tree.

@dataclass
class IRInstr:
    op:   str
    dst:  Optional[str] = None
    src1: Any           = None
    src2: Any           = None

    def __repr__(self):
        parts = [self.op]
        if self.dst:  parts.append(f"dst={self.dst}")
        if self.src1 is not None: parts.append(f"src1={self.src1!r}")
        if self.src2 is not None: parts.append(f"src2={self.src2!r}")
        return "  " + " | ".join(parts)


class IRGenerator:
    """Lowering pass: AST → list of IRInstr"""

    def __init__(self):
        self.instrs: List[IRInstr] = []
        self._tmp = 0
        self._label = 0

    def fresh_tmp(self) -> str:
        self._tmp += 1
        return f"_t{self._tmp}"

    def fresh_label(self) -> str:
        self._label += 1
        return f"L{self._label}"

    def emit(self, op, dst=None, src1=None, src2=None):
        self.instrs.append(IRInstr(op=op, dst=dst, src1=src1, src2=src2))

    def generate(self, program: Program) -> List[IRInstr]:
        # Hoist task definitions first so they land before main body
        tasks = [n for n in program.body if isinstance(n, TaskDecl)]
        rest  = [n for n in program.body if not isinstance(n, TaskDecl)]

        for task in tasks:
            self._lower_task(task)

        self.emit("SECTION", src1="main")
        for node in rest:
            self._lower(node)
        self.emit("HALT")
        return self.instrs

    # ── lower dispatch ────────────────────
    def _lower(self, node: ASTNode):
        method = f"_lower_{type(node).__name__}"
        fn = getattr(self, method, None)
        if fn:
            fn(node)
        else:
            raise Exception(f"IRGenerator: no lowering for {type(node).__name__}")

    def _lower_SceneDecl(self, n: SceneDecl):
        self.emit("SET_SCENE", src1=n.name)

    def _lower_CharacterDecl(self, n: CharacterDecl):
        self.emit("DECL_CHAR", src1=n.name)

    def _lower_task(self, n: TaskDecl):
        self.emit("FUNC_BEGIN", src1=n.name)
        for stmt in n.body:
            self._lower(stmt)
        self.emit("FUNC_END", src1=n.name)

    def _lower_TaskDecl(self, n: TaskDecl):
        self._lower_task(n)

    def _lower_EnterStmt(self, n: EnterStmt):
        self.emit("ENTER", src1=n.character)

    def _lower_ExitStmt(self, n: ExitStmt):
        self.emit("EXIT", src1=n.character)

    def _lower_SayStmt(self, n: SayStmt):
        self.emit("SAY", src1=n.character, src2=n.text)

    def _lower_MoveStmt(self, n: MoveStmt):
        steps_tmp = self._lower_expr(n.steps)
        self.emit("MOVE", src1=n.character, src2=n.direction, dst=steps_tmp)

    def _lower_WaitStmt(self, n: WaitStmt):
        dur_tmp = self._lower_expr(n.duration)
        self.emit("WAIT", src1=dur_tmp)

    def _lower_EmoteStmt(self, n: EmoteStmt):
        self.emit("EMOTE", src1=n.character, src2=n.emotion)

    def _lower_DoStmt(self, n: DoStmt):
        self.emit("CALL", src1=n.task)

    def _lower_LetStmt(self, n: LetStmt):
        tmp = self._lower_expr(n.value)
        self.emit("STORE", dst=n.name, src1=tmp)

    def _lower_SetStmt(self, n: SetStmt):
        tmp = self._lower_expr(n.value)
        self.emit("STORE", dst=n.name, src1=tmp)

    def _lower_PrintStmt(self, n: PrintStmt):
        tmp = self._lower_expr(n.value)
        self.emit("PRINT", src1=tmp)

    def _lower_IfStmt(self, n: IfStmt):
        cond_tmp = self._lower_expr(n.condition)
        else_lbl = self.fresh_label()
        end_lbl  = self.fresh_label()
        self.emit("JMP_FALSE", src1=cond_tmp, dst=else_lbl)
        for s in n.then_body: self._lower(s)
        self.emit("JMP", dst=end_lbl)
        self.emit("LABEL", src1=else_lbl)
        for s in n.else_body: self._lower(s)
        self.emit("LABEL", src1=end_lbl)

    def _lower_LoopStmt(self, n: LoopStmt):
        count_tmp = self._lower_expr(n.count)
        iter_var  = self.fresh_tmp()
        zero_tmp  = self.fresh_tmp()
        one_tmp   = self.fresh_tmp()
        loop_lbl  = self.fresh_label()
        end_lbl   = self.fresh_label()
        # Always use LOAD_CONST so iter_var is initialised via a proper tmp.
        # Bare int literals as src1 to STORE confuse DSE and _resolve.
        self.emit("LOAD_CONST", dst=zero_tmp, src1=0.0)
        self.emit("STORE",      dst=iter_var, src1=zero_tmp)
        self.emit("LABEL",      src1=loop_lbl)
        cmp_tmp = self.fresh_tmp()
        self.emit("BINOP",      dst=cmp_tmp, src1=iter_var, src2=(count_tmp, "<"))
        self.emit("JMP_FALSE",  src1=cmp_tmp, dst=end_lbl)
        for s in n.body:
            self._lower(s)
        inc_tmp = self.fresh_tmp()
        self.emit("LOAD_CONST", dst=one_tmp, src1=1.0)
        self.emit("BINOP",      dst=inc_tmp, src1=iter_var, src2=(one_tmp, "+"))
        self.emit("STORE",      dst=iter_var, src1=inc_tmp)
        self.emit("JMP",        dst=loop_lbl)
        self.emit("LABEL",      src1=end_lbl)

    def _lower_RepeatStmt(self, n: RepeatStmt):
        loop_lbl = self.fresh_label()
        self.emit("LABEL", src1=loop_lbl)
        for s in n.body: self._lower(s)
        cond_tmp = self._lower_expr(n.condition)
        self.emit("JMP_FALSE", src1=cond_tmp, dst=loop_lbl)

    def _lower_ReturnStmt(self, n: ReturnStmt):
        val_tmp = self._lower_expr(n.value)
        self.emit("RETURN", src1=val_tmp)

    # ── expression lowering (returns tmp name or literal) ──
    def _lower_expr(self, expr) -> str:
        if isinstance(expr, NumberLit):
            tmp = self.fresh_tmp()
            self.emit("LOAD_CONST", dst=tmp, src1=expr.value)
            return tmp
        if isinstance(expr, StringLit):
            tmp = self.fresh_tmp()
            self.emit("LOAD_CONST", dst=tmp, src1=expr.value)
            return tmp
        if isinstance(expr, VarRef):
            tmp = self.fresh_tmp()
            self.emit("LOAD_VAR", dst=tmp, src1=expr.name)
            return tmp
        if isinstance(expr, BinOp):
            l = self._lower_expr(expr.left)
            r = self._lower_expr(expr.right)
            tmp = self.fresh_tmp()
            self.emit("BINOP", dst=tmp, src1=l, src2=(r, expr.op))
            return tmp
        if isinstance(expr, UnaryOp):
            v = self._lower_expr(expr.operand)
            tmp = self.fresh_tmp()
            self.emit("UNOP", dst=tmp, src1=v, src2=expr.op)
            return tmp
        if isinstance(expr, CallExpr):
            tmp = self.fresh_tmp()
            self.emit("CALL_EXPR", dst=tmp, src1=expr.task)
            return tmp
        raise Exception(f"IRGenerator: unknown expr {type(expr).__name__}")


# ══════════════════════════════════════════
# PHASE 6 — IR OPTIMIZER
# ══════════════════════════════════════════
# Passes applied to the flat IR list:
#   1. Constant Folding  — evaluate BINOP/UNOP on two constants at compile time
#   2. Dead Store Elim  — remove STORE to a tmp that's never LOADed
#   3. Peephole         — collapse LOAD_CONST + STORE into a single CONST_STORE

class IROptimizer:
    def __init__(self, verbose=False):
        self.verbose = verbose

    def run(self, instrs: List[IRInstr]) -> List[IRInstr]:
        passes = [
            ("Constant Folding",  self._constant_folding),
            ("Dead Store Elim",   self._dead_store_elim),
            ("Peephole",          self._peephole),
        ]
        for name, fn in passes:
            before = len(instrs)
            instrs = fn(instrs)
            after  = len(instrs)
            if self.verbose:
                print(f"  ✦ {name}: {before} → {after} instructions")
        return instrs

    # Pass 1: Constant Folding
    def _constant_folding(self, instrs: List[IRInstr]) -> List[IRInstr]:
        const_map: Dict[str, Any] = {}  # tmp → literal value
        result = []
        for instr in instrs:
            if instr.op == "LOAD_CONST":
                const_map[instr.dst] = instr.src1
                result.append(instr)
            elif instr.op == "BINOP":
                rhs_tmp, op = instr.src2
                lv = const_map.get(instr.src1)
                rv = const_map.get(rhs_tmp)
                if lv is not None and rv is not None and isinstance(lv, (int, float)) and isinstance(rv, (int, float)):
                    folded = self._fold(lv, rv, op)
                    if folded is not None:
                        new_instr = IRInstr("LOAD_CONST", dst=instr.dst, src1=folded)
                        const_map[instr.dst] = folded
                        result.append(new_instr)
                        continue
                result.append(instr)
            elif instr.op == "UNOP":
                v = const_map.get(instr.src1)
                if v is not None and isinstance(v, (int, float)):
                    if instr.src2 == "-":
                        folded = -v
                        const_map[instr.dst] = folded
                        result.append(IRInstr("LOAD_CONST", dst=instr.dst, src1=folded))
                        continue
                result.append(instr)
            else:
                result.append(instr)
        return result

    def _fold(self, a, b, op):
        try:
            if op == "+":  return a + b
            if op == "-":  return a - b
            if op == "*":  return a * b
            if op == "/":  return a / b if b != 0 else None
            if op == "==": return float(a == b)
            if op == "!=": return float(a != b)
            if op == "<":  return float(a < b)
            if op == ">":  return float(a > b)
            if op == "<=": return float(a <= b)
            if op == ">=": return float(a >= b)
        except:
            pass
        return None

    # Pass 2: Dead Store Elimination
    def _dead_store_elim(self, instrs: List[IRInstr]) -> List[IRInstr]:
        # Collect all tmps used as operands (sources).
        # MOVE is special: its dst field holds the steps tmp (it is a USE, not a define).
        # WAIT's src1 is always a use.
        # Loop counter tmps appear in BINOP src2 tuples.
        used: set = set()
        for instr in instrs:
            # src1 uses
            if isinstance(instr.src1, str) and instr.src1.startswith("_t"):
                used.add(instr.src1)
            # src2 uses — plain string or (tmp, op) tuple
            if isinstance(instr.src2, tuple):
                tmp, _ = instr.src2
                if isinstance(tmp, str) and tmp.startswith("_t"):
                    used.add(tmp)
            elif isinstance(instr.src2, str) and instr.src2.startswith("_t"):
                used.add(instr.src2)
            # MOVE: dst is actually a USE (it holds the steps tmp)
            if instr.op == "MOVE" and isinstance(instr.dst, str) and instr.dst.startswith("_t"):
                used.add(instr.dst)
            # STORE: src1 may be a tmp name (loop counter init path)
            if instr.op == "STORE" and isinstance(instr.src1, str) and instr.src1.startswith("_t"):
                used.add(instr.src1)

        result = []
        for instr in instrs:
            # Only eliminate a STORE/LOAD_CONST/BINOP whose dst tmp is never read.
            # Never eliminate MOVE (its dst is a use), WAIT, or any side-effect op.
            if (instr.op in ("LOAD_CONST", "BINOP", "UNOP", "LOAD_VAR")
                    and instr.dst
                    and instr.dst.startswith("_t")
                    and instr.dst not in used):
                continue  # genuinely dead — skip
            result.append(instr)
        return result

    # Pass 3: Peephole — LOAD_CONST _t1 X; WAIT _t1  →  WAIT_CONST X
    def _peephole(self, instrs: List[IRInstr]) -> List[IRInstr]:
        result = []
        i = 0
        while i < len(instrs):
            cur = instrs[i]
            nxt = instrs[i+1] if i+1 < len(instrs) else None

            if cur.op == "LOAD_CONST" and nxt and nxt.op == "WAIT" and nxt.src1 == cur.dst:
                result.append(IRInstr("WAIT_CONST", src1=cur.src1))
                i += 2
                continue

            # (MOVE_CONST fusion removed — MOVE dst encodes the steps tmp,
            #  fusing it here would destroy the who/dir/steps mapping.)

            result.append(cur)
            i += 1
        return result


# ══════════════════════════════════════════
# PHASE 7 — CODE GENERATOR
# ══════════════════════════════════════════
# Interprets optimized IR and produces:
#   • Runtime execution (animation actions list)
#   • JSON output for the Animator

class RuntimeError_(Exception):
    def __init__(self, msg):
        super().__init__(f"🔴 RuntimeError — {msg}")

class CodeGenerator:
    def __init__(self):
        self.actions: List[dict]  = []
        self.env:     Dict[str, Any] = {}   # variables
        self.scene:   Optional[str] = None
        self.characters: Dict[str, bool] = {}   # name → on_stage
        self.tasks:   Dict[str, List[IRInstr]] = {}
        self.return_val: Any = None

    def execute(self, instrs: List[IRInstr]) -> dict:
        # First pass: collect task definitions
        i = 0
        while i < len(instrs):
            ins = instrs[i]
            if ins.op == "FUNC_BEGIN":
                task_name = ins.src1
                body = []
                i += 1
                while i < len(instrs) and not (instrs[i].op == "FUNC_END" and instrs[i].src1 == task_name):
                    body.append(instrs[i])
                    i += 1
                self.tasks[task_name] = body
            i += 1

        # Second pass: execute main section
        in_main = False
        main_instrs = []
        for ins in instrs:
            if ins.op == "SECTION" and ins.src1 == "main":
                in_main = True
                continue
            if in_main and ins.op not in ("FUNC_BEGIN", "FUNC_END"):
                main_instrs.append(ins)

        self._run(main_instrs)
        return {
            "scene": self.scene,
            "characters": list(self.characters.keys()),
            "actions": self.actions,
            "metadata": {
                "compiler": "Parsia v1.0",
                "actionCount": len(self.actions),
                "characterCount": len(self.characters)
            }
        }

    def _run(self, instrs: List[IRInstr]):
        """Execute a list of IR instructions. Handles jumps via index."""
        # Build label map
        label_map: Dict[str, int] = {}
        for idx, ins in enumerate(instrs):
            if ins.op == "LABEL":
                label_map[ins.src1] = idx

        ip = 0
        while ip < len(instrs):
            ins = instrs[ip]
            ip += 1

            if ins.op == "HALT" or ins.op == "FUNC_BEGIN" or ins.op == "FUNC_END":
                break

            elif ins.op == "SECTION":
                pass

            elif ins.op == "LABEL":
                pass

            elif ins.op == "SET_SCENE":
                if self.scene is not None and ins.src1 != self.scene:
                    # Emit a scene_change action for mid-story scene transitions
                    self.actions.append({"type": "scene_change", "scene": ins.src1})
                    print(f"  🎬 Scene change: {self.scene} → {ins.src1}")
                self.scene = ins.src1
                print(f"  🎬 Scene: {self.scene}")

            elif ins.op == "DECL_CHAR":
                self.characters[ins.src1] = False
                print(f"  👤 Declared: {ins.src1}")

            elif ins.op == "ENTER":
                self.characters[ins.src1] = True
                self.actions.append({"type": "enter", "who": ins.src1})
                print(f"  🚪 ENTER: {ins.src1}")

            elif ins.op == "EXIT":
                self.characters[ins.src1] = False
                self.actions.append({"type": "exit", "who": ins.src1})
                print(f"  🚶 EXIT: {ins.src1}")

            elif ins.op == "SAY":
                self.actions.append({"type": "say", "who": ins.src1, "text": ins.src2})
                print(f"  💬 SAY: {ins.src1} → \"{ins.src2}\"")

            elif ins.op == "MOVE":
                # Encoding: src1=character  src2=direction  dst=steps_tmp
                who       = ins.src1
                direction = ins.src2
                steps     = int(self._resolve(ins.dst))
                self.actions.append({"type": "move", "who": who, "dir": direction, "steps": steps})
                print(f"  🚶 MOVE: {who} {direction} {steps}")

            elif ins.op in ("WAIT", "WAIT_CONST"):
                dur = ins.src1 if ins.op == "WAIT_CONST" else self._resolve(ins.src1)
                self.actions.append({"type": "wait", "duration": dur})
                print(f"  ⏸️  WAIT: {dur}s")

            elif ins.op == "EMOTE":
                self.actions.append({"type": "emote", "who": ins.src1, "emotion": ins.src2})
                print(f"  🎭 EMOTE: {ins.src1} → {ins.src2}")

            elif ins.op == "LOAD_CONST":
                self.env[ins.dst] = ins.src1

            elif ins.op == "LOAD_VAR":
                if ins.src1 not in self.env:
                    raise RuntimeError_(f"Undefined variable '{ins.src1}'")
                self.env[ins.dst] = self.env[ins.src1]

            elif ins.op == "STORE":
                val = self.env.get(ins.src1, ins.src1)
                self.env[ins.dst] = val

            elif ins.op == "BINOP":
                rhs_tmp, op = ins.src2
                lv = self._resolve(ins.src1)
                rv = self._resolve(rhs_tmp)
                self.env[ins.dst] = self._apply_op(lv, rv, op)

            elif ins.op == "UNOP":
                v = self._resolve(ins.src1)
                if ins.src2 == "-": self.env[ins.dst] = -v
                elif ins.src2 == "not": self.env[ins.dst] = not v

            elif ins.op == "PRINT":
                val = self._resolve(ins.src1)
                print(f"  📢 PRINT: {val}")

            elif ins.op == "JMP":
                ip = label_map[ins.dst]

            elif ins.op == "JMP_FALSE":
                cond = self._resolve(ins.src1)
                if not cond:
                    ip = label_map[ins.dst]

            elif ins.op == "CALL" or ins.op == "CALL_EXPR":
                result = self._call_task(ins.src1)
                if ins.op == "CALL_EXPR" and ins.dst:
                    self.env[ins.dst] = result

            elif ins.op == "RETURN":
                self.return_val = self._resolve(ins.src1)
                break

            else:
                raise RuntimeError_(f"Unknown IR opcode '{ins.op}'")

    def _call_task(self, task_name: str):
        if task_name not in self.tasks:
            raise RuntimeError_(f"Task '{task_name}' not found")
        saved_ret = self.return_val
        self.return_val = None
        self._run(self.tasks[task_name])
        result = self.return_val
        self.return_val = saved_ret
        return result

    def _resolve(self, key) -> Any:
        if isinstance(key, (int, float)): return key
        if isinstance(key, str) and key in self.env: return self.env[key]
        return key

    def _apply_op(self, a, b, op):
        if op == "+":  return a + b
        if op == "-":  return a - b
        if op == "*":  return a * b
        if op == "/":  return a / b
        if op == "==": return a == b
        if op == "!=": return a != b
        if op == "<":  return a < b
        if op == ">":  return a > b
        if op == "<=": return a <= b
        if op == ">=": return a >= b
        if op == "and": return a and b
        if op == "or":  return a or b
        raise RuntimeError_(f"Unknown operator '{op}'")


# ══════════════════════════════════════════
# MAIN DRIVER
# ══════════════════════════════════════════

def compile_source(source: str, verbose: bool = False) -> dict:
    """Compile a .story source string and return the animation JSON as a dict."""
    lexer = Lexer(source)
    tokens = lexer.tokenize()
    parser = Parser(tokens)
    ast = parser.parse()
    sem = SemanticAnalyser()
    sem.analyse(ast)
    irgen = IRGenerator()
    ir = irgen.generate(ast)
    optimizer = IROptimizer(verbose=verbose)
    ir_opt = optimizer.run(ir)
    codegen = CodeGenerator()
    return codegen.execute(ir_opt)


def compile_file(filepath: str, output_file: Optional[str] = None, verbose: bool = False):
    DIVIDER = "═" * 56

    print(f"\n{'Parsia v1.0':^56}")
    print(DIVIDER)

    with open(filepath) as f:
        source = f.read()

    # ── Phase 1: Lexing ─────────────────────────────────────
    print("\n▶ Phase 1: Lexical Analysis")
    lexer = Lexer(source)
    tokens = lexer.tokenize()
    if verbose:
        for tok in tokens[:30]:
            print(f"   {tok}")
        if len(tokens) > 30:
            print(f"   ... ({len(tokens)} tokens total)")
    else:
        print(f"   Produced {len(tokens)} tokens ✓")

    # ── Phase 2-3: Parsing ──────────────────────────────────
    print("\n▶ Phase 2-3: Parsing (AST construction)")
    parser = Parser(tokens)
    ast = parser.parse()
    print(f"   AST root has {len(ast.body)} top-level nodes ✓")

    # ── Phase 4: Semantic Analysis ──────────────────────────
    print("\n▶ Phase 4: Semantic Analysis")
    sem = SemanticAnalyser()
    sem.analyse(ast)
    if sem.warnings:
        for w in sem.warnings:
            print(f"   ⚠️  {w}")
    print(f"   {len(sem.characters)} character(s), {len(sem.tasks)} task(s), {len(sem.variables)} variable(s) ✓")

    # ── Phase 5: IR Generation ──────────────────────────────
    print("\n▶ Phase 5: IR Generation (Three-Address Code)")
    irgen = IRGenerator()
    ir = irgen.generate(ast)
    print(f"   {len(ir)} IR instructions generated ✓")
    if verbose:
        print("   --- IR ---")
        for ins in ir:
            print(f"   {ins}")

    # ── Phase 6: Optimization ───────────────────────────────
    print("\n▶ Phase 6: Optimization")
    optimizer = IROptimizer(verbose=True)
    ir_opt = optimizer.run(ir)
    print(f"   {len(ir)} → {len(ir_opt)} instructions after optimization ✓")
    if verbose:
        print("   --- Optimized IR ---")
        for ins in ir_opt:
            print(f"   {ins}")

    # ── Phase 7: Code Generation / Execution ────────────────
    print("\n▶ Phase 7: Code Generation & Execution")
    codegen = CodeGenerator()
    output = codegen.execute(ir_opt)

    # ── Output ───────────────────────────────────────────────
    json_out = json.dumps(output, indent=2)
    if output_file:
        with open(output_file, "w") as f:
            f.write(json_out)
        print(f"\n✅ Animation JSON saved to: {output_file}")
    else:
        print("\n" + DIVIDER)
        print("📋 GENERATED ANIMATION JSON:")
        print(DIVIDER)
        print(json_out)

    print(f"\n{'Compilation successful! 🎉':^56}")
    print(DIVIDER)
    return output


def main():
    import argparse
    ap = argparse.ArgumentParser(description="Parsia v1.0")
    ap.add_argument("script",  help="Path to .story script file")
    ap.add_argument("-o", "--output", help="Output JSON file", default=None)
    ap.add_argument("-v", "--verbose", action="store_true", help="Print tokens and IR")
    args = ap.parse_args()
    compile_file(args.script, args.output, args.verbose)


if __name__ == "__main__":
    main()
