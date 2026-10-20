# Click Wendi

A top-down browser demo for [clickwendi.com](https://clickwendi.com). The year is 2032. The block is queued into a shooter. You are still awake.

Wendi, in 4B, thinks the flag is a game. Siri is the voice in the headset, and she wants the chair filled. Shooting Wendi scores the match and costs Signal. Taking the flag puts it on you. The plant stand takes it off. A tank fills a flask of coolant. At the end you take Siri's chair or walk away. C, or Story, keeps the lines.

## Play locally

```bash
npm install
npm run dev
```

Open the URL Vite prints. `npm test` checks Signal, checkpoints, and the treatment tank.

Checkpoints stay in this browser under `clickwendi-save-v1`.

## Controls

- WASD or arrows: move
- Q: match layer / street layer
- Click the headset, flag, stand, tank, or inlet, or press E: use
- Click or F: shoot
- C: the story so far
- Space, held: vent the tank

On a phone, a stick and buttons sit along the bottom.

## What this demo is

The apartment is a tutorial. Pick up the headset, press Q to see the room under the match, and shoot the practice plate. Signal does not move. Before the stairwell opens, the room tells you the flag: click or E picks it up, it rides on you, and the stand in the plant takes it off.

One apartment, one block, one tank, one boss. GitHub Pages serves this repository from the root, including the `CNAME` for clickwendi.com. No build step is required for the site. `npm run build` still writes a bundled copy to `dist/` if you want one.

[How it works](docs/how-it-works.md) maps the files, the checkpoint, the flag, and the two endings.
