/*
 * Prolog step → bake/scene visibility. Pure UMD: no DOM.
 * All four beats keep the tavern plate; Svatava's exit is a cast hide (prologBeat), not a blackout.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LOM = Object.assign(root.LOM || {}, { PrologScene: api });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CAST_FREE_BASE = "../assets/runtime/locations/tavern";
  const CAST_LAYER_BASE = "../assets/runtime/locations/tavern/layers";
  const CAST_WIDTHS = [3840, 1920];

  /** True while the baked tavern plate should paint behind the origins card. */
  function visibleForPick(pick) {
    return pick === "class" || pick === "race" || pick === "react" || pick === "origin";
  }

  /** Bake shot for a step pick: s1 on class, s2 afterwards. */
  function shotForPick(pick) {
    if (pick === "class") return "s1";
    if (pick === "race" || pick === "react" || pick === "origin") return "s2";
    return null;
  }

  /**
   * Place + style + time of day of a bake key (`<place>-prolog-<style>-s1|s2-<phase>[-weather]`).
   * Shot (s1/s2) and weather are not part of the scene identity.
   */
  function sceneIdentityOf(bakeKey) {
    const m = /^([^-]+)-prolog-([^-]+)-s[12]-([^-]+)(?:-[^-]+)?$/.exec(String(bakeKey || ""));
    return m ? `${m[1]}|${m[2]}|${m[3]}` : null;
  }

  /**
   * Whether the composed background plate must reload between two bake keys.
   * Same scene + time of day → false (camera tween / cast fade only; do not recreate the plate).
   * Unknown or first paint (null identity) → true.
   */
  function shouldReloadBackground(prevKey, nextKey) {
    const a = sceneIdentityOf(prevKey);
    const b = sceneIdentityOf(nextKey);
    return a == null || b == null || a !== b;
  }

  /**
   * Which painted bake matches the visible cast (independent of the camera shot).
   * S1 paint has stand-table + sit-right; S2 paint has sit-right only.
   * Cast overrides / empty sit → null (caller uses a cast-free plate + cutouts).
   */
  function castBakePlate(wantStand, wantSit, castOverride) {
    if (castOverride) return null;
    if (wantSit && wantStand) return "s1";
    if (wantSit && !wantStand) return "s2";
    return null;
  }

  /** Stable signature of who the plate must show (pin across camera-only shot changes). */
  function castSig(wantStand, wantSit, castOverride) {
    if (castOverride) return "override";
    return `${wantStand ? 1 : 0}${wantSit ? 1 : 0}`;
  }

  /**
   * Texture width for cast-free plates and cast cutouts: same srcset rule as SceneDisplay.pickTextureWidth
   * over [1920, 3840] (covers displayCssWidth × dpr at 90 %).
   */
  function pickCastTextureWidth(displayCssWidth, dpr) {
    const g = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : null;
    const SD = g && g.LOM && g.LOM.SceneDisplay;
    if (SD && typeof SD.pickTextureWidth === "function") {
      return SD.pickTextureWidth(displayCssWidth, dpr, [1920, 3840]);
    }
    const need = (Number(displayCssWidth) || 0) * Math.min(Math.max(Number(dpr) || 1, 1), 3);
    if (!(need > 0)) return 3840;
    return need * 0.9 <= 1920 ? 1920 : 3840;
  }

  /** Hi-res cast-free plate candidates (3840 then 1920, AVIF only). */
  function castFreePlateUrls(shot, phase) {
    if (!shot || !phase) return [];
    const base = `${CAST_FREE_BASE}/clean-${shot}-${phase}-16x9`;
    return CAST_WIDTHS.map((w) => `${base}-${w}.avif`);
  }

  /** Prefer the candidate matching pickCastTextureWidth; else the first URL. */
  function pickCastFreePlateUrl(urls, displayCssWidth, dpr) {
    if (!Array.isArray(urls) || !urls.length) return null;
    const want = pickCastTextureWidth(displayCssWidth, dpr);
    return urls.find((u) => typeof u === "string" && u.includes(`-${want}.`)) || urls[0];
  }

  /**
   * Pick plate sourcing for one prolog compose.
   * Prefer a sharp cast-free plate (cutouts can fade) when `castFreeUrl` is set; else a cast-matched
   * high-res bake (plateHasCast) when `bakeUrl` is set; else the layer clean plate + cutouts.
   */
  function pickPlateSource(opts) {
    const o = opts || {};
    if (o.castFreeUrl) {
      return { mode: "clean", plateSrc: o.castFreeUrl, plateHasCast: false, plate: o.plate || o.shot || null };
    }
    if (o.castPlate && o.bakeUrl) {
      return { mode: "bake", plateSrc: o.bakeUrl, plateHasCast: true, plate: o.castPlate };
    }
    return { mode: "clean", plateSrc: null, plateHasCast: false, plate: o.plate || o.shot || null };
  }

  /**
   * Pin the plate across camera-only shot changes while the cast signature stays the same.
   * Cast change (or scene/time reload) updates the pin so a new bake/clean can crossfade in.
   * Cast-free mode uses a fixed sig (caller passes one) so beat cast fades do not swap the plate.
   */
  function nextPlatePin(prevPin, plate, sig, reloadBg) {
    if (!reloadBg && prevPin && prevPin.castSig === sig && prevPin.plate) {
      return { plate: prevPin.plate, castSig: sig, changed: false };
    }
    return { plate: plate || null, castSig: sig, changed: true };
  }

  /** Basename of an authoring cutout (`char-…webp`) or cast tier URL → hi-res cast URL at `width`. */
  function hiresCastCutoutUrl(authoringSrc, width) {
    const file = String(authoringSrc || "").split("/").pop() || "";
    const w = width === 1920 || width === 3840 ? width : 3840;
    let m = /^char-(.+)\.webp$/i.exec(file);
    if (m) return `${CAST_LAYER_BASE}/cast-${m[1]}-${w}.webp`;
    m = /^cast-(.+)-(1920|3840)\.webp$/i.exec(file);
    if (m) return `${CAST_LAYER_BASE}/cast-${m[1]}-${w}.webp`;
    return null;
  }

  /**
   * Cutout texture candidates: hi-res first (width from display × dpr), then the authoring cutout.
   * Accepts an already-upgraded `cast-*-1920|3840` src so zoom/DPR growth can retarget 1920 → 3840.
   * Caller tries in order (onerror / tiny bitmap → next), once each, no loop.
   */
  function cutoutSrcCandidates(authoringSrc, displayCssWidth, dpr) {
    const src = String(authoringSrc || "");
    if (!src) return [];
    const w = pickCastTextureWidth(displayCssWidth, dpr);
    const hi = hiresCastCutoutUrl(src, w);
    const out = [];
    if (hi) out.push(hi);
    const file = src.split("/").pop() || "";
    if (/^cast-.+-(1920|3840)\.webp$/i.test(file)) {
      const other = w === 3840 ? hiresCastCutoutUrl(src, 1920) : hiresCastCutoutUrl(src, 3840);
      if (other && !out.includes(other)) out.push(other);
    } else if (!out.includes(src)) {
      out.push(src);
    }
    return out;
  }

  /** Tiny / empty bitmaps (e.g. Svatava absent on s2) count as missing. */
  function isAbsentBitmap(naturalWidth, naturalHeight) {
    return !(Number(naturalWidth) > 2 && Number(naturalHeight) > 2);
  }

  return {
    visibleForPick,
    shotForPick,
    sceneIdentityOf,
    shouldReloadBackground,
    castBakePlate,
    castSig,
    pickCastTextureWidth,
    castFreePlateUrls,
    pickCastFreePlateUrl,
    pickPlateSource,
    nextPlatePin,
    hiresCastCutoutUrl,
    cutoutSrcCandidates,
    isAbsentBitmap,
    CAST_FREE_BASE,
    CAST_LAYER_BASE,
    CAST_WIDTHS,
  };
});
