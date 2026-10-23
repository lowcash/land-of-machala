/* Simulace boje: node prototype/js/sim.js [N] - boti proti nepřátelům, tabulka metrik. */
const { createRng } = require("./rng.js");
const { createCombat, resolveTurn, availableActions } = require("./systems/combat.js");
const { ENEMIES } = require("./data/enemies.js");

/* Start postavy Lv1 Machalští + startovní výbava (viz statsNow v app.js). */
const PLAYERS = {
  mercenary: { classId: "mercenary", hpMax: 58, resMax: 14, atk: 13, def: 10, dex: 5, int: 4 },
  tracker: { classId: "tracker", hpMax: 54, resMax: 12, atk: 10, def: 9, dex: 9, int: 5 },
  chanter: { classId: "chanter", hpMax: 52, resMax: 16, atk: 8, def: 9, dex: 5, int: 10 },
  /* legist: STR 5 DEX 5 VIT 6+1 INT 8, naběračka +4 ATK, zbroj +6 DEF */
  legist: { classId: "legist", hpMax: 54, resMax: 12, atk: 9, def: 9, dex: 5, int: 8 },
};

const can = (c, id) => availableActions(c).find((a) => a.id === id)?.enabled;
const fixed = (id, fallback = "guard") => (c) => (can(c, id) ? id : fallback);

const BOTS = {
  "vždy-quick": fixed("quick"),
  "vždy-heavy": fixed("heavy", "guard"),
  "vždy-guard": fixed("guard"),
  "vždy-special": fixed("special", "quick"),
  "vždy-evade": fixed("evade"),
  náhodný: (c, rng) => rng.pick(availableActions(c).filter((a) => a.enabled && a.id !== "flee" && a.id !== "spare" && a.id !== "foresight").map((a) => a.id)),
  /* zná skutečný záměr */
  informovaný: (c) => {
    const i = c.trueIntent;
    if (i === "heavy") return "guard";
    if (i === "quick") return "evade";
    return can(c, "heavy") ? "heavy" : "quick";
  },
  /* věří indicii jen když je „tuším“/„jistě“; jinak hraje rytmus těžký/obrana */
  čtenář: (c) => {
    if (c.hint.confidence === "nejasné") return can(c, "heavy") ? "heavy" : "guard";
    const i = c.hint.id;
    if (i === "heavy") return "guard";
    if (i === "quick") return "evade";
    return can(c, "heavy") ? "heavy" : "quick";
  },
  /* čtenář, který před soubojem vypil odvar předtuchy a pozoruje při nejasné indicii */
  "čtenář+odvar": (c) => {
    if (c.items.foresight > 0) return "foresight";
    if (c.hint.confidence === "nejasné") return can(c, "heavy") ? "heavy" : "guard";
    const i = c.hint.id;
    if (i === "heavy") return "guard";
    if (i === "quick") return "evade";
    return can(c, "heavy") ? "heavy" : "quick";
  },
};

function runOne(botName, enemyId, player, seed, extra = {}) {
  const rng = createRng(seed);
  const c = createCombat({
    enemyId,
    player: { ...player, hp: player.hpMax, res: player.resMax, ...extra.player },
    items: { heal: 2, foresight: 0, ...(extra.items || {}) },
    familiarity: extra.familiarity || 0,
    rng,
  });
  const bot = BOTS[botName];
  const used = {};
  let taken = 0;
  let spent = 0;
  let guard = 0;
  while (!c.over && guard++ < 80) {
    const before = c.hp;
    const resBefore = c.res;
    const action = bot(c, rng);
    used[action] = (used[action] || 0) + 1;
    const r = resolveTurn(c, action, rng);
    if (!r.ok) {
      resolveTurn(c, "guard", rng);
    }
    taken += Math.max(0, before - c.hp);
    spent += Math.max(0, resBefore - c.res);
  }
  return { win: c.result === "win" ? 1 : 0, taken, turns: c.turn, spent, used };
}

function run(botName, enemyId, player, n, extra) {
  let wins = 0, taken = 0, turns = 0, spent = 0;
  const takenAll = [];
  const used = {};
  for (let s = 1; s <= n; s++) {
    const r = runOne(botName, enemyId, player, s, extra);
    wins += r.win; taken += r.taken; turns += r.turns; spent += r.spent;
    takenAll.push(r.taken);
    for (const [k, v] of Object.entries(r.used)) used[k] = (used[k] || 0) + v;
  }
  const mean = taken / n;
  const sd = Math.sqrt(takenAll.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  const total = Object.values(used).reduce((a, b) => a + b, 0) || 1;
  const top = Object.entries(used).sort((a, b) => b[1] - a[1])[0];
  return {
    win: (100 * wins) / n,
    taken: mean,
    sd,
    turns: turns / n,
    spent: spent / n,
    top: `${top[0]} ${Math.round((100 * top[1]) / total)}%`,
  };
}

function table(enemyId, playerName, n, extra) {
  const p = PLAYERS[playerName];
  console.log(`\n== ${ENEMIES[enemyId].name} vs ${playerName} (N=${n}${extra?.label ? ", " + extra.label : ""})`);
  console.log("bot            win%   dmg    sd    tahů  zdroj  nejčastější akce");
  const rows = {};
  for (const b of Object.keys(BOTS)) {
    const r = run(b, enemyId, p, n, extra);
    rows[b] = r;
    console.log(
      `${b.padEnd(14)} ${r.win.toFixed(1).padStart(5)} ${r.taken.toFixed(1).padStart(6)} ${r.sd.toFixed(1).padStart(5)} ${r.turns.toFixed(1).padStart(6)} ${r.spent.toFixed(1).padStart(6)}  ${r.top}`
    );
  }
  return rows;
}

module.exports = { PLAYERS, BOTS, run, table };

if (require.main === module) {
  const n = Number(process.argv[2]) || 2000;
  for (const enemy of ["wolf", "boar", "bandit", "brigand"]) {
    for (const player of ["mercenary", "tracker", "chanter", "legist"]) table(enemy, player, n);
  }
  console.log("\n######## Čtení záměru: vliv schopnosti (pacholek, bandita) ########");
  table("bandit", "mercenary", n, { label: "INT 4" });
  table("bandit", "mercenary", n, { player: { int: 10 }, familiarity: 0.15, label: "INT 10 + zkušenost" });
  table("bandit", "mercenary", n, { items: { foresight: 1 }, label: "INT 4 + odvar předtuchy" });
}
