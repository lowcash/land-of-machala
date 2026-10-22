# Land of Machala

**A text RPG about how sure you can be.** Nobody in this world lies out of malice, but everybody knows a slightly different story, and every fight, rumour and deal asks the same question: *how much do you trust what you see?*

Play it in a browser tab: **https://lowcash.github.io/land-of-machala/** (the same files, hosted on GitHub Pages). No build, no server, no dependencies; locally just open `prototype/index.html`.

**This public build is a prologue demo:** it starts at the tavern, walks you through the four prologue steps, asks for a name and ends the next morning. The rest of the game (including everything below) lives in the development version.

## What makes it interesting

- **Enemies telegraph, and the hint can lie.** Every turn you see what the enemy seems to be preparing, labelled *sure / I think so / unclear*. The label is the real probability that the hint is right. Your INT, your experience with that kind of enemy and a potion of foresight change it; elites bluff.
- **One stolen bell, six rumours.** Everybody in town has a different version. Check them at the bandit camp, in the town hall registers, at the chapel at night. A deadline runs (5 days); if you do nothing, the world decides without you. Your classes and races read different kinds of clues.
- **Death is a place.** Lose a fight and everything you carry stays in your corpse on the map; you wake up at the healer with a stick and a tunic and must walk back for it. Quest items never duplicate.
- **A world you can plan around.** Encounters sit in fixed places derived from the game seed, tracks are visible by day, and nothing spawns while you walk: the same road gives the same result.
- **Rules are pure, tested modules.** Combat, world, quests, rumours and saves live in `prototype/js/systems/` as DOM-free UMD modules with a deterministic RNG, so everything is simulated and covered by tests.
- **A built-in storybook.** The dev bar jumps straight into any scene (a wounded hero at the healer, the bell in your bag at the verdict, a full backpack at the stash), lets you tweak one value at a time and can reveal the enemy's true intent.

## Run

```
open prototype/index.html                      # play
node --test prototype/js/test/*.test.js        # tests
node prototype/js/sim.js 2000                  # simulate 2000 fights per strategy
node prototype/js/gen-docs.js                  # regenerate the tables in docs/reference
```

The game, its texts and the docs in `docs/` are in **Czech**; the code is plain JavaScript. Start with [docs/OVERVIEW.md](docs/OVERVIEW.md) (English), then [docs/README.md](docs/README.md).

## License

Code: MIT ([LICENSE](LICENSE)). Game content (setting, texts, story, art): CC BY 4.0 ([NOTICE.md](NOTICE.md)).
