SCENE SilentNight

CHARACTER Ayaan
CHARACTER Mira

ENTER Ayaan
ENTER Mira

Ayaan SAY "It's quiet tonight..."
Mira SAY "Too quiet. Something feels off."

Ayaan EMOTE thinking
Mira EMOTE scared

WAIT 2

# Ayaan walks around restlessly
loop 3:
    Ayaan MOVE RIGHT 1
    Ayaan MOVE LEFT 1

Ayaan SAY "I can't stay still."

# Mira tries to calm herself
let calm = 0
repeat:
    Mira EMOTE thinking
    WAIT 1
    set calm = calm + 1
until calm >= 2

Mira EMOTE sad
Mira SAY "I'm trying... but I still feel uneasy."

# Tension builds
if calm >= 2:
    Ayaan SAY "It's okay, I'm here."
    Ayaan EMOTE happy
else:
    Ayaan SAY "Something is really wrong..."
    Ayaan EMOTE scared

WAIT 1

# Both react suddenly
Ayaan EMOTE surprised
Mira EMOTE surprised

Ayaan SAY "Did you hear that?!"
Mira SAY "Yeah... behind us..."

# They move together slowly
loop 2:
    Ayaan MOVE UP 1
    Mira MOVE UP 1

WAIT 1

# Final emotional shift
Ayaan EMOTE angry
Ayaan SAY "Whatever it is, I'm not afraid anymore."

Mira EMOTE happy
Mira SAY "Then let's face it together."

WAIT 2

Ayaan EMOTE happy
Mira EMOTE wave

Ayaan SAY "We made it through the night."
Mira SAY "Yeah... together."

EXIT Ayaan
EXIT Mira
