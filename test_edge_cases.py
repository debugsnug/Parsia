"""Edge-case tests for Parsia compiler."""
import sys, json, traceback
sys.path.insert(0, ".")
from story_compiler import compile_source, LexerError, ParseError, SemanticError, RuntimeError_

passed = 0
failed = 0

def test(name, fn):
    global passed, failed
    try:
        fn()
        print(f"  ✅ {name}")
        passed += 1
    except Exception as e:
        print(f"  ❌ {name}: {e}")
        traceback.print_exc()
        failed += 1

# ───────────────────────────────────────────
# 1. HAPPY PATH: Minimal story
# ───────────────────────────────────────────
def test_minimal():
    src = '''SCENE Park
CHARACTER Sam
ENTER Sam
Sam SAY "Hello"
EXIT Sam
'''
    r = compile_source(src)
    assert r["scene"] == "Park"
    assert "Sam" in r["characters"]
    assert len(r["actions"]) == 3  # enter, say, exit

test("Minimal story", test_minimal)

# ───────────────────────────────────────────
# 2. HAPPY PATH: Variables & expressions
# ───────────────────────────────────────────
def test_variables():
    src = '''SCENE Lab
CHARACTER Bot
ENTER Bot
let x = 5
set x = x + 3
print x
Bot SAY "Done"
EXIT Bot
'''
    r = compile_source(src)
    assert r["scene"] == "Lab"
    assert len(r["actions"]) >= 2  # enter, say, exit

test("Variables & expressions", test_variables)

# ───────────────────────────────────────────
# 3. HAPPY PATH: Tasks / do statements
# ───────────────────────────────────────────
def test_tasks():
    src = '''SCENE Arena
CHARACTER Warrior
task greet:
    Warrior SAY "Hail!"
ENTER Warrior
do greet
EXIT Warrior
'''
    r = compile_source(src)
    assert any(a["type"] == "say" and a["text"] == "Hail!" for a in r["actions"])

test("Tasks & do statements", test_tasks)

# ───────────────────────────────────────────
# 4. HAPPY PATH: Loop unrolling
# ───────────────────────────────────────────
def test_loop():
    src = '''SCENE Track
CHARACTER Runner
ENTER Runner
loop 3:
    Runner MOVE RIGHT 1
EXIT Runner
'''
    r = compile_source(src)
    move_actions = [a for a in r["actions"] if a["type"] == "move"]
    assert len(move_actions) == 3, f"Expected 3 moves, got {len(move_actions)}"

test("Loop execution (3 iterations)", test_loop)

# ───────────────────────────────────────────
# 5. HAPPY PATH: If/else
# ───────────────────────────────────────────
def test_if_then():
    src = '''SCENE Lab
CHARACTER Bot
ENTER Bot
let x = 10
if x > 5:
    Bot SAY "big"
else:
    Bot SAY "small"
EXIT Bot
'''
    r = compile_source(src)
    says = [a for a in r["actions"] if a["type"] == "say"]
    assert len(says) == 1
    assert says[0]["text"] == "big"

test("If/else conditional", test_if_then)

# ───────────────────────────────────────────
# 6. ERROR: Undeclared character
# ───────────────────────────────────────────
def test_undeclared_char():
    src = '''SCENE Park
ENTER Ghost
'''
    try:
        compile_source(src)
        assert False, "Should have thrown SemanticError"
    except SemanticError:
        pass

test("Error: undeclared character", test_undeclared_char)

# ───────────────────────────────────────────
# 7. ERROR: Character not on stage
# ───────────────────────────────────────────
def test_not_on_stage():
    src = '''SCENE Park
CHARACTER Shy
Shy SAY "Boo"
'''
    try:
        compile_source(src)
        assert False, "Should have thrown SemanticError"
    except SemanticError:
        pass

test("Error: character not on stage", test_not_on_stage)

# ───────────────────────────────────────────
# 8. ERROR: Undefined variable
# ───────────────────────────────────────────
def test_undefined_var():
    src = '''SCENE Lab
CHARACTER Bot
ENTER Bot
print y
EXIT Bot
'''
    try:
        compile_source(src)
        assert False, "Should have thrown SemanticError"
    except SemanticError:
        pass

test("Error: undefined variable", test_undefined_var)

# ───────────────────────────────────────────
# 9. ERROR: Undefined task
# ───────────────────────────────────────────
def test_undefined_task():
    src = '''SCENE Arena
CHARACTER Hero
ENTER Hero
do nonexistent
EXIT Hero
'''
    try:
        compile_source(src)
        assert False, "Should have thrown SemanticError"
    except SemanticError:
        pass

test("Error: undefined task", test_undefined_task)

# ───────────────────────────────────────────
# 10. ERROR: Duplicate character declaration
# ───────────────────────────────────────────
def test_duplicate_char():
    src = '''SCENE Park
CHARACTER Sam
CHARACTER Sam
'''
    try:
        compile_source(src)
        assert False, "Should have thrown SemanticError"
    except SemanticError:
        pass

test("Error: duplicate character", test_duplicate_char)

# ───────────────────────────────────────────
# 11. ERROR: Unterminated string
# ───────────────────────────────────────────
def test_bad_string():
    src = '''SCENE Park
CHARACTER Sam
ENTER Sam
Sam SAY "no closing quote
EXIT Sam
'''
    try:
        compile_source(src)
        assert False, "Should have thrown LexerError"
    except LexerError:
        pass

test("Error: unterminated string", test_bad_string)

# ───────────────────────────────────────────
# 12. ERROR: Bad indentation
# ───────────────────────────────────────────
def test_bad_indent():
    src = '''SCENE Park
CHARACTER Sam
ENTER Sam
    Sam SAY "bad indent"
EXIT Sam
'''
    try:
        compile_source(src)
        assert False, "Should have thrown ParseError"
    except (ParseError, LexerError):
        pass

test("Error: bad indentation", test_bad_indent)

# ───────────────────────────────────────────
# 13. HAPPY PATH: All 4 directions
# ───────────────────────────────────────────
def test_all_directions():
    src = '''SCENE Grid
CHARACTER Dot
ENTER Dot
Dot MOVE LEFT 1
Dot MOVE RIGHT 1
Dot MOVE UP 1
Dot MOVE DOWN 1
EXIT Dot
'''
    r = compile_source(src)
    dirs = [a["dir"] for a in r["actions"] if a["type"] == "move"]
    assert dirs == ["LEFT", "RIGHT", "UP", "DOWN"]

test("All 4 directions", test_all_directions)

# ───────────────────────────────────────────
# 14. HAPPY PATH: Multiple scenes (redeclaration is a warning, not error)
# ───────────────────────────────────────────
def test_scene_change():
    src = '''SCENE Forest
CHARACTER Wanderer
ENTER Wanderer
Wanderer SAY "I'm in the forest."
SCENE Desert
Wanderer SAY "Now I'm in the desert."
EXIT Wanderer
'''
    r = compile_source(src)
    assert r["scene"] == "Desert"
    scene_changes = [a for a in r["actions"] if a["type"] == "scene_change"]
    assert len(scene_changes) == 1

test("Scene change mid-story", test_scene_change)

# ───────────────────────────────────────────
# 15. HAPPY PATH: Emote all emotions
# ───────────────────────────────────────────
def test_emotes():
    src = '''SCENE Emote
CHARACTER Actor
ENTER Actor
Actor EMOTE happy
Actor EMOTE sad
Actor EMOTE angry
Actor EMOTE scared
Actor EMOTE surprised
Actor EMOTE thinking
EXIT Actor
'''
    r = compile_source(src)
    emotes = [a["emotion"] for a in r["actions"] if a["type"] == "emote"]
    assert len(emotes) == 6

test("All standard emotes", test_emotes)

# ───────────────────────────────────────────
# 16. HAPPY PATH: Wait with expression
# ───────────────────────────────────────────
def test_wait_expr():
    src = '''SCENE Lab
CHARACTER Bot
ENTER Bot
let t = 2
WAIT t
EXIT Bot
'''
    r = compile_source(src)
    waits = [a for a in r["actions"] if a["type"] == "wait"]
    assert len(waits) == 1

test("Wait with variable expression", test_wait_expr)

# ───────────────────────────────────────────
# 17. HAPPY PATH: Nested loops
# ───────────────────────────────────────────
def test_nested_loops():
    src = '''SCENE Arena
CHARACTER Knight
ENTER Knight
loop 2:
    loop 2:
        Knight MOVE RIGHT 1
EXIT Knight
'''
    r = compile_source(src)
    moves = [a for a in r["actions"] if a["type"] == "move"]
    assert len(moves) == 4, f"Expected 4 moves from nested 2x2 loop, got {len(moves)}"

test("Nested loops (2x2)", test_nested_loops)

# ───────────────────────────────────────────
# 18. HAPPY PATH: Task with return value
# ───────────────────────────────────────────
def test_task_return():
    src = '''SCENE Lab
CHARACTER Bot
task getValue:
    return 42
ENTER Bot
let v = getValue()
print v
Bot SAY "Done"
EXIT Bot
'''
    r = compile_source(src)
    assert r["scene"] == "Lab"

test("Task with return value", test_task_return)

# ───────────────────────────────────────────
# 19. OPTIMIZER: Constant folding
# ───────────────────────────────────────────
def test_constant_fold():
    src = '''SCENE Lab
CHARACTER Bot
ENTER Bot
let x = 2 + 3
WAIT 1 + 1
Bot SAY "ok"
EXIT Bot
'''
    r = compile_source(src)
    waits = [a for a in r["actions"] if a["type"] == "wait"]
    assert waits[0]["duration"] == 2.0, f"Expected wait of 2.0, got {waits[0]['duration']}"

test("Optimizer: constant folding", test_constant_fold)

# ───────────────────────────────────────────
# 20. OUTPUT: Valid JSON structure
# ───────────────────────────────────────────
def test_json_structure():
    src = '''SCENE Park
CHARACTER Sam
ENTER Sam
Sam SAY "Hi"
EXIT Sam
'''
    r = compile_source(src)
    j = json.dumps(r)
    parsed = json.loads(j)
    assert "scene" in parsed
    assert "characters" in parsed
    assert "actions" in parsed
    assert "metadata" in parsed
    assert parsed["metadata"]["compiler"] == "Parsia v1.0"

test("Valid JSON output structure", test_json_structure)


# ───────────────────────────────────────────
print(f"\n{'='*50}")
print(f"  Results: {passed} passed, {failed} failed")
print(f"{'='*50}")
