/*
 * Herní čas: fáze dne a tiky. Čisté funkce bez DOMu. Prolog z něj bere jen fázi pro pečený záběr;
 * zbytek původního world.js (místa setkání, úrovně, smrt) tu není.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PHASES = [
    { id: "morning", label: "ráno", icon: "🌅" },
    { id: "noon", label: "poledne", icon: "☀" },
    { id: "afternoon", label: "odpoledne", icon: "🌤" },
    { id: "evening", label: "večer", icon: "🌇" },
    { id: "night", label: "noc", icon: "🌙" },
  ];
  const TICKS_PER_PHASE = 4;
  const TICKS_PER_DAY = PHASES.length * TICKS_PER_PHASE;

  const newClock = () => ({ day: 1, tick: 2 * TICKS_PER_PHASE });
  function advanceClock(clock, ticks) {
    const t = clock.tick + ticks;
    return { day: clock.day + Math.floor(t / TICKS_PER_DAY), tick: t % TICKS_PER_DAY };
  }
  const toMorning = (clock) => ({ day: clock.day + 1, tick: 0 });
  const phaseOf = (clock) => PHASES[Math.floor(clock.tick / TICKS_PER_PHASE)];
  const isNight = (clock) => Math.floor(clock.tick / TICKS_PER_PHASE) >= 3;

  return { PHASES, TICKS_PER_PHASE, TICKS_PER_DAY, newClock, advanceClock, toMorning, phaseOf, isNight };
});
