# Empire Dawn: First Age

**Empire Dawn: First Age** is a self-contained, original browser real-time strategy game inspired by the foundational loop of late-1990s historical RTS games. It does not include or redistribute any original *Age of Empires* code, art, audio, maps, writing, or trademarks.

## Play

Serve this folder with any static web server, then open `index.html`. No build step or external assets are required.

```bash
python3 -m http.server 4174
```

## Core systems

- 64 × 64 isometric world with terrain, shoreline, resources, exploration and fog of war
- Four-resource economy: food, wood, stone and gold
- Villager gathering, carrying, drop-off, building, repairing and emergency combat
- Town Centres, houses, economic buildings, military buildings, farms and watch towers
- Clubmen, bowmen and mounted scouts with melee, ranged combat and projectiles
- Stone, Tool and Bronze Ages with age requirements and technologies
- Rival AI economy, production, expansion and escalating attack waves
- A* pathfinding, formation orders, attack-move, rally points and control groups
- Minimap navigation, camera edge-scroll/WASD, zoom, pause and four game speeds
- Local manual save, load and 30-second autosave
- Procedural original interface audio generated with the Web Audio API

## Controls

| Control | Action |
| --- | --- |
| Left-click | Select a unit, building or resource |
| Drag left mouse | Box-select units |
| Shift + click | Add or remove selection |
| Right-click | Context order: move, gather, build, repair or attack |
| WASD / arrow keys | Move camera |
| Mouse at screen edge | Edge-scroll camera |
| Mouse wheel | Zoom |
| A | Attack-move targeting |
| B | Open Villager build menu |
| S | Stop selected units |
| Delete | Delete selected building |
| Ctrl + 1–5 | Create a control group |
| 1–5 | Recall a control group |
| Space | Centre the current selection |
| P | Pause / resume |
| Escape | Cancel command mode or close overlays |

## Preview mode

Append `?preview=1` to open an advanced skirmish staged for screenshots and demonstrations.
