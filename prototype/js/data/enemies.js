/*
 * Nepřátelé. dmg = základní poškození podle záměru
 * (heavy/quick/guard). tactics.weights = základní váhy záměrů; adapt = reakce na opakování hráče;
 * feint = šance, že indicie klame (elity). surrenderAt = podíl HP, od kterého lze ušetřit.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ENEMIES = {
    wolf: {
      id: "wolf",
      name: "Vlk šedivák",
      level: 1,
      type: "wildlife",
      hp: 45,
      def: 2,
      dmg: { heavy: 18, quick: 11, guard: 5 },
      tactics: { weights: { heavy: 0.25, quick: 0.55, guard: 0.2 }, adapt: 0, feint: 0 },
      reward: { gold: [8, 16], xp: 18, loot: [{ id: "wolf-tooth", p: 0.7 }] },
    },
    boar: {
      id: "boar",
      name: "Divočák",
      level: 1,
      type: "wildlife",
      hp: 52,
      def: 3,
      dmg: { heavy: 21, quick: 8, guard: 6 },
      tactics: { weights: { heavy: 0.5, quick: 0.15, guard: 0.35 }, adapt: 0, feint: 0 },
      reward: { gold: [6, 14], xp: 20, loot: [] },
    },
    bandit: {
      id: "bandit",
      name: "Bandita Honza",
      level: 2,
      type: "humanoid",
      hp: 49,
      def: 3,
      dmg: { heavy: 17, quick: 12, guard: 5 },
      tactics: { weights: { heavy: 0.35, quick: 0.35, guard: 0.3 }, adapt: 0.4, feint: 0 },
      surrenderAt: 0.25,
      reward: { gold: [14, 30], xp: 26, loot: [] },
    },
    brigand: {
      id: "brigand",
      name: "Zbojník z monstrance",
      level: 3,
      type: "humanoid",
      hp: 74,
      def: 4,
      dmg: { heavy: 23, quick: 15, guard: 6 },
      tactics: { weights: { heavy: 0.35, quick: 0.35, guard: 0.3 }, adapt: 0.55, feint: 0.3 },
      reward: { gold: [30, 55], xp: 50, loot: [] },
    },
  };
  return { ENEMIES };
});
