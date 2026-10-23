/*
 * Katalog předmětů prototypu - jediný zdroj pravdy (docs/reference/items.md se z něj generuje).
 * atk/def = bonus ke statům · weight = nosnost batohu (equipped mimo batoh) · slot = výbavový slot.
 * quest: true = příběhový předmět (v corpse nikdy nezmizí). Kategorie vychází ze slotu (itemCategory).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  /* Zbraně (slot weapon) */
  const WEAPONS = [
    { id: "stick", icon: "🪵", name: "Klacek od cesty", tip: "technicky vzato zbraň", slot: "weapon", atk: 1, weight: 1, rarity: "poor" },
    { id: "ladle", icon: "🥄", name: "Válečná naběračka", tip: "crit chutná jako polévka", slot: "weapon", atk: 4, weight: 3, rarity: "uncommon" },
    { id: "axe", icon: "🪓", name: "Sekera dřevorubce", tip: "těžší úder", slot: "weapon", atk: 6, weight: 4, rarity: "common" },
    { id: "wood_sword", icon: "🗡", name: "Dřevěný meč", tip: "cvičný", slot: "weapon", atk: 5, weight: 2, rarity: "common" },
    { id: "iron_sword", icon: "⚔", name: "Železný meč", tip: "poctivé železo", slot: "weapon", atk: 8, weight: 4, rarity: "uncommon" },
    { id: "long_sword", icon: "🗡", name: "Dlouhý meč", tip: "dosah rozhoduje", slot: "weapon", atk: 10, weight: 5, rarity: "rare" },
  ];

  /* Zbroje a štíty (head, shoulders, body, hands, wrists, legs, feet, shield) */
  const ARMOR = [
    { id: "shield", icon: "🛡", name: "Dubový štít", tip: "blockBonus", slot: "shield", def: 3, weight: 4, rarity: "common" },
    { id: "buckler", icon: "🥏", name: "Kovový puklíř", tip: "lehčí blok", slot: "shield", def: 2, weight: 2, rarity: "common" },
    { id: "cap", icon: "🪖", name: "Kožená čapka", tip: "hlava", slot: "head", def: 1, weight: 1, rarity: "poor" },
    { id: "helm", icon: "⛑️", name: "Železná přilba", tip: "tvrdší lebka", slot: "head", def: 2, weight: 3, rarity: "uncommon" },
    { id: "cloak", icon: "🧥", name: "Cestovní plášť", tip: "ramena", slot: "shoulders", def: 1, weight: 1, rarity: "common" },
    { id: "pauldrons", icon: "🥋", name: "Ramenní kroužky", tip: "těžší", slot: "shoulders", def: 2, weight: 3, rarity: "uncommon" },
    { id: "tunic", icon: "👕", name: "Lněná tunika", tip: "základ", slot: "body", def: 1, weight: 2, rarity: "poor" },
    { id: "mail", icon: "🦺", name: "Kroužková košile", tip: "těžší brnění", slot: "body", def: 3, weight: 5, rarity: "rare" },
    { id: "gloves", icon: "🧤", name: "Kožené rukavice", tip: "úchop", slot: "hands", def: 1, weight: 1, rarity: "common" },
    { id: "gauntlets", icon: "🥊", name: "Ocelové rukavice", tip: "pěst", slot: "hands", atk: 1, def: 1, weight: 2, rarity: "uncommon" },
    { id: "pants", icon: "👖", name: "Cestovní nohavice", tip: "pohyb", slot: "legs", def: 1, weight: 2, rarity: "common" },
    { id: "greaves", icon: "🦴", name: "Kroužkové nohavice", tip: "těžší", slot: "legs", def: 2, weight: 3, rarity: "uncommon" },
    { id: "boots", icon: "👢", name: "Putovní obuv", tip: "lehčí krok", slot: "feet", def: 1, weight: 1, rarity: "common" },
    { id: "sabatons", icon: "🥾", name: "Okované boty", tip: "stabilita", slot: "feet", def: 2, weight: 2, rarity: "uncommon" },
    { id: "bracers", icon: "⌚", name: "Kožené nátepníky", tip: "zápěstí", slot: "wrists", def: 1, weight: 1, rarity: "common" },
  ];

  /* Šperky (neck, trinket) */
  const JEWELRY = [
    { id: "amulet", icon: "✝️", name: "Dřevěný křížek", tip: "ochrana", slot: "neck", def: 1, weight: 0.5, rarity: "common" },
    { id: "trinket", icon: "🔮", name: "Skleněný korálek", tip: "trinket", slot: "trinket", atk: 1, weight: 0.5, rarity: "uncommon" },
  ];

  /* Spotřebiče (v boji: potion = +14 HP, foresight = čtení záměru) */
  const CONSUMABLES = [
    { id: "potion", icon: "🧪", name: "Kalný odvar", tip: "healMinor", slot: "consumable", weight: 1, rarity: "common" },
    { id: "foresight", icon: "🧿", name: "Odvar předtuchy", tip: "čtení záměru nepřítele", slot: "consumable", weight: 1, rarity: "uncommon" },
    { id: "ration", icon: "🍞", name: "Suchý chléb", tip: "cesta", slot: "consumable", weight: 1, rarity: "poor" },
  ];

  /* Ostatní (trofeje, drobnosti; herbs/quill = start z prologu) */
  const MISC = [
    { id: "daisy", icon: "🌼", name: "Sedmikráska", tip: "misc", slot: "misc", weight: 0.2, rarity: "poor" },
    { id: "herbs", icon: "🌿", name: "Sušené byliny", tip: "voní ostře; z prologu", slot: "misc", weight: 0.3, rarity: "poor" },
    { id: "quill", icon: "🪶", name: "Brk a kalamář", tip: "psaní; z prologu", slot: "misc", weight: 0.4, rarity: "common" },
    { id: "wolf-tooth", icon: "🦷", name: "Zub vlka", tip: "trofej", slot: "misc", weight: 0.3, rarity: "uncommon" },
    { id: "shovel", icon: "⛏", name: "Lopata", tip: "zakopat věci", slot: "misc", weight: 3, rarity: "common" },
    { id: "letter", icon: "✉️", name: "Zapečetěný dopis", tip: "příběhový předmět", slot: "misc", weight: 0.1, rarity: "rare", quest: true },
    { id: "bell", icon: "🔔", name: "Zvon z kaple", tip: "těžký, unikátní; nezmizí z těla", slot: "misc", weight: 14, rarity: "rare", quest: true },
    { id: "cart_bell", icon: "🔕", name: "Vozový zvonek", tip: "malý cechovní zvon; není z kaple", slot: "misc", weight: 1, rarity: "common", quest: true },
  ];

  const INVENTORY = [...WEAPONS, ...ARMOR, ...JEWELRY, ...CONSUMABLES, ...MISC];

  const CATEGORY_BY_SLOT = { weapon: "weapons", neck: "jewelry", trinket: "jewelry", consumable: "consumables", misc: "misc" };
  const itemCategory = (item) => CATEGORY_BY_SLOT[item.slot] || "armor";

  return { INVENTORY, itemCategory };
});
