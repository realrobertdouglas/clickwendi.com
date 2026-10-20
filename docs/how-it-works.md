# How Click Wendi works

This is the map of the demo as it stands: one night, four rooms, two layers, and a checkpoint. The playable rules are in the [README](../README.md). This file is for whoever changes the code next.

GitHub Pages serves the repository root. There is no build step on the site. Vite is the local dev server (`npm run dev`, port 47321). `base` in `vite.config.js` is `./`, and `.nojekyll` is present so Pages does not rewrite the paths. `CNAME` is `clickwendi.com`. The title credit, drawn in `src/ui.js`, is the exact string `Build by PESSS GAMES`.

The cast is fictional. The voice in the headset is The Assistant. The neighbor is Wendi, in 4B. The crime the match asks for is clicking her.

## Files

| File | Owns |
| --- | --- |
| `index.html` | The page, the caption, the Story button, the key bar, and the touch controls. |
| `src/main.js` | Input. Keys, canvas click, stick, and buttons become one packet per frame. Exposes `window.__game`. |
| `src/game.js` | The night. Modes, scenes, shooting, the flag, the tank, the endings, and the journal. |
| `src/maps.js` | Room geometry, props, which doors are open, and where a doorway drops you (`ARRIVALS`). |
| `src/rules.js` | Signal costs, checkpoint rank, and the tank math. This is what `npm test` covers. |
| `src/save.js` | `localStorage` key `clickwendi-save-v1`. |
| `src/render.js` | The canvas: people, the tool, the carried flag, lightning, floating numbers, the tank gauge, and the camera. |
| `src/ui.js` | The DOM menus, the HUD, captions, and the credit. |
| `src/style.css` | Layout, including the mobile HUD. |
| `src/audio.js` | Short tones: unlock, shot, layer, hurt, good, bad, checkpoint. |
| `tests/rules.test.js` | Signal floor, forward-only checkpoints, the tank band, and spawns that are not inside a wall. |

`src/main.js` calls `game.frame(dt, input)` and then paints the DOM and the canvas. `game.debug()` returns mode, scene, layer, Signal, HP, flag, positions, boss HP, the live caption, and the journal length. Playtests drive that object.

## Modes

`title`, `play`, `gauge`, `dead`, `story`, `vent`, `choice`, `ending`.

Begin writes a fresh checkpoint and enters the apartment. Resume reloads the saved checkpoint. Death does not write a save. Reload checkpoint restores the last write, so Signal spent since that write comes back, and HP returns to 4.

The story journal pauses play. E or Close returns. During `choice`, a click or F takes the chair and E walks away. An empty click on the canvas is a click, so it takes the chair.

## The night, in order

1. **Apartment.** The stairwell stays shut until both lessons are done. Take the headset (click or E). Press Q and see the room under the match (`briefed`). Shoot the practice plate (`drilled`). That shot does not spend Signal. Both flags open the door, and The Assistant says how the flag works.
2. **Street.** One neighbor, Wendi. The relay east of her door is the flag. She walks to it and picks it up; the flag then rides on her, and the gamertag reads HAS THE FLAG. Click or E takes it off her. She is spared and stops fighting. Carry it to the plant. Shooting her is the other way through the plant door. If she dies while holding it, the flag drops where she fell.
3. **Plant.** Drop the flag on the stand by the southwest door. The console will not start the tank while the flag is still on you. Treating the tank yields a flask. The flask is coolant. The east door opens once you have it.
4. **The Assistant.** Pour the flask into the inlet. The inlet accepts it on the street layer. Q from the match layer is required first. Pouring plays a short vent, then the choice: take the score, or walk away.

## Two layers

Q toggles `match` and `street` after the headset is on. Without it, the apartment is only the room.

Match is the shooter: magenta HUD, gamertags, diamond bodies. Street is the block: muted colors, human figures, serif captions. The same walls and the same people exist on both. The inlet in the Assistant room is a street-layer object. Her bolts exist only on the match layer, and switching to street clears them. Those bolts cross the room without hitting walls.

Entering the street or the Assistant room starts on match. Entering the plant starts on street. The apartment starts on street until the headset goes on, then switches to match.

## Flag

`flag` is `"down"`, `"carried"`, or `"dropped"`.

Down: the relay is on the street. Carried: it rides on the player as a pole and cloth behind the tool, and the relay prop is gone. Dropped: it sits on the plant stand. The player's match look gains a ring and the word CLEAR. The street look gains a pale sash.

Taking the flag sets `wendi` to `"spared"` unless she is already `"killed"`, sets `plantOpen`, and pacifies her. An old save with no `flag` field is migrated in `loadCheckpoint`: still `"pending"` means `"down"`, anything else means `"dropped"`.

`nearestProp` picks what E uses. Distance is to the edge of the prop, range 78. Rank prefers the thing you can still use. While the flag is carried, the drop stand outranks the console. A click on a headset, relay, stand, console, or inlet inside that range uses it. A click anywhere else shoots. The practice plate is a shot, not a use.

## Signal, health, shots

Signal starts at 100 and never goes below 0. `SHOT_COST` is 30. `KILL_COST` is 10, applied once when Wendi's HP reaches 0. Practice-plate shots, lightning itself, and shots into The Assistant's plate do not spend Signal. Three hits plus the kill can zero it. Taking the chair also sets it to 0.

HP is 4 hearts in the top right. Wendi is not a wall. While the flag is still down she ignores the chase and walks to the relay at 112. Once she is holding it, she aggros inside 170px or when shot, still at 112 against the player's 176, and damages at a distance under 28 about once a second. The flag stays on her through that chase. The player is immune for 1 second after a hit. A change in the player's HP floats under them for 0.9s, red for a loss and green for a heal. Entering a scene sets HP back to 4 and floats the amount regained. Wendi's hits show a yellow X and a yellow −1. Her bar steps down by 1 from 3.

A shot is instant. `shoot` faces the click, then `castBeam` steps 10px from the muzzle and stops on the first hit: practice plate, a solid, Wendi, The Assistant's plate (−30 from a plate of 1000), or one of her bolts. The drawn strike is a jagged teal bolt plus a short fork, life 0.2s. F shoots the current facing with a default travel of 240. The plate can reach 0. She does not die. The first shot on her plate is a spoken line; later shots only update the caption, so the journal does not fill with repeats.

## Checkpoints

`writeCheckpoint` stores `{ v: 1, checkpoint }`. The checkpoint is scene, Signal, headset, flask, Wendi (`pending`, `spared`, or `killed`), `briefed`, `drilled`, and `flag`. It does not store position, facing, HP, or the journal.

Rank is apartment 0, street 1, plant 2, plant with the flask 2.5, Assistant 3. `shouldAdvanceCheckpoint` only replaces the save when the new rank is higher. Headset, the lesson, picking up the flag, dropping it, and filling the flask pass `force: true`, so they write at the same rank. Walking back to an earlier room updates the live scene and does not rewind the save.

## The tank

Hold Space (or the touch valve) and pressure falls at 46 per second. Release and it rises at 20. The green band is 36–64. Inside the band, treated rises at 16 per second and spill falls. Outside it, spill rises at 20, and at 0 or 100 pressure it rises faster. Every 1.7s an inflow of 14 or 22 is added once, alternating. Treated at 100 wins the flask. Spill at 100 dumps the tank and you can try again. The math lives in `stepGauge` so the test can run it without the canvas.

## Endings

Both endings know whether Wendi is alive.

Take the score: title "You take the chair." Signal becomes 0. If she is alive, she is the first name you will assign. If she is dead, you will name the next neighbor. Either way you are the headset.

Walk away: title "You walk off the path." Signal stays where it was. Alive, she asks if the game is over and you say yes. Dead, 4B's light is out and the match will queue someone else.

## Story

`hear(speaker, text)` shows a caption and appends `{ who, line }` if that exact line is not already in the journal. `say` shows a caption only. `ensurePrologue` puts the 2032 line at the front whenever a room starts. C or the Story button opens "Tonight" while you are in play. The journal lasts for the page session. A reload keeps the checkpoint and loses the lines heard since then. The room's entrance line is spoken again.

Speakers used on purpose: `2032`, `Ward slip`, `The Assistant`, `Wendi`, `You`.

## A few sharp edges

The apartment stairwell label can still clip at the right edge of that small room. Closed doors do not draw a world label. Their hint is the closed copy, and the Assistant door's hint is "Flask opens this door."

Wendi's street spawn and her Assistant-room patrol are separate. On the street she starts near 4B, then goes to the flag and carries it until you take it or she drops it. In the Assistant room, if she is alive, she paces a fixed lane and does not chase.

`go()` places you with `ARRIVALS["<destination>:<source>"]`. A missing key falls back to the map's spawn. The street's north lane, around y 150–250, is the open walk east. The cars sit on the straight line from the stairwell to Wendi.
