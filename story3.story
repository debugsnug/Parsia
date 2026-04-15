SCENE Castle

CHARACTER Hero
CHARACTER Villain
CHARACTER Companion

ENTER Hero
ENTER Companion

Hero SAY "This forest... it's darker than I remember."
Companion SAY "Stay close. I don't like this place."

Hero EMOTE thinking
Companion EMOTE scared

WAIT 2

loop 2:
    Hero MOVE UP 1
    Companion MOVE UP 1

WAIT 1

ENTER Villain

Villain EMOTE angry
Villain SAY "You shouldn't have come here."

Hero EMOTE surprised
Companion EMOTE scared

Hero SAY "Who are you?!"

WAIT 1

loop 2:
    Villain MOVE LEFT 2
    Villain MOVE RIGHT 2

Villain SAY "This forest belongs to me."

let courage = 0
repeat:
    Hero EMOTE thinking
    WAIT 1
    set courage = courage + 1
until courage >= 2

if courage >= 2:
    Hero EMOTE angry
    Hero SAY "We’re not afraid of you!"
else:
    Hero EMOTE scared
    Hero SAY "We should run..."

WAIT 1

loop 3:
    Hero MOVE RIGHT 1
    Companion MOVE LEFT 1

Companion SAY "I'm with you!"

Villain EMOTE surprised
Villain SAY "Impressive... but not enough."

WAIT 1

Hero EMOTE angry
Villain EMOTE angry

Hero SAY "This ends now!"
Villain SAY "Then come at me!"

WAIT 2

Villain EMOTE sad
Villain SAY "You have spirit..."

Hero EMOTE happy
Companion EMOTE happy

Hero SAY "We fight together."

WAIT 1

EXIT Villain

Companion SAY "Did we win...?"
Hero SAY "For now."

Hero EMOTE thinking

WAIT 2

Hero SAY "Let's leave this place."

EXIT Hero
EXIT Companion
