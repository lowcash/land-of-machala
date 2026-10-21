/*
 * Questy prototypu — jediný zdroj pravdy (docs/reference/quests.md se z něj generuje).
 * giver: kde se nabídnou (místo + otázka v rozhovoru, po které se objeví „Přijmout“) · turnIn: kde se odevzdává
 * (place = místo ve městě, cell = políčko mapy) · objectives: kill (druh + terén), have (předmět v batohu), arrive (políčko)
 * reward.flags / choices[].flags: drobné následky voleb (např. cena noclehu).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const QUESTS = [
    {
      id: "wolves_outside",
      title: "Vlci za hradbami",
      giver: { place: "healer", after: "help", npc: "Lidmila" },
      turnIn: { place: "healer", npc: "Lidmila" },
      brief: "Vlci z lesa trhají pocestné a rány jim hnisají. Lidmila chce, aby je někdo prořídl.",
      objectives: [{ id: "wolves", type: "kill", enemy: "wolf", terrain: "forest", count: 2, text: "Zabij vlky v lese severně od města" }],
      reward: { xp: 40, gold: 25, items: ["potion"] },
    },
    {
      id: "bread_for_uda",
      title: "Kůrka pro Svatavu",
      giver: { place: "tavern", after: "bread", npc: "Svatava z Přívozu" },
      turnIn: { place: "tavern", npc: "Svatava z Přívozu" },
      brief: "Svatava přišla o dodávku z pekárny. Chléb koupíš na tržišti.",
      objectives: [{ id: "bread", type: "have", item: "ration", count: 1, text: "Kup suchý chléb na tržišti" }],
      consume: ["ration"],
      choices: [
        { id: "give", label: "Dát chléb Svatavě", hint: "zdarma · Svatava ti to oplatí levnějším noclehem", reward: { xp: 20, gold: 0 }, flags: ["svatava_friend"] },
        { id: "sell", label: "Chtít za chléb zaplatit", hint: "peníze hned · Svatava si to zapamatuje", reward: { xp: 8, gold: 15 }, flags: ["svatava_haggled"] },
      ],
    },
    {
      id: "letter_to_lada",
      title: "Dopis do Lady",
      giver: { place: "bank", after: "letter", npc: "Gertruda" },
      turnIn: { cell: [3, 0], npc: "písař v Ladě" },
      brief: "Gertruda posílá zapečetěný dopis do vsi Lada. Cesta je na jih a je klidná.",
      giveItems: ["letter"],
      objectives: [
        { id: "carry", type: "have", item: "letter", count: 1, text: "Měj u sebe dopis" },
        { id: "arrive", type: "arrive", cell: [3, 0], text: "Dojdi do vsi Lada" },
      ],
      consume: ["letter"],
      reward: { xp: 30, gold: 30 },
    },
  ];
  const QUEST_BY = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
  return { QUESTS, QUEST_BY };
});
