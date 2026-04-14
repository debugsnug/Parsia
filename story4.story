SCENE DarkForest

CHARACTER Hero
CHARACTER Villain
CHARACTER Companion

ENTER Hero
ENTER Companion

Hero SAY "This ends tonight."
Companion SAY "I'm right behind you."

Hero EMOTE thinking
Companion EMOTE scared

WAIT 1

# Approach the battlefield
loop 2:
    Hero MOVE UP 1
    Companion MOVE UP 1

WAIT 1

# Villain entrance (mad boss aura)
ENTER Villain

Villain EMOTE angry
Villain SAY "So... you finally made it."

Hero EMOTE angry
Hero SAY "We’re not backing down."

WAIT 1

# ───────────── PHASE 1: PROBING ATTACK ─────────────

# Hero dashes forward and back
loop 2:
    Hero MOVE RIGHT 2
    Hero MOVE LEFT 2

Hero SAY "Let’s test your strength!"

# Villain counters with aggressive movement
loop 2:
    Villain MOVE LEFT 2
    Villain MOVE RIGHT 2

Villain EMOTE angry
Villain SAY "Too slow!"

WAIT 1

# ───────────── PHASE 2: SPEED EXCHANGE ─────────────

loop 3:
    Hero MOVE RIGHT 1
    Villain MOVE LEFT 1
    Hero MOVE LEFT 1
    Villain MOVE RIGHT 1

Hero EMOTE surprised
Villain EMOTE surprised

Hero SAY "He's fast..."
Villain SAY "You can barely keep up."

WAIT 1

# Companion supports
Companion SAY "Focus! You can do this!"
Companion EMOTE wave

# ───────────── PHASE 3: POWER BUILDUP ─────────────

let energy = 0
repeat:
    Hero EMOTE thinking
    WAIT 1
    set energy = energy + 1
until energy >= 3

Hero EMOTE angry
Hero SAY "This is my full power!"

# ───────────── PHASE 4: HEAVY STRIKES ─────────────

loop 3:
    Hero MOVE RIGHT 2
    Villain MOVE LEFT 1
    WAIT 1

Villain EMOTE angry
Villain SAY "Impressive... but not enough!"

# Villain retaliates
loop 2:
    Villain MOVE RIGHT 3
    Hero MOVE LEFT 2

Hero EMOTE scared
Companion EMOTE scared

WAIT 1

# ───────────── PHASE 5: TURNING POINT ─────────────

if energy >= 3:
    Hero EMOTE angry
    Hero SAY "I won't lose!"

    loop 2:
        Hero MOVE RIGHT 3
        Villain MOVE LEFT 2

    Villain EMOTE surprised
    Villain SAY "What?!"
else:
    Hero EMOTE sad
    Hero SAY "I... can't..."

WAIT 1

# ───────────── FINAL CLASH ─────────────

Hero EMOTE angry
Villain EMOTE angry

Hero SAY "THIS IS IT!"
Villain SAY "COME!"

loop 4:
    Hero MOVE RIGHT 1
    Villain MOVE LEFT 1

WAIT 2

# Aftermath
Villain EMOTE sad
Villain SAY "You... surpassed me..."

Hero EMOTE tired
Hero SAY "It's over."

Companion EMOTE happy
Companion SAY "You did it!"

WAIT 2

# Exit
EXIT Villain

Hero EMOTE happy
Hero SAY "We survived."

EXIT Hero
EXIT Companion
