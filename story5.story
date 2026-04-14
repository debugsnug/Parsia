SCENE DarkForest

CHARACTER Hero
CHARACTER Villain
CHARACTER Companion

# ───────────── PHASE 1: DARK FOREST ─────────────

ENTER Hero
ENTER Companion

Hero SAY "This is where it ends."
Companion SAY "Stay sharp..."

Hero EMOTE thinking
Companion EMOTE scared

WAIT 1

loop 2:
    Hero MOVE UP 1
    Companion MOVE UP 1

# Boss enters
ENTER Villain

Villain EMOTE angry
Villain SAY "Foolish heroes..."

Hero EMOTE angry
Hero SAY "We’ll stop you!"

WAIT 1

# Combat exchange
loop 3:
    Hero MOVE RIGHT 1
    Villain MOVE LEFT 1
    Hero MOVE LEFT 1
    Villain MOVE RIGHT 1

Hero EMOTE surprised
Hero SAY "He's strong..."

# Power build
let energy = 0
repeat:
    Hero EMOTE thinking
    WAIT 1
    set energy = energy + 1
until energy >= 2

# Turning point
if energy >= 2:
    Hero EMOTE angry
    Hero SAY "Now!"
    loop 2:
        Hero MOVE RIGHT 2
        Villain MOVE LEFT 1

Villain EMOTE surprised
Villain SAY "You dare...?"

WAIT 2

# ───────────── PHASE TRANSITION ─────────────

Villain EMOTE angry
Villain SAY "Enough! Witness my TRUE power!"

WAIT 2

# Everyone leaves (scene reset)
EXIT Hero
EXIT Companion
EXIT Villain

# 🔥 ARENA CHANGE 🔥
SCENE LavaArena

ENTER Hero
ENTER Companion
ENTER Villain

Hero EMOTE surprised
Hero SAY "The ground... it's burning!"

Companion EMOTE scared
Companion SAY "We’ve been pulled into another arena!"

Villain EMOTE angry
Villain SAY "Welcome to your end."

WAIT 2

# ───────────── PHASE 2: LAVA ARENA ─────────────

# Faster, more aggressive movement
loop 3:
    Villain MOVE LEFT 2
    Villain MOVE RIGHT 2

Hero EMOTE scared
Hero SAY "He's faster now!"

# Companion supports
Companion EMOTE wave
Companion SAY "Don't give up!"

# Hero powers up more
set energy = energy + 2
print energy

# Heavy clash
loop 4:
    Hero MOVE RIGHT 2
    Villain MOVE LEFT 2

WAIT 1

# Final decision
if energy >= 4:
    Hero EMOTE angry
    Hero SAY "This ends NOW!"

    loop 3:
        Hero MOVE RIGHT 3
        Villain MOVE LEFT 2

    Villain EMOTE sad
    Villain SAY "Impossible..."
else:
    Hero EMOTE sad
    Hero SAY "I... failed..."

WAIT 2


Hero EMOTE tired
Companion EMOTE happy

Hero SAY "It's over..."
Companion SAY "We actually did it!"

EXIT Villain

WAIT 1

Hero EMOTE happy
Hero SAY "Let's go home."

EXIT Hero
EXIT Companion
