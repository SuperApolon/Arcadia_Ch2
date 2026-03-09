import { useState, useEffect, useRef, useCallback } from "react";

// @@SECTION:PALETTE
const C = {
  bg:"#050d14", panel:"#0a1a26", panel2:"#0d2235",
  border:"#1a4a6a", accent:"#00c8ff", accent2:"#00ffcc",
  gold:"#f0c040", red:"#ff4466", text:"#c8e8f8",
  muted:"#4a7a9a", white:"#eef8ff"
};


// @@SECTION:BATTLE_CONFIG ─────────────────────────────────────────────────────
// 【編集ガイド】
//   敵のパターンを変えたいとき → 各エネミーの pattern: [...] だけ書き換える
//   使える行動ID:
//     "atk"         強攻       プレイヤーのcounterに負ける
//     "counter"     カウンター プレイヤーのatkを無効化して反撃、dodgeには空振り
//     "dodge"       回避       このターン敵は行動しない（atkには避けられない）
//     "unavoidable" 回避不能   ボス専用。counter/dodgeを粉砕して高ダメージ
//   データの正本は battle_defs.js で管理。JSXとの同期を保つこと。

// ─── プレイヤー行動 ───────────────────────────────────────────────────────
const BATTLE_SKILLS = [
  { id:"atk",     label:"強攻",      icon:"⚔",  color:"#00ffcc", cost:0,  dmg:[14,22] },
  { id:"counter", label:"カウンター", icon:"🔄", color:"#f97316", cost:10, dmg:[18,28] },
  { id:"dodge",   label:"回避",      icon:"💨",  color:"#a78bfa", cost:8,  dmg:[0,0]   },
  { id:"heal",    label:"回復",      icon:"🧪",  color:"#f0c040", cost:0,  dmg:[0,0]   },
];

// ─── 敵定義 ─────────────────────────────────────────────────────────────
// ★ パターン変更は各エネミーの pattern:[...] だけ編集すればOK
// ★ unavoidableAtk:[min,max] はボス専用の回避不能ダメージ範囲
const INITIAL_BATTLE_DEFS = {

  seagull: {
    name:"カモメ型モンスター", em:"🦅",
    maxHp:55, atk:[8,14], elk:20, exp:15, lv:1, spd:14,
    bg:["#0a1628","#0d2a5e","#1a5fa0"], isFloating:true, isGround:false,
    pattern:["atk","dodge","atk","counter"],
  },

  koza: {
    name:"コーザ（訓練）", em:"🙍",
    maxHp:120, atk:[10,16], elk:0, exp:0, lv:1, spd:13,
    bg:["#0a1808","#184018","#2a2818"], isFloating:false, isGround:true,
    pattern:["atk","counter","atk","dodge","counter","atk"],
  },

  shamerlot: {
    name:"シャメロット Lv.1", em:"🦀",
    maxHp:80, atk:[6,12], elk:30, exp:20, lv:1, spd:8,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["atk","atk","dodge","counter"],
  },

  shamerlot_lv3: {
    name:"シャメロット Lv.3", em:"🦀",
    maxHp:130, atk:[10,18], elk:50, exp:40, lv:3, spd:10,
    bg:["#0a1808","#1a2808","#301008"], isFloating:false, isGround:true,
    pattern:["counter","atk","dodge","atk","counter","dodge"],
  },

  shamerlot_lv5: {
    name:"シャメロット Lv.5", em:"🦀",
    maxHp:200, atk:[14,24], elk:80, exp:70, lv:5, spd:11,
    bg:["#0a1808","#1a2808","#301008"], isFloating:false, isGround:true,
    pattern:["counter","atk","unavoidable_lite","dodge","atk","counter","atk","dodge"],
  },

  simuluu: {
    name:"Simuluu ─ 試練の主", em:"🦌",
    maxHp:400, atk:[15,25], elk:200, exp:200, lv:6, spd:12,
    bg:["#010610","#050e28","#0a1840"], isBoss:true, isFloating:false, isGround:true,
    pattern:["atk","counter","unavoidable","atk","dodge","unavoidable","counter","unavoidable"],
    unavoidableAtk:[30,45],
    elementCycle:["ice","thunder","fire","earth","none"],
  },

  // ── 第二章専用ボス ─────────────────────────────────────────────────────────
  simuluu_ch2: {
    name:"Simuluu ─ 覚醒体", em:"🦌",
    maxHp:2000, atk:[18,30], elk:500, exp:500, lv:10, spd:12,
    bg:["#050210","#0f0528","#1a0a50"], isBoss:true, isFloating:false, isGround:true,
    pattern:["atk","counter","unavoidable","atk_all","enrage","dodge","unavoidable","counter","atk_all","unavoidable"],
    unavoidableAtk:[35,50],
    elementCycle:["fire","ice","thunder","earth","none"],
  },

};

// @@SECTION:ELEMENT_SYSTEM ────────────────────────────────────────────────────
// 属性定義（エネミーと属性スキルの相性管理）
const ELEMENT_NAMES = {
  fire:    { label:"炎",   icon:"🔥", color:"#ff6633" },
  ice:     { label:"氷",   icon:"❄️", color:"#88ddff" },
  thunder: { label:"雷",   icon:"⚡", color:"#ffee44" },
  earth:   { label:"地",   icon:"🌿", color:"#66cc44" },
  none:    { label:"無",   icon:"◯",  color:"#aaaaaa" },
};

// 属性スキル定義。targetElement = このスキルが有効な敵の弱点属性
const ELEMENT_SKILL_DEFS = [
  { id:"elem_fire",    label:"火炎斬", icon:"🔥", color:"#ff6633", cost:20, dmg:[50,50], targetElement:"ice",     desc:"氷属性の敵に有効" },
  { id:"elem_ice",     label:"氷結斬", icon:"❄️", color:"#88ddff", cost:20, dmg:[50,50], targetElement:"thunder", desc:"雷属性の敵に有効" },
  { id:"elem_thunder", label:"雷神斬", icon:"⚡", color:"#ffee44", cost:20, dmg:[50,50], targetElement:"earth",   desc:"地属性の敵に有効" },
  { id:"elem_earth",   label:"大地斬", icon:"🌿", color:"#66cc44", cost:20, dmg:[50,50], targetElement:"fire",    desc:"炎属性の敵に有効" },
];

// 属性破壊発動に必要な累積ダメージ閾値
const ELEMENT_BREAK_THRESHOLD = 50;

// @@SECTION:UTILS
const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const EXP_TABLE = [0,30,80,160,280,450,700];


// @@SECTION:NOVEL_TEXTS
const NOVEL_BASE_URL = "https://superapolon.github.io/Arcadia_Assets/novels/";
const NOVEL_STATUS = {};
function novelUrl(_i) { return null; }

// @@SECTION:ASSETS
const BASE_URL = "https://superapolon.github.io/Arcadia_Assets/";

const ASSET_STATUS = {
  "title/title_bg":          true,
  "movies/ch01_opening":     true,   // ✅ 確認済み 2026-03-05
  // ── bgm ──
  "bgm/title":               true,   // ✅ 確認済み 2026-03-05
  "bgm/field":               true,   // ✅ 確認済み 2026-03-05
  "bgm/night":               true,   // ✅ 確認済み 2026-03-05
  "bgm/cave":                true,   // ✅ 確認済み 2026-03-05
  "bgm/battle_normal":       true,   // ✅ 確認済み 2026-03-05
  "bgm/battle_boss":         true,   // ✅ 確認済み 2026-03-05
  "bgm/fanfare":             true,   // ✅ 確認済み 2026-03-05
  "scenes/s00_vrs":          true,   // ✅ 確認済み 2026-03-04
  "scenes/s01_beach":        true,   // ✅ 確認済み 2026-03-04
  "scenes/s02_coast":        true,   // ✅ 確認済み 2026-03-04
  "scenes/s03_village":      true,   // ✅ 確認済み 2026-03-04
  "scenes/s04_guild":        true,   // ✅ 確認済み 2026-03-04
  "scenes/s07_meadow":       true,   // ✅ 確認済み 2026-03-04
  "scenes/s09_inn":          true,   // ✅ 確認済み 2026-03-04
  "scenes/s10_tavern":       true,   // ✅ 確認済み 2026-03-04
  "scenes/s11_coast2":       true,   // ✅ 確認済み 2026-03-04
  "scenes/s13_market":       true,   // ✅ 確認済み 2026-03-04
  "scenes/s14_rocks":        true,   // ✅ 確認済み 2026-03-04
  "scenes/s17_armory":       true,   // ✅ 確認済み 2026-03-04
  "scenes/s19_pier":         true,   // ✅ 確認済み 2026-03-04
  "scenes/s20_guild2":       true,   // ✅ 確認済み 2026-03-04
  "scenes/s25_westcoast":    true,   // ✅ 確認済み 2026-03-04
  "scenes/s26_cave_blue":    true,   // ✅ 確認済み 2026-03-04
  "scenes/s27_cave_deep":    true,   // ✅ 確認済み 2026-03-04
  "battle/bg_coast":         true,
  "battle/bg_meadow":        true,
  "battle/bg_rocks":         true,
  "battle/bg_cave":          true,
  "enemies/seagull":         true,
  "enemies/koza":            true,
  "enemies/shamelot":        true,
  "enemies/simuluu":         true,
  "sprites/eltz":            true,   // ✅ 確認済み 2026-03-02
  "sprites/swift":           true,   // ✅ 確認済み 2026-03-02
  "sprites/linz":            true,   // ✅ 確認済み 2026-03-02
  "sprites/chopper":         true,   // ✅ 確認済み 2026-03-02
  "sprites/cricket":         true,   // ✅ 確認済み 2026-03-02
  "sprites/koza":            true,   // ✅ 確認済み 2026-03-02 ※ファイル名は koza.webp（koza_sp ではない）
  "sprites/rose":            true,   // ✅ 確認済み 2026-03-07
  "sprites/juda":            true,   // ✅ 確認済み 2026-03-07
  "sprites/ymir":            true,   // ✅ 確認済み 2026-03-07
  "sprites/rubens":          true,   // ✅ 確認済み 2026-03-02
  "sprites/traveler":        true,   // ✅ 確認済み 2026-03-07
  "sprites/old_woman":       true,   // ✅ 確認済み 2026-03-07
  "sprites/shopkeeper":      true,   // ✅ 確認済み 2026-03-07
  "skills/atk":              false,
  "skills/skill":            false,
  "skills/guard":            false,
  "skills/item":             false,
};

function assetUrl(key) {
  return ASSET_STATUS[key] ? `${BASE_URL}${key}.webp` : null;
}

// ムービーURL解決ヘルパー -- 拡張子は .mp4 固定
function movieUrl(key) {
  return ASSET_STATUS[key] ? `${BASE_URL}${key}.mp4` : null;
}

// BGM URL解決ヘルパー -- 拡張子は .mp3 固定
function bgmUrl(key) {
  return ASSET_STATUS[key] ? `${BASE_URL}${key}.mp3` : null;
}

// ── BGM割り当てマップ ──────────────────────────────────────────────────────
const PHASE_BGM = {
  title:  "bgm/title",
  ending: "bgm/field",
};

const LOC_BGM = {
  "VRS接続中":               "bgm/field",
  "旅立ちの浜辺":             "bgm/field",
  "イルカ島 海岸線":          "bgm/field",
  "エルム村":                "bgm/field",
  "エルム村 ギルド":          "bgm/field",
  "エルム村 ギルド裏・草地":   "bgm/field",
  "エルム村 交易所":          "bgm/field",
  "エルム村 武器屋":          "bgm/field",
  "エルム村 防具屋":          "bgm/field",
  "イルカ島 岩場":            "bgm/field",
  "イルカ島 船着場":          "bgm/field",
  "イルカ島 西海岸":          "bgm/field",
  "エルム村 ギルド（ユミル登場）": "bgm/field",
  "エルム村 宿屋":            "bgm/night",
  "エルム村 レミングスの酒場": "bgm/night",
  "試練の洞窟 ─ 青の洞窟":   "bgm/cave",
  "試練の洞窟 ─ 最深部":     "bgm/cave",
};

const BATTLE_BGM = {
  seagull:       "bgm/battle_normal",
  koza:          "bgm/battle_normal",
  shamerlot:     "bgm/battle_normal",
  shamerlot_lv3: "bgm/battle_normal",
  shamerlot_lv5: "bgm/battle_normal",
  simuluu:       "bgm/battle_boss",
};

function resolveBgmId(phase, sceneLoc, enemyType) {
  if (phase === "title" || phase === "select") return PHASE_BGM.title;
  if (phase === "end")     return PHASE_BGM.ending;
  if (phase === "victory") return null;  // ファンファーレはplayFanfareで別管理
  if (phase === "battle")  return BATTLE_BGM[enemyType] ?? null;
  if (phase === "game")    return LOC_BGM[sceneLoc] ?? null;
  return null;
}

const SIMULUU_IMG_URL = "https://superapolon.github.io/Arcadia_Assets/enemies/simuluu.webp";

const ENEMY_IMG_MAP = {
  seagull:       "enemies/seagull",
  koza:          "enemies/koza",
  shamerlot:     "enemies/shamelot",
  shamerlot_lv3: "enemies/shamelot",
  shamerlot_lv5: "enemies/shamelot",
  simuluu:       null, // 直URL使用
  simuluu_ch2:   null, // 直URL使用
};

const SPRITE_MAP = {
  "🧑":     "sprites/eltz",
  "🧑‍🦱":     "sprites/swift",
  "👩":     "sprites/linz",
  "👦":     "sprites/chopper",
  "🐰":     "sprites/cricket",
  "🙍":     "sprites/koza",
  "👩‍🦰":     "sprites/rose",
  "👨":     "sprites/juda",
  "👧":     "sprites/ymir",
  "🤓":     "sprites/rubens",
  "👤":     "sprites/traveler",
  "👵":     "sprites/old_woman",
  "🧓":     "sprites/shopkeeper",
};

// @@SECTION:SPRITE_SIZE ────────────────────────────────────────────────────
// スプライトごとの表示サイズ個別設定。変更したいときはここだけ編集する。
// height:       画像の通常表示高さ（px）
// heroHeight:   index=0（主人公）として表示されるときの高さ（px）
// offsetY:      下端からの垂直オフセット（px）。正値で上に、負値で下にずらす
// fallbackSize: 画像なしの場合の絵文字フォントサイズ（px）
const SPRITE_SIZE = {
  "🧑":           { height: 240, heroHeight: 240, offsetY:  0, fallbackSize: 52 }, // 🧑  eltz
  "🧑‍🦱":           { height: 220, heroHeight: 240, offsetY:  0, fallbackSize: 48 }, // 🧑‍🦱 swift
  "👩":           { height: 220, heroHeight: 240, offsetY:  0, fallbackSize: 48 }, // 👩  linz
  "👦":           { height: 180, heroHeight: 240, offsetY:  0, fallbackSize: 40 }, // 👦  chopper
  "🐰":           { height: 130, heroHeight: 220, offsetY:  0, fallbackSize: 40 }, // 🐰  cricket
  "🙍":           { height: 205, heroHeight: 280, offsetY:  0, fallbackSize: 48 }, // 🙍  koza
  "👩‍🦰":           { height: 233, heroHeight: 280, offsetY:  0, fallbackSize: 50 }, // 👩‍🦰 rose
  "👨":           { height: 220, heroHeight: 280, offsetY:  0, fallbackSize: 50 }, // 👨  juda
  "👧":           { height: 200, heroHeight: 260, offsetY:  0, fallbackSize: 50 }, // 👧  ymir
  "🤓":           { height: 180, heroHeight: 280, offsetY:  0, fallbackSize: 48 }, // 🤓  rubens
  "👤":           { height: 200, heroHeight: 260, offsetY:  0, fallbackSize: 50 }, // 👤  traveler
  "👵":           { height: 190, heroHeight: 240, offsetY:  0, fallbackSize: 50 }, // 👵  old_woman
  "🧓":           { height: 200, heroHeight: 260, offsetY:  0, fallbackSize: 50 }, // 🧓  shopkeeper
};

// @@SECTION:ENEMY_SIZE ─────────────────────────────────────────────────────
// エネミーごとの表示サイズ設定。変更したいときはここだけ編集する。
//
// 【指定方法】数値 or オブジェクトの2通り:
//
//   数値だけ書く場合 → px固定（縦横ともその値で表示）
//     seagull: 160
//
//   オブジェクトで書く場合 → モードを明示指定
//     { mode:"fixed", size:160 }   // px固定（数値指定と同じ）
//     { mode:"auto",  pct:75  }    // 縦方向基準・左カラム高さの pct% で表示
//                                  // pct 省略時は 80%
//
// 【使い分けの目安】
//   - 画面を大きく使いたいボス・大型エネミー → mode:"auto"
//   - 小さめに見せたい雑魚・人型エネミー    → mode:"fixed" or 数値
//
const ENEMY_IMG_SIZE = {
  seagull:       { mode:"fixed", size: 180 },
  koza:          { mode:"fixed", size: 450 },
  shamerlot:     { mode:"fixed", size: 220 },
  shamerlot_lv3: { mode:"fixed", size: 260 },
  shamerlot_lv5: { mode:"fixed", size: 300 },
  simuluu:       { mode:"fixed", size: 500 },
};

const BATTLE_BG_MAP = {
  seagull:       "battle/bg_cave",
  koza:          "battle/bg_cave",
  shamerlot:     "battle/bg_cave",
  shamerlot_lv3: "battle/bg_cave",
  shamerlot_lv5: "battle/bg_cave",
  simuluu:       "scenes/s26_cave_blue",
  simuluu_ch2:   "scenes/s27_cave_deep",
};

// @@SECTION:BATTLE_BG_STYLE ─────────────────────────────────────────────────
// バトル背景画像のサイズ・位置をエネミーごとに個別調整する。
// size:     CSS background-size 値（"cover" / "contain" / "120%" など）
// position: CSS background-position 値（"center" / "top center" / "50% 30%" など）
const BATTLE_BG_STYLE = {
  seagull:       { size: "contain", position: "top center" },
  koza:          { size: "contain", position: "top center" },
  shamerlot:     { size: "contain", position: "top center" },
  shamerlot_lv3: { size: "contain", position: "top center" },
  shamerlot_lv5: { size: "contain", position: "top center" },
  simuluu:       { size: "cover",   position: "center" },
  simuluu_ch2:   { size: "cover",   position: "center" },
};

// @@SECTION:SCENE_BG_STYLE ──────────────────────────────────────────────────
// シーン背景画像のサイズ・位置をロケーションごとに個別調整する。
// size:     CSS background-size 値（"cover" / "contain" / "120%" など）
// position: CSS background-position 値（"center" / "top center" / "50% 30%" など）
// ※ キーは LOC_TO_SCENE_IMG のキー（loc文字列）と一致させる
const SCENE_BG_STYLE = {
  "VRS接続中":               { size: "contain", position: "center" },
  "旅立ちの浜辺":            { size: "contain", position: "center" },
  "イルカ島 海岸線":         { size: "contain", position: "center" },
  "エルム村":                { size: "contain", position: "center" },
  "エルム村 ギルド":         { size: "contain", position: "center" },
  "エルム村 ギルド裏・草地": { size: "contain", position: "center" },
  "エルム村 宿屋":           { size: "contain", position: "center" },
  "エルム村 レミングスの酒場":{ size: "contain", position: "center" },
  "イルカ島 岩場":           { size: "contain", position: "center" },
  "エルム村 交易所":         { size: "contain", position: "center" },
  "エルム村 武器屋":         { size: "contain", position: "center" },
  "エルム村 防具屋":         { size: "contain", position: "center" },
  "イルカ島 船着場":         { size: "contain", position: "center" },
  "イルカ島 西海岸":         { size: "contain", position: "center" },
  "試練の洞窟 ─ 青の洞窟":  { size: "contain", position: "center" },
  "試練の洞窟 ─ 最深部":    { size: "contain", position: "center" },
};

const LOC_TO_SCENE_IMG = {
  "VRS接続中":               "scenes/s00_vrs",
  "旅立ちの浜辺":            "scenes/s01_beach",
  "イルカ島 海岸線":         "scenes/s02_coast",
  "エルム村":                "scenes/s03_village",
  "エルム村 ギルド":         "scenes/s04_guild",
  "エルム村 ギルド裏・草地": "scenes/s07_meadow",
  "エルム村 宿屋":           "scenes/s09_inn",
  "エルム村 レミングスの酒場":"scenes/s10_tavern",
  "イルカ島 岩場":           "scenes/s14_rocks",
  "エルム村 交易所":         "scenes/s13_market",
  "エルム村 武器屋":         "scenes/s17_armory",
  "エルム村 防具屋":         "scenes/s17_armory",
  "イルカ島 船着場":         "scenes/s19_pier",
  "イルカ島 西海岸":         "scenes/s25_westcoast",
  "試練の洞窟 ─ 青の洞窟":  "scenes/s26_cave_blue",
  "試練の洞窟 ─ 最深部":    "scenes/s27_cave_deep",
};

// 勝利画面ボタン -- 1回目押下でファンファーレ開始、2回目押下でシーン遷移
function VictoryButton({ onFanfareStart, onProceed }) {
  const [started, setStarted] = useState(false);
  const handleClick = () => {
    if (!started) {
      setStarted(true);
      onFanfareStart();
    } else {
      onProceed();
    }
  };
  const label  = started ? "次へ ▶" : "結果を確認  ▶";
  const border = started ? C.accent2 : C.gold;
  const color  = started ? C.accent2 : C.gold;
  return (
    <button
      onClick={handleClick}
      style={{padding:"12px 52px",background:"transparent",border:`1px solid ${border}`,color,fontSize:15,letterSpacing:4,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",transition:"all 0.3s"}}
      onMouseEnter={e => { e.currentTarget.style.background = `${border}22`; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >{label}</button>
  );
}


// @@SECTION:SAVE_LOAD
// セーブJSON: { version, chapter, savedAt, player:{hp,mhp,mp,mmp,elk,lv,exp,weapon,weaponPatk,statPoints,statAlloc,hasPb,hasMapScan,inCom} }

// ============================================================
// @@SECTION:SCENES_CH2 -- 第二章シナリオデータ
// ============================================================
const SCENES = [
  // S0: Lexia 大陸 到着 → 即バトルモック突入
  { bg:["#0a1828","#1a4060","#2a6888"], loc:"Lexia 沿岸部", sprites:["🧑","🧑‍🦱","👩","👦"], dl:[
    { sp:"ナレーション", t:"洗礼の門を越えた先に広がる新大陸──\n\nLexia。\n\nその沿岸の空気は、イルカ島とは\nまるで異なる重さを持っていた。" },
    { sp:"エルツ", t:"「着いた......\n\nここが、Lexia か」" },
    { sp:"スウィフト", t:"「なんか空気が違うな。\n\nイルカ島より......息苦しい感じがする」" },
    { sp:"チョッパー", t:"「ねえ、あれ見て！\n\n空に魔法陣みたいなの浮かんでる！」" },
    { sp:"ナレーション", t:"チョッパーの指差す方向を見ると──\n確かに夕暮れ空に巨大な光の紋様が\nゆっくりと回転していた。\n\nその瞬間──", next:1 }
  ]},
  // S0.5: Simuluu 再臨（バトルモック）
  { bg:["#050210","#0f0528","#1a0a50"], loc:"Lexia 沿岸部", sprites:["🧑","🧑‍🦱","👩","👦"], dl:[
    { sp:"SYSTEM", t:"── 警告 ──\n\n空間が歪んでいる。\n何かが......来る。" },
    { sp:"ナレーション", t:"光の紋様が激しく脈打ち、\n眩い閃光とともに巨大な影が\n浜辺に降り立った。\n\nその白亜の姿は、確かに見覚えがある──" },
    { sp:"エルツ", t:"「Simuluu......！？\n\nなぜここに......！」" },
    { sp:"スウィフト", t:"「でかい。\nイルカ島で戦ったやつの\n何倍もある......！」" },
    { sp:"ナレーション", t:"Simuluuの身体が七色に輝く。\n\n属性エネルギーを纏い、\n覚醒体と化した主が四人に牙を剥く──！", battle:true, battleType:"simuluu_ch2", battleNext:2 }
  ]},
  // S1: 最初の街 Verne
  { bg:["#100820","#201040","#301860"], loc:"Verne 城下町", sprites:["🧑","🧑‍🦱","👩","👦"], dl:[
    { sp:"ナレーション", t:"沿岸から続く石畳の道を歩くこと小一時間──\n\n石造りの建物が立ち並ぶ街が見えてきた。\n名をVerne（ヴェルヌ）という。" },
    { sp:"エルツ", t:"「ここが最初の街か......\n\nイルカ島の木造の雰囲気とは\n全然違うな」" },
    { sp:"スウィフト", t:"「見ろよ、路地に魔法灯がある。\n\nあれ、全部魔力で光ってるんじゃないか？」" },
    { sp:"リンス", t:"「魔法が日常にある場所、\nってことなんだね」", next:3 }
  ]},
  // S2: 宿屋（仮エンド）
  { bg:["#100820","#201040","#301860"], loc:"Verne 宿屋", sprites:["🧑"], dl:[
    { sp:"ナレーション", t:"Verneの宿屋で一夜を過ごした四人。\n\n明日から始まる新たな冒険に向けて、\nエルツは静かに目を閉じた。\n\n─ 第二章 序章 ─\n\nTO BE CONTINUED..." },
    { sp:"SYSTEM", t:"── 第二章 序章 完了 ──\n\n引き続きのご冒険を、お楽しみに。", ending:true }
  ]},
  // S3: マルチバトルテスト（シャメロットLv5 × 2 ＋ シムルー中央）
  { bg:["#0a1808","#1a2808","#301008"], loc:"イルカ島 岩場", sprites:["🧑","🧑‍🦱","👩","👦"], dl:[
    { sp:"エルツ", t:"「3体同時......！\n行くぞ、みんな！」", battle:true, multiEnemyTypes:["shamerlot_lv5","simuluu","shamerlot_lv5"], battleNext:2 }
  ]},
];

// @@SECTION:MAIN_COMPONENT
export default function ArcadiaCh2() {
  // @@SECTION:STATE_ADVENTURE
  const [phase, setPhase] = useState("load");
  const [saveFile,  setSaveFile]  = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [dragOver,  setDragOver]  = useState(false);
  // エネミーパターンをランタイムで編集可能なステートとして保持
  const [battleDefs, setBattleDefs] = useState(INITIAL_BATTLE_DEFS);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [dlIdx, setDlIdx] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [typing, setTyping] = useState(false);
  const [choices, setChoices] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [pbTab, setPbTab] = useState(0);
  const [fade, setFade] = useState(false);
  const [notif, setNotif] = useState(null);
  const [lvUpInfo, setLvUpInfo] = useState(null);
  const [showStatUI, setShowStatUI] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const autoAdvanceRef = useRef(false);
  const setAutoAdv = (v) => { autoAdvanceRef.current = v; setAutoAdvance(v); };
  const [novelLog, setNovelLog] = useState([]);  // { sp, t, sIdx }[] -- 全ダイアログ履歴
  const [novelSelScene, setNovelSelScene] = useState(null);  // 表示中のシーンindex
  const [novelTab, setNovelTab] = useState("novel");  // "novel" | "log"
  const [novelCache, setNovelCache] = useState({});   // { [sceneIdx]: string | null } fetchキャッシュ
  const [novelLoading, setNovelLoading] = useState(false);  // fetch中フラグ
  // パターンエディター用ステート
  const [editorSelKey, setEditorSelKey] = useState("seagull");
  const [showExport, setShowExport] = useState(false);

  // @@SECTION:STATE_PLAYER
  const [hp, setHp] = useState(100);
  const [mhp, setMhp] = useState(100);
  const [mp, setMp] = useState(80);
  const [mmp, setMmp] = useState(80);
  const [elk, setElk] = useState(50);
  const [lv, setLv] = useState(1);
  const [exp, setExp] = useState(0);
  const [weapon, setWeapon] = useState("銅の短剣");
  const [weaponPatk, setWeaponPatk] = useState(3);   // 武器による物理ATK補正（銅の短剣+3）
  const [statPoints, setStatPoints] = useState(0);
  const [statAlloc, setStatAlloc] = useState({patk:10,pdef:10,matk:10,spd:10});
  const [hasPb, setHasPb] = useState(true);
  const [hasMapScan, setHasMapScan] = useState(true);
  const [inCom, setInCom] = useState(false);

  // @@SECTION:STATE_BATTLE
  const [battleEnemy, setBattleEnemy] = useState(null);
  const [currentEnemyType, setCurrentEnemyType] = useState(null);
  const [enemyHp, setEnemyHp] = useState(0);
  const [btlLogs, setBtlLogs] = useState([]);
  const [guarding, setGuarding] = useState(false);
  const [victory, setVictory] = useState(false);
  const [defeat, setDefeat] = useState(false);
  const [turn, setTurn] = useState(0);
  const [battleNext, setBattleNext] = useState(null);
  const [btlAnimEnemy, setBtlAnimEnemy] = useState(false);
  const [btlAnimPlayer, setBtlAnimPlayer] = useState(false);
  const [victoryNextSc, setVictoryNextSc] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [enemyTurnIdx, setEnemyTurnIdx] = useState(0);
  const [enemyNextAction, setEnemyNextAction] = useState(null);
  const [noDmgStreak, setNoDmgStreak] = useState(0);
  const [battleResultBonus, setBattleResultBonus] = useState({ comboMult: 1.0, gradeMult: 1.0 });

  // ── 複数敵バトル ───────────────────────────────────────────────────────────
  // null = 単体バトル（既存ロジックそのまま）
  // array = [{ type, def, hp, turnIdx, defeated }, ...]
  const [multiEnemies, setMultiEnemies] = useState(null);
  // コマンド選択後のターゲット選択モード
  // { memberIdx, skillId } を保持し、ターゲット選択UIを出す
  const [pendingTargetSelect, setPendingTargetSelect] = useState(null);
  // { memberId → targetIdx } ターゲット決定済みバッファ
  const [pendingTargets, setPendingTargets] = useState({});

  // ── 属性システム（第二章） ────────────────────────────────────────────────
  const [enemyElementIdx, setEnemyElementIdx] = useState(0);
  const [elemDmgAccum, setElemDmgAccum] = useState(0);
  const [showElemMenu, setShowElemMenu] = useState(false);
  const [showSpecMenu, setShowSpecMenu] = useState(false); // 特殊スキルサブメニュー
  const [elemBreakAnim, setElemBreakAnim] = useState(false);

  // ── パーティーHP・MP・SPD（第二章専用） ────────────────────────────────
  // 主人公はメインのhp/mhp/mp/mmpで管理。仲間3人の個別HP/MP
  const [partyHp,  setPartyHp ] = useState({ swift:80, linz:70,  chopper:65 });
  const [partyMhp]              = useState({ swift:80, linz:70,  chopper:65 });
  const [partyMp,  setPartyMp ] = useState({ swift:60, linz:70,  chopper:50 });
  const [partyMmp]              = useState({ swift:60, linz:70,  chopper:50 });

  // ── パーティーコマンド入力フェーズ（第二章専用） ────────────────────────
  // PARTY_MEMBERS: 固定順序でコマンド入力を回す
  // inputPhase: "command" = コマンド入力中, "execute" = 実行中（ボタン無効）
  // pendingCommands: { memberId → skillId } 収集バッファ
  // cmdInputIdx: 現在コマンド入力中のメンバーインデックス（0〜3）
  const [inputPhase, setInputPhase] = useState("command"); // "command" | "execute"
  const [pendingCommands, setPendingCommands] = useState({}); // { eltz,swift,linz,chopper → skillId }
  const [cmdInputIdx, setCmdInputIdx] = useState(0); // 0=エルツ,1=スウィフト,2=リンス,3=チョッパー

  // ── SPDデバフ管理 ──────────────────────────────────────────────────────
  // 大地斬を使ったターンの次ターン、敵SPDを-5する残りターン数
  const [enemySpdDebuff, setEnemySpdDebuff] = useState(0); // 残りターン数（1以上で有効）

  // ── 怒り状態管理（敵） ─────────────────────────────────────────────────
  // enrageCount > 0 のとき、敵の全攻撃ダメージ×2（氷結斬で即時解除）
  const [enrageCount, setEnrageCount] = useState(0);

  // ── 敵ATKデバフ管理（火炎斬効果） ─────────────────────────────────────
  // enemyAtkDebuff > 0 のとき、敵の攻撃力を半減する残りターン数
  const [enemyAtkDebuff, setEnemyAtkDebuff] = useState(0);

  // ── パーティSPDバフ管理（雷神斬効果） ─────────────────────────────────
  // partySpdBuff > 0 のとき、全味方のSPDを+3する残りターン数
  const [partySpdBuff, setPartySpdBuff] = useState(0);

  // ── 挑発クールダウン管理（エルツ専用） ──────────────────────────────────
  // provokeCooldown > 0 のとき挑発は使用不可。使用後3ターン経過で再使用可能。
  // provokeActive > 0 のとき敵の行動を強制的にatkに変換する（残りターン数）。
  const [provokeCooldown, setProvokeCooldown] = useState(0);
  const [provokeActive,   setProvokeActive  ] = useState(0);

  // ── テイクダウン（エルツ専用）────────────────────────────────────────────
  // takedownCooldown > 0: CD中。使用後3T経過で再使用可。
  // takedownActive > 0: このターン敵を行動不能にする（使用した次ターン反映）
  const [takedownCooldown, setTakedownCooldown] = useState(0);
  const [takedownActive,   setTakedownActive  ] = useState(0);

  // ── スリープ（リンス専用）──────────────────────────────────────────────
  // sleepCooldown > 0: CD中。使用後3T経過で再使用可。
  // sleepActive > 0: 敵全員を行動不能にする残りターン数
  const [sleepCooldown, setSleepCooldown] = useState(0);
  const [sleepActive,   setSleepActive  ] = useState(0);

  // ── 属性スキルクールダウン（各3T）────────────────────────────────────────
  // { elem_fire:0, elem_ice:0, elem_thunder:0, elem_earth:0 }
  // > 0 のとき使用不可、毎ターン1ずつ減算
  const [elemCooldowns, setElemCooldowns] = useState({ elem_fire:0, elem_ice:0, elem_thunder:0, elem_earth:0 });

  const typeTimerRef = useRef(null);
  const notifTimerRef = useRef(null);
  const textScrollRef = useRef(null);
  const tapStartYRef  = useRef(0);   // スクロール判定用
  const autoAdvTimerRef = useRef(null); // オート進行タイマー

  // ── BGM制御 ref ────────────────────────────────────────────────────────────
  const audioRef        = useRef(null);   // 現在再生中のAudioインスタンス
  const currentBgmRef   = useRef(null);   // 現在再生中のbgmId
  const audioUnlocked   = useRef(false);  // AutoPlay Policy: ユーザー操作後にtrue
  const pendingBgmRef   = useRef(null);   // アンロック前に要求されたbgmId
  const fanfareRef      = useRef(null);   // ファンファーレ専用Audioインスタンス
  const isFanfareRef    = useRef(false);  // ファンファーレ再生中フラグ

  const FADE_OUT_MS = 1000;
  const FADE_IN_MS  = 800;

  // fadeOutはタイマーをローカル管理（競合しない）
  const fadeOut = useCallback((audio, ms, onDone) => {
    if (!audio) { onDone(); return; }
    const steps    = 20;
    const interval = ms / steps;
    const delta    = audio.volume / steps;
    let count      = 0;
    let timer      = null;
    timer = setInterval(() => {
      count++;
      audio.volume = Math.max(0, audio.volume - delta);
      if (count >= steps) { clearInterval(timer); onDone(); }
    }, interval);
  }, []);

  const fadeIn = useCallback((audio, ms, targetVolume = 0.7) => {
    const steps    = 20;
    const interval = ms / steps;
    const delta    = targetVolume / steps;
    let count      = 0;
    const timer = setInterval(() => {
      count++;
      audio.volume = Math.min(targetVolume, audio.volume + delta);
      if (count >= steps) clearInterval(timer);
    }, interval);
  }, []);

  // BGMを即再生する内部関数（アンロック済み前提）
  const _startBgm = useCallback((nextId) => {
    // ファンファーレ再生中はBGM切り替えをスキップ
    if (isFanfareRef.current) { currentBgmRef.current = nextId; return; }
    const nextUrl = nextId ? bgmUrl(nextId) : null;
    fadeOut(audioRef.current, FADE_OUT_MS, () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      currentBgmRef.current = nextId;
      if (!nextUrl) return;
      const audio = new Audio(nextUrl);
      audio.loop   = true;
      audio.volume = 0;
      audio.play().catch(() => {});
      audioRef.current = audio;
      fadeIn(audio, FADE_IN_MS);
    });
  }, [fadeOut, fadeIn]);

  const switchBgm = useCallback((nextId) => {
    if (currentBgmRef.current === nextId) return;
    // ユーザー操作前はpendingに積むだけ（AutoPlay Policy対策）
    if (!audioUnlocked.current) {
      pendingBgmRef.current = nextId;
      return;
    }
    _startBgm(nextId);
  }, [_startBgm]);

  // ユーザーの最初の操作でAudioContextをアンロックし、pendingBGMを再生する
  const unlockAudio = useCallback((bgmId) => {
    audioUnlocked.current = true;
    const target = bgmId ?? pendingBgmRef.current;
    pendingBgmRef.current = null;
    if (target && currentBgmRef.current !== target) {
      _startBgm(target);
    }
  }, [_startBgm]);

  // ファンファーレ再生。メインBGMとは独立したAudioで再生し競合しない。
  const playFanfare = useCallback((onDone) => {
    const url = bgmUrl("bgm/fanfare");
    // urlなし or AutoPlayブロック時でも必ずonDoneを呼ぶためフラグで管理
    let called = false;
    const done = () => {
      if (!called) {
        called = true;
        isFanfareRef.current = false;
        fanfareRef.current = null;
        onDone?.();
      }
    };

    if (!url) { done(); return; }

    // メインBGMをフェードダウン（停止はしない）
    if (audioRef.current) {
      fadeOut(audioRef.current, 600, () => {
        if (audioRef.current) audioRef.current.volume = 0;
      });
    }

    isFanfareRef.current = true;
    if (fanfareRef.current) { fanfareRef.current.pause(); fanfareRef.current = null; }

    const audio = new Audio(url);
    audio.loop   = false;
    audio.volume = 0.8;
    fanfareRef.current = audio;
    audio.onerror = done;

    // play()が失敗（AutoPlayブロック含む）した場合も即done
    audio.play().then(() => {
      // 再生成功: onendedで遷移、念のため最大10秒のフォールバック
      const fallback = setTimeout(done, 10000);
      audio.onended = () => { clearTimeout(fallback); done(); };
      audio.onerror = () => { clearTimeout(fallback); done(); };
    }).catch(() => {
      // 再生失敗 → 即座にシーン遷移
      done();
    });
  }, [fadeOut]);

  // @@SECTION:LOGIC_TYPEWRITER
  const startType = useCallback((text, onDone) => {
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
    setTyping(true);
    setDisplayText("");
    let i = 0;
    const tick = () => {
      if (i >= text.length) { setTyping(false); onDone && onDone(); return; }
      const ch = text[i];
      setDisplayText(text.slice(0,i+1));
      i++;
      const delay = /[。！？...]/.test(ch) ? 120 : ch==="\n" ? 80 : 28;
      typeTimerRef.current = setTimeout(tick, delay);
    };
    tick();
  }, []);

  const showNotif = useCallback((msg) => {
    setNotif(msg);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setNotif(null), 2800);
  }, []);

  const showDl = useCallback((sIdx, dIdx) => {
    const sc = SCENES[sIdx];
    if (!sc) return;
    const dl = sc.dl[dIdx];
    if (!dl) return;

    // シナリオログに追記（sceneIdxも記録してシーン別表示に対応）
    setNovelLog(prev => [...prev, { sp: dl.sp, t: dl.t, sIdx: sIdx }]);

    // Handle events
    if (dl.pbOpen) setHasPb(true);
    if (dl.mapScanUnlock) { setHasMapScan(true); showNotif("📡 MapScan 解放！"); }
    if (dl.innRest) {
      setHp(h => { const v = Math.max(h, mhp); return v; });
      setMp(m => { const v = Math.max(m, mmp); return v; });
      setHp(mhp); setMp(mmp);
      showNotif("🏨 HP・MP が全回復した！");
    }
    if (dl.sellElk) {
      setElk(e => e + dl.sellElk);
      if (dl.sellElk > 0) showNotif(`💰 ${dl.sellElk} ELK 獲得！`);
    }
    if (dl.gainExp) {
      const ed = battleDefs[dl.gainExp];
      if (ed) handleExpGain(ed.exp, ed.lv);
    }
    if (dl.joinCom) setInCom(true);

    // Battle
    if (dl.battle) {
      const eKey = dl.battleType || "seagull";
      const ed = battleDefs[eKey];
      setBattleEnemy(ed);
      setCurrentEnemyType(eKey);
      setEnemyHp(ed.maxHp);
      setBtlLogs([`⚔ ${ed.name} との戦闘が始まった！`]);
      setGuarding(false);
      setVictory(false);
      setDefeat(false);
      setTurn(0);
      setNoDmgStreak(0);
      setBattleResultBonus({ comboMult: 1.0, gradeMult: 1.0 });
      setEnemyTurnIdx(0);
      setEnemyNextAction((ed.pattern || ["atk"])[0]);
      setBattleNext(dl.battleNext !== undefined ? dl.battleNext : sIdx + 1);
      setPhase("battle");
      return;
    }

    // Ending
    if (dl.ending) {
      startType(dl.t, () => setTimeout(() => { setFade(true); setTimeout(() => { setPhase("end"); setFade(false); }, 600); }, 1200));
      return;
    }

    startType(dl.t, () => {
      if (dl.choices) { setChoices(dl.choices); return; }
      // オートページめくり: 選択肢・バトル・ending以外のみ発火
      if (autoAdvanceRef.current) {
        if (autoAdvTimerRef.current) clearTimeout(autoAdvTimerRef.current);
        autoAdvTimerRef.current = setTimeout(() => {
          if (!autoAdvanceRef.current) return;
          // dl.next 指定あり → シーン遷移
          if (dl.next !== undefined) {
            setFade(true);
            setTimeout(() => { setSceneIdx(dl.next); setDlIdx(0); setFade(false); }, 300);
            return;
          }
          // 次のダイアログへ
          const sc2 = SCENES[sIdx];
          const nextDl = dIdx + 1;
          if (nextDl < sc2.dl.length) {
            setDlIdx(nextDl);
          } else {
            const nextSc = sIdx + 1;
            if (nextSc < SCENES.length) {
              setFade(true);
              setTimeout(() => { setSceneIdx(nextSc); setDlIdx(0); setFade(false); }, 300);
            }
          }
        }, 1800);
      }
    });
  }, [mhp, mmp, showNotif, startType]);

  // enemyLv を受け取り、プレイヤーLvとの差で倍率を計算して経験値付与
  const handleExpGain = useCallback((amount, enemyLv, comboMult) => {
    // 自分以下のLvの敵からは経験値なし（コーザ/シムルー除外フラグは呼び出し側で制御）
    if (enemyLv !== undefined && enemyLv <= lv - 1) {
      showNotif("経験値なし（格下の敵）");
      return;
    }
    // 格上ボーナス: 敵Lvが自分より高いほど多く入手
    let gradeBonus = 1.0;
    if (enemyLv !== undefined) {
      const diff = enemyLv - lv;
      if (diff >= 3)       gradeBonus = 2.0;
      else if (diff === 2) gradeBonus = 1.5;
      else if (diff === 1) gradeBonus = 1.2;
    }
    // comboMult は doBattleAction 側で計算済みの値を受け取る（未渡しは 1.0）
    const totalMult   = gradeBonus * (comboMult ?? 1.0);
    const finalAmount = Math.round(amount * totalMult);

    // ── 多段レベルアップ処理（while ループで何段でも対応）──────────────────
    // React の setState は非同期なので、ここでは現在の lv を直接参照して
    // 「何レベル上がるか」「残EXPはいくつか」を同期的に計算してからまとめてセットする。
    let curLv  = lv;
    let curExp = exp + finalAmount;   // exp は useCallback の deps に含まれているため最新値
    let gained = 0;                   // 今回上がったレベル数

    while (curLv < 6) {
      const threshold = EXP_TABLE[curLv];
      if (!threshold || curExp < threshold) break;
      curExp -= threshold;
      curLv  += 1;
      gained += 1;
    }

    // ステートをまとめて更新（gained > 0 なら複数段もまとめて処理）
    if (gained > 0) {
      setLv(curLv);
      setMhp(h  => h  + 10 * gained);
      setHp(prev => prev + 10 * gained);
      setMmp(m  => m  + 5  * gained);
      setMp(prev => prev + 5 * gained);
      setStatPoints(sp => sp + 3 * gained);
      setLvUpInfo({ oldLv: lv, newLv: curLv });
    }
    setExp(curExp);

    // 通知文字列
    const bonusParts = [];
    if (gradeBonus > 1.0)          bonusParts.push(`格上×${gradeBonus}`);
    if ((comboMult ?? 1.0) > 1.0)  bonusParts.push(`Combo×${(comboMult ?? 1.0).toFixed(2)}`);
    const bonusStr = bonusParts.length > 0 ? ` (${bonusParts.join(", ")})` : "";
    showNotif(`✨ EXP +${finalAmount}${bonusStr}！`);
  }, [lv, exp, showNotif]);

  useEffect(() => {
    if (phase === "game") {
      setChoices(null);
      showDl(sceneIdx, dlIdx);
    }
  }, [phase, sceneIdx, dlIdx]);

  // ── タイプライター自動スクロール ─────────────────────────────────────────
  useEffect(() => {
    const el = textScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayText]);

  // ── BGM切り替え（フェーズ・シーン・バトル敵が変わるたびに呼ぶ）──────────
  useEffect(() => {
    const sceneLoc = SCENES[sceneIdx]?.loc;
    const nextId   = resolveBgmId(phase, sceneLoc, currentEnemyType);
    switchBgm(nextId);
  }, [phase, sceneIdx, currentEnemyType, switchBgm]);

  // アンマウント時にBGM・オートタイマーを停止
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (fanfareRef.current) fanfareRef.current.pause();
      if (autoAdvTimerRef.current) clearTimeout(autoAdvTimerRef.current);
    };
  }, []);

  // @@SECTION:LOGIC_DIALOG_TAP
  const onTapDlg = useCallback(() => {
    if (choices) return;
    // 手動タップ時はオートタイマーをリセット（次のページはオートが再スケジュールする）
    if (autoAdvTimerRef.current) clearTimeout(autoAdvTimerRef.current);
    if (typing) {
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
      const sc = SCENES[sceneIdx];
      const dl = sc?.dl[dlIdx];
      if (dl) setDisplayText(dl.t);
      setTyping(false);
      if (sc?.dl[dlIdx]?.choices) setChoices(sc.dl[dlIdx].choices);
      return;
    }
    // Advance
    const sc = SCENES[sceneIdx];
    const dl = sc?.dl[dlIdx];
    if (!dl) return;
    if (dl.choices) return;

    // Ending フラグがある場合はエンディングへ遷移
    if (dl.ending) {
      setFade(true);
      setTimeout(() => { setPhase("end"); setFade(false); }, 600);
      return;
    }

    if (dl.next !== undefined) {
      setFade(true);
      setTimeout(() => { setSceneIdx(dl.next); setDlIdx(0); setFade(false); }, 300);
    } else {
      const nextDl = dlIdx + 1;
      if (nextDl < sc.dl.length) { setDlIdx(nextDl); }
      else {
        const nextSc = sceneIdx + 1;
        if (nextSc < SCENES.length) { setFade(true); setTimeout(() => { setSceneIdx(nextSc); setDlIdx(0); setFade(false); }, 300); }
      }
    }
  }, [choices, typing, sceneIdx, dlIdx]);

  // @@SECTION:LOGIC_CHOICE
  const onChoice = useCallback((ch) => {
    setChoices(null);
    if (ch.buy === "sword") {
      if (elk >= 87) {
        setElk(e => e - 87);
        setWeapon("銅の剣");
        setWeaponPatk(6);
        showNotif("⚔ 銅の剣を購入した！ 物理ATK +6");
        const nextSc = sceneIdx + 1;
        setFade(true);
        setTimeout(() => { setSceneIdx(nextSc); setDlIdx(0); setFade(false); }, 300);
      } else {
        showNotif("💸 ELKが足りない！");
        const nextDl = dlIdx + 1;
        const sc = SCENES[sceneIdx];
        if (nextDl < sc.dl.length) setDlIdx(nextDl);
      }
      return;
    }
    if (ch.joinCom) {
      setInCom(true);
      showNotif("🌸 White Garden に加入した！");
      const nextSc = sceneIdx + 1;
      setFade(true);
      setTimeout(() => { setSceneIdx(nextSc); setDlIdx(0); setFade(false); }, 300);
      return;
    }
    if (ch.battle) {
      // ── マルチ敵バトル（ch.multiEnemyTypes が配列の場合） ────────────────
      if (ch.multiEnemyTypes && Array.isArray(ch.multiEnemyTypes)) {
        const types = ch.multiEnemyTypes;
        const firstDef = battleDefs[types[0]];
        // バトル全体の代表敵（BGM・単体用HPバー表示などの fallback に使用）
        setBattleEnemy(firstDef);
        setCurrentEnemyType(types[0]);
        setEnemyHp(firstDef.maxHp);
        // 複数敵配列を初期化（slot=インデックスで識別）
        const initEnemies = types.map((t, i) => ({
          slot: i, type: t, def: battleDefs[t],
          hp: battleDefs[t].maxHp, turnIdx: 0, defeated: false,
        }));
        setMultiEnemies(initEnemies);
        setBtlLogs([`⚔ ${types.length}体の敵が現れた！`]);
        setGuarding(false); setVictory(false); setDefeat(false); setTurn(0); setNoDmgStreak(0);
        setBattleResultBonus({ comboMult:1.0, gradeMult:1.0 });
        setEnemyTurnIdx(0);
        setEnemyNextAction((firstDef.pattern || ["atk"])[0]);
        setBattleNext(ch.battleNext !== undefined ? ch.battleNext : sceneIdx + 1);
        setEnemyElementIdx(0); setElemDmgAccum(0); setShowElemMenu(false); setShowSpecMenu(false); setElemBreakAnim(false);
        setPartyHp({ swift:80, linz:70, chopper:65 });
        setPartyMp({ swift:60, linz:70, chopper:50 });
        setInputPhase("command"); setPendingCommands({}); setPendingTargets({}); setPendingTargetSelect(null); setCmdInputIdx(0);
        setEnemySpdDebuff(0); setEnrageCount(0); setEnemyAtkDebuff(0); setPartySpdBuff(0); setProvokeCooldown(0); setProvokeActive(0); setTakedownCooldown(0); setTakedownActive(0); setSleepCooldown(0); setSleepActive(0); setElemCooldowns({ elem_fire:0, elem_ice:0, elem_thunder:0, elem_earth:0 });
        setPhase("battle");
        return;
      }
      // ── 単体バトル（従来） ─────────────────────────────────────────────────
      const eKey = ch.battleType || "seagull";
      const ed = battleDefs[eKey];
      setBattleEnemy(ed);
      setCurrentEnemyType(eKey);
      setEnemyHp(ed.maxHp);
      setBtlLogs([`⚔ ${ed.name} との戦闘が始まった！`]);
      setGuarding(false); setVictory(false); setDefeat(false); setTurn(0); setNoDmgStreak(0);
      setBattleResultBonus({ comboMult: 1.0, gradeMult: 1.0 });
      setEnemyTurnIdx(0);
      setEnemyNextAction((ed.pattern || ["atk"])[0]);
      setBattleNext(ch.battleNext !== undefined ? ch.battleNext : sceneIdx + 1);
      setEnemyElementIdx(0); setElemDmgAccum(0); setShowElemMenu(false); setShowSpecMenu(false); setElemBreakAnim(false);
      setPartyHp({ swift:80, linz:70, chopper:65 });
      setPartyMp({ swift:60, linz:70, chopper:50 });
      setInputPhase("command"); setPendingCommands({}); setPendingTargets({}); setPendingTargetSelect(null); setCmdInputIdx(0);
      setEnemySpdDebuff(0); setEnrageCount(0); setEnemyAtkDebuff(0); setPartySpdBuff(0); setProvokeCooldown(0); setProvokeActive(0); setTakedownCooldown(0); setTakedownActive(0); setSleepCooldown(0); setSleepActive(0); setElemCooldowns({ elem_fire:0, elem_ice:0, elem_thunder:0, elem_earth:0 });
      setMultiEnemies(null);
      setPhase("battle");
      return;
    }
    if (ch.next !== undefined) {
      setFade(true);
      setTimeout(() => { setSceneIdx(ch.next); setDlIdx(0); setFade(false); }, 300);
    } else if (ch.reply !== undefined) {
      const nextDl = dlIdx + 1;
      const sc = SCENES[sceneIdx];
      if (nextDl < sc.dl.length) setDlIdx(nextDl);
    } else {
      const nextDl = dlIdx + 1;
      const sc = SCENES[sceneIdx];
      if (nextDl < sc.dl.length) setDlIdx(nextDl);
    }
  }, [elk, sceneIdx, dlIdx, showNotif]);

  // @@SECTION:LOGIC_BATTLE
  // ─── 定数 ────────────────────────────────────────────────────────────────
  // パーティーメンバー基本情報（変更しない固定値）
  const PARTY_DEFS = [
    // allowedElemSkills: 使用可能な属性スキルID（空配列=属性スキルなし）
    // specialSkill: キャラ固有スキルID（nullなし）
    { id:"eltz",    name:"エルツ",    icon:"🧑",   spd:12, allowedElemSkills:[],                              specialSkills:["provoke","takedown"] },
    { id:"swift",   name:"スウィフト", icon:"🧑‍🦱", spd:15, allowedElemSkills:["elem_ice","elem_thunder"],    specialSkills:[]                    },
    { id:"linz",    name:"リンス",    icon:"👩",   spd:11, allowedElemSkills:[],                              specialSkills:["overheal","sleep"]   },
    { id:"chopper", name:"チョッパー", icon:"👦",   spd:9,  allowedElemSkills:["elem_fire","elem_earth"],     specialSkills:[]                    },
  ];
  const ENEMY_BASE_SPD = 12; // シムルー基本SPD

  // ─── すくみ判定ヘルパー ────────────────────────────────────────────────
  function judgeRPS(playerAction, enemyAction) {
    if (enemyAction === "unavoidable") {
      if (playerAction === "counter" || playerAction === "dodge") return "lose_unavoidable";
      return "neutral";
    }
    if (enemyAction === "unavoidable_lite") {
      if (playerAction === "dodge") return "lose_unavoidable_lite";
      return "neutral";
    }
    if (playerAction === "atk"     && enemyAction === "counter") return "lose";
    if (playerAction === "counter" && enemyAction === "atk")     return "win";
    if (playerAction === "counter" && enemyAction === "dodge")   return "lose";
    if (playerAction === "dodge"   && enemyAction === "counter") return "win";
    if (playerAction === "dodge"   && enemyAction === "atk")     return "lose";
    if (playerAction === "atk"     && enemyAction === "dodge")   return "neutral";
    return "neutral";
  }

  const ENEMY_ACTION_LABEL = {
    atk:              { icon:"⚔",  text:"強攻" },
    counter:          { icon:"🔄", text:"カウンター" },
    dodge:            { icon:"💨", text:"回避" },
    unavoidable:      { icon:"💥", text:"回避不能攻撃！" },
    unavoidable_lite: { icon:"⚡", text:"強化攻撃！" },
    atk_all:          { icon:"🌊", text:"全体攻撃！" },
    enrage:           { icon:"🔴", text:"怒り状態！" },
  };

  // ─── コマンド登録（コマンドフェーズ専用） ───────────────────────────────
  const onSelectCommand = useCallback((skillId) => {
    if (victory || defeat || inputPhase !== "command") return;
    setShowElemMenu(false);
    setShowSpecMenu(false);

    const member = PARTY_DEFS[cmdInputIdx];
    const elemSk = ELEMENT_SKILL_DEFS.find(s => s.id === skillId);
    const baseSk = BATTLE_SKILLS.find(s => s.id === skillId);
    // 特殊スキルは全てコスト0として扱う
    const SPECIAL_IDS = ["provoke","takedown","overheal","sleep"];
    const specialSk = SPECIAL_IDS.includes(skillId) ? { id:skillId, cost:0, dmg:[0,0] } : null;
    const sk = elemSk || baseSk || specialSk;
    if (!sk) return;

    // キャラ別属性スキル制限チェック
    if (elemSk && !member.allowedElemSkills.includes(skillId)) {
      showNotif(`${member.name}はこのスキルを使えない！`); return;
    }
    // キャラ別特殊スキル制限チェック
    if (specialSk && !member.specialSkills.includes(skillId)) {
      showNotif(`${member.name}はこのスキルを使えない！`); return;
    }
    // 各スキルのクールダウンチェック
    if (skillId === "provoke"   && provokeCooldown   > 0) { showNotif(`挑発 CD中（残${provokeCooldown}T）`);    return; }
    if (skillId === "takedown"  && takedownCooldown  > 0) { showNotif(`テイクダウン CD中（残${takedownCooldown}T）`); return; }
    if (skillId === "sleep"     && sleepCooldown     > 0) { showNotif(`スリープ CD中（残${sleepCooldown}T）`);  return; }
    if (elemSk && elemCooldowns[skillId] > 0) {
      showNotif(`${elemSk.label} CD中（残${elemCooldowns[skillId]}T）`); return;
    }

    const currentMp = member.id === "eltz" ? mp : (partyMp[member.id] ?? 0);
    if (sk.cost > 0 && currentMp < sk.cost) { showNotif(`${member.name}のMPが足りない！`); return; }

    // 複数敵バトル かつ 攻撃系スキル → ターゲット選択モードへ
    const needsTarget = !!multiEnemies && skillId !== "heal" && skillId !== "dodge";
    if (needsTarget) {
      setPendingCommands(prev => ({ ...prev, [member.id]: skillId }));
      setPendingTargetSelect({ memberIdx: cmdInputIdx, skillId });
      return;
    }

    // ターゲット不要（heal/dodge または単体バトル）
    const newTargets = multiEnemies ? { ...pendingTargets, [member.id]: 0 } : pendingTargets;
    if (multiEnemies) setPendingTargets(newTargets);

    const newCmds = { ...pendingCommands, [member.id]: skillId };
    const nextIdx = cmdInputIdx + 1;

    if (nextIdx < PARTY_DEFS.length) {
      setPendingCommands(newCmds);
      setCmdInputIdx(nextIdx);
    } else {
      setPendingCommands({});
      if (multiEnemies) setPendingTargets({});
      setCmdInputIdx(0);
      setInputPhase("execute");
      if (multiEnemies) {
        executeMultiTurn(newCmds, newTargets);
      } else {
        executePartyTurn(newCmds);
      }
    }
  }, [victory, defeat, inputPhase, cmdInputIdx, pendingCommands, pendingTargets, mp, partyMp, showNotif, multiEnemies, provokeCooldown, takedownCooldown, sleepCooldown, elemCooldowns]);

  // ─── ターゲット確定（複数敵専用） ─────────────────────────────────────────
  const onSelectTarget = useCallback((targetIdx) => {
    if (!pendingTargetSelect || !multiEnemies) return;
    const { memberIdx, skillId } = pendingTargetSelect;
    const member = PARTY_DEFS[memberIdx];
    const newTargets = { ...pendingTargets, [member.id]: targetIdx };
    const newCmds = { ...pendingCommands }; // skillIdは既に登録済み
    setPendingTargetSelect(null);
    const nextIdx = memberIdx + 1;

    if (nextIdx < PARTY_DEFS.length) {
      setPendingTargets(newTargets);
      setCmdInputIdx(nextIdx);
    } else {
      setPendingCommands({});
      setPendingTargets({});
      setCmdInputIdx(0);
      setInputPhase("execute");
      executeMultiTurn(newCmds, newTargets);
    }
  }, [pendingTargetSelect, pendingTargets, pendingCommands, multiEnemies]);

  // ─── 複数敵ターン実行 ──────────────────────────────────────────────────────
  const executeMultiTurn = useCallback((cmds, targets) => {
    const enemies = multiEnemies;
    if (!enemies) return;

    const spdBuff = partySpdBuff > 0 ? 3 : 0;
    const defBonus = Math.floor((statAlloc.pdef - 10) * 1.2);
    const atkBonus = weaponPatk + Math.floor((statAlloc.patk - 10) * 1.5);

    // 各生存敵の今ターンのアクションを決定
    const aliveEnemies = enemies.filter(e => !e.defeated);

    // SPD順アクターリスト構築（プレイヤー4人 + 生存敵）
    const actors = [
      ...PARTY_DEFS.map(m => ({
        type: "player", id: m.id, name: m.name, icon: m.icon,
        spd: m.spd + spdBuff, skill: cmds[m.id], targetIdx: targets[m.id] ?? 0,
      })),
      ...aliveEnemies.map(e => {
        const eSpd = Math.max(1, (e.def.spd ?? 12) - (enemySpdDebuff > 0 ? 5 : 0));
        const eAction = e.def.pattern[e.turnIdx % e.def.pattern.length];
        return { type: "enemy", enemySlot: e.slot, name: e.def.name, icon: e.def.em,
                 spd: eSpd, skill: eAction, def: e.def };
      }),
    ].sort((a, b) => b.spd !== a.spd ? b.spd - a.spd : (a.type === "player" ? -1 : 1));

    let logs = [];
    let curHp = hp;
    let curMp = mp;
    let curPartyHp = { ...partyHp };
    let curPartyMp = { ...partyMp };
    let curEnemies = enemies.map(e => ({ ...e }));
    const memberHit = { eltz:false, swift:false, linz:false, chopper:false };
    let earthSlashUsed = false;
    let iceSlashUsed = false;
    let thunderSlashUsed = false;
    let fireSlashUsed = false;

    // SPD順行動リスト表示
    const spdLine = actors.map(a => `${a.icon}${a.spd}`).join(">");
    logs.push(`─ ターン ${turn + 1} ─ ${spdLine}`);

    for (const actor of actors) {
      if (actor.type === "player") {
        const skillId = actor.skill;
        const elemSk = ELEMENT_SKILL_DEFS.find(s => s.id === skillId);
        const baseSk = BATTLE_SKILLS.find(s => s.id === skillId);
        const sk = elemSk || baseSk;
        const isEltz = actor.id === "eltz";

        if (sk && sk.cost > 0) {
          if (isEltz) curMp = Math.max(0, curMp - sk.cost);
          else curPartyMp[actor.id] = Math.max(0, (curPartyMp[actor.id] ?? 0) - sk.cost);
        }

        if (skillId === "heal") {
          const healAmt = 80;
          if (isEltz) curHp = Math.min(curHp + healAmt, mhp);
          else curPartyHp[actor.id] = Math.min((curPartyHp[actor.id] ?? 0) + healAmt, partyMhp[actor.id]);
          logs.push(`${actor.icon}${actor.name} 🧪 HP+${healAmt}`);
          continue;
        }
        if (skillId === "dodge") {
          logs.push(`${actor.icon}${actor.name} 💨 回避態勢`);
          continue;
        }

        // 攻撃先を決定（倒されていたら生存中の先頭にフォールバック）
        let tIdx = actor.targetIdx;
        if (!curEnemies[tIdx] || curEnemies[tIdx].defeated) {
          const fb = curEnemies.findIndex(e => !e.defeated);
          if (fb < 0) { logs.push(`${actor.icon}${actor.name} 攻撃対象なし`); continue; }
          tIdx = fb;
        }
        const tEnemy = curEnemies[tIdx];
        const eAction = tEnemy.def.pattern[tEnemy.turnIdx % tEnemy.def.pattern.length];
        const rawDmg = Math.max(1, randInt(sk.dmg[0], sk.dmg[1]) + (isEltz ? atkBonus : 0));

        // 属性スキル追加効果フラグ
        if (skillId === "elem_earth")   { earthSlashUsed = true; }
        if (skillId === "elem_ice")     { iceSlashUsed = true; }
        if (skillId === "elem_thunder") { thunderSlashUsed = true; }
        if (skillId === "elem_fire")    { fireSlashUsed = true; }

        if (elemSk) {
          curEnemies[tIdx].hp = Math.max(0, curEnemies[tIdx].hp - rawDmg);
          if (curEnemies[tIdx].hp <= 0) curEnemies[tIdx].defeated = true;
          logs.push(`${actor.icon}${actor.name} ${elemSk.icon}${elemSk.label} → ${tEnemy.def.em}${tEnemy.def.name} ${rawDmg}ダメージ！`);
        } else {
          const rps = judgeRPS(skillId, eAction);
          if (skillId === "atk" && rps === "lose") {
            logs.push(`${actor.icon}${actor.name} ⚔ → ${tEnemy.def.em}カウンター無効！`);
          } else if (skillId === "counter" && rps === "lose") {
            logs.push(`${actor.icon}${actor.name} 🔄 カウンター → 空振り`);
          } else if (skillId === "counter" && rps === "win") {
            const bd = Math.floor(rawDmg * 1.5);
            curEnemies[tIdx].hp = Math.max(0, curEnemies[tIdx].hp - bd);
            if (curEnemies[tIdx].hp <= 0) curEnemies[tIdx].defeated = true;
            logs.push(`${actor.icon}${actor.name} 🔄カウンター！ → ${tEnemy.def.em}${tEnemy.def.name} ${bd}ダメージ（×1.5）！`);
          } else {
            curEnemies[tIdx].hp = Math.max(0, curEnemies[tIdx].hp - rawDmg);
            if (curEnemies[tIdx].hp <= 0) curEnemies[tIdx].defeated = true;
            logs.push(`${actor.icon}${actor.name} ${baseSk.icon} → ${tEnemy.def.em}${tEnemy.def.name} ${rawDmg}ダメージ！`);
          }
        }
      } else {
        // ── 敵行動 ──────────────────────────────────────────────────────────
        const slot = actor.enemySlot;
        const e = curEnemies.find(e => e.slot === slot);
        if (!e || e.defeated) continue;
        const eAction = actor.skill;

        const isEnraged = enrageCount > 0 && !iceSlashUsed;
        const atkHalf = enemyAtkDebuff > 0;
        const totalMult = (isEnraged ? 2.0 : 1.0) * (atkHalf ? 0.5 : 1.0);
        const rageLabel = isEnraged ? "🔴" : "";
        const halfLabel = atkHalf ? "（ATK½）" : "";

        // 攻撃先パーティメンバー（SPD最低のメンバー）
        const spdSorted = [...PARTY_DEFS].sort((a, b) => a.spd - b.spd);
        const tMember = spdSorted[0];
        const isAtkAll = eAction === "atk_all" || eAction === "unavoidable" || eAction === "unavoidable_lite";

        if (eAction === "dodge") {
          logs.push(`${e.def.em}${e.def.name} 💨 回避！`);
        } else if (eAction === "enrage") {
          logs.push(`${e.def.em}${e.def.name} 🔴 怒り状態に！`);
        } else if (isAtkAll) {
          const [minD, maxD] = eAction === "unavoidable" ? (e.def.unavoidableAtk ?? [30,45]) : eAction === "unavoidable_lite" ? [18,28] : e.def.atk;
          const dmg = Math.max(1, Math.floor(randInt(minD, maxD) * totalMult) - defBonus);
          const label = eAction === "atk_all" ? "🌊全体攻撃" : eAction === "unavoidable" ? "💥回避不能" : "⚡強化攻撃";
          logs.push(`${e.def.em}${rageLabel}${label}${halfLabel} 全員${dmg}ダメージ！`);
          curHp = Math.max(0, curHp - dmg);
          for (const k of ["swift","linz","chopper"]) curPartyHp[k] = Math.max(0, (curPartyHp[k] ?? 0) - dmg);
          Object.keys(memberHit).forEach(k => memberHit[k] = true);
        } else if (eAction === "counter") {
          const eltzCmd = cmds["eltz"];
          if (eltzCmd === "atk") {
            const cd = Math.max(1, Math.floor(randInt(e.def.atk[0], e.def.atk[1]) * 1.3 * totalMult) - defBonus);
            curHp = Math.max(0, curHp - cd);
            memberHit["eltz"] = true;
            logs.push(`${e.def.em}${rageLabel}🔄${e.def.name}カウンター！${halfLabel} エルツ${cd}ダメージ！`);
          } else {
            const d = Math.max(1, Math.floor(randInt(e.def.atk[0], e.def.atk[1]) * totalMult) - defBonus);
            if (tMember.id === "eltz") { curHp = Math.max(0, curHp - d); memberHit["eltz"] = true; }
            else { curPartyHp[tMember.id] = Math.max(0, (curPartyHp[tMember.id] ?? 0) - d); memberHit[tMember.id] = true; }
            logs.push(`${e.def.em}${rageLabel}🔄${e.def.name}カウンター！${halfLabel} ${tMember.icon}${tMember.name}${d}ダメージ！`);
          }
        } else {
          // 通常atk
          const d = Math.max(1, Math.floor(randInt(e.def.atk[0], e.def.atk[1]) * totalMult) - defBonus);
          if (tMember.id === "eltz") { curHp = Math.max(0, curHp - d); memberHit["eltz"] = true; }
          else { curPartyHp[tMember.id] = Math.max(0, (curPartyHp[tMember.id] ?? 0) - d); memberHit[tMember.id] = true; }
          logs.push(`${e.def.em}${rageLabel}⚔${e.def.name}！${halfLabel} ${tMember.icon}${tMember.name}に${d}ダメージ！`);
        }
        // このスロットのturnIdxを進める
        const slotIdx = curEnemies.findIndex(e => e.slot === slot);
        if (slotIdx >= 0) curEnemies[slotIdx].turnIdx = (e.turnIdx + 1) % e.def.pattern.length;
      }
    }

    // コンボ判定
    const anyHit = Object.values(memberHit).some(v => v);
    const newStreak = anyHit ? 0 : noDmgStreak + PARTY_DEFS.length;
    if (!anyHit) {
      const gain = 5 + newStreak;
      curMp = Math.min(curMp + gain, mmp);
      for (const k of Object.keys(curPartyMp)) curPartyMp[k] = Math.min((curPartyMp[k] ?? 0) + gain, partyMmp[k] ?? 0);
      if (newStreak >= 3) logs.push(`✨PARTY COMBO ${newStreak}! 全員MP+${gain}！`);
    }

    // バフ・デバフ更新
    const nextEnrageCount = iceSlashUsed ? 0 : Math.max(0, enrageCount - 1);
    const nextAtkDebuff = fireSlashUsed ? 3 : Math.max(0, enemyAtkDebuff - 1);
    const nextSpdBuff = thunderSlashUsed ? 3 : Math.max(0, partySpdBuff - 1);

    // ステート一括更新
    setHp(Math.min(curHp, mhp));
    setMp(Math.max(0, curMp));
    setPartyHp(curPartyHp);
    setPartyMp(curPartyMp);
    setMultiEnemies(curEnemies);
    setTurn(t => t + 1);
    setNoDmgStreak(newStreak);
    setEnemySpdDebuff(prev => earthSlashUsed ? 1 : Math.max(0, prev - 1));
    setEnrageCount(nextEnrageCount);
    setEnemyAtkDebuff(nextAtkDebuff);
    setPartySpdBuff(nextSpdBuff);
    setBtlAnimEnemy(true); setTimeout(() => setBtlAnimEnemy(false), 400);
    setBtlLogs(prev => [...prev, ...logs].slice(-20));

    // 全滅チェック
    const allDefeated = curEnemies.every(e => e.defeated);
    if (allDefeated) {
      setVictory(true);
      const totalElk = curEnemies.reduce((s, e) => s + (e.def.elk ?? 0), 0);
      const totalExp = curEnemies.reduce((s, e) => s + (e.def.exp ?? 0), 0);
      const maxLv = Math.max(...curEnemies.map(e => e.def.lv ?? 1));
      if (totalElk > 0) { setElk(v => v + totalElk); showNotif(`💰 ${totalElk} ELK 獲得！`); }
      if (totalExp > 0) {
        const gradeMult = (() => { const d = maxLv - lv; if (d >= 3) return 2.0; if (d === 2) return 1.5; if (d === 1) return 1.2; return 1.0; })();
        setBattleResultBonus({ comboMult:1.0, gradeMult });
        setTimeout(() => handleExpGain(totalExp, maxLv, 1.0), 500);
      }
      setBtlLogs(prev => [...prev, `🏆 全敵を倒した！`]);
    } else if (curHp <= 0) {
      setDefeat(true);
      setBtlLogs(prev => [...prev, "💀 エルツが戦闘不能..."]);
    } else {
      setInputPhase("command");
      setCmdInputIdx(0);
    }
  }, [
    multiEnemies, hp, mp, mhp, mmp, partyHp, partyMhp, partyMp, partyMmp,
    statAlloc, weaponPatk, partySpdBuff, enemySpdDebuff, enrageCount, enemyAtkDebuff,
    noDmgStreak, turn, lv, showNotif, handleExpGain,
  ]);

  // ─── パーティーターン実行 ──────────────────────────────────────────────
  // cmds: { memberId → skillId } の確定済みコマンドマップ
  const executePartyTurn = useCallback((cmds) => {
    const ed = battleEnemy;
    if (!ed) return;

    const pattern = (battleDefs[currentEnemyType]?.pattern) || ed.pattern || ["atk"];
    const eAction = pattern[enemyTurnIdx % pattern.length];
    const nextEnemyTurnIdx = (enemyTurnIdx + 1) % pattern.length;

    // ── 属性情報 ──────────────────────────────────────────────────────────
    const elementCycle = ed.elementCycle || null;
    const currentElementKey = elementCycle ? elementCycle[enemyElementIdx % elementCycle.length] : null;
    const nextElementIdx = elementCycle ? (enemyElementIdx + 1) % elementCycle.length : 0;
    const currentElemInfo = currentElementKey ? ELEMENT_NAMES[currentElementKey] : null;

    // ── SPD順ソート ───────────────────────────────────────────────────────
    // 敵SPD（デバフ考慮）
    const effectiveEnemySpd = Math.max(1, ENEMY_BASE_SPD - (enemySpdDebuff > 0 ? 5 : 0));
    // パーティSPDバフ（雷神斬効果）
    const spdBuff = partySpdBuff > 0 ? 3 : 0;
    const actors = [
      ...PARTY_DEFS.map(m => ({ type:"player", id:m.id, name:m.name, icon:m.icon, spd:m.spd + spdBuff, skill:cmds[m.id] })),
      { type:"enemy", id:"enemy", name:ed.name, icon:ed.em, spd:effectiveEnemySpd, skill:eAction },
    ].sort((a, b) => {
      if (b.spd !== a.spd) return b.spd - a.spd;
      return a.type === "player" ? -1 : 1; // 同SPDは味方優先
    });

    // ── 各アクターの行動を順番に解決 ──────────────────────────────────────
    let logs = [];
    let curEnemyHp = enemyHp;
    let curHp = hp;
    let curMp = mp;
    let curPartyHp = { ...partyHp };
    let curPartyMp = { ...partyMp }; // 仲間MP（ターン内で変動）

    const defBonus = Math.floor((statAlloc.pdef - 10) * 1.2);
    const atkBonus = weaponPatk + Math.floor((statAlloc.patk - 10) * 1.5);

    // 属性破壊発動フラグ（このターン中に発動したら敵行動を無効化）
    let elemBreakTriggered = false;
    let newElemAccum = elemDmgAccum;
    // 大地斬使用フラグ（次ターン敵SPDデバフ付与用）
    let earthSlashUsed = false;
    // 氷結斬使用フラグ（怒り状態解除）
    let iceSlashUsed = false;
    // 雷神斬使用フラグ（パーティSPDバフ）
    let thunderSlashUsed = false;
    // 火炎斬使用フラグ（敵ATKデバフ）
    let fireSlashUsed = false;
    // 挑発使用フラグ（このターン挑発発動 → 敵行動を強攻に上書き）
    let provokeUsed = false;
    // テイクダウン使用フラグ（このターン使用 → 敵を1T行動不能）
    let takedownUsed = false;
    // スリープ使用フラグ（このターン使用 → 敵全員を1T行動不能）
    let sleepUsed = false;
    // オーバーヒール使用フラグ
    let overhealUsed = false;
    // 属性スキル使用フラグ（CDセット用）
    const elemUsed = { elem_fire:false, elem_ice:false, elem_thunder:false, elem_earth:false };
    // このターンで敵行動が割り込んだ後の全メンバーの被弾フラグ
    const memberHit = { eltz:false, swift:false, linz:false, chopper:false };

    // ── 現在有効なバフ・デバフ表示 ──────────────────────────────────────
    logs.push(`─ ターン ${turn + 1} ─ SPD順：${actors.map(a => `${a.icon}${a.spd}`).join(" > ")}`);
    if (enemySpdDebuff > 0) logs.push(`⬇️ ${ed.name} SPD -5 デバフ中（残${enemySpdDebuff}T）`);
    if (enrageCount > 0)    logs.push(`🔴 ${ed.name} 怒り状態！ 攻撃力×2（残${enrageCount}T）-- 氷結斬で解除可能`);
    if (enemyAtkDebuff > 0) logs.push(`🔥 ${ed.name} ATK半減中（残${enemyAtkDebuff}T）`);
    if (partySpdBuff > 0)   logs.push(`⚡ パーティ SPD +3 バフ中（残${partySpdBuff}T）`);
    if (provokeActive > 0)  logs.push(`👊 挑発中！ ${ed.name}の行動を強制的に強攻に変換（残${provokeActive}T）`);
    if (takedownActive > 0) logs.push(`🦵 テイクダウン中！ ${ed.name}が行動不能（残${takedownActive}T）`);
    if (sleepActive > 0)    logs.push(`😴 スリープ中！ ${ed.name}が眠り行動不能（残${sleepActive}T）`);

    for (const actor of actors) {
      // 敵が既に倒されていたら敵行動はスキップ
      if (actor.type === "enemy" && curEnemyHp <= 0) continue;

      if (actor.type === "player") {
        const skillId = actor.skill;
        const elemSk = ELEMENT_SKILL_DEFS.find(s => s.id === skillId);
        const baseSk = BATTLE_SKILLS.find(s => s.id === skillId);
        const sk = elemSk || baseSk;
        const isEltz = actor.id === "eltz";

        // MP消費: エルツはcurMp、仲間はcurPartyMp
        if (sk && sk.cost > 0) {
          if (isEltz) curMp = Math.max(0, curMp - sk.cost);
          else curPartyMp[actor.id] = Math.max(0, (curPartyMp[actor.id] ?? 0) - sk.cost);
        }

        if (elemSk) {
          // ── 属性スキル ──────────────────────────────────────────────────
          const isWeakHit = elemSk.targetElement === currentElementKey;
          const rawDmg = Math.max(1, randInt(elemSk.dmg[0], elemSk.dmg[1]) + (isEltz ? atkBonus : 0));

          if (currentElementKey === "none") {
            // 無属性: 蓄積なし・ダメージ半減
            const dmg = Math.max(1, Math.floor(rawDmg * 0.5));
            curEnemyHp = Math.max(0, curEnemyHp - dmg);
            logs.push(`${actor.icon} ${actor.name} ${elemSk.icon} ${elemSk.label}（無属性・蓄積なし） → ${dmg} ダメージ`);
          } else if (isWeakHit) {
            // 優位属性ヒット: 全メンバーの弱点ヒットで蓄積加算
            newElemAccum += rawDmg;
            curEnemyHp = Math.max(0, curEnemyHp - rawDmg);
            logs.push(`${actor.icon} ${actor.name} ${elemSk.icon} ${elemSk.label}！ 弱点ヒット！ ${rawDmg} dmg [蓄積:${Math.min(newElemAccum, ELEMENT_BREAK_THRESHOLD)}/${ELEMENT_BREAK_THRESHOLD}]`);
            if (newElemAccum >= ELEMENT_BREAK_THRESHOLD && !elemBreakTriggered) {
              elemBreakTriggered = true;
              newElemAccum = 0;
              logs.push(`💫 属性破壊！ ${currentElemInfo.label}属性を突破！ 以後の敵行動を無効化！`);
              setElemBreakAnim(true);
              setTimeout(() => setElemBreakAnim(false), 1500);
            }
          } else {
            // 属性不一致: 蓄積なし・ダメージ半減
            const dmg = Math.max(1, Math.floor(rawDmg * 0.5));
            curEnemyHp = Math.max(0, curEnemyHp - dmg);
            logs.push(`${actor.icon} ${actor.name} ${elemSk.icon} ${elemSk.label}（属性不一致・蓄積なし） → ${dmg} ダメージ`);
          }

          // ── 属性スキル追加効果 ──────────────────────────────────────────
          if (skillId === "elem_earth") {
            // 大地斬: 次ターン敵SPD-5
            earthSlashUsed = true; elemUsed.elem_earth = true;
            logs.push(`🌿 大地斬効果：次ターン ${ed.name} SPD -5！`);
          }
          if (skillId === "elem_ice") {
            // 氷結斬: 怒り状態を即時解除
            iceSlashUsed = true; elemUsed.elem_ice = true;
            if (enrageCount > 0) {
              logs.push(`❄️ 氷結斬！ ${ed.name}の怒り状態を解除した！`);
            }
          }
          if (skillId === "elem_thunder") {
            // 雷神斬: 味方全員のSPD+3（3ターン）
            thunderSlashUsed = true; elemUsed.elem_thunder = true;
            logs.push(`⚡ 雷神斬効果：味方全員 SPD +3（3ターン）！`);
          }
          if (skillId === "elem_fire") {
            // 火炎斬: 敵攻撃力半減（3ターン）
            fireSlashUsed = true; elemUsed.elem_fire = true;
            logs.push(`🔥 火炎斬効果：${ed.name}の攻撃力を半減させた（3ターン）！`);
          }
        } else if (skillId === "provoke") {
          // ── 挑発（エルツ専用）──────────────────────────────────────────
          provokeUsed = true;
          logs.push(`${actor.icon} ${actor.name} 👊 挑発！ ${ed.name}の行動を強制的に強攻へ変換！（3ターン）`);
        } else if (skillId === "takedown") {
          // ── テイクダウン（エルツ専用）─────────────────────────────────
          takedownUsed = true;
          logs.push(`${actor.icon} ${actor.name} 🦵 テイクダウン！ ${ed.name}を1ターン行動不能にした！`);
        } else if (skillId === "sleep") {
          // ── スリープ（リンス専用）────────────────────────────────────
          sleepUsed = true;
          logs.push(`${actor.icon} ${actor.name} 😴 スリープ！ ${ed.name}を1ターン眠らせた！`);
        } else if (skillId === "overheal") {
          // ── オーバーヒール（リンス専用）── SPD最低扱い・コンボ判定前に処理
          // このフラグはfor loopの外でまとめて処理（最遅行動）
          overhealUsed = true;
          logs.push(`${actor.icon} ${actor.name} 💚 オーバーヒール！ パーティ全員 HP +80！`);
        } else if (baseSk) {
          // ── 通常スキル ──────────────────────────────────────────────────
          if (skillId === "heal") {
            const healAmt = 80;
            if (isEltz) {
              curHp = Math.min(curHp + healAmt, mhp);
            } else {
              curPartyHp[actor.id] = Math.min((curPartyHp[actor.id] ?? 0) + healAmt, partyMhp[actor.id]);
            }
            logs.push(`${actor.icon} ${actor.name} 🧪 回復ポーション！ HP +${healAmt}`);
          } else if (skillId === "dodge") {
            logs.push(`${actor.icon} ${actor.name} 💨 回避態勢`);
          } else {
            // atk / counter
            const rawDmg = Math.max(1, randInt(baseSk.dmg[0], baseSk.dmg[1]) + (isEltz ? atkBonus : 0));
            const rps = judgeRPS(skillId, eAction);
            if (skillId === "atk" && rps === "lose") {
              logs.push(`${actor.icon} ${actor.name} ⚔ 強攻 → 🔄 カウンターされ無効！`);
            } else if (skillId === "atk" && eAction === "dodge") {
              curEnemyHp = Math.max(0, curEnemyHp - rawDmg);
              logs.push(`${actor.icon} ${actor.name} ⚔ 強攻（回避看破）→ ${rawDmg} ダメージ！`);
            } else if (skillId === "counter" && rps === "lose") {
              logs.push(`${actor.icon} ${actor.name} 🔄 カウンター → 空振り（敵回避）`);
            } else if (skillId === "counter" && rps === "win") {
              const bonusDmg = Math.floor(rawDmg * 1.5);
              curEnemyHp = Math.max(0, curEnemyHp - bonusDmg);
              logs.push(`${actor.icon} ${actor.name} 🔄 カウンター成功！ → ${bonusDmg} ダメージ（×1.5）！`);
            } else {
              curEnemyHp = Math.max(0, curEnemyHp - rawDmg);
              logs.push(`${actor.icon} ${actor.name} ${baseSk.icon} ${baseSk.label} → ${rawDmg} ダメージ！`);
            }
          }
        }
      } else {
        // ── 敵行動 ────────────────────────────────────────────────────────
        if (elemBreakTriggered) {
          logs.push(`${ed.em} ${ed.name}の行動は属性破壊で無効化された！`);
          continue;
        }

        // 行動不能チェック（テイクダウン/スリープ）
        const isStunned = takedownUsed || takedownActive > 0 || sleepUsed || sleepActive > 0;
        if (isStunned) {
          const stunLabel = (takedownUsed || takedownActive > 0) ? "🦵 テイクダウン" : "😴 スリープ";
          logs.push(`${ed.em} ${ed.name} は行動不能！（${stunLabel}）`);
          continue;
        }

        // 挑発中（provokeActive > 0 または今ターン使用）は敵行動を強攻に強制変換
        const isProvokeActive = provokeUsed || provokeActive > 0;
        const resolvedEAction = isProvokeActive ? "atk" : eAction;

        // 怒り状態を使用後に氷結斬で解除する場合、怒り状態は無効
        const isEnraged = enrageCount > 0 && !iceSlashUsed;
        // 敵ATKデバフ（火炎斬効果）
        const atkHalf = enemyAtkDebuff > 0;

        // 基礎ダメージ倍率
        const rageMult = isEnraged ? 2.0 : 1.0;
        const halfMult = atkHalf ? 0.5 : 1.0;
        const totalMult = rageMult * halfMult;

        if (resolvedEAction === "enrage") {
          // ── 怒り状態付与（攻撃なし） ──────────────────────────────────
          logs.push(`${ed.em} 🔴 ${ed.name}が怒り状態に！ 3ターン攻撃力×2！`);
          // enrageCountはターン後にセットする（フラグで管理）
        } else if (resolvedEAction === "atk_all") {
          // ── 全体攻撃 ──────────────────────────────────────────────────
          const baseRaw = randInt(ed.atk[0], ed.atk[1]);
          const rawWithMods = Math.max(1, Math.floor(baseRaw * totalMult));
          const dmgPerMember = Math.max(1, rawWithMods - defBonus);
          const atkAllLabel = isEnraged ? "🔴🌊 怒り全体攻撃！" : "🌊 全体攻撃！";
          const halfLabel = atkHalf ? "（ATK半減中）" : "";
          logs.push(`${ed.em} ${atkAllLabel}${halfLabel} 全員に ${dmgPerMember} ダメージ！`);
          curHp = Math.max(0, curHp - dmgPerMember);
          memberHit["eltz"] = true;
          for (const key of ["swift","linz","chopper"]) {
            curPartyHp[key] = Math.max(0, (curPartyHp[key] ?? 0) - dmgPerMember);
            memberHit[key] = true;
          }
        } else if (resolvedEAction === "unavoidable" || resolvedEAction === "unavoidable_lite") {
          // ── 回避不能攻撃 ──────────────────────────────────────────────
          const [minD, maxD] = resolvedEAction === "unavoidable"
            ? (ed.unavoidableAtk ?? [30, 45])
            : [18, 28];
          const baseRaw = randInt(minD, maxD);
          const rawWithMods = Math.max(1, Math.floor(baseRaw * totalMult));
          const dmg = Math.max(1, rawWithMods - defBonus);
          const label = eAction === "unavoidable" ? "💥 回避不能攻撃！" : "⚡ 強化攻撃！";
          const rageLabel = isEnraged ? "🔴" : "";
          const halfLabel = atkHalf ? "（ATK半減）" : "";
          logs.push(`${ed.em} ${rageLabel}${label}${halfLabel} 全員に ${dmg} ダメージ！`);
          const targets = [
            { id:"eltz",    isPlayer:true  },
            { id:"swift",   isPlayer:false },
            { id:"linz",    isPlayer:false },
            { id:"chopper", isPlayer:false },
          ];
          for (const t of targets) {
            if (t.isPlayer) { curHp = Math.max(0, curHp - dmg); }
            else { curPartyHp[t.id] = Math.max(0, (curPartyHp[t.id] ?? 0) - dmg); }
            memberHit[t.id] = true;
          }
        } else if (resolvedEAction === "dodge") {
          logs.push(`${ed.em} ${ed.name} 💨 回避！（行動なし）`);
        } else if (resolvedEAction === "counter") {
          // カウンター: エルツのコマンドを代表として判定
          const eltzCmd = cmds["eltz"];
          if (eltzCmd === "atk") {
            const baseRaw = randInt(ed.atk[0], ed.atk[1]) + Math.floor(ed.atk[1]*0.3);
            const rawWithMods = Math.max(1, Math.floor(baseRaw * totalMult));
            const cDmg = Math.max(1, rawWithMods - defBonus);
            const rageLabel = isEnraged ? "🔴" : "";
            const halfLabel = atkHalf ? "（ATK半減）" : "";
            curHp = Math.max(0, curHp - cDmg);
            memberHit["eltz"] = true;
            logs.push(`${ed.em} ${rageLabel}🔄 ${ed.name}カウンター！${halfLabel} エルツに ${cDmg} ダメージ！（強攻無効）`);
          } else if (eltzCmd === "counter") {
            logs.push(`🔄 カウンター相殺！ ${ed.name}の攻撃を完全に無効化した！`);
          } else if (eltzCmd === "dodge") {
            logs.push(`💨 回避成功！ ${ed.name}のカウンターをかわした！`);
          } else {
            const baseRaw = randInt(ed.atk[0], ed.atk[1]);
            const rawWithMods = Math.max(1, Math.floor(baseRaw * totalMult));
            const eDmg = Math.max(1, rawWithMods - defBonus);
            const rageLabel = isEnraged ? "🔴" : "";
            const halfLabel = atkHalf ? "（ATK半減）" : "";
            curHp = Math.max(0, curHp - eDmg);
            memberHit["eltz"] = true;
            logs.push(`${ed.em} ${rageLabel}🔄 ${ed.name}カウンター！${halfLabel} エルツに ${eDmg} ダメージ！`);
          }
        } else {
          // 通常強攻: 最も遅いメンバーに集中攻撃
          const eltzCmd = cmds["eltz"];
          const rps = judgeRPS(eltzCmd, resolvedEAction);
          if (eltzCmd === "counter" && rps === "win") {
            logs.push(`🔄 カウンターで ${ed.name}の強攻を完全に封じた！`);
          } else {
            const spdSorted = [...PARTY_DEFS].sort((a,b) => a.spd - b.spd);
            const targetMember = spdSorted[0]; // 最も遅いメンバー
            const baseRaw = randInt(ed.atk[0], ed.atk[1]);
            const rawWithMods = Math.max(1, Math.floor(baseRaw * totalMult));
            const eDmg = Math.max(1, rawWithMods - defBonus);
            const rageLabel = isEnraged ? "🔴" : "";
            const halfLabel = atkHalf ? "（ATK半減）" : "";
            if (targetMember.id === "eltz") {
              const dodge = eltzCmd === "dodge";
              const dodgeLabel = dodge ? "（回避不可）" : "";
              logs.push(`${ed.em} ${rageLabel}⚔ ${ed.name}強攻！${halfLabel}${dodgeLabel} エルツに ${eDmg} ダメージ！`);
              curHp = Math.max(0, curHp - eDmg);
              memberHit["eltz"] = true;
            } else {
              curPartyHp[targetMember.id] = Math.max(0, (curPartyHp[targetMember.id] ?? 0) - eDmg);
              memberHit[targetMember.id] = true;
              logs.push(`${ed.em} ${rageLabel}⚔ ${ed.name}強攻！${halfLabel} ${targetMember.icon}${targetMember.name}に ${eDmg} ダメージ！`);
            }
          }
        }
      }
    }

    // ── オーバーヒール処理（コンボ判定前・最遅行動）──────────────────────
    if (overhealUsed) {
      const overhealAmt = 80;
      curHp = Math.min(curHp + overhealAmt, mhp);
      for (const key of ["swift","linz","chopper"]) {
        curPartyHp[key] = Math.min((curPartyHp[key] ?? 0) + overhealAmt, partyMhp[key]);
      }
    }

    // ── コンボ判定 ────────────────────────────────────────────────────────
    const anyoneHit = Object.values(memberHit).some(v => v);
    const newStreak = anyoneHit ? 0 : noDmgStreak + PARTY_DEFS.length;
    if (!anyoneHit && noDmgStreak >= 0) {
      const gain = 5 + newStreak;
      curMp = Math.min(curMp + gain, mmp);
      for (const key of Object.keys(curPartyMp)) {
        curPartyMp[key] = Math.min((curPartyMp[key] ?? 0) + gain, partyMmp[key] ?? 0);
      }
      if (newStreak >= 3) logs.push(`✨ PARTY COMBO ${newStreak}! 全員MP +${gain} 回復！`);
    }

    // ── 属性チェンジログ ──────────────────────────────────────────────────
    if (elementCycle && curEnemyHp > 0) {
      const nextElemKey = elementCycle[nextElementIdx];
      const nextInfo = ELEMENT_NAMES[nextElemKey];
      logs.push(`🔮 ${ed.name}が属性チェンジ！ 次の属性: ${nextInfo.icon} ${nextInfo.label}`);
    }

    // ── 次ターンの怒り状態・バフ・デバフを計算 ──────────────────────────
    // 怒り状態: enrageアクションで3セット、毎ターン減算、氷結斬で0に
    const nextEnrageCount = iceSlashUsed
      ? 0
      : eAction === "enrage"
      ? 3
      : Math.max(0, enrageCount - 1);
    // 敵ATKデバフ: 火炎斬で3セット、毎ターン減算
    const nextEnemyAtkDebuff = fireSlashUsed ? 3 : Math.max(0, enemyAtkDebuff - 1);
    // パーティSPDバフ: 雷神斬で3セット、毎ターン減算
    const nextPartySpdBuff = thunderSlashUsed ? 3 : Math.max(0, partySpdBuff - 1);
    // 挑発クールダウン・アクティブ更新
    const nextProvokeCooldown  = provokeUsed  ? 3 : Math.max(0, provokeCooldown  - 1);
    const nextProvokeActive    = provokeUsed  ? 3 : Math.max(0, provokeActive    - 1);
    // テイクダウン更新（使用した次ターンに1T行動不能、CD=3）
    const nextTakedownCooldown = takedownUsed ? 3 : Math.max(0, takedownCooldown - 1);
    const nextTakedownActive   = takedownUsed ? 1 : Math.max(0, takedownActive   - 1);
    // スリープ更新（使用した次ターンに1T行動不能、CD=3）
    const nextSleepCooldown    = sleepUsed    ? 3 : Math.max(0, sleepCooldown    - 1);
    const nextSleepActive      = sleepUsed    ? 1 : Math.max(0, sleepActive      - 1);
    // 属性スキルCD更新（使用した場合3をセット、毎ターン減算）
    const nextElemCooldowns = {
      elem_fire:    elemUsed.elem_fire    ? 3 : Math.max(0, elemCooldowns.elem_fire    - 1),
      elem_ice:     elemUsed.elem_ice     ? 3 : Math.max(0, elemCooldowns.elem_ice     - 1),
      elem_thunder: elemUsed.elem_thunder ? 3 : Math.max(0, elemCooldowns.elem_thunder - 1),
      elem_earth:   elemUsed.elem_earth   ? 3 : Math.max(0, elemCooldowns.elem_earth   - 1),
    };

    // ── ステート一括更新 ────────────────────────────────────────────────────
    setHp(Math.min(curHp, mhp));
    setMp(Math.max(0, curMp));
    setPartyHp(curPartyHp);
    setPartyMp(curPartyMp);
    setEnemyHp(curEnemyHp);
    setElemDmgAccum(newElemAccum);
    if (elementCycle) setEnemyElementIdx(nextElementIdx);
    setTurn(t => t + 1);
    setNoDmgStreak(newStreak);
    setEnemyTurnIdx(nextEnemyTurnIdx);
    setEnemyNextAction(pattern[nextEnemyTurnIdx]);
    setEnemySpdDebuff(prev => earthSlashUsed ? 1 : Math.max(0, prev - 1));
    setEnrageCount(nextEnrageCount);
    setEnemyAtkDebuff(nextEnemyAtkDebuff);
    setPartySpdBuff(nextPartySpdBuff);
    setProvokeCooldown(nextProvokeCooldown);
    setProvokeActive(nextProvokeActive);
    setTakedownCooldown(nextTakedownCooldown);
    setTakedownActive(nextTakedownActive);
    setSleepCooldown(nextSleepCooldown);
    setSleepActive(nextSleepActive);
    setElemCooldowns(nextElemCooldowns);
    setBtlAnimEnemy(true); setTimeout(() => setBtlAnimEnemy(false), 400);
    setBtlLogs(prev => [...prev, ...logs].slice(-18));

    // ── 勝敗判定 ────────────────────────────────────────────────────────────
    if (curEnemyHp <= 0) {
      setVictory(true);
      setBtlLogs(prev => [...prev, `🏆 ${ed.name}を倒した！`]);
      if (ed.elk > 0) { setElk(e => e + ed.elk); showNotif(`💰 ${ed.elk} ELK 獲得！`); }
      if (ed.exp > 0) {
        const comboTier = Math.floor(newStreak / 15);
        const comboMult = comboTier > 0 ? Math.pow(1.5, comboTier) : 1;
        if (comboTier > 0) setBtlLogs(prev => [...prev, `✨ Combo bonus ×${comboMult.toFixed(2)}！`]);
        setTimeout(() => handleExpGain(ed.exp, ed.lv, comboMult), 500);
        const gradeMult = (() => {
          const diff = ed.lv - lv;
          if (diff >= 3) return 2.0;
          if (diff === 2) return 1.5;
          if (diff === 1) return 1.2;
          return 1.0;
        })();
        setBattleResultBonus({ comboMult, gradeMult });
      }
    } else if (curHp <= 0) {
      setDefeat(true);
      setBtlLogs(prev => [...prev, "💀 エルツが戦闘不能..."]);
    } else {
      setInputPhase("command");
      setCmdInputIdx(0);
    }
  }, [
    battleEnemy, currentEnemyType, battleDefs, enemyTurnIdx,
    enemyElementIdx, elemDmgAccum, enemySpdDebuff,
    enrageCount, enemyAtkDebuff, partySpdBuff,
    provokeCooldown, provokeActive,
    takedownCooldown, takedownActive, sleepCooldown, sleepActive, elemCooldowns,
    enemyHp, hp, mp, mhp, mmp, partyHp, partyMhp, partyMp, partyMmp,
    statAlloc, weaponPatk, noDmgStreak, lv,
    showNotif, handleExpGain, turn,
  ]);

  // コマンドキャンセル（最後に選んだメンバーの選択を1つ戻す）
  const onCancelCommand = useCallback(() => {
    // ターゲット選択中のキャンセル → スキル選択に戻る（cmdInputIdxはそのまま）
    if (pendingTargetSelect) {
      const { memberIdx, skillId } = pendingTargetSelect;
      const memberId = PARTY_DEFS[memberIdx].id;
      const newCmds = { ...pendingCommands };
      delete newCmds[memberId];
      setPendingCommands(newCmds);
      setPendingTargetSelect(null);
      return;
    }
    if (cmdInputIdx === 0) return;
    const prevIdx = cmdInputIdx - 1;
    const prevId = PARTY_DEFS[prevIdx].id;
    const newCmds = { ...pendingCommands };
    const newTargets = { ...pendingTargets };
    delete newCmds[prevId];
    delete newTargets[prevId];
    setPendingCommands(newCmds);
    if (multiEnemies) setPendingTargets(newTargets);
    setCmdInputIdx(prevIdx);
  }, [cmdInputIdx, pendingCommands, pendingTargets, pendingTargetSelect, multiEnemies]);

  const exitBattle = useCallback(() => {
    if (defeat) {
      setHp(Math.floor(mhp * 0.3));
      setMp(Math.floor(mmp * 0.3));
      setMultiEnemies(null);
      showNotif("💀 敗北...");
      setFade(true);
      setTimeout(() => { setPhase("select"); setFade(false); }, 400);
      return;
    }
    const nextSc = battleNext !== null ? battleNext : sceneIdx;
    setVictoryNextSc(nextSc);
    // マルチバトルの場合は全敵のELK/EXPを合算
    const totalMult = (battleResultBonus.comboMult ?? 1.0) * (battleResultBonus.gradeMult ?? 1.0);
    const gainElk = multiEnemies
      ? multiEnemies.reduce((s, e) => s + (e.def.elk ?? 0), 0)
      : (battleEnemy ? battleEnemy.elk : 0);
    const baseExp = multiEnemies
      ? multiEnemies.reduce((s, e) => s + (e.def.exp ?? 0), 0)
      : (battleEnemy ? battleEnemy.exp : 0);
    const displayExp = Math.round(baseExp * totalMult);
    setBattleResult({ gainExp:displayExp, gainElk, comboMult:battleResultBonus.comboMult??1.0, gradeMult:battleResultBonus.gradeMult??1.0 });
    setMultiEnemies(null);
    setFade(true);
    setTimeout(() => { setPhase("victory"); setFade(false); }, 300);
  }, [defeat, mhp, mmp, battleNext, sceneIdx, showNotif, battleEnemy, battleResultBonus, multiEnemies]);

  // ──────────── RENDER ────────────
  const sc = SCENES[sceneIdx] || SCENES[0];
  const bg = sc.bg;
  const sceneImgKey = LOC_TO_SCENE_IMG[sc.loc];
  const sceneBgUrl = sceneImgKey ? assetUrl(sceneImgKey) : null;
  const sceneBgSt = SCENE_BG_STYLE[sc.loc] ?? { size: "cover", position: "center" };
  const bgStyle = sceneBgUrl
    ? { background: `url(${sceneBgUrl}) ${sceneBgSt.position}/${sceneBgSt.size} no-repeat, linear-gradient(180deg, ${bg[0]} 0%, ${bg[1]} 50%, ${bg[2]} 100%)` }
    : { background: `linear-gradient(180deg, ${bg[0]} 0%, ${bg[1]} 50%, ${bg[2]} 100%)` };

  const keyframes = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=Share+Tech+Mono&display=swap');
    @keyframes idle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes blnk { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes dngr { 0%,100%{color:#ff4466} 50%{color:#ff9999} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
    @keyframes glow { 0%,100%{box-shadow:0 0 10px #00c8ff44} 50%{box-shadow:0 0 25px #00c8ff88,0 0 50px #00c8ff33} }
    @keyframes bossFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-10px) scale(1.03)} }
    @keyframes scanLine { 0%{top:0%} 100%{top:100%} }
    @keyframes notifIn { from{opacity:0;transform:translate(-50%,-20px)} to{opacity:1;transform:translate(-50%,0)} }
    @keyframes victoryRise { 0%{opacity:0;transform:translateY(40px) scale(0.85)} 60%{opacity:1;transform:translateY(-6px) scale(1.04)} 100%{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes victoryGlow { 0%,100%{text-shadow:0 0 30px #f0c04088,0 0 60px #f0c04044} 50%{text-shadow:0 0 60px #f0c040cc,0 0 120px #f0c04066,0 0 200px #f0c04022} }
    @keyframes starBurst { 0%{opacity:0;transform:scale(0) rotate(0deg)} 50%{opacity:1;transform:scale(1.2) rotate(180deg)} 100%{opacity:0;transform:scale(0.8) rotate(360deg)} }
    @keyframes comboPop { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.4)} 60%{opacity:1;transform:translate(-50%,-50%) scale(1.15)} 100%{opacity:1;transform:translate(-50%,-50%) scale(1)} }
    @keyframes comboPulse { 0%,100%{text-shadow:0 0 20px #f0c040cc,0 0 40px #f0c04088} 50%{text-shadow:0 0 40px #ffffffcc,0 0 80px #f0c040bb,0 0 120px #f0c04044} }
    @keyframes pbSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
    @keyframes pbSpinR { 0%{transform:rotate(0deg)} 100%{transform:rotate(-360deg)} }
    @keyframes pbPulse { 0%,100%{opacity:0.6;r:6} 50%{opacity:1;r:8} }
    @keyframes pbGlow { 0%,100%{filter:drop-shadow(0 0 4px #00c8ff88)} 50%{filter:drop-shadow(0 0 10px #00c8ffcc) drop-shadow(0 0 20px #00c8ff44)} }
    @keyframes lvPulse { 0%,100%{filter:drop-shadow(0 0 4px #f0c04088)} 50%{filter:drop-shadow(0 0 12px #f0c040cc) drop-shadow(0 0 24px #f0c04044)} }
  `;

  // @@SECTION:RENDER_VICTORY
  if (phase === "victory") {
    const handleFanfareStart = () => {
      unlockAudio(null);
      playFanfare(null);
    };
    const handleProceed = () => {
      if (fanfareRef.current) { fanfareRef.current.pause(); fanfareRef.current = null; }
      isFanfareRef.current = false;
      setFade(true);
      setTimeout(() => {
        setPhase("title");
        setFade(false);
      }, 400);
    };

    // リザルト表示用の値を解決
    const res        = battleResult ?? {};
    const gainExp    = res.gainExp ?? 0;
    const gainElk    = res.gainElk ?? 0;
    const comboMult  = res.comboMult  ?? 1.0;
    const gradeMult  = res.gradeMult  ?? 1.0;
    const totalMult  = comboMult * gradeMult;
    const dropItems  = res.dropItems ?? [];   // 将来: ドロップアイテム配列
    const expToNext  = EXP_TABLE[lv] ? Math.max(0, EXP_TABLE[lv] - exp) : null;
    // ボーナス行の表示要否
    const hasGradeBonus = gradeMult > 1.0;
    const hasComboBonus = comboMult > 1.0;

    return (
      <div style={{width:"100%",height:"100%",minHeight:"600px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#020608 0%,#050d14 40%,#0a1420 100%)",fontFamily:"'Noto Serif JP',serif",position:"relative",overflow:"hidden",userSelect:"none"}}>
        <style>{keyframes}</style>

        {fade && <div style={{position:"absolute",inset:0,background:"#050d14",zIndex:50}}/>}

        {/* 背景パーティクル */}
        {[...Array(24)].map((_,i) => (
          <div key={i} style={{
            position:"absolute",
            width: i%4===0 ? 6 : i%3===0 ? 4 : 2,
            height: i%4===0 ? 6 : i%3===0 ? 4 : 2,
            borderRadius:"50%",
            background: i%3===0 ? C.gold : i%3===1 ? C.accent2 : C.accent,
            top:`${10+Math.random()*80}%`,
            left:`${5+Math.random()*90}%`,
            opacity: 0.3+Math.random()*0.5,
            animation:`starBurst ${2+Math.random()*3}s ${Math.random()*2}s infinite`,
          }}/>
        ))}

        <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(240,192,64,0.02) 3px,rgba(240,192,64,0.02) 4px)",pointerEvents:"none",zIndex:1}}/>

        <div style={{position:"relative",zIndex:2,textAlign:"center",padding:"0 24px",width:"100%",maxWidth:460}}>

          {/* ロゴ */}
          <div style={{fontSize:11,letterSpacing:10,color:C.muted,marginBottom:10,fontFamily:"'Share Tech Mono',monospace",animation:"fadeIn 0.8s ease"}}>VRMMORPG</div>
          <div style={{fontSize:44,fontWeight:700,letterSpacing:12,color:C.white,textShadow:`0 0 30px ${C.accent}88`,lineHeight:1,marginBottom:4,animation:"fadeIn 0.8s ease"}}>ARCADIA</div>

          <div style={{width:"100%",height:1,background:`linear-gradient(90deg,transparent,${C.gold}88,transparent)`,margin:"16px auto"}}/>

          {/* BATTLE RESULT ヘッダー */}
          <div style={{fontSize:10,letterSpacing:8,color:C.gold,fontFamily:"'Share Tech Mono',monospace",marginBottom:12,animation:"fadeIn 1s 0.3s ease both"}}>── BATTLE RESULT ──</div>
          <div style={{fontSize:52,fontWeight:700,letterSpacing:6,color:C.gold,animation:"victoryRise 0.8s 0.4s cubic-bezier(0.22,1,0.36,1) both, victoryGlow 2.5s 1.2s ease-in-out infinite",lineHeight:1.1,marginBottom:4}}>戦闘勝利</div>
          <div style={{fontSize:13,letterSpacing:4,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",animation:"fadeIn 1s 1s ease both",marginBottom:20}}>VICTORY</div>

          {/* ─── リザルトパネル ─── */}
          <div style={{background:"rgba(10,26,38,0.85)",border:`1px solid ${C.border}`,borderRadius:4,padding:"16px 24px",marginBottom:20,animation:"slideUp 0.6s 0.8s ease both",textAlign:"left"}}>

            {/* 取得EXP */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}33`}}>
              <span style={{fontSize:11,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>取得 EXP</span>
              <span style={{fontSize:14,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>+{gainExp}</span>
            </div>

            {/* 格上ボーナス（1.0超のときのみ表示） */}
            {hasGradeBonus && (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0 5px 12px",borderBottom:`1px solid ${C.border}22`}}>
                <span style={{fontSize:10,color:C.gold,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>┗ 格上ボーナス</span>
                <span style={{fontSize:12,color:C.gold,fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>×{gradeMult.toFixed(1)}</span>
              </div>
            )}

            {/* コンボボーナス（1.0超のときのみ表示） */}
            {hasComboBonus && (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0 5px 12px",borderBottom:`1px solid ${C.border}22`}}>
                <span style={{fontSize:10,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>┗ Combo ボーナス</span>
                <span style={{fontSize:12,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>×{comboMult.toFixed(2)}</span>
              </div>
            )}

            {/* 合計倍率（いずれかのボーナスがある場合のみ） */}
            {(hasGradeBonus || hasComboBonus) && (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0 5px 12px",borderBottom:`1px solid ${C.border}33`}}>
                <span style={{fontSize:10,color:C.accent,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>┗ 合計倍率</span>
                <span style={{fontSize:12,color:C.accent,fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>×{totalMult.toFixed(2)}</span>
              </div>
            )}

            {/* 取得ELK */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}33`}}>
              <span style={{fontSize:11,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>取得 ELK</span>
              <span style={{fontSize:14,color:C.gold,fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>+{gainElk}</span>
            </div>

            {/* 所持ELK */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}33`}}>
              <span style={{fontSize:11,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>所持 ELK</span>
              <span style={{fontSize:14,color:C.text,fontFamily:"'Share Tech Mono',monospace"}}>{elk}</span>
            </div>

            {/* 現在EXP / 次のLvまで */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}33`}}>
              <span style={{fontSize:11,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>現在 EXP</span>
              <span style={{fontSize:14,color:C.text,fontFamily:"'Share Tech Mono',monospace"}}>{exp}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}33`}}>
              <span style={{fontSize:11,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>次のLvまで</span>
              <span style={{fontSize:14,color:C.accent,fontFamily:"'Share Tech Mono',monospace"}}>{expToNext !== null ? expToNext : "MAX"}</span>
            </div>

            {/* ドロップアイテム（将来実装 -- 今は「なし」表示） */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
              <span style={{fontSize:11,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>ドロップ</span>
              <span style={{fontSize:12,color:dropItems.length > 0 ? C.accent2 : C.muted,fontFamily:"'Share Tech Mono',monospace"}}>
                {dropItems.length > 0 ? dropItems.join(" / ") : "なし"}
              </span>
            </div>
          </div>

          {/* ボタン */}
          <VictoryButton onFanfareStart={handleFanfareStart} onProceed={handleProceed} />
        </div>
      </div>
    );
  }


  // ============================================================
  // @@SECTION:RENDER_LOAD -- セーブデータ読み込み画面（第二章専用）
  // ============================================================
  // keyframesはRENDER_GAMEで定義されているが、RENDER_LOAD専用のものをここで使う
  const loadKeyframes = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=Share+Tech+Mono&display=swap');
    @keyframes idle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes blnk { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes glow { 0%,100%{box-shadow:0 0 10px #00c8ff44} 50%{box-shadow:0 0 25px #00c8ff88,0 0 50px #00c8ff33} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
    @keyframes dropZonePulse { 0%,100%{border-color:#1a4a6a} 50%{border-color:#00c8ff88} }
    @keyframes dropZoneOver { 0%,100%{border-color:#00c8ff} 50%{border-color:#00ffcc} }
  `;

  // ── ファイル読み込み処理 ──────────────────────────────────────────────────
  const validateSave = (obj) => {
    if (!obj || typeof obj !== "object")         return "JSONの形式が不正です";
    if (!obj.version?.startsWith("arcadia_ch"))  return "ARCADIAのセーブデータではありません";
    if (!obj.player)                             return "player データが見つかりません";
    if (typeof obj.player.lv !== "number")       return "セーブデータが破損しています（lv）";
    return null;
  };

  const applySaveData = (sd) => {
    const p = sd.player;
    setHp(p.hp);           setMhp(p.mhp);
    setMp(p.mp);           setMmp(p.mmp);
    setElk(p.elk);         setLv(p.lv);
    setExp(p.exp);
    setWeapon(p.weapon);   setWeaponPatk(p.weaponPatk ?? 3);
    setStatPoints(p.statPoints ?? 0);
    setStatAlloc({ patk:10, pdef:10, matk:10, spd:10, ...p.statAlloc });
    setHasPb(true);
    setHasMapScan(true);
    setInCom(p.inCom ?? false);
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith(".json")) { setSaveError("JSONファイルを選択してください"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        const err = validateSave(obj);
        if (err) { setSaveError(err); return; }
        setSaveFile(obj);
        setSaveError(null);
        setPhase("loaded");
      } catch {
        setSaveError("JSONの解析に失敗しました。ファイルが壊れている可能性があります。");
      }
    };
    reader.readAsText(file);
  };

  if (phase === "load") return (
    <div
      style={{width:"100%",height:"100%",minHeight:"600px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#020810 0%,#050d14 40%,#0a1020 100%)`,fontFamily:"'Noto Serif JP',serif",textAlign:"center",padding:32,position:"relative",overflow:"hidden"}}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
    >
      <style>{loadKeyframes}</style>
      <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,200,255,0.012) 2px,rgba(0,200,255,0.012) 4px)",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:480,animation:"fadeIn 1s ease"}}>
        <div style={{fontSize:10,letterSpacing:8,color:C.muted,marginBottom:8,fontFamily:"'Share Tech Mono',monospace"}}>VRMMORPG · EPISODE 2</div>
        <div style={{fontSize:52,fontWeight:700,letterSpacing:12,color:C.white,textShadow:`0 0 30px ${C.accent}`,marginBottom:4}}>ARCADIA</div>
        <div style={{fontSize:12,letterSpacing:6,color:C.accent,marginBottom:32,fontFamily:"'Share Tech Mono',monospace"}}>─── Lexia の章 ───</div>
        <div style={{width:240,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"0 auto 28px"}}/>

        <div style={{fontSize:12,color:C.text,marginBottom:20,letterSpacing:1,lineHeight:1.9}}>
          第一章のセーブデータを読み込んで<br/>エルツのステータスを引き継ぎます。
        </div>

        <label
          style={{display:"block",border:`2px dashed ${dragOver ? C.accent : C.border}`,borderRadius:8,padding:"32px 20px",cursor:"pointer",marginBottom:16,background:dragOver ? "rgba(0,200,255,0.06)" : "rgba(10,26,38,0.4)",animation:dragOver ? "dropZoneOver 0.8s infinite" : "dropZonePulse 2s infinite",transition:"background 0.2s"}}
        >
          <input type="file" accept=".json" onChange={e => handleFile(e.target.files?.[0])} style={{display:"none"}} />
          <div style={{fontSize:32,marginBottom:12}}>{dragOver ? "📂" : "💾"}</div>
          <div style={{fontSize:13,color:dragOver ? C.accent : C.text,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
            {dragOver ? "ここにドロップ！" : "クリック or ドラッグ＆ドロップ"}
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:8}}>arcadia_save_ch1_*.json または arcadia_save_ch2_*.json</div>
        </label>

        {saveError && (
          <div style={{background:"rgba(255,68,102,0.1)",border:`1px solid ${C.red}`,borderRadius:4,padding:"10px 16px",marginBottom:16,fontSize:12,color:C.red,fontFamily:"'Share Tech Mono',monospace",animation:"shake 0.4s ease"}}>
            ⚠ {saveError}
          </div>
        )}
        <div style={{width:240,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"0 auto 20px"}}/>
        <button
          onClick={() => setPhase("title")}
          style={{width:"100%",padding:"12px 0",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:12,letterSpacing:4,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",borderRadius:4}}
          onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.text; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
        >新規スタート（引き継ぎなし）</button>
        <div style={{fontSize:10,color:C.muted,marginTop:8,fontFamily:"'Share Tech Mono',monospace",opacity:0.7}}>※ Lv1・初期ステータスで開始します</div>
      </div>
    </div>
  );

  // ── RENDER_LOADED -- 確認画面 ───────────────────────────────────────────
  if (phase === "loaded" && saveFile) {
    const p = saveFile.player;
    const savedDate = saveFile.savedAt ? new Date(saveFile.savedAt).toLocaleString("ja-JP") : "不明";
    return (
      <div style={{width:"100%",height:"100%",minHeight:"600px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#020810 0%,#050d14 100%)`,fontFamily:"'Noto Serif JP',serif",textAlign:"center",padding:32}}>
        <style>{loadKeyframes}</style>
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:480,animation:"fadeIn 0.6s ease"}}>
          <div style={{fontSize:11,letterSpacing:6,color:C.accent2,marginBottom:16,fontFamily:"'Share Tech Mono',monospace"}}>── SAVE DATA LOADED ──</div>
          <div style={{background:"rgba(10,26,38,0.85)",border:`1px solid ${C.border}`,borderRadius:8,padding:"20px 28px",marginBottom:24,textAlign:"left"}}>
            <div style={{fontSize:10,letterSpacing:6,color:C.muted,marginBottom:10,fontFamily:"'Share Tech Mono',monospace",textAlign:"center"}}>CHAPTER {saveFile.chapter ?? 1} DATA</div>
            <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginBottom:12,textAlign:"center"}}>{savedDate}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px",fontSize:13,color:C.text,fontFamily:"'Share Tech Mono',monospace",lineHeight:1.8}}>
              <div><span style={{color:C.muted}}>NAME</span>  Eltz</div>
              <div><span style={{color:C.muted}}>Lv</span>    {p.lv}</div>
              <div><span style={{color:C.muted}}>HP</span>    {p.hp}/{p.mhp}</div>
              <div><span style={{color:C.muted}}>MP</span>    {p.mp}/{p.mmp}</div>
              <div><span style={{color:C.muted}}>EXP</span>   {p.exp}</div>
              <div><span style={{color:C.muted}}>ELK</span>   {p.elk}</div>
              <div><span style={{color:C.muted}}>武器</span>  {p.weapon}</div>
              <div><span style={{color:C.muted}}>ATK+</span>  {p.weaponPatk}</div>
              <div><span style={{color:C.muted}}>PATK</span>  {p.statAlloc?.patk ?? 10}</div>
              <div><span style={{color:C.muted}}>PDEF</span>  {p.statAlloc?.pdef ?? 10}</div>
              <div><span style={{color:C.muted}}>MATK</span>  {p.statAlloc?.matk ?? 10}</div>
              <div><span style={{color:C.muted}}>SPD</span>   {p.statAlloc?.spd  ?? 10}</div>
            </div>
          </div>
          <div style={{fontSize:12,color:C.accent2,marginBottom:24,letterSpacing:1}}>このデータを引き継いで第二章を開始しますか？</div>
          <div style={{display:"flex",gap:12}}>
            <button onClick={() => { setSaveFile(null); setPhase("load"); }} style={{flex:1,padding:"12px 0",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:12,letterSpacing:2,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",borderRadius:4}}>← 戻る</button>
            <button
              onClick={() => { applySaveData(saveFile); setPhase("title"); }}
              style={{flex:2,padding:"12px 0",background:`linear-gradient(135deg,rgba(0,200,255,0.2),rgba(0,255,204,0.15))`,border:`1px solid ${C.accent}`,color:C.accent,fontSize:13,letterSpacing:4,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",borderRadius:4}}
            >引き継いで開始 ▶</button>
          </div>
        </div>
      </div>
    );
  }

  // @@SECTION:RENDER_TITLE
  if (phase === "title") return (
    <div style={{width:"100%",height:"100%",minHeight:"600px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#020810 0%,#050d14 40%,#0a1828 100%)`,backgroundImage:`url(https://superapolon.github.io/Arcadia_Assets/title/title_bg.webp)`,backgroundSize:"cover",backgroundPosition:"center",fontFamily:"'Noto Serif JP',serif",position:"relative",overflow:"hidden"}}>
      <style>{keyframes}</style>
      {/* Scanline effect */}
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,200,255,0.015) 2px,rgba(0,200,255,0.015) 4px)",pointerEvents:"none",zIndex:1}}/>
      {/* Stars */}
      {[...Array(30)].map((_,i)=>(
        <div key={i} style={{position:"absolute",width:i%5===0?2:1,height:i%5===0?2:1,borderRadius:"50%",background:"#adf",top:`${Math.random()*100}%`,left:`${Math.random()*100}%`,opacity:0.3+Math.random()*0.5,animation:`blnk ${1.5+Math.random()*2}s ${Math.random()*2}s infinite`}}/>
      ))}

      <div style={{position:"relative",zIndex:2,textAlign:"center",animation:"fadeIn 1.5s ease"}}>
        <div style={{fontSize:11,letterSpacing:12,color:C.muted,marginBottom:16,fontFamily:"'Share Tech Mono',monospace"}}>VRMMORPG · EPISODE 2</div>
        <div style={{fontSize:72,fontWeight:700,letterSpacing:16,color:C.white,textShadow:`0 0 40px ${C.accent},0 0 80px ${C.accent}44`,lineHeight:1,marginBottom:8}}>ARCADIA</div>
        <div style={{fontSize:13,letterSpacing:4,color:C.accent2,marginBottom:48,fontFamily:"'Share Tech Mono',monospace",textShadow:`0 0 10px ${C.accent2}`}}>─── Lexia の章 ───</div>

        <div style={{width:280,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"0 auto 40px"}}/>

        <button
          onClick={() => { unlockAudio("bgm/title"); setPhase("select"); }}
          style={{padding:"14px 48px",background:"transparent",border:`1px solid ${C.accent}`,color:C.accent,fontSize:16,letterSpacing:6,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",animation:"glow 2s infinite",transition:"all 0.3s"}}
          onMouseEnter={e => e.target.style.background = `${C.accent}22`}
          onMouseLeave={e => e.target.style.background = "transparent"}
        >GAME START</button>

        <div style={{marginTop:24,fontSize:11,color:C.muted,letterSpacing:2,fontFamily:"'Share Tech Mono',monospace"}}>VRS CONNECT ▶</div>
        <div style={{marginTop:32,width:280,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`}}/>
        <button
          onClick={() => setPhase("load")}
          style={{marginTop:20,padding:"8px 32px",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,letterSpacing:4,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",transition:"all 0.3s"}}
          onMouseEnter={e => { e.currentTarget.style.color = C.accent2; e.currentTarget.style.borderColor = C.accent2; }}
          onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
        >💾 セーブデータ読み込み</button>
      </div>
    </div>
  );

  // @@SECTION:RENDER_SELECT -- バトル選択画面
  if (phase === "select") {
    // バトル直接起動ヘルパー
    const startBattle = (types) => {
      const isMulti = Array.isArray(types);
      const firstKey = isMulti ? types[0] : types;
      const ed = battleDefs[firstKey];
      setBattleEnemy(ed);
      setCurrentEnemyType(firstKey);
      setEnemyHp(ed.maxHp);
      if (isMulti) {
        const initEnemies = types.map((t, i) => ({
          slot: i, type: t, def: battleDefs[t],
          hp: battleDefs[t].maxHp, turnIdx: 0, defeated: false,
        }));
        setMultiEnemies(initEnemies);
        setBtlLogs([`⚔ ${types.length}体の敵が現れた！`]);
      } else {
        setMultiEnemies(null);
        setBtlLogs([`⚔ ${ed.name} との戦闘が始まった！`]);
      }
      setGuarding(false); setVictory(false); setDefeat(false); setTurn(0); setNoDmgStreak(0);
      setBattleResultBonus({ comboMult:1.0, gradeMult:1.0 });
      setEnemyTurnIdx(0);
      setEnemyNextAction((ed.pattern || ["atk"])[0]);
      setBattleNext(0); // 勝利後はsceneIdx=0へ戻す
      setEnemyElementIdx(0); setElemDmgAccum(0); setShowElemMenu(false); setShowSpecMenu(false); setElemBreakAnim(false);
      setPartyHp({ swift:80, linz:70, chopper:65 });
      setPartyMp({ swift:60, linz:70, chopper:50 });
      setInputPhase("command"); setPendingCommands({}); setPendingTargets({}); setPendingTargetSelect(null); setCmdInputIdx(0);
      setEnemySpdDebuff(0); setEnrageCount(0); setEnemyAtkDebuff(0); setPartySpdBuff(0); setProvokeCooldown(0); setProvokeActive(0); setTakedownCooldown(0); setTakedownActive(0); setSleepCooldown(0); setSleepActive(0); setElemCooldowns({ elem_fire:0, elem_ice:0, elem_thunder:0, elem_earth:0 });
      setPhase("battle");
    };

    const OPTIONS = [
      {
        key: "single",
        label: "Simuluu 単体戦",
        sub: "─── 試練の主 ───",
        em: "🦌",
        color: C.red,
        types: "simuluu_ch2",
        desc: "ボス単体。属性システムを使ってブレイクを狙え",
        lv: "Lv10 / HP2000",
      },
      {
        key: "multi",
        label: "3体同時戦",
        sub: "シャメロット Lv5 × 2 ＋ Simuluu",
        em: "🦀🦌🦀",
        color: C.accent,
        types: ["shamerlot_lv5", "simuluu_ch2", "shamerlot_lv5"],
        desc: "取り巻き2体を先に倒すか、ボスを集中攻撃するか",
        lv: "Lv5 × 2 ＋ Lv10",
      },
    ];

    return (
      <div style={{width:"100%",height:"100%",minHeight:"600px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#020810 0%,#050d14 50%,#0a1828 100%)`,fontFamily:"'Noto Serif JP',serif",position:"relative",overflow:"hidden"}}>
        <style>{keyframes}</style>
        <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,200,255,0.012) 2px,rgba(0,200,255,0.012) 4px)",pointerEvents:"none"}}/>

        <div style={{position:"relative",zIndex:2,textAlign:"center",animation:"fadeIn 0.6s ease",width:"100%",maxWidth:480,padding:"0 24px"}}>
          <div style={{fontSize:10,letterSpacing:6,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginBottom:8}}>BATTLE SELECT</div>
          <div style={{fontSize:18,color:C.white,fontWeight:700,letterSpacing:3,marginBottom:4}}>バトルを選択</div>
          <div style={{width:200,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"0 auto 28px"}}/>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => startBattle(opt.types)}
                style={{
                  width:"100%", padding:"18px 20px",
                  background:`${opt.color}0a`,
                  border:`1px solid ${opt.color}55`,
                  borderRadius:8, cursor:"pointer",
                  textAlign:"left", transition:"all 0.2s",
                  display:"flex", alignItems:"center", gap:16,
                }}
                onMouseEnter={e => { e.currentTarget.style.background=`${opt.color}1a`; e.currentTarget.style.borderColor=opt.color; }}
                onMouseLeave={e => { e.currentTarget.style.background=`${opt.color}0a`; e.currentTarget.style.borderColor=`${opt.color}55`; }}>
                <div style={{fontSize:32,lineHeight:1,flexShrink:0}}>{opt.em}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,color:opt.color,fontWeight:700,letterSpacing:1,marginBottom:2}}>{opt.label}</div>
                  <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,marginBottom:5}}>{opt.sub}</div>
                  <div style={{fontSize:11,color:C.text,lineHeight:1.5,marginBottom:4}}>{opt.desc}</div>
                  <div style={{fontSize:9,color:`${opt.color}99`,fontFamily:"'Share Tech Mono',monospace"}}>{opt.lv}</div>
                </div>
                <div style={{fontSize:18,color:`${opt.color}88`,flexShrink:0}}>▶</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setPhase("title")}
            style={{marginTop:24,padding:"8px 28px",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:10,letterSpacing:3,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",borderRadius:4,transition:"all 0.2s"}}
            onMouseEnter={e => { e.currentTarget.style.color=C.text; e.currentTarget.style.borderColor=C.muted; }}
            onMouseLeave={e => { e.currentTarget.style.color=C.muted; e.currentTarget.style.borderColor=C.border; }}>
            ← タイトルへ戻る
          </button>
        </div>
      </div>
    );
  }

  // @@SECTION:RENDER_MOVIE
  if (phase === "movie") {
    const url = movieUrl("movies/ch02_opening");
    // ムービーが存在しない場合は即座にゲームへ
    if (!url) {
      setPhase("game");
      return null;
    }
    const onMovieEnd = () => {
      setSceneIdx(0);
      setDlIdx(0);
      setPhase("game");
    };
    return (
      <div style={{width:"100%",height:"100%",minHeight:"600px",position:"relative",background:"#000",overflow:"hidden"}}>
        <style>{keyframes}</style>
        <video
          src={url}
          autoPlay
          playsInline
          style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
          onEnded={onMovieEnd}
        />
        <button
          onClick={onMovieEnd}
          style={{
            position:"absolute", bottom:24, right:24,
            background:"rgba(5,13,20,0.8)",
            color:C.text,
            border:`1px solid ${C.border}`,
            borderRadius:4,
            padding:"8px 20px",
            cursor:"pointer",
            fontSize:12,
            letterSpacing:2,
            fontFamily:"'Share Tech Mono',monospace",
            zIndex:10,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; }}
        >
          SKIP ▶
        </button>
        <div style={{
          position:"absolute", bottom:60, left:"50%", transform:"translateX(-50%)",
          fontSize:10, letterSpacing:8, color:"rgba(200,232,248,0.4)",
          fontFamily:"'Share Tech Mono',monospace",
          pointerEvents:"none",
        }}>
          CHAPTER 2 -- Lexia の章
        </div>
      </div>
    );
  }

  // @@SECTION:RENDER_ENDING
  if (phase === "end") {
    // ── セーブデータ生成 ────────────────────────────────────────────────────
    const buildSaveData = () => ({
      version:    "arcadia_ch2_v1",
      chapter:    1,
      savedAt:    new Date().toISOString(),
      player: {
        hp, mhp, mp, mmp,
        elk, lv, exp,
        weapon, weaponPatk,
        statPoints,
        statAlloc: { ...statAlloc },
        hasPb, hasMapScan, inCom,
      },
    });

    const handleExport = () => {
      const data    = buildSaveData();
      const json    = JSON.stringify(data, null, 2);
      const blob    = new Blob([json], { type: "application/json" });
      const url     = URL.createObjectURL(blob);
      const a       = document.createElement("a");
      a.href        = url;
      a.download    = `arcadia_save_ch2_lv${lv}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const resetToTitle = () => {
      setPhase("title"); setSceneIdx(0); setDlIdx(0);
      setElk(50); setHp(100); setMhp(100); setMp(80); setMmp(80);
      setLv(1); setExp(0);
      setWeapon("銅の短剣"); setWeaponPatk(3);
      setStatPoints(0); setStatAlloc({patk:10,pdef:10,matk:10,spd:10});
      setHasPb(false); setHasMapScan(false); setInCom(false);
    };

    return (
      <div style={{width:"100%",height:"100%",minHeight:"600px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#030a06 0%,#0a1a0a 50%,#0d2010 100%)`,fontFamily:"'Noto Serif JP',serif",textAlign:"center",padding:40}}>
        <style>{keyframes}</style>
        <div style={{animation:"fadeIn 2s ease",maxWidth:480,width:"100%"}}>
          <div style={{fontSize:11,letterSpacing:12,color:C.muted,marginBottom:20,fontFamily:"'Share Tech Mono',monospace"}}>─ EPISODE 2 END ─</div>
          <div style={{fontSize:48,fontWeight:700,color:C.white,textShadow:`0 0 30px ${C.accent2}`,marginBottom:16}}>ARCADIA</div>
          <div style={{fontSize:18,color:C.accent2,letterSpacing:4,marginBottom:40}}>旅立ちの日は明日──</div>
          <div style={{width:240,height:1,background:`linear-gradient(90deg,transparent,${C.accent2},transparent)`,margin:"0 auto 32px"}}/>

          {/* ── ステータスサマリー ───────────────────────────────────────── */}
          <div style={{background:"rgba(10,26,38,0.7)",border:`1px solid ${C.border}`,borderRadius:8,padding:"20px 28px",marginBottom:32,textAlign:"left"}}>
            <div style={{fontSize:10,letterSpacing:6,color:C.muted,marginBottom:14,fontFamily:"'Share Tech Mono',monospace",textAlign:"center"}}>PLAYER DATA</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px",fontSize:13,color:C.text,fontFamily:"'Share Tech Mono',monospace",lineHeight:1.8}}>
              <div><span style={{color:C.muted}}>NAME</span>  Eltz</div>
              <div><span style={{color:C.muted}}>Lv</span>    {lv}</div>
              <div><span style={{color:C.muted}}>HP</span>    {hp} / {mhp}</div>
              <div><span style={{color:C.muted}}>MP</span>    {mp} / {mmp}</div>
              <div><span style={{color:C.muted}}>EXP</span>   {exp}</div>
              <div><span style={{color:C.muted}}>ELK</span>   {elk}</div>
              <div><span style={{color:C.muted}}>武器</span>  {weapon}</div>
              <div><span style={{color:C.muted}}>ATK+</span>  {weaponPatk}</div>
              <div><span style={{color:C.muted}}>PATK</span>  {statAlloc.patk}</div>
              <div><span style={{color:C.muted}}>PDEF</span>  {statAlloc.pdef}</div>
              <div><span style={{color:C.muted}}>MATK</span>  {statAlloc.matk}</div>
              <div><span style={{color:C.muted}}>SPD</span>   {statAlloc.spd}</div>
            </div>
          </div>

          {/* ── セーブデータエクスポート ─────────────────────────────────── */}
          <div style={{marginBottom:16,fontSize:12,color:C.muted,letterSpacing:1,lineHeight:1.8}}>
            第二章へ引き継ぐには、セーブデータをエクスポートして<br/>
            ARCADIA Ch.2 で読み込んでください。
          </div>
          <button
            onClick={handleExport}
            style={{width:"100%",padding:"14px 0",marginBottom:12,background:`linear-gradient(135deg,rgba(0,200,255,0.15),rgba(0,255,204,0.1))`,border:`1px solid ${C.accent}`,color:C.accent,fontSize:14,letterSpacing:4,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",borderRadius:4}}
          >
            💾 セーブデータをエクスポート
          </button>
          <div style={{fontSize:11,color:C.muted,marginBottom:32,fontFamily:"'Share Tech Mono',monospace",opacity:0.7}}>
            arcadia_save_ch2_lv{lv}.json がダウンロードされます
          </div>

          <div style={{width:240,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"0 auto 24px"}}/>
          <button
            onClick={resetToTitle}
            style={{padding:"10px 40px",background:"transparent",border:`1px solid ${C.muted}`,color:C.muted,fontSize:12,letterSpacing:4,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",borderRadius:4}}
          >
            TITLE へ戻る
          </button>
        </div>
      </div>
    );
  }

  // @@SECTION:RENDER_BATTLE
  if (phase === "battle") {
    const ed = battleEnemy;
    if (!ed) return null;
    const enemyPct = Math.max(0, enemyHp / ed.maxHp * 100);
    const playerPct = Math.max(0, hp / mhp * 100);
    const mpPct = Math.max(0, mp / mmp * 100);
    const isBoss = ed.isBoss;

    const battleBgKey = BATTLE_BG_MAP[currentEnemyType];
    const battleBgUrl = battleBgKey ? assetUrl(battleBgKey) : null;
    const enemyImgKey = ENEMY_IMG_MAP[currentEnemyType];
    const isSimuluu = currentEnemyType === "simuluu" || currentEnemyType === "simuluu_ch2";
    const enemyImgUrl = isSimuluu ? SIMULUU_IMG_URL : (enemyImgKey ? assetUrl(enemyImgKey) : null);

    // ENEMY_IMG_SIZE は数値 or { mode:"fixed"|"auto", size?:px, pct?:% } のどちらでも受け付ける
    const _rawSize = ENEMY_IMG_SIZE[currentEnemyType] ?? (isBoss ? 220 : 140);
    const _sizeConf = typeof _rawSize === "number" ? { mode:"fixed", size:_rawSize } : _rawSize;
    const enemySizeMode = _sizeConf.mode ?? "fixed";
    const enemyImgSize  = _sizeConf.size ?? (isBoss ? 220 : 140);
    const enemyImgPct   = _sizeConf.pct  ?? 80;

    const bgSt = BATTLE_BG_STYLE[currentEnemyType] ?? { size: "cover", position: "center" };
    const battleBg = battleBgUrl
      ? `url(${battleBgUrl}) ${bgSt.position}/${bgSt.size} no-repeat, linear-gradient(180deg,${ed.bg[0]} 0%,${ed.bg[1]} 50%,${ed.bg[2]} 100%)`
      : `linear-gradient(180deg,${ed.bg[0]} 0%,${ed.bg[1]} 50%,${ed.bg[2]} 100%)`;

    // ── 属性システム表示用データ ────────────────────────────────────────────
    const elementCycle = ed.elementCycle || null;
    const currentElemKey = elementCycle ? elementCycle[enemyElementIdx % elementCycle.length] : null;
    const currentElemInfo = currentElemKey ? ELEMENT_NAMES[currentElemKey] : null;
    const elemBarPct = Math.min(100, (elemDmgAccum / ELEMENT_BREAK_THRESHOLD) * 100);

    // ── パーティーメンバー表示データ ────────────────────────────────────────
    const spdBuffDisp = partySpdBuff > 0 ? 3 : 0;
    const partyMembers = [
      { key:"eltz",    name:"エルツ",    icon:"🧑",   hp, mhp,               mp,                mmp,               spd:12 + spdBuffDisp },
      { key:"swift",   name:"スウィフト", icon:"🧑‍🦱", hp:partyHp.swift,   mhp:partyMhp.swift,   mp:partyMp.swift,  mmp:partyMmp.swift,  spd:15 + spdBuffDisp },
      { key:"linz",    name:"リンス",    icon:"👩",   hp:partyHp.linz,    mhp:partyMhp.linz,    mp:partyMp.linz,   mmp:partyMmp.linz,   spd:11 + spdBuffDisp },
      { key:"chopper", name:"チョッパー", icon:"👦",   hp:partyHp.chopper, mhp:partyMhp.chopper, mp:partyMp.chopper,mmp:partyMmp.chopper, spd:9  + spdBuffDisp },
    ];
    // 現在コマンド入力中のメンバー
    const currentCmdMember = PARTY_DEFS[cmdInputIdx];
    // 敵の実効SPD（デバフ考慮）
    const effectiveEnemySpdDisp = Math.max(1, 12 - (enemySpdDebuff > 0 ? 5 : 0));

    return (
      <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",background:battleBg,fontFamily:"'Noto Serif JP',serif",userSelect:"none",position:"relative",overflow:"hidden"}}>
        <style>{keyframes}</style>
        {notif && <div style={{position:"absolute",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(10,26,38,0.95)",border:`1px solid ${C.accent}`,color:C.accent,padding:"8px 20px",fontSize:13,letterSpacing:1,zIndex:100,whiteSpace:"nowrap",fontFamily:"'Share Tech Mono',monospace",animation:"notifIn 0.3s ease"}}>{notif}</div>}

        {/* ── 怒り状態フルスクリーン警告エフェクト ─────────────────────────── */}
        {enrageCount > 0 && (
          <div style={{position:"absolute",inset:0,zIndex:1,pointerEvents:"none",
            border:`3px solid #ff446688`,
            boxShadow:"inset 0 0 40px rgba(255,50,50,0.15), inset 0 0 80px rgba(255,50,50,0.08)",
            animation:"dngr 1.2s infinite"}} />
        )}

        {/* ── 属性破壊エフェクト ────────────────────────────────────────────── */}
        {elemBreakAnim && (
          <div style={{position:"absolute",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",background:"rgba(100,200,255,0.08)"}}>
            <div style={{fontSize:"clamp(24px,6vw,48px)",fontWeight:900,color:"#88ddff",textAlign:"center",fontFamily:"'Share Tech Mono',monospace",animation:"victoryRise 0.6s ease both",textShadow:"0 0 40px #88ddffcc, 0 0 80px #88ddff88"}}>
              💫 属性破壊！<br/>
              <span style={{fontSize:"0.5em",letterSpacing:4,color:"#ccf4ff"}}>ELEMENT BREAK</span>
            </div>
          </div>
        )}

        {/* ── メインエリア：左＝エネミー、右＝ログ＋ステータス＋ボタン ── */}
        <div style={{flex:1,display:"flex",flexDirection:"row",overflow:"hidden",minHeight:0}}>

          {/* 左カラム：エネミー表示 */}
          <div style={{flex:"0 0 62%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"8px",position:"relative",overflow:"hidden",gap:0}}>

          {multiEnemies ? (
            /* ── マルチ敵表示 ─────────────────────────────────────────────── */
            <>
              {/* ターゲット選択モード中ヘッダー */}
              {pendingTargetSelect && (
                <div style={{position:"absolute",top:6,left:"50%",transform:"translateX(-50%)",zIndex:5,background:"rgba(5,13,20,0.9)",border:`1px solid ${C.accent}`,borderRadius:5,padding:"4px 16px",fontSize:10,color:C.accent,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,whiteSpace:"nowrap",animation:"glow 1.5s infinite"}}>
                  👆 攻撃対象を選択
                </div>
              )}

              {/* 3敵カード横並び -- stretch で縦余白を排除 */}
              <div style={{display:"flex",flexDirection:"row",alignItems:"stretch",justifyContent:"center",gap:5,width:"100%",flex:1,minHeight:0,paddingTop:pendingTargetSelect ? 28 : 0}}>
                {multiEnemies.map((me, idx) => {
                  const meDef = me.def;
                  const isSimuluuSlot = me.type === "simuluu" || me.type === "simuluu_ch2";
                  const meImg = isSimuluuSlot ? SIMULUU_IMG_URL : (ENEMY_IMG_MAP[me.type] ? assetUrl(ENEMY_IMG_MAP[me.type]) : null);
                  const meHpPct = Math.max(0, me.hp / meDef.maxHp * 100);
                  const meIsBoss = meDef.isBoss;
                  const meNextAction = meDef.pattern[me.turnIdx % meDef.pattern.length];
                  const meLabel = ENEMY_ACTION_LABEL[meNextAction];
                  const meIsUnavoidable = meNextAction === "unavoidable" || meNextAction === "unavoidable_lite";
                  const meColor = meIsUnavoidable ? C.red : meNextAction === "counter" ? "#f97316" : meNextAction === "dodge" ? C.muted : "#60a5fa";
                  const isTargetable = !!pendingTargetSelect && !me.defeated;
                  const cardBorder = isTargetable ? `2px solid ${C.accent}` : `1px solid ${C.border}44`;
                  const cardBg = meIsBoss ? "rgba(20,5,10,0.88)" : "rgba(5,13,20,0.82)";
                  // ── 属性情報（elementCycle 持ちの敵のみ表示） ──
                  const meElemCycle = meDef.elementCycle || null;
                  const meElemKey   = meElemCycle ? meElemCycle[enemyElementIdx % meElemCycle.length] : null;
                  const meElemInfo  = meElemKey ? ELEMENT_NAMES[meElemKey] : null;

                  return (
                    <div
                      key={me.slot}
                      onClick={() => isTargetable && onSelectTarget(idx)}
                      style={{
                        flex: meIsBoss ? "2 0 0" : "1 0 0",
                        display:"flex", flexDirection:"column", alignItems:"center",
                        justifyContent:"space-between",
                        gap:0, padding:"6px 5px 8px",
                        background: cardBg,
                        border: cardBorder,
                        borderRadius:8,
                        cursor: isTargetable ? "pointer" : "default",
                        opacity: me.defeated ? 0.3 : 1,
                        transition:"border 0.15s, opacity 0.3s",
                        position:"relative", overflow:"hidden",
                        boxShadow: meIsBoss ? "0 0 18px rgba(255,68,102,0.2)" : "none",
                      }}>

                      {/* ── 上部：BOSSラベル or 倒れ ── */}
                      <div style={{width:"100%",textAlign:"center",flexShrink:0,minHeight:14}}>
                        {meIsBoss && !me.defeated && (
                          <div style={{fontSize:8,letterSpacing:3,color:C.red,fontFamily:"'Share Tech Mono',monospace",animation:"dngr 1s infinite"}}>BOSS</div>
                        )}
                        {me.defeated && (
                          <div style={{fontSize:meIsBoss?36:24,lineHeight:1,marginTop:8}}>💀</div>
                        )}
                      </div>

                      {/* ── 中央：エネミー画像（flex:1 で縦最大） ── */}
                      {!me.defeated && (
                        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",width:"100%",minHeight:0,padding:"3px 0"}}>
                          {meImg
                            ? <img src={meImg} alt={meDef.name} style={{
                                width:"100%", maxWidth: meIsBoss ? 160 : 86,
                                height:"100%", maxHeight: meIsBoss ? 200 : 120,
                                objectFit:"contain",
                                animation: meIsBoss ? "bossFloat 2s infinite" : "idle 2.2s infinite",
                                filter: meIsBoss
                                  ? "drop-shadow(0 0 16px #ff4466cc) drop-shadow(0 0 4px #ff000088)"
                                  : "drop-shadow(0 2px 8px rgba(0,0,0,0.8))",
                                transform: btlAnimEnemy ? "scale(1.07)" : "scale(1)",
                                transition:"transform 0.1s",
                              }} />
                            : <div style={{
                                fontSize: meIsBoss ? "clamp(48px,8vw,72px)" : "clamp(28px,5vw,44px)",
                                lineHeight:1,
                                animation: meIsBoss ? "bossFloat 2s infinite" : "idle 2.2s infinite",
                                filter: meIsBoss ? "drop-shadow(0 0 12px #ff4466)" : "none",
                              }}>{meDef.em}</div>
                          }
                        </div>
                      )}

                      {/* ── 下部：属性・名前・HP・行動バッジ ── */}
                      {!me.defeated && (
                        <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
                          {/* 属性バッジ（elementCycle 持ちのみ） */}
                          {meElemInfo && (
                            <div style={{display:"flex",alignItems:"center",gap:2,background:`${meElemInfo.color}18`,border:`1px solid ${meElemInfo.color}55`,borderRadius:3,padding:"1px 6px"}}>
                              <span style={{fontSize:9}}>{meElemInfo.icon}</span>
                              <span style={{fontSize:8,color:meElemInfo.color,fontFamily:"'Share Tech Mono',monospace",fontWeight:700,letterSpacing:1,textShadow:`0 0 8px ${meElemInfo.color}`}}>{meElemInfo.label}</span>
                            </div>
                          )}
                          {/* 敵名 */}
                          <div style={{fontSize:8,color:C.white,fontFamily:"'Share Tech Mono',monospace",textAlign:"center",lineHeight:1.2,width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"0 2px"}}>
                            {meDef.name.replace("Simuluu ─ ","").replace("シャメロット ","Lv").replace(" 試練の主","")}
                          </div>
                          {/* HPバー */}
                          <div style={{width:"92%",height:4,background:C.panel2,borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${meHpPct}%`,background: meIsBoss ? `linear-gradient(90deg,${C.red},#ff8844)` : `linear-gradient(90deg,${C.accent2},${C.accent})`,transition:"width 0.4s",borderRadius:2}}/>
                          </div>
                          <div style={{fontSize:8,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>{me.hp}/{meDef.maxHp}</div>
                          {/* NEXT行動バッジ */}
                          {!victory && !defeat && (
                            <div style={{width:"94%",padding:"2px 3px",background:`${meColor}11`,border:`1px solid ${meColor}44`,borderRadius:3,textAlign:"center"}}>
                              <span style={{fontSize:8,color:meColor,fontFamily:"'Share Tech Mono',monospace",animation:meIsUnavoidable?"dngr 0.8s infinite":"none",whiteSpace:"nowrap"}}>
                                {meLabel?.icon} {meLabel?.text}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ターゲット選択中の👆 */}
                      {isTargetable && (
                        <div style={{position:"absolute",bottom:-12,left:"50%",transform:"translateX(-50%)",fontSize:16,animation:"idle 0.8s infinite"}}>👆</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* キャンセルボタン（ターゲット選択中） */}
              {pendingTargetSelect && (
                <button onClick={onCancelCommand} style={{marginTop:16,padding:"5px 24px",background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:9,cursor:"pointer",borderRadius:4,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
                  ← スキル選択に戻る
                </button>
              )}
            </>
          ) : (
            /* ── 単体敵表示（縦フル3段） ─────────────────────────────────── */
            <>
            {/* コンボ（絶対配置オーバーレイ） */}
            {noDmgStreak >= 3 && (
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%, -50%)",zIndex:10,pointerEvents:"none",textAlign:"center",animation:"comboPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both"}}>
                <div style={{fontSize:"clamp(36px, 8vw, 64px)",fontWeight:900,fontFamily:"'Share Tech Mono',monospace",color:C.gold,letterSpacing:2,lineHeight:1,animation:"comboPulse 1s infinite",WebkitTextStroke:`1px #ffffff44`}}>
                  {noDmgStreak}
                  <span style={{fontSize:"0.45em",letterSpacing:4,display:"block",marginTop:2,color:"#ffe08a"}}>COMBO</span>
                </div>
                <div style={{fontSize:10,color:"#ffe08a",fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,marginTop:4,opacity:0.85}}>MP +{5 + noDmgStreak} / turn</div>
              </div>
            )}

            {/* ── 上段：BOSSラベル + 属性インジケーター ── */}
            <div style={{width:"100%",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:4,paddingTop:4,zIndex:2}}>
              {isBoss && (
                <div style={{fontSize:11,letterSpacing:6,color:C.red,fontFamily:"'Share Tech Mono',monospace",animation:"dngr 1s infinite",whiteSpace:"nowrap"}}>─── BOSS ───</div>
              )}
              {currentElemInfo && (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"rgba(5,13,20,0.78)",border:`1px solid ${currentElemInfo.color}88`,borderRadius:6,padding:"4px 14px",minWidth:130}}>
                  <div style={{fontSize:9,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2}}>CURRENT ELEMENT</div>
                  <div style={{fontSize:15,fontWeight:900,color:currentElemInfo.color,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,textShadow:`0 0 12px ${currentElemInfo.color}`}}>
                    {currentElemInfo.icon} {currentElemInfo.label}
                  </div>
                  <div style={{width:"100%",height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${elemBarPct}%`,background:`linear-gradient(90deg,${currentElemInfo.color}88,${currentElemInfo.color})`,transition:"width 0.3s",borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:8,color:currentElemInfo.color,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
                    蓄積 {elemDmgAccum}/{ELEMENT_BREAK_THRESHOLD}
                  </div>
                </div>
              )}
            </div>

            {/* ── 中段：エネミー画像（flex:1 で縦を最大利用、上限clampで画面内に収める） ── */}
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",width:"100%",minHeight:0,padding:"4px 0",overflow:"hidden"}}>
              {enemyImgUrl
                ? <img src={enemyImgUrl} alt={ed.name} style={{
                    width:"auto",
                    height:"clamp(120px, 63vh, 500px)",
                    maxWidth:"96%",
                    objectFit:"contain",
                    animation:isBoss?"bossFloat 2s infinite":"idle 2s infinite",
                    filter:isBoss?`drop-shadow(0 0 24px ${C.red}) drop-shadow(0 0 6px #ff000066)`:"drop-shadow(0 4px 16px rgba(0,0,0,0.7))",
                    transform:btlAnimEnemy?"scale(1.05)":"scale(1)", transition:"transform 0.1s",
                  }} />
                : <div style={{
                    fontSize:"clamp(60px, 10vh, 140px)",
                    lineHeight:1,
                    animation:isBoss?"bossFloat 2s infinite":"idle 2s infinite",
                    filter:isBoss?`drop-shadow(0 0 24px ${C.red})`:"none",
                    transform:btlAnimEnemy?"scale(1.08)":"scale(1)", transition:"transform 0.1s",
                  }}>{ed.em}</div>
              }
            </div>

            {/* ── 下段：名前 + デバフ + HPバー + NEXTバッジ ── */}
            <div style={{width:"92%",flexShrink:0,zIndex:2,display:"flex",flexDirection:"column",gap:4,paddingBottom:6}}>
              <div style={{background:"rgba(5,13,20,0.72)",padding:"5px 10px",borderRadius:4,display:"flex",flexDirection:"column",gap:3}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,flexWrap:"wrap"}}>
                  <span style={{color:C.white,fontSize:13,fontWeight:700,letterSpacing:1,textShadow:"0 1px 4px #000"}}>{ed.name}</span>
                  {enrageCount > 0 && (
                    <span style={{fontSize:9,color:C.red,fontFamily:"'Share Tech Mono',monospace",background:"rgba(255,50,50,0.18)",border:`1px solid ${C.red}66`,borderRadius:3,padding:"1px 5px",animation:"dngr 0.8s infinite",whiteSpace:"nowrap"}}>
                      🔴 怒り×2 残{enrageCount}T
                    </span>
                  )}
                </div>
                {(enemyAtkDebuff > 0 || partySpdBuff > 0) && (
                  <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap"}}>
                    {enemyAtkDebuff > 0 && (
                      <span style={{fontSize:8,color:"#ff9944",fontFamily:"'Share Tech Mono',monospace",background:"rgba(255,120,50,0.15)",border:"1px solid #ff994466",borderRadius:3,padding:"1px 5px",whiteSpace:"nowrap"}}>
                        🔥 ATK½ 残{enemyAtkDebuff}T
                      </span>
                    )}
                    {partySpdBuff > 0 && (
                      <span style={{fontSize:8,color:"#ffee44",fontFamily:"'Share Tech Mono',monospace",background:"rgba(255,238,50,0.12)",border:"1px solid #ffee4466",borderRadius:3,padding:"1px 5px",whiteSpace:"nowrap"}}>
                        ⚡ 味方SPD+3 残{partySpdBuff}T
                      </span>
                    )}
                  </div>
                )}
                <div style={{width:"100%",height:8,background:C.panel2,borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${enemyPct}%`,background:isBoss?`linear-gradient(90deg,${C.red},#ff8844)`:`linear-gradient(90deg,${C.accent2},${C.accent})`,transition:"width 0.4s",borderRadius:4,boxShadow:enrageCount>0?`0 0 8px ${C.red}`:"none"}}/>
                </div>
                <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace",textAlign:"center"}}>{enemyHp} / {ed.maxHp}</div>
              </div>
              {!victory && !defeat && enemyNextAction && (() => {
                const eLabel = ENEMY_ACTION_LABEL[enemyNextAction];
                const isUnavoidable = enemyNextAction === "unavoidable";
                const previewColor = isUnavoidable ? C.red : enemyNextAction === "counter" ? "#f97316" : enemyNextAction === "dodge" ? C.muted : "#60a5fa";
                return (
                  <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",background:`${previewColor}11`,border:`1px solid ${previewColor}44`,borderRadius:5}}>
                    <span style={{fontSize:8,color:C.muted,fontFamily:"'Share Tech Mono',monospace",whiteSpace:"nowrap"}}>NEXT</span>
                    <span style={{fontSize:10,color:previewColor,fontFamily:"'Share Tech Mono',monospace",fontWeight:700,animation:isUnavoidable?"dngr 0.8s infinite":"none",flex:1,textAlign:"center"}}>
                      {eLabel?.icon} {eLabel?.text}
                    </span>
                    {isUnavoidable && <span style={{fontSize:8,color:C.red,whiteSpace:"nowrap"}}>⚠ 必中</span>}
                  </div>
                );
              })()}
            </div>
            </>
          )}
          </div>

          {/* 右カラム：ログ＋ステータス＋ボタン */}
          <div style={{flex:"0 0 38%",display:"flex",flexDirection:"column",background:"rgba(5,13,20,0.82)",borderLeft:`1px solid ${C.border}44`,overflow:"hidden"}}>

            {/* すくみガイド */}
            <div style={{padding:"3px 8px",borderBottom:`1px solid ${C.border}33`,display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:8,color:"#00ffcc88",fontFamily:"'Share Tech Mono',monospace"}}>⚔→🔄負 </span>
              <span style={{fontSize:8,color:"#f9731688",fontFamily:"'Share Tech Mono',monospace"}}>🔄→💨負 </span>
              <span style={{fontSize:8,color:"#a78bfa88",fontFamily:"'Share Tech Mono',monospace"}}>💨→⚔負 </span>
              <span style={{fontSize:8,color:"#ff446688",fontFamily:"'Share Tech Mono',monospace"}}>💥回避不能</span>
            </div>

            {/* バトルログ */}
            <div style={{flex:1,overflowY:"auto",padding:"8px 12px",minHeight:0}}>
              {btlLogs.map((l,i) => (
                <div key={i} style={{fontSize:11,color:i===btlLogs.length-1?C.white:C.muted,lineHeight:1.7,animation:i===btlLogs.length-1?"slideUp 0.3s ease":"none"}}>{l}</div>
              ))}
            </div>

            {/* 右カラム下部：パーティー＋アクション */}
            <div style={{padding:"5px 10px",background:"rgba(10,26,38,0.95)",borderTop:`1px solid ${C.border}`,flexShrink:0,overflowY:"auto"}}>

              {/* ── パーティーメンバーリスト（右カラム） ── */}
              {/* コマンド選択中の1人だけスプライトをハイライト表示 */}
              <div style={{marginBottom:6}}>
                {/* コマンド選択中メンバーのスプライト大表示 */}
                {!victory && !defeat && inputPhase === "command" && (() => {
                  const cm = partyMembers[cmdInputIdx];
                  const cmSprKey = SPRITE_MAP[cm.icon];
                  const cmSprUrl = cmSprKey ? assetUrl(cmSprKey) : null;
                  const cmHpPct = Math.max(0, cm.hp / cm.mhp * 100);
                  const cmHpColor = cmHpPct <= 25 ? C.red : cmHpPct <= 50 ? C.gold : C.accent2;
                  const cmMpPct = Math.max(0, cm.mp / cm.mmp * 100);
                  return (
                    <div style={{display:"flex",alignItems:"flex-start",gap:6,padding:"4px 6px",marginBottom:4,background:`linear-gradient(90deg,${C.accent}18,transparent)`,border:`1px solid ${C.accent}55`,borderRadius:6}}>
                      {/* スプライト: 下半身欠けOK・頭が見えるよう object-position:top */}
                      <div style={{flexShrink:0,width:44,height:60,overflow:"hidden",borderRadius:4,border:`1px solid ${C.accent}66`,background:"rgba(0,200,255,0.06)",filter:`drop-shadow(0 0 8px ${C.accent}55)`}}>
                        {cmSprUrl
                          ? <img src={cmSprUrl} alt={cm.name} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top center"}} />
                          : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>{cm.icon}</div>
                        }
                      </div>
                      {/* 名前・HP・MP */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                          <span style={{color:C.accent,fontSize:9}}>▶</span>
                          <span style={{fontSize:11,color:C.white,fontFamily:"'Noto Serif JP',serif",fontWeight:700}}>{cm.name}</span>
                          <span style={{fontSize:8,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginLeft:"auto"}}>T{turn} {cmdInputIdx+1}/{PARTY_DEFS.length}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                          <span style={{fontSize:8,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>HP</span>
                          <span style={{fontSize:10,color:cmHpColor,fontFamily:"'Share Tech Mono',monospace",animation:cmHpPct<=25?"dngr 0.8s infinite":"none"}}>{cm.hp}<span style={{fontSize:8,color:C.muted}}>/{cm.mhp}</span></span>
                        </div>
                        <div style={{height:4,background:C.panel2,borderRadius:2,marginBottom:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${cmHpPct}%`,background:`linear-gradient(90deg,${cmHpColor}99,${cmHpColor})`,transition:"width 0.4s",borderRadius:2}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                          <span style={{fontSize:8,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>MP</span>
                          <span style={{fontSize:10,color:"#60a5fa",fontFamily:"'Share Tech Mono',monospace"}}>{cm.mp}<span style={{fontSize:8,color:C.muted}}>/{cm.mmp}</span></span>
                        </div>
                        <div style={{height:3,background:C.panel2,borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${cmMpPct}%`,background:"linear-gradient(90deg,#2255cc,#60a5fa)",transition:"width 0.4s",borderRadius:2}}/>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>

              {/* ── アクションボタン / スキルサブメニュー / 勝敗結果 ── */}
              <div style={{flexShrink:0}}>
                {!victory && !defeat ? (
                  <div>
                    {/* 敵SPD表示（コンパクト） */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6,marginBottom:5}}>
                      <div style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px",background:"transparent",border:`1px solid ${C.border}44`,borderRadius:4}}>
                        <span style={{fontSize:11}}>{ed.em}</span>
                        <span style={{fontSize:8,color:enemySpdDebuff>0?C.gold:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>
                          SPD {effectiveEnemySpdDisp}{enemySpdDebuff>0?" ⬇":""}
                        </span>
                      </div>
                    </div>

                    {showElemMenu ? (
                      /* ── 属性スキルサブメニュー ── */
                      <div>
                        <div style={{fontSize:9,color:currentElemInfo ? currentElemInfo.color : C.accent,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,textAlign:"center",marginBottom:4}}>
                          {currentElemInfo ? `敵属性: ${currentElemInfo.icon}${currentElemInfo.label} ─ 弱点を突け！` : "属性スキルを選択"}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}>
                          {ELEMENT_SKILL_DEFS.filter(esk => currentCmdMember.allowedElemSkills.includes(esk.id)).map(esk => {
                            const memberMp = currentCmdMember.id === "eltz" ? mp : (partyMp[currentCmdMember.id] ?? 0);
                            const canAfford = memberMp >= esk.cost;
                            const isEffective = currentElemKey && esk.targetElement === currentElemKey;
                            const borderColor = isEffective ? esk.color : `${esk.color}44`;
                            const bgColor = isEffective ? `${esk.color}22` : C.panel;
                            const extraEffectMap = {
                              "elem_ice":     "❄怒り解除",
                              "elem_thunder": "⚡SPD+3(3T)",
                              "elem_fire":    "🔥ATK½(3T)",
                              "elem_earth":   "🌿敵SPD-5",
                            };
                            const extraEffect = extraEffectMap[esk.id];
                            const isIceWithEnrage = esk.id === "elem_ice" && enrageCount > 0;
                            const elemCd = elemCooldowns[esk.id] ?? 0;
                            const canUseElem = canAfford && elemCd === 0;
                            const btnSt = canUseElem
                              ? { padding:"5px 4px", background:bgColor, border:`1px solid ${borderColor}`, color:esk.color, fontSize:10, cursor:"pointer", borderRadius:4, fontFamily:"'Noto Serif JP',serif", position:"relative" }
                              : { padding:"5px 4px", background:C.panel, border:`1px solid ${C.border}`, color:C.muted, fontSize:10, cursor:"not-allowed", borderRadius:4, fontFamily:"'Noto Serif JP',serif", opacity:0.5, position:"relative" };
                            return (
                              <button key={esk.id} onClick={() => canUseElem && onSelectCommand(esk.id)} style={btnSt}>
                                {isEffective && <div style={{position:"absolute",top:-2,right:-2,fontSize:7,background:esk.color,color:"#000",borderRadius:2,padding:"0 3px",fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>有効!</div>}
                                {isIceWithEnrage && <div style={{position:"absolute",top:-2,left:-2,fontSize:7,background:C.red,color:"#fff",borderRadius:2,padding:"0 3px",fontFamily:"'Share Tech Mono',monospace",fontWeight:700,animation:"dngr 0.6s infinite"}}>解除!</div>}
                                <div style={{fontSize:16}}>{esk.icon}</div>
                                <div style={{fontSize:9,marginTop:1}}>{esk.label}</div>
                                <div style={{fontSize:7,color:canAfford?C.muted:"#553333"}}>MP {esk.cost}</div>
                                {elemCd > 0 && <div style={{fontSize:6,color:C.red,marginTop:1}}>{elemCd}T後</div>}
                                {elemCd === 0 && extraEffect && <div style={{fontSize:6,color:isIceWithEnrage?C.red:esk.color,marginTop:1,opacity:0.9}}>{extraEffect}</div>}
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={() => setShowElemMenu(false)} style={{width:"100%",padding:"4px",background:"transparent",border:`1px solid ${C.border}44`,color:C.muted,fontSize:9,cursor:"pointer",borderRadius:4,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
                          ← 戻る
                        </button>
                      </div>
                    ) : showSpecMenu ? (
                      /* ── 特殊スキルサブメニュー（エルツ・リンス） ── */
                      (() => {
                        const SPEC_DEF = {
                          provoke:  { icon:"👊", label:"挑発",       color:"#f97316", cd:provokeCooldown,  desc:"敵行動を3T強攻に変換" },
                          takedown: { icon:"🦵", label:"テイクダウン", color:"#ef4444", cd:takedownCooldown, desc:"敵を1T行動不能" },
                          overheal: { icon:"💚", label:"オーバーヒール",color:"#22c55e", cd:0,               desc:"全員HP+80（最遅）" },
                          sleep:    { icon:"😴", label:"スリープ",    color:"#a78bfa", cd:sleepCooldown,    desc:"敵を1T眠らせ行動不能" },
                        };
                        return (
                          <div>
                            <div style={{fontSize:9,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,textAlign:"center",marginBottom:4}}>
                              特殊スキルを選択
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}>
                              {currentCmdMember.specialSkills.map(spId => {
                                const def = SPEC_DEF[spId];
                                if (!def) return null;
                                const cd = def.cd;
                                const canUse = cd === 0;
                                const stl = canUse
                                  ? { padding:"6px 4px", background:C.panel, border:`1px solid ${def.color}66`, color:def.color, fontSize:10, cursor:"pointer", borderRadius:4, fontFamily:"'Noto Serif JP',serif", position:"relative" }
                                  : { padding:"6px 4px", background:C.panel, border:`1px solid ${C.border}`, color:C.muted, fontSize:10, cursor:"not-allowed", borderRadius:4, fontFamily:"'Noto Serif JP',serif", opacity:0.5, position:"relative" };
                                return (
                                  <button key={spId} onClick={() => canUse && onSelectCommand(spId)} style={stl}>
                                    {cd > 0 && <div style={{position:"absolute",top:-2,right:-2,fontSize:7,background:C.red,color:"#fff",borderRadius:2,padding:"0 3px",fontFamily:"'Share Tech Mono',monospace"}}>CD{cd}</div>}
                                    <div style={{fontSize:18}}>{def.icon}</div>
                                    <div style={{fontSize:9,marginTop:2,fontWeight:700}}>{def.label}</div>
                                    <div style={{fontSize:7,color:canUse?`${def.color}bb`:C.muted,marginTop:2,lineHeight:1.3}}>{def.desc}</div>
                                  </button>
                                );
                              })}
                            </div>
                            <button onClick={() => setShowSpecMenu(false)} style={{width:"100%",padding:"4px",background:"transparent",border:`1px solid ${C.border}44`,color:C.muted,fontSize:9,cursor:"pointer",borderRadius:4,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
                              ← 戻る
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      /* ── 通常アクションボタン ── */
                      <div>
                        {(() => {
                          const baseCols = 4;
                          const elemCol = currentCmdMember.allowedElemSkills.length > 0 ? 1 : 0;
                          // 特殊スキルがある場合は「スキル」ボタン1個に集約
                          const specCol = currentCmdMember.specialSkills.length > 0 ? 1 : 0;
                          const totalCols = baseCols + elemCol + specCol;
                          const gtc = Array(totalCols).fill("1fr").join(" ");
                          return (
                        <div style={{display:"grid",gridTemplateColumns:gtc,gap:3,marginBottom:3}}>
                          {BATTLE_SKILLS.map(sk => {
                            const memberMp = currentCmdMember.id === "eltz" ? mp : (partyMp[currentCmdMember.id] ?? 0);
                            const canAfford = sk.cost === 0 || memberMp >= sk.cost;
                            const disabled = inputPhase !== "command";
                            const btnStyle = (canAfford && !disabled)
                              ? { padding:"5px 3px", background:C.panel, border:`1px solid ${sk.color}44`, color:sk.color, fontSize:10, cursor:"pointer", borderRadius:4, fontFamily:"'Noto Serif JP',serif" }
                              : { padding:"5px 3px", background:C.panel, border:`1px solid ${C.border}`, color:C.muted, fontSize:10, cursor:"not-allowed", borderRadius:4, fontFamily:"'Noto Serif JP',serif", opacity:0.5 };
                            return (
                              <button key={sk.id} onClick={() => canAfford && !disabled && onSelectCommand(sk.id)} style={btnStyle}>
                                <div style={{fontSize:16}}>{sk.icon}</div>
                                <div style={{fontSize:9,marginTop:2}}>{sk.label}</div>
                                {sk.cost > 0 && <div style={{fontSize:7,color:canAfford?C.muted:"#553333"}}>MP {sk.cost}</div>}
                              </button>
                            );
                          })}
                          {/* 属性スキルボタン（スウィフト・チョッパー） */}
                          {currentCmdMember.allowedElemSkills.length > 0 && (
                            <button
                              onClick={() => inputPhase === "command" && setShowElemMenu(true)}
                              style={{padding:"5px 3px",background:C.panel,border:`1px solid #a855f744`,color:inputPhase==="command"?"#a855f7":C.muted,fontSize:10,cursor:inputPhase==="command"?"pointer":"not-allowed",borderRadius:4,fontFamily:"'Noto Serif JP',serif",opacity:inputPhase==="command"?1:0.5}}>
                              <div style={{fontSize:16}}>✨</div>
                              <div style={{fontSize:9,marginTop:2}}>スキル</div>
                            </button>
                          )}
                          {/* 特殊スキルボタン（エルツ・リンス）→ サブメニューを開く */}
                          {currentCmdMember.specialSkills.length > 0 && (() => {
                            const hasCdAll = currentCmdMember.specialSkills.every(spId => {
                              const cdMap = { provoke:provokeCooldown, takedown:takedownCooldown, overheal:0, sleep:sleepCooldown };
                              return (cdMap[spId] ?? 0) > 0;
                            });
                            const canOpen = inputPhase === "command";
                            return (
                              <button
                                onClick={() => canOpen && setShowSpecMenu(true)}
                                style={{padding:"5px 3px",background:C.panel,border:`1px solid ${hasCdAll?"#55555566":"#00ffcc44"}`,color:canOpen?(hasCdAll?C.muted:C.accent2):C.muted,fontSize:10,cursor:canOpen?"pointer":"not-allowed",borderRadius:4,fontFamily:"'Noto Serif JP',serif",opacity:canOpen?1:0.5}}>
                                <div style={{fontSize:16}}>🌟</div>
                                <div style={{fontSize:9,marginTop:2}}>スキル</div>
                              </button>
                            );
                          })()}
                        </div>
                          ); // IIFEのreturn終わり
                          })()}
                        {/* キャンセルボタン */}
                        {cmdInputIdx > 0 && inputPhase === "command" && (
                          <button onClick={onCancelCommand} style={{width:"100%",padding:"3px",background:"transparent",border:`1px solid ${C.border}44`,color:C.muted,fontSize:8,cursor:"pointer",borderRadius:4,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
                            ← 前のコマンドに戻る
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 0"}}>
                    <div style={{fontSize:15,color:victory?C.gold:C.red,fontWeight:700,marginBottom:10,animation:"fadeIn 0.5s"}}>
                      {victory ? "🏆 Victory！" : "💀 Defeat..."}
                    </div>
                    <button onClick={exitBattle} style={{padding:"7px 32px",background:"transparent",border:`1px solid ${victory?C.gold:C.muted}`,color:victory?C.gold:C.muted,fontSize:13,cursor:"pointer",letterSpacing:2,fontFamily:"'Share Tech Mono',monospace"}}>
                      {victory ? "続ける ▶" : "戻る ▶"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // @@SECTION:RENDER_GAME
  const dl = sc.dl[dlIdx] || sc.dl[0];
  const spColor = dl.sp === "SYSTEM" ? C.accent : dl.sp === "ナレーション" ? C.muted : C.accent2;
  const isHpLow = hp / mhp <= 0.25;

  return (
    <div style={{width:"100%",height:"100%",minHeight:"600px",display:"flex",flexDirection:"column",...bgStyle,fontFamily:"'Noto Serif JP',serif",userSelect:"none",position:"relative",overflow:"hidden",transition:"background 1s"}}>
      <style>{keyframes}</style>

      {/* Overlay fade */}
      {fade && <div style={{position:"absolute",inset:0,background:"#050d14",opacity:1,zIndex:50,transition:"opacity 0.3s"}}/>}

      {/* Notification */}
      {notif && <div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:"rgba(5,13,20,0.95)",border:`1px solid ${C.accent}`,color:C.accent,padding:"8px 20px",fontSize:12,letterSpacing:1,zIndex:100,whiteSpace:"nowrap",fontFamily:"'Share Tech Mono',monospace",animation:"notifIn 0.3s ease",borderRadius:2}}>{notif}</div>}

      {/* Scanlines */}
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,200,255,0.01) 3px,rgba(0,200,255,0.01) 4px)",pointerEvents:"none",zIndex:1}}/>

      {/* HUD top */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 14px",background:"rgba(5,13,20,0.7)",borderBottom:`1px solid ${C.border}`,zIndex:10,position:"relative"}}>
        <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>{sc.loc}</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>
            <span style={{color:isHpLow?C.red:C.accent2,animation:isHpLow?"dngr 0.8s infinite":"none"}}>HP {hp}</span>
            <span style={{color:C.muted}}> / </span>
            <span style={{color:C.muted}}>{mhp}</span>
          </div>
          <div style={{fontSize:10,color:"#60a5fa",fontFamily:"'Share Tech Mono',monospace"}}>MP {mp}</div>
          <div style={{fontSize:10,color:C.gold,fontFamily:"'Share Tech Mono',monospace"}}>💰 {elk}</div>
          <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>Lv.{lv}</div>
        </div>
      </div>

      {/* Sprite area */}
      <div style={{flex:1,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"20px 20px 0",position:"relative",zIndex:5,minHeight:200}}>
        {/* Scene-specific atmosphere */}
        {sc.loc.includes("洞窟") && (
          <>
            {[...Array(8)].map((_,i) => (
              <div key={i} style={{position:"absolute",width:4,height:4,borderRadius:"50%",background:`rgba(0,100,255,${0.3+Math.random()*0.3})`,left:`${10+Math.random()*80}%`,top:`${Math.random()*80}%`,animation:`idle ${2+Math.random()*3}s ${Math.random()*2}s infinite`}}/>
            ))}
          </>
        )}

        {/* P.BOOK 幾何学シンボル -- 右上固定 */}
        {hasPb && (
          <button
            onClick={() => setOverlay(overlay==="pb"?null:"pb")}
            style={{position:"absolute",top:12,right:14,width:52,height:52,background:"transparent",border:"none",padding:0,cursor:"pointer",zIndex:20,animation:"pbGlow 3s ease-in-out infinite"}}
          >
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* 外周リング -- 低速回転 */}
              <circle cx="26" cy="26" r="24" stroke={overlay==="pb"?C.accent:C.border} strokeWidth="1" fill="none" strokeDasharray="4 3" style={{animation:"pbSpin 18s linear infinite",transformOrigin:"26px 26px"}}/>
              {/* 内周リング -- 逆回転 */}
              <circle cx="26" cy="26" r="19" stroke={overlay==="pb"?C.accent+"88":C.border+"66"} strokeWidth="0.8" fill="none" strokeDasharray="2 4" style={{animation:"pbSpinR 12s linear infinite",transformOrigin:"26px 26px"}}/>
              {/* 六角形フレーム */}
              <polygon points="26,5 44,15.5 44,36.5 26,47 8,36.5 8,15.5" stroke={overlay==="pb"?C.accent:C.border} strokeWidth="1" fill={overlay==="pb"?"rgba(0,200,255,0.08)":"rgba(10,26,38,0.7)"} />
              {/* 中央 -- 菱形 */}
              <polygon points="26,14 34,26 26,38 18,26" stroke={overlay==="pb"?C.accent:C.muted} strokeWidth="1" fill={overlay==="pb"?"rgba(0,200,255,0.15)":"transparent"} />
              {/* 中心点 */}
              <circle cx="26" cy="26" r="3" fill={overlay==="pb"?C.accent:C.muted} style={{animation:"pbPulse 2s ease-in-out infinite"}}/>
              {/* 四方位の小ダイヤ */}
              {[[26,9],[43,26],[26,43],[9,26]].map(([cx,cy],i) => (
                <polygon key={i} points={`${cx},${cy-3} ${cx+2},${cy} ${cx},${cy+3} ${cx-2},${cy}`} fill={overlay==="pb"?C.accent:C.border} opacity="0.8"/>
              ))}
              {/* P.B テキスト */}
              <text x="26" y="29" textAnchor="middle" fill={overlay==="pb"?C.accent:C.muted} fontSize="7" fontFamily="'Share Tech Mono',monospace" letterSpacing="1" opacity="0.9">P.B</text>
            </svg>
          </button>
        )}

        {/* LV UP シンボル -- P.BOOKの下 */}
        {lvUpInfo && (
          <button
            onClick={() => setOverlay("lvup")}
            style={{position:"absolute",top:hasPb?72:12,right:14,width:52,height:52,background:"transparent",border:"none",padding:0,cursor:"pointer",zIndex:20,animation:"lvPulse 1.2s ease-in-out infinite"}}
          >
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* 外周リング */}
              <circle cx="26" cy="26" r="24" stroke={C.gold} strokeWidth="1" fill="none" strokeDasharray="3 3" style={{animation:"pbSpin 6s linear infinite",transformOrigin:"26px 26px"}}/>
              {/* 星形 */}
              <polygon points="26,7 29.5,19.5 42.5,19.5 32,27.5 35.5,40 26,32 16.5,40 20,27.5 9.5,19.5 22.5,19.5" fill={C.gold} opacity="0.85"/>
              {/* LV テキスト */}
              <text x="26" y="30" textAnchor="middle" fill={C.bg} fontSize="7" fontFamily="'Share Tech Mono',monospace" letterSpacing="0.5" fontWeight="bold">LV!</text>
            </svg>
          </button>
        )}

        <div style={{display:"flex",gap:16,alignItems:"flex-end",justifyContent:"center",flexWrap:"wrap"}}>
          {sc.sprites.map((sp, i) => {
            const sprKey = SPRITE_MAP[sp];
            const sprUrl = sprKey ? assetUrl(sprKey) : null;
            const isHero = i === 0;
            const sz = SPRITE_SIZE[sp] ?? { height: 100, heroHeight: 130, offsetY: 0, fallbackSize: 40 };
            const dispH = isHero ? sz.heroHeight : sz.height;
            const heroFilter = isHero ? "drop-shadow(0 0 8px rgba(0,200,255,0.3))" : "none";
            return sprUrl
              ? <img key={i} src={sprUrl} alt={sp} style={{height:dispH,objectFit:"contain",marginBottom:sz.offsetY,animation:`idle ${2+i*0.3}s ${i*0.2}s infinite`,filter:heroFilter}} />
              : <div key={i} style={{fontSize:sz.fallbackSize,animation:`idle ${2+i*0.3}s ${i*0.2}s infinite`,filter:heroFilter,marginBottom:sz.offsetY,textShadow:"0 4px 8px rgba(0,0,0,0.5)"}}>{sp}</div>;
          })}
        </div>
      </div>

      {/* Dialog box -- 5行固定高さ＋スクロール対応 */}
      <style>{`
        .arcadia-text-scroll::-webkit-scrollbar { width: 4px; }
        .arcadia-text-scroll::-webkit-scrollbar-track { background: transparent; }
        .arcadia-text-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        .arcadia-text-scroll::-webkit-scrollbar-thumb:hover { background: ${C.accent}88; }
        .arcadia-text-scroll { scrollbar-width: thin; scrollbar-color: ${C.border} transparent; }
      `}</style>
      <div
        style={{position:"relative",zIndex:10,height:171,margin:"0 8px 4px",flexShrink:0}}
        onPointerDown={e => { tapStartYRef.current = e.clientY; }}
        onPointerUp={e => {
          const dy = Math.abs(e.clientY - tapStartYRef.current);
          if (dy < 8) onTapDlg();   // 8px未満の移動はタップとみなす
        }}
      >
        {/* ベースダイアログ */}
        <div style={{position:"absolute",inset:0,background:"rgba(5,13,20,0.92)",border:`1px solid ${C.border}`,borderTop:`1px solid ${C.accent}44`,padding:"14px 18px 16px",cursor:"pointer",backdropFilter:"blur(4px)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Speaker + Auto toggle */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexShrink:0}}>
            <div style={{fontSize:11,color:spColor,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,borderLeft:`2px solid ${spColor}`,paddingLeft:8}}>
              {dl.sp}
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation();
                const next = !autoAdvanceRef.current;
                setAutoAdv(next);
                // ONに切り替えた瞬間、すでにテキスト表示完了・選択肢なしなら即タイマー起動
                if (next && !typing && !choices) {
                  if (autoAdvTimerRef.current) clearTimeout(autoAdvTimerRef.current);
                  autoAdvTimerRef.current = setTimeout(() => {
                    if (!autoAdvanceRef.current) return;
                    const sc2 = SCENES[sceneIdx];
                    const dl2 = sc2?.dl[dlIdx];
                    if (!dl2 || dl2.choices || dl2.battle || dl2.ending) return;
                    if (dl2.next !== undefined) {
                      setFade(true);
                      setTimeout(() => { setSceneIdx(dl2.next); setDlIdx(0); setFade(false); }, 300);
                      return;
                    }
                    const nextDl = dlIdx + 1;
                    if (nextDl < sc2.dl.length) {
                      setDlIdx(nextDl);
                    } else {
                      const nextSc = sceneIdx + 1;
                      if (nextSc < SCENES.length) {
                        setFade(true);
                        setTimeout(() => { setSceneIdx(nextSc); setDlIdx(0); setFade(false); }, 300);
                      }
                    }
                  }, 1800);
                }
              }}
              style={{padding:"2px 8px",fontSize:9,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,border:`1px solid ${autoAdvance ? C.accent : C.border}`,background:autoAdvance ? `${C.accent}22` : "transparent",color:autoAdvance ? C.accent : C.muted,cursor:"pointer",borderRadius:2,transition:"all 0.2s",flexShrink:0}}
            >
              {autoAdvance ? "AUTO ●" : "AUTO ○"}
            </button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setOverlay("novel"); }}
              style={{padding:"2px 8px",fontSize:9,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",borderRadius:2,transition:"all 0.2s",flexShrink:0}}
              onMouseEnter={e => { e.currentTarget.style.color=C.accent2; e.currentTarget.style.borderColor=C.accent2; }}
              onMouseLeave={e => { e.currentTarget.style.color=C.muted;   e.currentTarget.style.borderColor=C.border; }}
            >
              📖 NOVELIZE
            </button>
            </div>
          </div>
          {/* Text -- スクロールエリア */}
          <div
            ref={textScrollRef}
            className="arcadia-text-scroll"
            style={{flex:1,fontSize:13,color:C.white,lineHeight:1.85,whiteSpace:"pre-wrap",overflowY:"auto",overflowX:"hidden",paddingRight:6}}
          >
            {displayText}
            {typing && <span style={{animation:"blnk 0.5s infinite",color:C.accent}}>█</span>}
          </div>
          {/* Advance indicator */}
          {!typing && !choices && (
            <div style={{position:"absolute",bottom:10,right:16,fontSize:10,color:C.accent,animation:"blnk 1s infinite",fontFamily:"'Share Tech Mono',monospace"}}>▼</div>
          )}
        </div>

        {/* Choices -- ダイアログ全体を上書きして表示 */}
        {choices && !typing && (
          <div style={{position:"absolute",inset:0,background:"rgba(5,13,20,0.97)",border:`1px solid ${C.border}`,borderTop:`1px solid ${C.accent}44`,display:"flex",flexDirection:"column",justifyContent:"center",gap:8,padding:"12px 10px",backdropFilter:"blur(4px)",animation:"slideUp 0.3s ease"}}>
            {choices.map((ch, i) => (
              <button key={i}
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => { e.stopPropagation(); onChoice(ch); }}
                onClick={e => e.stopPropagation()}
                style={{flex:1,padding:"0 16px",background:C.panel,border:`1px solid ${C.border}`,color:C.text,fontSize:13,textAlign:"left",cursor:"pointer",transition:"all 0.2s",fontFamily:"'Noto Serif JP',serif",letterSpacing:0.5,display:"flex",alignItems:"center"}}
                onMouseEnter={e => { e.currentTarget.style.background = C.panel2; e.currentTarget.style.borderColor = C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.panel; e.currentTarget.style.borderColor = C.border; }}>
                {ch.t}
              </button>
            ))}
          </div>
        )}
      </div>



      {/* P.BOOK Overlay */}
      {overlay === "pb" && (
        <div style={{position:"absolute",inset:0,background:"rgba(5,13,20,0.97)",zIndex:30,display:"flex",flexDirection:"column",animation:"fadeIn 0.2s"}}>
          <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.border}`,padding:"10px 16px"}}>
            <div style={{fontSize:11,letterSpacing:4,color:C.accent,fontFamily:"'Share Tech Mono',monospace",flex:1}}>P.BOOK</div>
            <button onClick={() => setOverlay(null)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace"}}>✕</button>
          </div>
          {/* Tabs */}
          <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
            {["STATUS","MAIL","MAP"].map((tab,i) => (
              <button key={i} onClick={() => setPbTab(i)} style={{flex:1,padding:"8px 4px",background:"transparent",border:"none",borderBottom:pbTab===i?`2px solid ${C.accent}`:"2px solid transparent",color:pbTab===i?C.accent:C.muted,fontSize:11,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
                {tab}
              </button>
            ))}
          </div>
          <div style={{flex:1,padding:16,overflowY:"auto"}}>
            {pbTab === 0 && (
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,lineHeight:2}}>
                <div style={{color:C.accent2,fontSize:14,marginBottom:12,letterSpacing:2}}>Eltz</div>
                {[
                  ["Lv", lv],
                  ["EXP", `${exp} / ${EXP_TABLE[lv] || "MAX"}`],
                  ["HP", `${hp} / ${mhp}`],
                  ["MP", `${mp} / ${mmp}`],
                  ["ELK", elk],
                  ["武器", weapon],
                  ["物理ATK", weaponPatk + statAlloc.patk],
                  ["物理DEF", statAlloc.pdef],
                  ...(statPoints>0?[["未振り", `${statPoints} pt`]]:[]),
                  ...(inCom?[["コミュニティ","White Garden"]]:[]),
                ].map(([k,v]) => (
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:`1px solid ${C.border}44`}}>
                    <span style={{color:C.muted}}>{k}</span>
                    <span style={{color:C.text}}>{v}</span>
                  </div>
                ))}
                {statPoints > 0 && (
                  <button onClick={() => setOverlay("stat")} style={{marginTop:16,width:"100%",padding:"10px",background:C.panel,border:`1px solid ${C.gold}`,color:C.gold,fontSize:12,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",letterSpacing:2}}>
                    ⭐ ステータス振り分け ({statPoints} pt)
                  </button>
                )}
              </div>
            )}
            {pbTab === 1 && (
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.muted}}>
                <div style={{color:C.accent,marginBottom:12,letterSpacing:2,fontSize:11}}>── MAIL ──</div>
                {hasPb ? (
                  <div style={{color:C.text,lineHeight:2}}>
                    <div style={{color:C.accent2,marginBottom:8}}>クリケットより</div>
                    <div style={{color:C.muted,fontSize:11,lineHeight:1.8}}>P.BOOKの初期設定を\n完了してください。\n\n冒険者よ、健闘を祈る！</div>
                    {inCom && (
                      <>
                        <div style={{color:C.accent2,marginBottom:8,marginTop:16}}>ユミルより</div>
                        <div style={{color:C.muted,fontSize:11,lineHeight:1.8}}>White Garden へようこそ！\n一緒に頑張ろうね。🌸</div>
                      </>
                    )}
                  </div>
                ) : <div>メールなし</div>}
              </div>
            )}
            {pbTab === 2 && (
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.muted}}>
                <div style={{color:C.accent,marginBottom:8,letterSpacing:2,fontSize:11}}>── MAP SCAN ──</div>
                {hasMapScan ? (
                  <div>
                    <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:"8px 10px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:C.accent2}}>📍</span>
                      <span style={{color:C.white,fontSize:11}}>{sc.loc}</span>
                    </div>
                    {/* ─ 狩り場エンカウント ─ */}
                    <div style={{color:C.gold,fontSize:10,letterSpacing:2,marginBottom:6}}>── エンカウント ──</div>
                    {[
                      { key:"seagull",       label:"海岸線",   note:"Lv.1 カモメ型" },
                      { key:"shamerlot",     label:"岩場",     note:"Lv.1 シャメロット" },
                      { key:"shamerlot_lv3", label:"岩場 深部",note:"Lv.3 シャメロット" },
                      { key:"shamerlot_lv5", label:"岩場 最奥",note:"Lv.5 シャメロット" },
                    ].map(({ key, label, note }) => {
                      const def = battleDefs[key];
                      const lvDiff = def.lv - lv;
                      const canFight = true;
                      const expNote = lvDiff >= 1 ? `EXP ×${lvDiff>=3?2.0:lvDiff===2?1.5:1.2}` : lvDiff === 0 ? "EXP 等倍" : "経験値なし";
                      const expColor = lvDiff >= 1 ? C.accent2 : lvDiff === 0 ? C.muted : C.red;
                      const rowStyle = { display:"flex", alignItems:"center", gap:6, padding:"7px 8px", marginBottom:4, background:C.panel, border:`1px solid ${C.border}`, borderRadius:2 };
                      return (
                        <div key={key} style={rowStyle}>
                          <span style={{fontSize:16}}>{def.em}</span>
                          <div style={{flex:1}}>
                            <div style={{color:C.text,fontSize:11}}>{label}</div>
                            <div style={{color:C.muted,fontSize:9}}>{note} &nbsp;
                              <span style={{color:expColor}}>{expNote}</span>
                            </div>
                          </div>
                          <button onClick={() => {
                            setOverlay(null);
                            setBattleDefs(prev => prev); // flush
                            const ed = battleDefs[key];
                            setBattleEnemy(ed);
                            setCurrentEnemyType(key);
                            setEnemyHp(ed.maxHp);
                            setBtlLogs([`⚔ ${ed.name} との戦闘が始まった！`]);
                            setGuarding(false); setVictory(false); setDefeat(false); setTurn(0); setNoDmgStreak(0);
                            setBattleResultBonus({ comboMult: 1.0, gradeMult: 1.0 });
                            setEnemyTurnIdx(0); setEnemyNextAction((ed.pattern||["atk"])[0]);
                            setBattleNext(sceneIdx);
                            setPhase("battle");
                          }} style={{padding:"4px 10px",background:`${C.accent}11`,border:`1px solid ${C.accent}44`,color:C.accent,fontSize:10,cursor:"pointer",letterSpacing:1,flexShrink:0}}>
                            戦う
                          </button>
                        </div>
                      );
                    })}
                    <div style={{color:C.muted,fontSize:9,marginTop:6,lineHeight:1.6}}>
                      ※ コーザ・Simuluuはここから戦えません
                    </div>
                  </div>
                ) : <div style={{color:C.muted,padding:8}}>MapScan 未解放<br/><span style={{fontSize:10}}>交易所のローズと話すと解放されます</span></div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LvUp Overlay */}
      {overlay === "lvup" && lvUpInfo && (
        <div style={{position:"absolute",inset:0,background:"rgba(5,13,20,0.97)",zIndex:30,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.3s"}}>
          <div style={{textAlign:"center",padding:32,border:`1px solid ${C.gold}`,background:C.panel,maxWidth:280}}>
            <div style={{fontSize:11,letterSpacing:6,color:C.gold,fontFamily:"'Share Tech Mono',monospace",marginBottom:16}}>LEVEL UP!</div>
            <div style={{fontSize:48,color:C.gold,textShadow:`0 0 20px ${C.gold}`,marginBottom:8}}>⭐</div>
            <div style={{fontSize:24,color:C.white,fontFamily:"'Share Tech Mono',monospace",marginBottom:20}}>Lv.{lvUpInfo.oldLv} → Lv.{lvUpInfo.newLv}</div>
            <div style={{fontSize:12,color:C.muted,lineHeight:2,fontFamily:"'Share Tech Mono',monospace",marginBottom:20}}>
              <div style={{color:C.accent2}}>MAX HP +10</div>
              <div style={{color:"#60a5fa"}}>MAX MP +5</div>
              <div style={{color:C.gold}}>ステータスポイント +3</div>
              <div style={{color:C.muted,fontSize:10,marginTop:4}}>物理ATK / 物理DEF に振り分け可</div>
            </div>
            <button onClick={() => { setOverlay(null); setLvUpInfo(null); }}
              style={{padding:"10px 32px",background:"transparent",border:`1px solid ${C.gold}`,color:C.gold,fontSize:12,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",letterSpacing:2}}>OK</button>
          </div>
        </div>
      )}

      {/* Stat Alloc Overlay */}
      {overlay === "stat" && (
        <div style={{position:"absolute",inset:0,background:"rgba(5,13,20,0.97)",zIndex:30,display:"flex",flexDirection:"column",animation:"fadeIn 0.2s"}}>
          <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.border}`,padding:"10px 16px"}}>
            <div style={{fontSize:11,letterSpacing:4,color:C.gold,fontFamily:"'Share Tech Mono',monospace",flex:1}}>ステータス振り分け</div>
            <button onClick={() => setOverlay("pb")} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace"}}>戻る</button>
          </div>
          <div style={{flex:1,padding:16}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.gold,marginBottom:16}}>残りポイント: {statPoints}</div>
            {[
              {key:"patk",label:"物理攻撃力",color:C.accent2},
              {key:"pdef",label:"物理防御力",color:"#a78bfa"},
            ].map(({key,label,color}) => (
              <div key={key} style={{display:"flex",alignItems:"center",marginBottom:12,gap:8}}>
                <div style={{flex:1,fontSize:12,color:C.text,fontFamily:"'Share Tech Mono',monospace"}}>{label}</div>
                <div style={{fontSize:14,color,fontFamily:"'Share Tech Mono',monospace",minWidth:32,textAlign:"center"}}>{statAlloc[key]}</div>
                <button disabled={statPoints<=0} onClick={() => { if(statPoints>0){ setStatPoints(sp=>sp-1); setStatAlloc(sa=>({...sa,[key]:sa[key]+1})); }}}
                  style={{padding:"4px 12px",background:statPoints>0?`${color}22`:"transparent",border:`1px solid ${statPoints>0?color:C.border}`,color:statPoints>0?color:C.muted,cursor:statPoints>0?"pointer":"not-allowed",fontSize:12,fontFamily:"'Share Tech Mono',monospace"}}>
                  ＋
                </button>
                <button disabled={statAlloc[key]<=10} onClick={() => { if(statAlloc[key]>10){ setStatPoints(sp=>sp+1); setStatAlloc(sa=>({...sa,[key]:sa[key]-1})); }}}
                  style={{padding:"4px 12px",background:statAlloc[key]>10?`${C.muted}22`:"transparent",border:`1px solid ${statAlloc[key]>10?C.muted:C.border}`,color:statAlloc[key]>10?C.muted:C.border,cursor:statAlloc[key]>10?"pointer":"not-allowed",fontSize:12,fontFamily:"'Share Tech Mono',monospace"}}>
                  ─
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Novelize Overlay -- チャプター/シーン選択＋小説ログ */}
      {overlay === "novel" && (() => {
        // ── チャプター定義 ────────────────────────────────────────────────
        const NOVEL_CHAPTERS = [
          { id:1, label:"序章", sub:"Chapter 1", scenes:[
            { idx:0,  label:"S00 VRS接続中" },
            { idx:1,  label:"S01 旅立ちの浜辺" },
            { idx:2,  label:"S02 イルカ島 海岸線" },
            { idx:3,  label:"S03 エルム村" },
            { idx:4,  label:"S04 エルム村 ギルド（出会い）" },
            { idx:5,  label:"S05 P.BOOK取得" },
            { idx:6,  label:"S06 チュートリアル説明" },
          ]},
          { id:2, label:"初心者講習", sub:"Chapter 2", scenes:[
            { idx:7,  label:"S07 ギルド裏・草地（コーザ戦）" },
            { idx:8,  label:"S08 講習終了・卒業証" },
            { idx:9,  label:"S09 宿屋の夜" },
            { idx:10, label:"S10 レミングスの酒場" },
          ]},
          { id:3, label:"仲間との狩り", sub:"Chapter 3", scenes:[
            { idx:11, label:"S11 シャメロット初戦" },
            { idx:12, label:"S12 経験値の謎" },
            { idx:13, label:"S13 交易所・ローズとジュダ" },
            { idx:14, label:"S14 チョッパー登場" },
            { idx:15, label:"S15 チョッパー救出（赤信号）" },
            { idx:16, label:"S16 四人パーティ結成" },
          ]},
          { id:4, label:"準備と旅立ち", sub:"Chapter 4", scenes:[
            { idx:17, label:"S17 武器屋" },
            { idx:18, label:"S18 防具屋" },
            { idx:19, label:"S19 船着場・洗礼の門" },
            { idx:20, label:"S20 ホワイトガーデン加入" },
            { idx:21, label:"S21 Simuluu情報入手" },
          ]},
          { id:5, label:"試練の洞窟", sub:"Chapter 5", scenes:[
            { idx:22, label:"S22 狩り継続・レベルアップ" },
            { idx:23, label:"S23 岩場（継続）" },
            { idx:24, label:"S24 コーザの餞別" },
            { idx:25, label:"S25 西海岸・洞窟入口" },
            { idx:26, label:"S26 青の洞窟" },
            { idx:27, label:"S27 最深部・Simuluu遭遇" },
            { idx:28, label:"S28 ボス戦前" },
            { idx:29, label:"S29 撃破・勝利" },
            { idx:30, label:"S30 祝杯・エンディング" },
          ]},
        ];

        // 訪問済みシーンのセット
        const visitedSet = new Set(novelLog.map(e => e.sIdx));

        // 選択シーンのエントリ（SYSTEMも含めて表示）
        const selEntries = novelSelScene !== null
          ? novelLog.filter(e => e.sIdx === novelSelScene)
          : [];

        const selScene = NOVEL_CHAPTERS.flatMap(c => c.scenes).find(s => s.idx === novelSelScene);

        return (
          <div style={{position:"absolute",inset:0,background:`linear-gradient(180deg,#020810 0%,${C.bg} 100%)`,zIndex:30,display:"flex",flexDirection:"column",animation:"fadeIn 0.2s",fontFamily:"'Noto Serif JP',serif"}}>
            <style>{`
              .nv-scroll::-webkit-scrollbar{width:4px}
              .nv-scroll::-webkit-scrollbar-track{background:transparent}
              .nv-scroll::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
              .nv-scroll{scrollbar-width:thin;scrollbar-color:${C.border} transparent}
            `}</style>

            {/* ヘッダー */}
            <div style={{padding:"12px 18px 10px",borderBottom:`1px solid ${C.border}`,background:"rgba(5,13,20,0.97)",flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,letterSpacing:5,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginBottom:2}}>ARCADIA -- SCENARIO LOG</div>
                <div style={{fontSize:13,color:C.white,fontWeight:"bold",letterSpacing:2}}>小説ログ / NOVELIZE</div>
              </div>
              <button onClick={() => setOverlay(null)}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"5px 12px",fontSize:11,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,borderRadius:2,flexShrink:0}}
                onMouseEnter={e=>{e.currentTarget.style.color=C.white;e.currentTarget.style.borderColor=C.accent;}}
                onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;}}
              >✕ 閉じる</button>
            </div>

            {/* 本体 -- 左ペイン（目次） + 右ペイン（本文） */}
            <div style={{flex:1,display:"flex",overflow:"hidden"}}>

              {/* 左ペイン -- チャプター/シーン一覧 */}
              <div className="nv-scroll" style={{width:188,flexShrink:0,borderRight:`1px solid ${C.border}`,overflowY:"auto",background:"rgba(5,13,20,0.6)",padding:"8px 0"}}>
                {NOVEL_CHAPTERS.map(ch => {
                  const anyVisited = ch.scenes.some(s => visitedSet.has(s.idx));
                  return (
                    <div key={ch.id}>
                      {/* チャプターヘッダー */}
                      <div style={{padding:"8px 12px 5px",borderTop: ch.id>1 ? `1px solid ${C.border}44` : "none"}}>
                        <div style={{fontSize:8,letterSpacing:3,color: anyVisited ? C.accent : C.muted+"66",fontFamily:"'Share Tech Mono',monospace"}}>{ch.sub}</div>
                        <div style={{fontSize:11,color: anyVisited ? C.accent2 : C.muted+"66",fontWeight:"bold",letterSpacing:1,marginTop:1}}>{ch.label}</div>
                      </div>
                      {/* シーンボタン */}
                      {ch.scenes.map(s => {
                        const visited  = visitedSet.has(s.idx);
                        const selected = novelSelScene === s.idx;
                        const btnBg    = selected ? `${C.accent}22` : "transparent";
                        const btnColor = selected ? C.accent : visited ? C.text : C.muted+"44";
                        const btnBorder = selected ? `1px solid ${C.accent}` : "1px solid transparent";
                        return (
                          <button key={s.idx}
                            disabled={!visited}
                            onClick={() => {
                              setNovelSelScene(s.idx);
                              const hasNovel = NOVEL_STATUS[s.idx];
                              setNovelTab(hasNovel ? "novel" : "log");
                              // キャッシュ済みなら再fetchしない
                              if (hasNovel && !(s.idx in novelCache)) {
                                const url = novelUrl(s.idx);
                                setNovelLoading(true);
                                fetch(url)
                                  .then(r => r.ok ? r.text() : Promise.reject(r.status))
                                  .then(text => {
                                    setNovelCache(prev => ({ ...prev, [s.idx]: text || null }));
                                  })
                                  .catch(() => {
                                    setNovelCache(prev => ({ ...prev, [s.idx]: null }));
                                  })
                                  .finally(() => setNovelLoading(false));
                              }
                            }}
                            style={{display:"block",width:"100%",textAlign:"left",padding:"5px 14px 5px 18px",background:btnBg,border:"none",borderLeft: selected ? `3px solid ${C.accent}` : `3px solid transparent`,color:btnColor,fontSize:10,cursor: visited ? "pointer" : "default",fontFamily:"'Noto Serif JP',serif",letterSpacing:0.3,lineHeight:1.5,transition:"all 0.15s"}}
                            onMouseEnter={e=>{ if(visited && !selected){ e.currentTarget.style.background=`${C.accent}11`; e.currentTarget.style.color=C.white; }}}
                            onMouseLeave={e=>{ if(visited && !selected){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=C.text; }}}
                          >
                            {s.label}
                            {!visited && <span style={{fontSize:8,color:C.muted+"44",marginLeft:4}}>──</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* 右ペイン -- 本文 */}
              <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

                {/* タブバー */}
                {novelSelScene !== null && (
                  <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0,background:"rgba(5,13,20,0.8)"}}>
                    {[
                      { id:"novel", label:"📖 NOVEL" },
                      { id:"log",   label:"📋 GAME LOG" },
                    ].map(tab => {
                      const active = novelTab === tab.id;
                      const tabStyle = active
                        ? { color:C.accent, borderBottom:`2px solid ${C.accent}`, background:`${C.accent}11` }
                        : { color:C.muted,  borderBottom:"2px solid transparent", background:"transparent" };
                      return (
                        <button key={tab.id}
                          onClick={() => setNovelTab(tab.id)}
                          style={{padding:"9px 20px",fontSize:10,cursor:"pointer",border:"none",letterSpacing:2,fontFamily:"'Share Tech Mono',monospace",transition:"all 0.15s",...tabStyle}}
                          onMouseEnter={e=>{ if(!active){ e.currentTarget.style.color=C.white; }}}
                          onMouseLeave={e=>{ if(!active){ e.currentTarget.style.color=C.muted; }}}
                        >{tab.label}</button>
                      );
                    })}
                  </div>
                )}

                <div className="nv-scroll" style={{flex:1,overflowY:"auto",padding:"22px 24px 32px"}}>
                {novelSelScene === null ? (
                  <div style={{color:C.muted,fontSize:12,textAlign:"center",marginTop:60,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,lineHeight:2}}>
                    <div style={{fontSize:20,marginBottom:12}}>📖</div>
                    左のリストからシーンを選択してください<br/>
                    <span style={{fontSize:10}}>訪問済みのシーンのみ閲覧できます</span>
                  </div>
                ) : novelTab === "novel" ? (
                  /* ── NOVEL タブ ── */
                  (() => {
                    // ローディング中
                    if (novelLoading && !(novelSelScene in novelCache)) {
                      return (
                        <div style={{color:C.muted,fontSize:12,textAlign:"center",marginTop:60,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,lineHeight:2}}>
                          <div style={{fontSize:20,marginBottom:12,animation:"arcadiaBlnk 1s step-end infinite"}}>📖</div>
                          読み込み中...
                        </div>
                      );
                    }
                    const novelText = novelCache[novelSelScene] ?? null;
                    return novelText ? (
                      <>
                        <div style={{marginBottom:24,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
                          <div style={{fontSize:9,letterSpacing:4,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginBottom:4}}>
                            {NOVEL_CHAPTERS.find(c=>c.scenes.some(s=>s.idx===novelSelScene))?.sub ?? ""}
                          </div>
                          <div style={{fontSize:15,color:C.white,fontWeight:"bold",letterSpacing:1}}>
                            {selScene?.label ?? ""}
                          </div>
                          <div style={{fontSize:10,color:C.muted,marginTop:4}}>
                            {SCENES[novelSelScene]?.loc ?? ""}
                          </div>
                        </div>
                        <p style={{color:C.text,fontSize:13,lineHeight:2.2,margin:0,whiteSpace:"pre-wrap",letterSpacing:0.5,fontFamily:"'Noto Serif JP',serif"}}>
                          {novelText}
                        </p>
                      </>
                    ) : (
                      <div style={{color:C.muted,fontSize:12,textAlign:"center",marginTop:60,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,lineHeight:2}}>
                        <div style={{fontSize:20,marginBottom:12}}>✏️</div>
                        {novelSelScene in novelCache
                          ? <>読み込みに失敗しました<br/><span style={{fontSize:10}}>ネットワーク接続を確認してください</span></>
                          : <>このシーンのノベルはまだ執筆中です<br/><span style={{fontSize:10}}>GAME LOG タブでゲームログを確認できます</span></>
                        }
                      </div>
                    );
                  })()
                ) : selEntries.length === 0 ? (
                  /* ── LOG タブ（エントリなし） ── */
                  <div style={{color:C.muted,fontSize:12,textAlign:"center",marginTop:60,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2}}>
                    ── ログがありません ──
                  </div>
                ) : (
                  /* ── LOG タブ（本文） ── */
                  <>
                    {/* シーンタイトル */}
                    <div style={{marginBottom:24,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
                      <div style={{fontSize:9,letterSpacing:4,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginBottom:4}}>
                        {NOVEL_CHAPTERS.find(c=>c.scenes.some(s=>s.idx===novelSelScene))?.sub ?? ""}
                      </div>
                      <div style={{fontSize:15,color:C.white,fontWeight:"bold",letterSpacing:1}}>
                        {selScene?.label ?? ""}
                      </div>
                      <div style={{fontSize:10,color:C.muted,marginTop:4}}>
                        {SCENES[novelSelScene]?.loc ?? ""}
                      </div>
                    </div>

                    {/* 本文エントリ */}
                    {selEntries.map((entry, i) => {
                      const isNarration = entry.sp === "ナレーション";
                      const isSystem    = entry.sp === "SYSTEM";
                      return (
                        <div key={i} style={{marginBottom: isNarration ? 22 : isSystem ? 16 : 18}}>
                          {isSystem ? (
                            // SYSTEMメッセージ -- モノスペース・シアン枠
                            <div style={{background:`${C.accent}0d`,border:`1px solid ${C.accent}44`,borderLeft:`3px solid ${C.accent}`,padding:"10px 14px",borderRadius:2}}>
                              <div style={{fontSize:8,letterSpacing:4,color:C.accent,fontFamily:"'Share Tech Mono',monospace",marginBottom:6}}>── SYSTEM ──</div>
                              <p style={{color:C.accent,fontSize:12,lineHeight:1.9,margin:0,whiteSpace:"pre-wrap",fontFamily:"'Share Tech Mono',monospace",letterSpacing:0.3}}>
                                {entry.t}
                              </p>
                            </div>
                          ) : isNarration ? (
                            <p style={{color:C.text,fontSize:13,lineHeight:2.15,margin:0,textIndent:"1em",whiteSpace:"pre-wrap",letterSpacing:0.4}}>
                              {entry.t}
                            </p>
                          ) : (
                            <div>
                              <div style={{fontSize:9,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,marginBottom:4,borderLeft:`2px solid ${C.accent2}`,paddingLeft:7,display:"inline-block"}}>
                                {entry.sp}
                              </div>
                              <p style={{color:C.white,fontSize:13,lineHeight:2.0,margin:"4px 0 0 0",paddingLeft:9,whiteSpace:"pre-wrap",letterSpacing:0.4,borderLeft:`1px solid ${C.border}`}}>
                                {entry.t}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
                </div>
              </div>
            </div>

            {/* フッター */}
            <div style={{padding:"9px 18px 12px",borderTop:`1px solid ${C.border}`,background:"rgba(5,13,20,0.97)",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
                {visitedSet.size} / {NOVEL_CHAPTERS.flatMap(c=>c.scenes).length} シーン解放済み
              </div>
              <button onClick={() => setOverlay(null)}
                style={{padding:"7px 22px",background:`${C.accent}1a`,border:`1px solid ${C.accent}`,color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,borderRadius:2}}
                onMouseEnter={e=>{e.currentTarget.style.background=`${C.accent}33`;}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${C.accent}1a`;}}
              >ゲームに戻る ▶</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
