import React, { useState, useEffect, useRef, useCallback,useMemo } from "react";

// @@SECTION_MAP ─────────────────────────────────────────────────────────────────
// arcadia_ch2_artifact.jsx  セクション行番号マップ（@@SECTIONアンカー対応）
// grep -n "@@SECTION" <ファイル> で最新行番号を即確認できる。
//
// 【コンポーネント外（グローバル定数）】
//   PALETTE            65      カラー定数 C
//   BATTLE_CONFIG      74     スキル定義 BATTLE_SKILLS / 敵定義 INITIAL_BATTLE_DEFS
//   ELEMENT_SYSTEM     277    属性定義 ELEMENT_NAMES / ELEMENT_SKILL_DEFS
//   UTILS              298    randInt / EXP_TABLE / ALL_CHAR_DEFS / buildPartyInit / BATTLE_PARTY_MAP
//   NOVEL_TEXTS        350    NOVEL_STATUS / novelUrl / NOVEL_FETCH_ERR
//   ASSETS             400    ASSET_STATUS / assetUrl / movieUrl / bgmUrl / seUrl
//   BGM_MAPS           521    PHASE_BGM / LOC_BGM / BATTLE_BGM / resolveBgmId
//   SPRITE_SIZE        657    SPRITE_SIZE / SPRITE_MAP / LOC_TO_SCENE_IMG
//   ENEMY_SIZE         699    ENEMY_IMG_SIZE / ENEMY_IMG_MAP / SIMULUU_IMG_URL / BATTLE_BG_MAP
//   BATTLE_BG_STYLE    766    BATTLE_BG_STYLE（敵タイプ → bg画像サイズ・位置）
//   SCENE_BG_STYLE     795    SCENE_BG_STYLE（loc → bg画像サイズ・位置）
//   SAVE_LOAD          893    セーブデータ構造定義（コンポーネント外）
//   SCENES_CH2         897    第二章全シナリオデータ SCENES[]
//
// 【コンポーネント内（ArcadiaCh2関数内）】
//   MAIN_COMPONENT     1421   ArcadiaCh2コンポーネント開始
//   STATE_ADVENTURE    1423   フェーズ・シーン・UI制御ステート
//   STATE_PLAYER       1456   HP/MP/ELK/LV/装備などプレイヤーステート
//   STATE_BATTLE       1472   バトル用ステート全般（multiEnemies / pendingCommands 等）
//   BGM_CONTROL        1589   BGM制御 ref / fadeOut / fadeIn / switchBgm / playFanfare
//   LOGIC_TYPEWRITER   1712   startType / showDl / BGM切り替えuseEffect群
//   LOGIC_DIALOG_TAP   1903   onTapDlg（ダイアログ進行・各種イベント処理）
//   LOGIC_CHOICE       1998   onChoice（選択肢分岐・購入・バトル突入）
//   LOGIC_BATTLE       2095   PARTY_DEFS / judgeRPS / ENEMY_ACTION_LABEL
//   LOGIC_SELECT_CMD   2127   onSelectCommand（コマンド登録・戦闘不能スキップ）
//   LOGIC_SELECT_TGT   2213   onSelectTarget（ターゲット確定・戦闘不能スキップ）
//   LOGIC_MULTI_TURN   2248   executeMultiTurn（複数敵ターン実行）
//   LOGIC_PARTY_TURN   2771   executePartyTurn（単体敵ターン実行）
//   LOGIC_PENDING_EXEC 3334   pendingExecution useEffect（クロージャ問題解決）
//   LOGIC_BATTLE_CMD   3348   onCancelCommand / exitBattle
//   RENDER_VICTORY     3443   勝利画面（BATTLE RESULT）
//   RENDER_LOAD        3587   セーブデータ読み込み画面（loadKeyframes含む）
//   LOGIC_SAVE_LOAD    3601   validateSave / applySaveData / handleFile
//   RENDER_LOADED      3693   セーブデータ確認画面
//   RENDER_TITLE       3734   タイトル画面
//   RENDER_SELECT      3771   バトル選択画面（デバッグ用）
//   RENDER_MOVIE       3914   オープニングムービー画面
//   RENDER_ENDING      3969   エンディング画面（セーブエクスポート含む）
//   RENDER_BATTLE      4071   バトル画面（マルチ敵・単体敵・コマンドUI）
//   RENDER_GAME        4761   ゲーム画面（HUD・スプライト・ダイアログ・P.BOOK・LvUP等）
//
// 【「どこに追加すればいい？」クイックリファレンス】
//   新しい敵・スキルを追加          → BATTLE_CONFIG (74)
//   属性スキルを追加                → ELEMENT_SYSTEM (277)
//   キャラ定義・パーティ構成変更    → UTILS (298) の ALL_CHAR_DEFS / BATTLE_PARTY_MAP
//   シーン背景・BGMのloc対応追加    → BGM_MAPS (521) / SCENE_BG_STYLE (795)
//   スプライト・敵画像を追加        → SPRITE_SIZE (657) / ENEMY_SIZE (699)
//   新シーンを追加                  → SCENES_CH2 (897)
//   ダイアログイベントを追加        → LOGIC_DIALOG_TAP (1903)
//   バトルコマンド処理を変更        → LOGIC_SELECT_CMD (2127)
//   複数敵ターン処理を変更          → LOGIC_MULTI_TURN (2248)
//   単体敵ターン処理を変更          → LOGIC_PARTY_TURN (2771)
//   バトル終了・報酬処理を変更      → LOGIC_BATTLE_CMD (3348) の exitBattle
//   バトルUIを変更                  → RENDER_BATTLE (4071)
//   ゲーム画面UIを変更              → RENDER_GAME (4761)
// ──────────────────────────────────────────────────────────────────────────────

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
  { id:"dodge",   label:"回避",      icon:"💨",  color:"#a78bfa", cost:8,  dmg:[12,20]  },
  { id:"heal",    label:"回復",      icon:"🧪",  color:"#f0c040", cost:0,  dmg:[0,0]   },
];

// ─── 敵定義 ─────────────────────────────────────────────────────────────
// ★ パターン変更は各エネミーの pattern:[...] だけ編集すればOK
// ★ unavoidableAtk:[min,max] はボス専用の回避不能ダメージ範囲
const INITIAL_BATTLE_DEFS = {

  seagull: {
    name:"カモメ型モンスター", em:"🦅",
    maxHp:55, atk:[8,14], elk:20, exp:15, lv:1, spd:14,pdef:0, mdef:0,
    bg:["#0a1628","#0d2a5e","#1a5fa0"], isFloating:true, isGround:false,
    pattern:["atk","dodge","atk","counter"],
  },

  shamerlot: {
    name:"シャメロット Lv.1", em:"🦀",
    maxHp:80, atk:[6,12], elk:30, exp:20, lv:1, spd:8,pdef:0, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["atk","atk","dodge","counter"],
  },

  shamerlot_lv3: {
    name:"シャメロット Lv.3", em:"🦀",
    maxHp:130, atk:[10,18], elk:50, exp:40, lv:3, spd:10,pdef:0, mdef:0,
    bg:["#0a1808","#1a2808","#301008"], isFloating:false, isGround:true,
    pattern:["counter","atk","dodge","atk","counter","dodge"],
  },

  shamerlot_lv5: {
    name:"シャメロット Lv.5", em:"🦀",
    maxHp:200, atk:[14,24], elk:80, exp:70, lv:5, spd:11,pdef:0, mdef:0,
    bg:["#0a1808","#1a2808","#301008"], isFloating:false, isGround:true,
    pattern:["counter","atk","atk","dodge","atk","counter","atk","dodge"],
    elementCycle:["ice"],
  },

  // ── 第二章 通常エネミー ────────────────────────────────────────────────────
  woopy: {
    name:"ウーピィ", em:"🐇",
    maxHp:50, atk:[5,9], elk:15, exp:18, lv:2, spd:16,pdef:0, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["dodge","atk","dodge","atk","counter"],
  },

  moocat: {
    name:"ムーキャット", em:"🐱",
    maxHp:99, atk:[23,30], elk:35, exp:30, lv:4, spd:17,pdef:0, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["unavoidable"],
    elementCycle:["thunder"],
    unavoidableAtk:[42,45],  // ← 追加
  },

  mandragora: {
    name:"マンドラゴラ", em:"🌿",
    maxHp:50, atk:[8,14], elk:57, exp:35, lv:4, spd:6,pdef:999, mdef:0,
    bg:["#0a1808","#184018","#203020"], isFloating:false, isGround:true,
    pattern:["atk","atk","counter","dodge","atk","counter"],
    elementCycle:["ice"],
  },

  cocatris: {
    name:"コカトリス", em:"🐔",
    maxHp:230, atk:[12,18], elk:45, exp:45, lv:5, spd:14,pdef:5, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["atk","counter","atk","dodge","atk","counter","atk"],
    unavoidableAtk:[18,26],
    elementCycle:["earth"],
  },

  // ── 月夜の舞闘祭：Strikerチーム 3体個別 ──────────────────────────────────
  // ドナテロ（槍使い・Lv18）
  pvp_donatello: {
    name:"ドナテロ", em:"🎭",
    maxHp:326, atk:[60,75], elk:0, exp:0, lv:18, spd:14,pdef:12, mdef:12,
    bg:["#0a1206","#1a2a0a","#100e04"], isBoss:false, isFloating:false, isGround:true,
    pattern:["atk","counter","atk","dodge","atk","counter","unavoidable","unavoidable","windmill","windmill","windmill"],
    unavoidableAtk:[90,100],
    elementCycle:["fire"],
  },
  // ケヴィン（魔法剣士・Lv8）
  pvp_kevin: {
    name:"ケヴィン", em:"🧔",
    maxHp:180, atk:[13,15], elk:0, exp:0, lv:8, spd:13,pdef:5, mdef:0,
    bg:["#0a1206","#1a2a0a","#100e04"], isBoss:false, isFloating:false, isGround:true,
    pattern:["atk","atk","counter","dodge","atk","counter","atk"],
    unavoidableAtk:[0,0],
    elementCycle:["earth"],
  },
  // チョッパー（短剣使い・Lv3）
  pvp_chopper: {
    name:"チョッパー", em:"👦",
    maxHp:100, atk:[8,9], elk:0, exp:0, lv:3, spd:16,pdef:8, mdef:0,
    bg:["#0a1206","#1a2a0a","#100e04"], isBoss:false, isFloating:false, isGround:true,
    pattern:["atk","dodge","atk","atk","counter","atk"],
    unavoidableAtk:[0,0],
    elementCycle:["fire"],
  },

   // ── アリエス・カルマとのコカトリス3体 ──────────────────────────────────
   cocatris_karma_a: {
    name:"コカトリス Lv.5", em:"🐔",
    maxHp:200, atk:[12,18], elk:45, exp:45, lv:5, spd:14,pdef:5, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["atk","counter","atk","dodge","atk","counter","atk"],
    unavoidableAtk:[18,26],
    elementCycle:["earth"],
  },
  cocatris_karma_b: {
    name:"コカトリス Lv.5", em:"🐔",
    maxHp:200, atk:[12,18], elk:45, exp:45, lv:5, spd:14,pdef:5, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["counter","atk","counter","dodge","atk","counter","counter"],
    unavoidableAtk:[18,26],
    elementCycle:["earth"],
  },
  cocatris_karma_c: {
    name:"コカトリス Lv.5", em:"🐔",
    maxHp:200, atk:[12,18], elk:45, exp:45, lv:5, spd:14,pdef:5, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["atk","atk","counter","dodge","atk","atk","counter"],
    unavoidableAtk:[18,26],
    elementCycle:["earth"],
  },
  // ── ポンキチ・ペルシアとのコカトリス3体 ──────────────────────────────────
  cocatris_ponki_a: {
    name:"コカトリス Lv.5", em:"🐔",
    maxHp:230, atk:[12,18], elk:45, exp:45, lv:5, spd:14,pdef:5, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["atk","counter","atk","dodge","atk","counter","dodge"],
    unavoidableAtk:[18,26],
    elementCycle:["earth"],
  },
  cocatris_ponki_b: {
    name:"コカトリス Lv.5", em:"🐔",
    maxHp:230, atk:[12,18], elk:45, exp:45, lv:5, spd:14,pdef:5, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["counter","atk","counter","dodge","atk","counter","dodge"],
    unavoidableAtk:[18,26],
    elementCycle:["earth"],
  },
  cocatris_ponki_c: {
    name:"コカトリス Lv.5", em:"🐔",
    maxHp:230, atk:[12,18], elk:45, exp:45, lv:5, spd:14,pdef:5, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["atk","atk","counter","dodge","atk","atk","unavoidable"],
    unavoidableAtk:[18,26],
    elementCycle:["earth"],
  },

  // ── オルガ：最終話手合わせ ────────────────────────────────────────────────
  olga: {
    name:"オルガ", em:"⚔️",
    maxHp:999, atk:[99,99], elk:0, exp:0, lv:23, spd:11,pdef:18, mdef:18,
    bg:["#0a1206","#1a2a0a","#100e04"], isBoss:true, isFloating:false, isGround:true,
    pattern:["counter","dodge","atk_all","atk","dodge","unavoidable","atk","reverse","takedown","unavoidable","elem_earth","unavoidable","atk_all","counter","dodge","elem_thunder",],
    unavoidableAtk:[99,99],
    elementCycle:["fire","ice","thunder","earth","none"],
  },
  olga_pet: {
    name:"傀儡駒", em:"🐱",
    maxHp:99, atk:[23,30], elk:0, exp:0, lv:1, spd:17,pdef:0, mdef:0,
    bg:["#0a1808","#184010","#283020"], isFloating:false, isGround:true,
    pattern:["unavoidable"],
    elementCycle:["thunder"],
    unavoidableAtk:[55,55],  // ← 追加
  },
};
// ── 武器別使用可能スキル定義（エルツ専用） ────────────────────────────────
const ELTZ_BASE_SKILLS = ["atk","counter","dodge","heal"];
const WEAPON_SKILL_MAP = {
  copper_dagger:       ["trick_attack"],
  copper_sword:        ["flat_strike"],
  copper_greatsword:   ["slow_blade"],
  copper_lance:        ["penetrate"],
  copper_axe:          ["spiral_axe"],
  copper_bow:          ["double_arrow"],
  baroque_knife:       ["double_bite","stinger_bite"],
  baroque_sword:       ["biker_slash","sansanka"],
  baroque_blade:       ["provoke","deep_edge"],
  baroque_lance:       ["seesaw","windmill"],
  baroque_axe:         ["onslaught","takedown"],
  baroque_bow:         ["straight_shot","arrow_rain"],
  fire_rod:            ["fireball"],
  water_rod:           ["water_sphere"],
  stone_rod:           ["stone_blitz"],
  air_rod:             ["air_cutter"],
  thunder_rod:         ["thunderbolt"],
  // 武器追加時はここにエントリを追加
};
// ── WEAPON_BASE_ATK ───────────────────────────────────────────────────────
const WEAPON_BASE_ATK = {
  dagger:     { mult: 0.85, label: "短剣" },
  sword:      { mult: 1.00, label: "剣" },
  greatsword: { mult: 1.30, label: "大剣" },
  spear:      { mult: 1.10, label: "長槍" },
  axe:        { mult: 1.40, label: "戦斧" },
  bow:        { mult: 1.00, label: "両手弓" },
  none:       { mult: 1.00, label: "素手" },
};

// ── SKILL_DEFS ────────────────────────────────────────────────────────────
// [フィールド説明]
//
// === フェーズ制御 ===
//   isPrephase  : bool   プリフェイズ（SPD計算前）に行動する
//   isEndphase  : bool   エンドフェイズ（全行動後）に行動する
//   ※ どちらもfalseならメインフェイズ（SPD順）
//
// === ダメージ ===
//   dmgType     : "physical"|"magic"|"fixed"
//   baseDmg     : [min, max]   1ヒットあたりの乱数基礎値
//   weaponMult  : bool         武器種補正を掛けるか
//   atkMult     : bool         使用者ATKボーナスを加算するか
//   dmgMult     : number       スキルダメージ係数
//   hits        : number       ヒット回数（0=ダメージなし）
//   target      : "single"|"all"
//   element     : null|"fire"|"ice"|"thunder"|"earth"
//   pierceCounter : bool       敵カウンターを貫通してダメージを通す
//   comboBonus  : number       行動不能状態の敵へのダメージ係数（1.0=無効果）
//
// === 回復 ===
//   healFlat    : number       固定HP回復量（対象: healTarget で指定）
//   healTarget  : "self"|"party"
//
// === 状態付与（敵） ===
//   enemyStun   : number       行動不能付与ターン数（0=なし）
//   enemyForceAction : null|"atk"|"dodge"
//                              敵の行動を強制変更（"atk"=挑発相当、"dodge"=逃げさせる）
//                              適用ターン数は enemyForceActionTurns で指定
//   enemyForceActionTurns : number
//
// === デバフ（敵） ===
//   enemyDebuff : {
//     target   : "single"|"all",
//     turns    : number,
//     patk     : number,   // 0=変化なし、0.5=半減、など係数で指定
//     pdef     : number,
//     matk     : number,
//     mdef     : number,
//     spd      : number,   // 絶対値で減算（例: -5）
//   } | null
//
// === バフ（味方） ===
//   selfBuff : {
//     target  : "self"|"party",
//     turns   : number,    // 0=永続
//     patk    : number,    // 加算値（永続バフ用）
//     pdef    : number,
//     matk    : number,
//     mdef    : number,
//     spd     : number,
//   } | null
//
// === その他 ===
//   enrageBreak : bool         怒り状態を解除する
//   cooldown    : number       使用後CDターン数

const SKILL_DEFS = {

  // ─── 基本スキル ──────────────────────────────────────────────────────────
  atk: {
    label:"強攻", icon:"⚔", color:"#00ffcc", cost:0, cooldown:0,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[14,23], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },
  counter: {
    label:"カウンター", icon:"🔄", color:"#f97316", cost:10, cooldown:0,
    isPrephase:true, isEndphase:false,   // プリフェイズ宣言
    dmgType:"physical", baseDmg:[16,20], weaponMult:true, atkMult:true, dmgMult:1.5,
    hits:1, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },
  dodge: {
    label:"回避", icon:"💨", color:"#a78bfa", cost:8, cooldown:0,
    isPrephase:true, isEndphase:false,   // プリフェイズ宣言
    dmgType:"physical", baseDmg:[16,20], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:1, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  // heal: endphase:false → メインフェイズ即時回復
  heal: {
    label:"回復", icon:"🧪", color:"#f0c040", cost:0, cooldown:0,
    isPrephase:false, isEndphase:false,
    dmgType:"fixed", baseDmg:[0,0], weaponMult:false, atkMult:false, dmgMult:0,
    hits:0, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:75, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  // overheal: heal + isEndphase:true + healTarget:"party" の組み合わせ
  overheal: {
    label:"オーバーヒール", icon:"💚", color:"#22c55e", cost:0, cooldown:2,
    isPrephase:false, isEndphase:true,   // ← エンドフェイズ
    dmgType:"fixed", baseDmg:[0,0], weaponMult:false, atkMult:false, dmgMult:0,
    hits:0, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:120, healTarget:"party",    // ← パーティ全体回復
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  // provoke: enemyForceAction:"atk" の組み合わせ
  provoke: {
    label:"挑発", icon:"👊", color:"#f97316", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"fixed", baseDmg:[0,0], weaponMult:false, atkMult:false, dmgMult:0,
    hits:0, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0,
    enemyForceAction:"atk", enemyForceActionTurns:3,  // ← 全敵を3T強攻固定
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  // takedown: enemyStun:1 の組み合わせ
  takedown: {
    label:"テイクダウン", icon:"🦵", color:"#ef4444", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[10,15], weaponMult:false, atkMult:false, dmgMult:0,
    hits:0, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:1, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  // sleep: enemyStun:2 の組み合わせ
  sleep: {
    label:"スリープ", icon:"😴", color:"#a78bfa", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"fixed", baseDmg:[0,0], weaponMult:false, atkMult:false, dmgMult:0,
    hits:0, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:2, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  elem_fire: {
    label:"火炎斬", icon:"🔥", color:"#ff6633", cost:20, cooldown:2,
    isPrephase:false, isEndphase:false,
    dmgType:"magic", baseDmg:[50,50], weaponMult:false, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:"fire", pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    // 敵ATK半減3ターン
    enemyDebuff:{ target:"single", turns:3, patk:0.5, pdef:1.0, matk:1.0, mdef:1.0, spd:0 },
    selfBuff:null,
    enrageBreak:false,
  },
  elem_ice: {
    label:"氷結斬", icon:"❄️", color:"#88ddff", cost:20, cooldown:2,
    isPrephase:false, isEndphase:false,
    dmgType:"magic", baseDmg:[50,50], weaponMult:false, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:"ice", pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:true,  // 怒り解除
  },
  elem_thunder: {
    label:"雷神斬", icon:"⚡", color:"#ffee44", cost:20, cooldown:2,
    isPrephase:false, isEndphase:false,
    dmgType:"magic", baseDmg:[50,50], weaponMult:false, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:"thunder", pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    // 味方全員SPD+3 を3ターン
    selfBuff:{ target:"party", turns:3, patk:0, pdef:0, matk:0, mdef:0, spd:3 },
    enrageBreak:false,
  },
  elem_earth: {
    label:"大地斬", icon:"🌿", color:"#66cc44", cost:20, cooldown:2,
    isPrephase:false, isEndphase:false,
    dmgType:"magic", baseDmg:[50,50], weaponMult:false, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:"earth", pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    // 敵SPD-5を1ターン
    enemyDebuff:{ target:"single", turns:1, patk:1.0, pdef:1.0, matk:1.0, mdef:1.0, spd:-5 },
    selfBuff:null,
    enrageBreak:false,
  },

   trick_attack: {
    label:"トリックアタック", icon:"⚔", color:"#c084fc", cost:12, cooldown:2,
    isPrephase:true, isEndphase:false,
    dmgType:"physical", baseDmg:[15,20], weaponMult:true, atkMult:true, dmgMult:1.2,
    hits:1, target:"single", element:null, pierceCounter:true, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:1, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },
  
  double_bite: {
    label:"ダブルバイト", icon:"⚔", color:"#c084fc", cost:12, cooldown:2,
    isPrephase:true, isEndphase:false,
    dmgType:"physical", baseDmg:[20,23], weaponMult:true, atkMult:true, dmgMult:1.2,
    hits:2, target:"single", element:null, pierceCounter:true, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },
  stinger_bite: {
    label:"スティンガーバイト", icon:"⚔", color:"#f43f5e", cost:0, cooldown:3,
    isPrephase:true, isEndphase:false,
    dmgType:"physical", baseDmg:[45,50], weaponMult:true, atkMult:false, dmgMult:1.0,
    hits:1, target:"single", element:null, pierceCounter:false,
    comboBonus:2.0,   // 行動不能の敵に×2
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  flat_strike: {
    label:"フラットストライク", icon:"⚔", color:"#94a3b8", cost:0, cooldown:1,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[18,24], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  biker_slash: {
    label:"バイカースラッシュ", icon:"⚔", color:"#facc15", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"fixed", baseDmg:[45,50], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    // 自身PATK永続+5（累積・最大+20は処理側でクランプ）
    selfBuff:{ target:"self", turns:0, patk:5, pdef:0, matk:0, mdef:0, spd:0 },
    enrageBreak:false,
  },
  sansanka: {
    label:"三散華", icon:"⚔", color:"#00ffcc", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[15,20], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:3, target:"single", element:null, pierceCounter:true, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  slow_blade: {
    label:"スローブレード", icon:"⚔", color:"#67e8f9", cost:0, cooldown:1,
    isPrephase:false, isEndphase:true,
    dmgType:"fixed", baseDmg:[0,0], weaponMult:false, atkMult:false, dmgMult:1.0,
    hits:0, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:2, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,selfBuff:null, enrageBreak:false,
  },

  deep_edge: {
    label:"ディープエッジ", icon:"⚔", color:"#f472b6", cost:0, cooldown:4,
    isPrephase:false, isEndphase:true,
    dmgType:"fixed", baseDmg:[55,60], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  penetrate: {
    label:"ペネトレイト", icon:"⚔", color:"#c084fc", cost:0, cooldown:2,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[20,24], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:null, pierceCounter:true, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  seesaw: {
    label:"シーソー", icon:"⚔", color:"#86efac", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[36,40], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:60, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  windmill: {
    label:"風車", icon:"⚔", color:"#d4d4d8", cost:0, cooldown:4,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[18,23], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:3, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  spiral_axe: {
    label:"スパイラルアックス", icon:"⚔", color:"#fb923c", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[25,30], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  onslaught: {
    label:"オンスロート", icon:"⚔", color:"#f87171", cost:0, cooldown:4,
    isPrephase:false, isEndphase:true,
    dmgType:"physical", baseDmg:[30,36], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:2, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  double_arrow: {
    label:"ダブルアロー", icon:"⚔", color:"#7dd3fc", cost:0, cooldown:2,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[15,18], weaponMult:true, atkMult:false, dmgMult:1.0,
    hits:2, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  straight_shot: {
    label:"ストレートショット", icon:"⚔", color:"#38bdf8", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[48,51], weaponMult:true, atkMult:false, dmgMult:1.0,
    hits:1, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:2, enemyForceAction:null, enemyForceActionTurns:0,  // 2T行動不能付与
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  arrow_rain: {
    label:"アローレイン", icon:"⚔", color:"#a3e635", cost:0, cooldown:0,
    isPrephase:true, isEndphase:false,
    dmgType:"physical", baseDmg:[18,24], weaponMult:true, atkMult:false, dmgMult:1.0,
    hits:3, target:"all", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
  },

  triple_arrow: {
    label:"トリプルアロー", icon:"⚔", color:"#38bdf8", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[18,25], weaponMult:true, atkMult:false, dmgMult:1.0,
    hits:3, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  fireball: {
    label:"ファイアボール", icon:"🔥", color:"#f97316", cost:18, cooldown:2,
    isPrephase:false, isEndphase:false,
    dmgType:"magic", baseDmg:[50,55], weaponMult:false, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:"fire", pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  water_sphere: {
    label:"ウォータースフィア", icon:"🌊", color:"#22d3ee", cost:0, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"magic", baseDmg:[48,50], weaponMult:false, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:"ice", pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    // 敵ATKを0.5倍に3ターン（水濡れ状態）
    enemyDebuff:{ target:"single", turns:3, patk:0.5, pdef:1.0, matk:0.5, mdef:1.0, spd:0 },
    selfBuff:null,
    enrageBreak:false,
  },

  thunderbolt: {
    label:"サンダーボルト", icon:"⚡", color:"#fde047", cost:22, cooldown:3,
    isPrephase:false, isEndphase:false,
    dmgType:"magic", baseDmg:[36,40], weaponMult:false, atkMult:true, dmgMult:1.0,
    hits:1, target:"all", element:"thunder", pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },
  
  stone_blitz: {
    label:"ストーンブリッツ", icon:"🌿", color:"#a8a29e", cost:0, cooldown:2,
    isPrephase:false, isEndphase:true,
    dmgType:"physical", baseDmg:[60,72], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:1, target:"single", element:"earth", pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },

  air_cutter: {
    label:"エアカッター", icon:"🪄", color:"#bae6fd", cost:8, cooldown:2,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[16,17], weaponMult:true, atkMult:true, dmgMult:1.0,
    hits:3, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null, selfBuff:null, enrageBreak:false,
  },
  reverse: {
    label:"リバース", icon:"🔃", color:"#c084fc", cost:0, cooldown:0,
    isPrephase:false, isEndphase:false,
    dmgType:"physical", baseDmg:[0,0], weaponMult:false, atkMult:false, dmgMult:0,
    hits:0, target:"single", element:null, pierceCounter:false, comboBonus:1.0,
    healFlat:0, healTarget:"self",
    enemyStun:0, enemyForceAction:null, enemyForceActionTurns:0,
    enemyDebuff:null,
    selfBuff:null,
    enrageBreak:false,
    reversePhase:5,  // 継続ターン数（変更したい場合はここを編集）
  },
};


// ── resolveSkillDamage: 1ターン総ダメージ計算 ─────────────────────────────
// 戻り値: { perHit, totalDmg }
// 修正後（baseもhits分割する）
function resolveSkillDamage({ skillId, atkBonus=0, weaponType="none",
    comboMult=1.0, targetDef=0, targetMagDef=0, isStunned=false }) {
  const sk = SKILL_DEFS[skillId];
  if (!sk || sk.hits === 0) return { perHit:0, totalDmg:0 };

  const wMult     = sk.weaponMult ? (WEAPON_BASE_ATK[weaponType]?.mult ?? 1.0) : 1.0;
  const atk       = sk.atkMult ? atkBonus : 0;
  const baseFull  = randInt(sk.baseDmg[0], sk.baseDmg[1]);
  // 1ヒットあたりのベースダメージ（hits分割）
  const basePerHit  = sk.hits > 1 ? baseFull / sk.hits : baseFull;
  const atkPerHit   = sk.hits > 1 ? atk / sk.hits : atk;
  const def    = sk.dmgType === "physical" ? targetDef
               : sk.dmgType === "magic"    ? targetMagDef
               : 0;
  const cBonus = isStunned ? sk.comboBonus : 1.0;
  // 1ヒットごとにDEFを適用してからhits倍
  const rawPerHit = Math.max(1, Math.round((basePerHit + atkPerHit) * wMult * sk.dmgMult * comboMult));
  const perHit    = Math.max(1, Math.round(rawPerHit * cBonus) - def);
  const totalDmg  = perHit * sk.hits;
  return { perHit, totalDmg };
}

// resolveSkillDamage の直後に追加
function resolveAoeDamage({ skillId, atkBonus, weaponType, comboMult, isStunned, enemies }) {
  // enemies: [{ def: { pdef, mdef }, ... }] の配列
  // 戻り値: [{ perHit, totalDmg }] 各敵のダメージ配列
  return enemies.map(e => resolveSkillDamage({
    skillId, atkBonus, weaponType, comboMult,
    targetDef:    e.def?.pdef ?? 0,
    targetMagDef: e.def?.mdef ?? 0,
    isStunned,
  }));
}

// ── applySkillSideEffects: バフ/デバフ/スタン等の副作用を状態に反映 ────────
// ターン実行後のアップデートフェイズで呼び出す。
// skillsUsedThisTurn: Set<skillId>
// 戻り値: 次ターン用ステート群（setXxx の呼び出しは呼び出し元で行う）
function applySkillSideEffects({
  skillsUsedThisTurn,
  // 現在のデバフ/バフステート
  enemySpdDebuff, enemyAtkDebuff, partySpdBuff,
  provokeActive,
  takedownActive,
  sleepActive,
  straightShotActive = 0,   // ← 追加
  slowbladeActive = 0,
  waterSphereActive = 0,
  reverseActive = 0,   // ← 追加
  bikerAtkBonus,
  enrageCount,
  // CDマップ（key → 現在CD値）
  cdMap,
}) {
  const next = {
    enemySpdDebuff:   Math.max(0, enemySpdDebuff  - 1),
    enemyAtkDebuff:   Math.max(0, enemyAtkDebuff  - 1),
    partySpdBuff:     Math.max(0, partySpdBuff    - 1),
    provokeActive:    Math.max(0, provokeActive   - 1),
    takedownActive:   Math.max(0, takedownActive  - 1),
    sleepActive:      Math.max(0, sleepActive     - 1),
    straightShotActive:  Math.max(0, straightShotActive - 1),   // ← 追加
    slowbladeActive:  Math.max(0, slowbladeActive - 1),   // ← 追加
    waterSphereActive: Math.max(0, (typeof waterSphereActive !== "undefined" ? waterSphereActive : 0) - 1),
    bikerAtkBonus,
    enrageCount:      Math.max(0, enrageCount     - 1),
    reverseActive:    Math.max(0, reverseActive - 1),   // ← 追加
    nextCdMap: Object.fromEntries(
      Object.entries(cdMap).map(([skillId, memberVals]) => [
        skillId,
        Object.fromEntries(
          Object.entries(memberVals).map(([mid, val]) => [mid, Math.max(0, val - 1)])
        )
      ])
    ),
  };

  for (const skillId of skillsUsedThisTurn.keys()) {
    const sk = SKILL_DEFS[skillId];
    if (!sk) continue;
    const cd = sk.cooldown;

    // CD更新
    // elem_ の分岐を削除し、すべて同じ処理に統合
    if (cd > 0) {
      const usedByMemberId = skillsUsedThisTurn.get(skillId); // Mapから使用者を取得
      if (usedByMemberId) {
        if (!next.nextCdMap[skillId]) next.nextCdMap[skillId] = {};
        next.nextCdMap[skillId][usedByMemberId] = cd; // そのメンバーだけにCDをセット
      }
    }

    // 敵デバフ
    if (sk.enemyDebuff) {
      const d = sk.enemyDebuff;
      if (d.spd < 0)      next.enemySpdDebuff  = d.turns;
      if (d.patk < 1.0)   next.enemyAtkDebuff  = d.turns;
      // water_sphere専用：水濡れ状態をwaterSphereActiveで追跡
      if (skillId === "water_sphere") next.waterSphereActive = d.turns;
    }

    // 味方バフ
    if (sk.selfBuff) {
      const b = sk.selfBuff;
      if (b.spd > 0)      next.partySpdBuff    = b.turns;
      if (b.patk > 0 && b.turns === 0) {
        // 永続ATKバフ（bikerSlash）: 最大20でクランプ
        next.bikerAtkBonus = Math.min(bikerAtkBonus + b.patk, 20);
      }
    }

    // ── 変更後（provoke/takedown/sleep/overheal のCD更新も nextCdMap へ）──
      // enemyForceAction
      if (sk.enemyForceAction === "atk") {
        next.provokeActive = sk.enemyForceActionTurns;
        // CDはnextCdMapに統合済み（cd > 0 の else if ブロックで処理される）
      }

      // enemyStun
      if (sk.enemyStun > 0) {
        if (skillId === "takedown") {
          next.takedownActive = sk.enemyStun - 1;
        } else if (skillId === "straight_shot") {
          next.straightShotActive = sk.enemyStun - 1;
        } else if (skillId === "straight_shot") {
          next.slowbladeActive = sk.enemyStun - 1;
        } else {
          next.sleepActive = sk.enemyStun - 1;
        }
      }
      // reversePhase
      if (sk.reversePhase > 0) {
        next.reverseActive = sk.reversePhase - 1; // 使用ターンを1T消費済みとして扱う
      }
      // overheal: CDはnextCdMapに統合済み（追加処理不要）

      // enrageBreak
      if (sk.enrageBreak) {
        next.enrageCount = 0;
      }
  }

  return next;
}
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
  { id:"elem_fire",    label:"火炎斬", icon:"🔥", color:"#ff6633", cost:20, cooldown:2, dmg:[50,50], targetElement:"ice",     desc:"氷属性の敵に有効" },
  { id:"elem_ice",     label:"氷結斬", icon:"❄️", color:"#88ddff", cost:20, cooldown:2, dmg:[50,50], targetElement:"thunder", desc:"雷属性の敵に有効" },
  { id:"elem_thunder", label:"雷神斬", icon:"⚡", color:"#ffee44", cost:20, cooldown:2, dmg:[50,50], targetElement:"earth",   desc:"地属性の敵に有効" },
  { id:"elem_earth",   label:"大地斬", icon:"🌿", color:"#66cc44", cost:20, cooldown:2, dmg:[50,50], targetElement:"fire",    desc:"炎属性の敵に有効" },
];

// 属性破壊発動に必要な累積ダメージ閾値
const ELEMENT_BREAK_THRESHOLD = 50;
// 属性相性テーブル：スキル属性 → { weak: 弱点, resist: 半減 }
// ※ 弱点でも半減でもない属性は等倍（×1.0）
const ELEMENT_RELATIONS = {
  fire:    { weak: "ice",     resist: "earth"   },
  ice:     { weak: "thunder", resist: "fire"    },
  thunder: { weak: "earth",   resist: "ice"     },
  earth:   { weak: "fire",    resist: "thunder" },
};

// @@SECTION:UTILS
const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const EXP_TABLE = [0,30,80,160,280,450,700];

// ── 全キャラクター定義 ────────────────────────────────────────────────────────
const ALL_CHAR_DEFS = {
  eltz:    { id:"eltz",    name:"エルツ",    icon:"\u{1F9D1}",                     spd:12, mhp:100, mmp:80,  atk:0,  def:0,  
      skills:[
        // 基本
        "atk","counter","dodge","heal",
        // 既存
        "biker_slash","sansanka","provoke","takedown","overheal","sleep",
        "stinger_bite","straight_shot","arrow_rain","water_sphere",
        // 新規追加（WEAPON_SKILL_MAPの全スキル）
        "trick_attack","flat_strike","slow_blade","penetrate","spiral_axe","double_arrow",
        "double_bite","deep_edge","seesaw","windmill","onslaught",
        "fireball","stone_blitz","air_cutter","thunderbolt"
      ]
     },
  swift:   { id:"swift",   name:"スウィフト", icon:"\u{1F9D1}\u200D\u{1F9B1}",     spd:18, mhp:125, mmp:105,  atk:15,  def:10,  skills:["atk","counter","dodge","heal","takedown","windmill","elem_fire","slow_blade"] },
  linz:    { id:"linz",    name:"リンス",    icon:"\u{1F469}",                     spd:11, mhp:122, mmp:100,  atk:10,  def:10,  skills:["atk","counter","dodge","heal","overheal","trick_attack","arrow_rain"] },
  chopper: { id:"chopper", name:"チョッパー", icon:"\u{1F466}",                     spd:9,  mhp:110,  mmp:90,  atk:5,  def:8,  skills:["atk","counter","dodge","heal","elem_fire","elem_earth"] },
  aries:   { id:"aries",   name:"アリエス",  icon:"\u{1F30A}",                     spd:13, mhp:125, mmp:105,  atk:10,  def:10,  skills:["atk","counter","dodge","heal","water_sphere"] },
  karma:   { id:"karma",   name:"カルマ",    icon:"\u{1F61C}",                     spd:16, mhp:115, mmp:95,  atk:0,  def:0,  skills:["atk","counter","dodge","heal","provoke"] },
  frank:   { id:"frank",   name:"フランク",  icon:"\u{1F917}",                     spd:10, mhp:240, mmp:180,  atk:30,  def:36, skills:["atk","counter","dodge","heal","provoke","takedown"] },
  will:    { id:"will",    name:"ウィル",    icon:"\u{1F624}",                     spd:18, mhp:99,  mmp:88,  atk:10,  def:5,  skills:["atk","counter","dodge","heal","elem_thunder","elem_earth"] },
  ponkiti: { id:"ponkiti", name:"ポンキチ",  icon:"\u{1F929}",                     spd:17, mhp:135, mmp:95,  atk:16,  def:3,  skills:["atk","counter","dodge","heal","stinger_bite"] },
  persia:  { id:"persia",  name:"ペルシア",  icon:"\u{1F338}",                     spd:14, mhp:130, mmp:100,  atk:16,  def:5,  skills:["atk","counter","dodge","heal","straight_shot","arrow_rain"] },
};

// ── パーティ初期値ビルダー（コンポーネント外 - バトル突入処理から呼び出せるよう外出し）──
function buildPartyInit(keys) {
  const hp = {}; const mhp = {}; const mp = {}; const mmp = {};
  keys.filter(k => k !== "eltz").forEach(k => {
    const c = ALL_CHAR_DEFS[k];
    if (!c) return;
    hp[k] = c.mhp; mhp[k] = c.mhp; mp[k] = c.mmp; mmp[k] = c.mmp;
  });
  return { hp, mhp, mp, mmp };
}

// ── バトルタイプ → パーティ構成マップ ────────────────────────────────────────
const DEFAULT_PARTY_KEYS = ["eltz","swift","linz","chopper"];

const BATTLE_PARTY_MAP = {
  woopy:            ["eltz","swift","linz"],
  moocat:           ["eltz","swift","linz"],
  mandragora:       ["eltz","swift","linz"],
  cocatris:         ["eltz","aries","karma"],
  cocatris_karma_a: ["eltz","aries","karma"],
  cocatris_karma_b: ["eltz","aries","karma"],
  cocatris_karma_c: ["eltz","aries","karma"],
  cocatris_ponki_a: ["eltz","ponkiti","persia"],
  cocatris_ponki_b: ["eltz","ponkiti","persia"],
  cocatris_ponki_c: ["eltz","ponkiti","persia"],
  // 舞闘祭：pvp_donatello をキーにフランク・ウィルとパーティ
  pvp_donatello:    ["eltz","frank","will"],
  pvp_kevin:        ["eltz","frank","will"],
  pvp_chopper:      ["eltz","frank","will"],
  olga:             ["eltz","swift","linz"],
  olga_pet:         ["eltz","swift","linz"],
};


// @@SECTION:NOVEL_TEXTS
const NOVEL_BASE_URL = "https://superapolon.github.io/Arcadia_Assets/novels/ch2/";
// true = アップロード済み → テキストファイルを取得する
// false = 未アップロード → LOGタブのみ表示
const NOVEL_STATUS = {
   0: true,  // s00 スティアルーフ 港
   1: true,  // s01 繁華街
   2: true,  // s02 コミュニティセンター
   3: true,  // s03 中央広場（ホームポイント設定）
   4: true,  // s04 武器防具屋
   5: true,  // s05 レストランDIFORE
   6: true,  // s06 魔法店LUNALEE
   7: true,  // s07 B&B宿屋
   8: true,  // s08 コミュニティルーム（メール・舞闘祭前）
   9: true,  // s09 中央広場（舞闘祭・第一試合）
  10: true,  // s10 中央広場（舞闘祭・混戦）
  11: true,  // s11 コミュニティルーム（舞闘祭後）
  12: true,  // s12 西門（チョッパー別行動）
  13: true,  // s13 エイビス平原 西（ムーキャット初戦）
  14: true,  // s14 エイビス平原 西（ムーキャット苦戦）
  15: true,  // s15 エイビス平原 西（ムーキャット狩り継続）
  16: true,  // s16 エイビス平原 東（マンドラゴラ探索）
  17: true,  // s17 エイビス平原 東（マンドラゴラ初戦）
  18: true,  // s18 コミュニティルーム（オルガ登場）
  19: true,  // s19 コミュニティルーム（仲間集合）
  20: true,  // s20 エイビス平原 東（ソロ狩り開始）
  21: true,  // s21 エイビス平原 東（ソロ狩り中盤）
  22: true,  // s22 エイビス平原 西（Lv5到達）
  23: true,  // s23 スティアルーフ ギルド（依頼受付）
  24: true,  // s24 エイビス平原 西（アリエスと合流・カルマ）
  25: true,  // s25 エイビス平原 西（カルマ去る・WA習得）
  26: true,  // s26 エイビス平原 東（コカトリス狩り）
  27: true,  // s27 中央広場 屋台市（ウーピィ青年と邂逅）
  28: true,  // s28 コミュニティルーム（WA狩り向上）
  29: true,  // s29 中央広場（翌朝・新展開）
  30: true,  // s30 コミュニティルーム（夕方・一同集合）
  31: true,  // s31 エイビス平原 西（ペルシア・ポン吉パーティ）
  32: true,  // s32 エイビス平原 西（三人狩り・高揚感）
  33: true,  // s33 コミュニティルーム（夕方・オルガ）
  34: true,  // s34 中央広場 屋台市（スウィフト再合流）
  35: true,  // s35 コミュニティルーム（送別会準備）
  36: true,  // s36 中央広場（送別会・エンディング）
};
// true のシーンのみ novels/s{nn}.txt を取得する
function novelUrl(i) {
  return NOVEL_STATUS[i] ? `${NOVEL_BASE_URL}s${String(i).padStart(2,"0")}.txt` : null;
}
// fetchエラー識別用センチネル（nullと区別するため）
const NOVEL_FETCH_ERR = "NOVEL_FETCH_ERR";

// @@SECTION:ASSETS
const BASE_URL = "https://superapolon.github.io/Arcadia_Assets/";

const SHOP_DATA_URL =
  "https://raw.githubusercontent.com/superapolon/Arcadia_Assets/main/shop/shopData.json";

const ASSET_STATUS = {
  "title/title_bg":          true,
  "title/title_bg_ch2":      true,
  "movies/ch01_opening":     true,   // ✅ 確認済み 2026-03-05
  "movies/ch02_opening":     false,  // 第二章オープニング（アップロード後 true に変更）
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
  "enemies/shamelot":        true,
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
  // ── 第二章 新シーン背景 ─────────────────────────────────────────────────
  "scenes/ch2_s01_stiarroof_port":         true,   // スティアルーフ 港
  "scenes/ch2_s02_stiarroof_arcade":       true,   // スティアルーフ 繁華街
  "scenes/ch2_s03_central_square":       true,   // スティアルーフ 中央広場
  "scenes/ch2_s04_community_center":    true,   // コミュニティセンター
  "scenes/ch2_s05_wg_room":      true,   // WHITEGARDENルーム
  "scenes/ch2_s06_diflore":      true,   // レストランDIFORE
  "scenes/ch2_s07_lunalee":      true,   // 魔法店LUNALEE
  "scenes/ch2_s08_bb_inn":       true,   // B&B宿屋
  "scenes/ch2_s09_guild_lexia":  true,   // レクシアギルド
  "scenes/ch2_s10_west_gate":    true,   // 白亜の門（西門）
  "scenes/ch2_s11_eivis_plains": true,   // エイビス平原（西）
  "scenes/ch2_s12_eivis_forest": true,   // エイビス平原（東・森）
  "scenes/ch2_armory":       true,   // スティアルーフ 武器防具屋
  "scenes/ch2_foodcourt":       true,   // 中央広場屋台市
  // ── 第二章 新エネミー画像 ──────────────────────────────────────────────────
  "enemies/woopy":           false,
  "enemies/moocat":          true,
  "enemies/mandragora":      true,
  "enemies/cocatris":        true,
  "enemies/olga":            true,
  "enemies/donatello":       true,
  "enemies/kevin":           true,
  "enemies/chopper":         true,
  // ── 第二章 新スプライト ────────────────────────────────────────────────────
  "sprites/kevin":           true,
  "sprites/donatello":       true,
  "sprites/sneepi":          true,
  "sprites/frank":           true,
  "sprites/liebert":         true,
  "sprites/olga":            true,
  "sprites/aries":           true,
  "sprites/persia":          true,
  "sprites/ponkiti":         true,
  "sprites/will":            true,
  "sprites/shuraku":         true,
  "sprites/karma":           true,
  "sprites/toma":            true,
  // ── 第二章 新BGM ───────────────────────────────────────────────────────────
  "bgm/stiaroof":            true,   // 都市・街BGM
  "bgm/guild":               true,   // ギルド
  "bgm/eibisplain":          true,   // エイビス平原
  "bgm/battle_normal2":      true,   // PvP用BGM
  "bgm/battle_boss2":        true,   // PvP用BGM
  // ── SE (ヒット効果音) ── false のときはプログラム合成にフォールバック ──────
  "se/hit":                  true,  // 通常斬撃音（アップロード後 true に変更）
  "se/weak_hit":             true,  // 弱点ヒット音（アップロード後 true に変更）
  "se/defeat":               true,  // 討伐音（アップロード後 true に変更）
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

// SE URL解決ヘルパー -- 拡張子は .mp3 固定
// ASSET_STATUS[key] が false のときは null を返し、プログラム合成にフォールバックする
function seUrl(key) {
  return ASSET_STATUS[key] ? `${BASE_URL}${key}.mp3` : null;
}

// @@SECTION:BGM_MAPS ──────────────────────────────────────────────────────────
// BGM割り当てマップ（フェーズ・シーンloc・バトル敵タイプ → bgmId）
// 同一bgmIdが連続する場合はBGMを継続再生（切り替えなし）
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
  // ── 第二章 ────────────────────────────────────────────────────────────────
  "スティアルーフ 港":                  "bgm/stiaroof",
  "スティアルーフ 繁華街":              "bgm/stiaroof",
  "スティアルーフ 中央広場":            "bgm/stiaroof",
  "スティアルーフ コミュニティセンター": "bgm/stiaroof",
  "スティアルーフ コミュニティルーム":   "bgm/guild",
  "スティアルーフ 繁華街 武器防具屋":   "bgm/night",
  "スティアルーフ レストランDIFORE":    "bgm/night",
  "スティアルーフ 魔法店LUNALEE":       "bgm/night",
  "スティアルーフ B&B宿屋":            "bgm/night",
  "スティアルーフ 西門":               "bgm/eibisplain",
  "エイビス平原 西":                   "bgm/eibisplain",
  "エイビス平原 東":                   "bgm/eibisplain",
  "スティアルーフ ギルド":             "bgm/guild",
  "スティアルーフ 中央広場 屋台市":    "bgm/night",
};

const BATTLE_BGM = {
  seagull:       "bgm/battle_normal",
  koza:          "bgm/battle_normal",
  shamerlot:     "bgm/battle_normal",
  shamerlot_lv3: "bgm/battle_normal",
  shamerlot_lv5: "bgm/battle_normal",
  simuluu:       "bgm/battle_boss",
  // ── 第二章 ────────────────────────────────────────────────────────────────
  woopy:         "bgm/battle_normal",
  moocat:        "bgm/battle_normal",
  mandragora:    "bgm/battle_normal",
  cocatris:      "bgm/battle_normal",
  cocatris_karma_a:    "bgm/battle_normal2",
  cocatris_karma_b:    "bgm/battle_normal2",
  cocatris_karma_c:    "bgm/battle_normal2",
  cocatris_ponki_a:    "bgm/battle_normal2",
  cocatris_ponki_b:    "bgm/battle_normal2",
  cocatris_ponki_c:    "bgm/battle_normal2",
  pvp_donatello:       "bgm/battle_normal2",
  pvp_kevin:           "bgm/battle_normal2",
  pvp_chopper:         "bgm/battle_normal2",
  olga:                "bgm/battle_boss2",
  olga_pet:            "bgm/battle_boss2",
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
  shamerlot:     "enemies/shamelot",
  shamerlot_lv3: "enemies/shamelot",
  shamerlot_lv5: "enemies/shamelot",
  // ── 第二章 ────────────────────────────────────────────────────────────────
  woopy:         "enemies/woopy",
  moocat:        "enemies/moocat",
  mandragora:    "enemies/mandragora",
  cocatris:           "enemies/cocatris",
  cocatris_karma_a:    "enemies/cocatris",
  cocatris_karma_b:    "enemies/cocatris",
  cocatris_karma_c:    "enemies/cocatris",
  cocatris_ponki_a:    "enemies/cocatris",
  cocatris_ponki_b:    "enemies/cocatris",
  cocatris_ponki_c:    "enemies/cocatris",
  pvp_donatello:       "enemies/donatello",  // 絵文字フォールバック可
  pvp_kevin:           "enemies/kevin",
  pvp_chopper:         "enemies/chopper",
  olga:                "enemies/olga",
  olga_pet:            "enemies/moocat",
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
  // ── 第二章新キャラ ────────────────────────────────────────────────────────
  "🧔":     "sprites/kevin",       // ケヴィン
  "🎭":     "sprites/donatello",   // ドナテロ
  "🧙":     "sprites/sneepi",      // スニーピィ
  "🤗":     "sprites/frank",       // フランク
  "🏹":     "sprites/liebert",     // リーベルト
  "⚔️":     "sprites/olga",        // オルガ
  "🌊":     "sprites/aries",       // アリエス
  "🌸":     "sprites/persia",      // ペルシア
  "🤩":     "sprites/ponkiti",     // ポンキチ
  "🤫":     "sprites/toma",        // トマ
  "😤":     "sprites/will",        // ウィル
  "😄":     "sprites/shuraku",     // シュラク
  "😜":     "sprites/karma",       // カルマ
};

// @@SECTION:SPRITE_SIZE ────────────────────────────────────────────────────
// スプライトごとの表示サイズ個別設定。変更したいときはここだけ編集する。
//
// scale:        通常表示時の比率（1.00 = 基準身長）。30vh をベースに乗算される。
// heroScale:    index=0（主人公）として表示されるときの比率
// offsetY:      下端からの垂直オフセット（px）。正値で上に、負値で下にずらす
// fallbackSize: 画像なしの場合の絵文字フォントサイズ（px）
//
// ★ 実際のmaxHeightは calcSpriteMaxH(scale, count) で算出（30vh × scale × 人数補正）
// ★ heightは固定せず、画像の実縦横比に従って表示 → キャラ間の身長差が自然に出る
const SPRITE_SIZE = {
  "🧑":           { scale: 1.00, heroScale: 1.00, offsetY:  0, fallbackSize: 52 }, // eltz
  "🧑‍🦱":           { scale: 0.92, heroScale: 0.92, offsetY:  0, fallbackSize: 48 }, // swift
  "👩":           { scale: 0.92, heroScale: 0.92, offsetY:  0, fallbackSize: 48 }, // linz
  "👦":           { scale: 0.75, heroScale: 0.75, offsetY:  0, fallbackSize: 40 }, // chopper
  "🐰":           { scale: 0.54, heroScale: 0.54, offsetY:  0, fallbackSize: 40 }, // cricket
  "🙍":           { scale: 0.85, heroScale: 0.85, offsetY:  0, fallbackSize: 48 }, // koza
  "👩‍🦰":           { scale: 0.97, heroScale: 0.97, offsetY:  0, fallbackSize: 50 }, // rose
  "👨":           { scale: 0.92, heroScale: 0.92, offsetY:  0, fallbackSize: 50 }, // juda
  "👧":           { scale: 0.77, heroScale: 0.77, offsetY:  0, fallbackSize: 50 }, // ymir
  "🤓":           { scale: 0.75, heroScale: 0.75, offsetY:  0, fallbackSize: 48 }, // rubens
  "👤":           { scale: 0.83, heroScale: 0.83, offsetY:  0, fallbackSize: 50 }, // traveler
  "👵":           { scale: 0.79, heroScale: 0.79, offsetY:  0, fallbackSize: 50 }, // old_woman
  "🧓":           { scale: 0.83, heroScale: 0.83, offsetY:  0, fallbackSize: 50 }, // shopkeeper
  // ── 第二章新キャラ ────────────────────────────────────────────────────────
  "🧔":           { scale: 1.10, heroScale: 1.10, offsetY:  0, fallbackSize: 50 }, // kevin
  "🎭":           { scale: 1.12, heroScale: 1.12, offsetY:  0, fallbackSize: 50 }, // donatello
  "🧙":           { scale: 1.00, heroScale: 1.00, offsetY:  0, fallbackSize: 48 }, // sneepi
  "🤗":           { scale: 1.08, heroScale: 1.08, offsetY:  0, fallbackSize: 50 }, // frank
  "🏹":           { scale: 1.08, heroScale: 1.08, offsetY:  0, fallbackSize: 50 }, // liebert
  "⚔️":           { scale: 1.13, heroScale: 1.13, offsetY:  0, fallbackSize: 52 }, // olga
  "🌊":           { scale: 1.01, heroScale: 1.01, offsetY:  0, fallbackSize: 50 }, // aries
  "😜":           { scale: 0.99, heroScale: 0.99, offsetY:  0, fallbackSize: 50 }, // karma
  "🌸":           { scale: 0.94, heroScale: 0.94, offsetY:  0, fallbackSize: 50 }, // persia
  "🤫":           { scale: 1.04, heroScale: 1.04, offsetY:  0, fallbackSize: 50 }, // toma
  "🤩":           { scale: 0.95, heroScale: 0.95, offsetY:  0, fallbackSize: 50 }, // ponkiti
  "😤":           { scale: 0.75, heroScale: 0.75, offsetY:  0, fallbackSize: 42 }, // will
  "😄":           { scale: 0.75, heroScale: 0.75, offsetY:  0, fallbackSize: 42 }, // shuraku
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
  // ── 第二章 ────────────────────────────────────────────────────────────────
  woopy:         { mode:"fixed", size: 180 },
  moocat:        { mode:"fixed", size: 220 },
  mandragora:    { mode:"fixed", size: 220 },
  cocatris:      { mode:"fixed", size: 360 },
  cocatris_karma_a:    { mode:"fixed", size: 330 },
  cocatris_karma_b:    { mode:"fixed", size: 360 },
  cocatris_karma_c:    { mode:"fixed", size: 345 },
  cocatris_ponki_a:    { mode:"fixed", size: 330 },
  cocatris_ponki_b:    { mode:"fixed", size: 360 },
  cocatris_ponki_c:    { mode:"fixed", size: 345 },
  pvp_donatello:       { mode:"fixed", size: 480 },
  pvp_kevin:           { mode:"fixed", size: 450 },
  pvp_chopper:         { mode:"fixed", size: 320 },
  olga:                { mode:"fixed", size: 380 },
  olga_pet:            { mode:"fixed", size: 220 },
};

const BATTLE_BG_MAP = {
  seagull:       "scenes/s01_beach",
  shamerlot:     "scenes/s14_rocks",
  shamerlot_lv3: "scenes/s26_cave_blue",
  shamerlot_lv5: "scenes/s27_cave_deep",
  // ── 第二章 ────────────────────────────────────────────────────────────────
  woopy:         "scenes/ch2_s11_eivis_plains",
  moocat:        "scenes/ch2_s11_eivis_plains",
  mandragora:    "scenes/ch2_s12_eivis_forest",
  cocatris:           "scenes/ch2_s11_eivis_plains",
  cocatris_karma_a:    "scenes/ch2_s11_eivis_plains",
  cocatris_karma_b:    "scenes/ch2_s11_eivis_plains",
  cocatris_karma_c:    "scenes/ch2_s11_eivis_plains",
  cocatris_ponki_a:    "scenes/ch2_s11_eivis_plains",
  cocatris_ponki_b:    "scenes/ch2_s11_eivis_plains",
  cocatris_ponki_c:    "scenes/ch2_s11_eivis_plains",
  pvp_donatello:       "scenes/ch2_s03_central_square",
  pvp_kevin:           "scenes/ch2_s03_central_square",
  pvp_chopper:         "scenes/ch2_s03_central_square",
  olga:                "scenes/ch2_s03_central_square",
  olga_pet:            "scenes/ch2_s03_central_square", 
};

// @@SECTION:BATTLE_BG_STYLE ─────────────────────────────────────────────────
// バトル背景画像のサイズ・位置をエネミーごとに個別調整する。
// size:     CSS background-size 値（"cover" / "contain" / "120%" など）
// position: CSS background-position 値（"center" / "top center" / "50% 30%" など）
const BATTLE_BG_STYLE = {
  seagull:       { size: "cover", position: "center 40%" },
  shamerlot:     { size: "cover", position: "center 40%" },
  shamerlot_lv3: { size: "cover", position: "center 40%" },
  shamerlot_lv5: { size: "cover", position: "center 40%" },
  // ── 第二章 ────────────────────────────────────────────────────────────────
  woopy:         { size: "cover",   position: "center 40%" },
  moocat:        { size: "cover",   position: "center 40%" },
  mandragora:    { size: "cover",   position: "center 40%" },
  cocatris:           { size: "cover",   position: "center 40%" },
  cocatris_karma_a:    { size: "cover",   position: "center 40%" },
  cocatris_karma_b:    { size: "cover",   position: "center 40%" },
  cocatris_karma_c:    { size: "cover",   position: "center 40%" },
  cocatris_ponki_a:    { size: "cover",   position: "center 40%" },
  cocatris_ponki_b:    { size: "cover",   position: "center 40%" },
  cocatris_ponki_c:    { size: "cover",   position: "center 40%" },
  pvp_donatello:       { size: "cover",   position: "center 40%" },
  pvp_kevin:           { size: "cover",   position: "center 40%" },
  pvp_chopper:         { size: "cover",   position: "center 40%" },
  olga:                { size: "cover",   position: "center 40%" },
  olga_pet:            { size: "cover",   position: "center 40%" },
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
  // ── 第二章 ────────────────────────────────────────────────────────────────
  "スティアルーフ 港":                  { size: "cover", position: "center" },
  "スティアルーフ 繁華街":              { size: "cover", position: "center" },
  "スティアルーフ 中央広場":            { size: "cover", position: "center" },
  "スティアルーフ コミュニティセンター": { size: "cover", position: "center" },
  "スティアルーフ コミュニティルーム":   { size: "cover", position: "center" },
  "スティアルーフ 繁華街 武器防具屋":   { size: "cover", position: "center" },
  "スティアルーフ レストランDIFORE":    { size: "cover", position: "center" },
  "スティアルーフ 魔法店LUNALEE":       { size: "cover", position: "center" },
  "スティアルーフ B&B宿屋":            { size: "cover", position: "center" },
  "スティアルーフ 西門":               { size: "cover", position: "center" },
  "エイビス平原 西":                   { size: "cover", position: "center" },
  "エイビス平原 東":                   { size: "cover", position: "center" },
  "スティアルーフ ギルド":             { size: "cover", position: "center" },
  "スティアルーフ 中央広場 屋台市":    { size: "cover", position: "center" },
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
  // ── 第二章 ────────────────────────────────────────────────────────────────
  "スティアルーフ 港":                  "scenes/ch2_s01_stiarroof_port",
  "スティアルーフ 繁華街":              "scenes/ch2_s02_stiarroof_arcade",
  "スティアルーフ 中央広場":            "scenes/ch2_s03_central_square",
  "スティアルーフ コミュニティセンター": "scenes/ch2_s04_community_center",
  "スティアルーフ コミュニティルーム":   "scenes/ch2_s05_wg_room",
  "スティアルーフ 繁華街 武器防具屋":   "scenes/ch2_armory",
  "スティアルーフ レストランDIFORE":    "scenes/ch2_s06_diflore",
  "スティアルーフ 魔法店LUNALEE":       "scenes/ch2_s07_lunalee",
  "スティアルーフ B&B宿屋":            "scenes/ch2_s08_bb_inn",
  "スティアルーフ 西門":               "scenes/ch2_s10_west_gate",
  "エイビス平原 西":                   "scenes/ch2_s11_eivis_plains",
  "エイビス平原 東":                   "scenes/ch2_s12_eivis_forest",
  "スティアルーフ ギルド":             "scenes/ch2_s09_guild_lexia",   // ギルド専用背景
  "スティアルーフ 中央広場 屋台市":    "scenes/ch2_foodcourt",        // 中央広場背景を流用
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
// セーブJSON: { version, chapter, savedAt, player:{hp,mhp,mp,mmp,elk,lv,exp,weapon,weaponPatk,statPoints,statAlloc,hasPb,hasMapScan,inCom,hasBbs} }

// ============================================================
// @@SECTION:SCENES_CH2 -- 第二章シナリオデータ
// ============================================================
const SCENES = [

  // ─────────────────────────────────────────────────────────────
  // S0: 港町スティアルーフ 到着
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1a30","#1a4060","#2a6888"], loc:"スティアルーフ 港", sprites:["🧑","🧑‍🦱","👩","👦","👧"], dl:[
    { sp:"ナレーション", t:"洗礼の門を越え、新大陸レクシアへ──\n\n船が岸に近づくと、港は冒険者の姿で\n溢れ始める。マリーンフラワー号から\n次々と降り立つ冒険者達。" },
    { sp:"ユミル", t:"「新大陸へようこそ、皆さん♪」" },
    { sp:"エルツ", t:"「エルムと比べると随分雰囲気が違うね。\nこんな発展した街があるんだ」" },
    { sp:"ユミル", t:"「スティアルーフって言うんですよ、この街。\nこれから皆さんの活動拠点になる場所です。\nしっかり覚えて下さいね」" },
    { sp:"エルツ", t:"「あの指輪カッコイイな......\nなんか、空港の免税店みたいな雰囲気だな」" },
    { sp:"スウィフト", t:"「言えてる。でも雰囲気は確かにそうかもね」" },
    { sp:"ナレーション", t:"エルツは銅細工の店で\n『スティアルーフの街並み』が彫られた\n銅の指輪を購入した。\n\n港のゲートを抜ければ、\nそこはスティアルーフの街なのだ。", next:1 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S1: ユミル観光案内
  // ─────────────────────────────────────────────────────────────
  { bg:["#0e1a0a","#1a3010","#283a18"], loc:"スティアルーフ 繁華街", sprites:["🧑","🧑‍🦱","👩","👦","👧"], dl:[
    { sp:"ナレーション", t:"石畳を抜けると、そこは繁華街だった。\n\n透光板張りのドーム型アーケードの天井から\n差し込む光の下には様々なショップが\n軒を連ねていた。" },
    { sp:"ユミル", t:"「色んなお店があるんですよ。\n高級レストランもあるし、武器防具屋に、\n日常品を売ってる雑貨屋さんまであります」" },
    { sp:"スウィフト", t:"「なんか、あんまりキョロキョロしてると\n田舎者だと思われそうじゃない」" },
    { sp:"エルツ", t:"「いや、実際、否定できないって」", next:2 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S2: コミュニティセンター（WHITEGARDEN）
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ コミュニティセンター", sprites:["🧑","🧑‍🦱","👩","👦","👧"], dl:[
    { sp:"ナレーション", t:"正面には黒硝石製の艶のある外観の\n大きな建造物が聳えていた。" },
    { sp:"ユミル", t:"「あの建物がこの街のギルドですよ。\n右側が宿屋──Ｂ＆Ｂです。\nそして左側が......内緒ですよ。さあ行きましょう」" },
    { sp:"ナレーション", t:"コミュニティセンター。\n真っ赤な絨毯の敷かれた広々としたロビー。\n観葉植物が散りばめられた吹き抜けの空間。\n\n階段を上り、廊下の奥の扉へ向かうと\n他の冒険者達がすうっと透けて消えてゆく──" },
    { sp:"エルツ", t:"「なるほど、そういう事か」" },
    { sp:"ユミル", t:"「それでは、皆さん心の準備はいいですか？\n\nようこそ、ＷＨＩＴＥ ＧＡＲＤＥＮへ」" },
    { sp:"ナレーション", t:"開かれた扉の向こう──\nカーテンの締め切られた薄暗い室内。\n木目調の壁に囲まれた広い空間に\n優しい木の匂いが漂う。", loc:"スティアルーフ コミュニティルーム" },
    { sp:"ケヴィン", t:"「誰だ......？」\n\nソファでとんがり頭が揺れ動き、\n茶髪の青年が起き上がった。", loc:"スティアルーフ コミュニティルーム", sprites:["🧔"]},
    { sp:"ユミル", t:"「あ、ケヴィンさん居たんですか？\n\nそうだ──紹介遅れてごめんなさい。\nその人達が新しく入ってくれた\nルーキーの皆さんですよ。\nちっこいのが私の弟です」", loc:"スティアルーフ コミュニティルーム", sprites:["🧔","👦","👧"]},
    { sp:"エルツ", t:"「エルツです。まだわからない事だらけで、\nユミルさんに助けていただきました。\nよろしくお願いします」" , loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🧔","👦","👧"]},
    { sp:"ケヴィン", t:"「おお、いやいや！そう畏まんないで。\nこちらこそよろしく！」\n\n「じゃ夕方、歓迎会やろう。\nそれまで街でも観光しといてよ」",  loc:"スティアルーフ コミュニティルーム" , sprites:["🧑","🧔","👦","👧"],next:3 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S3: PvP観戦
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1206","#1a2a0a","#102010"], loc:"スティアルーフ 中央広場", sprites:["🧑","🧑‍🦱","👩","👦"], dl:[
    { sp:"ナレーション", t:"コミュニティセンターを出た一同は\nまずギルド前の女神像でホームポイントを設定。\n\n歓迎会まで、街を観光することに。" },
    { sp:"ナレーション", t:"繁華街を抜けると景色は一変した。\n石畳に囲まれた円形状の緑の芝地が\n広がっていた。" },
    { sp:"ユミル", t:"「ここがスティアルーフ中央広場です。\nよくＰｖＰ（対人戦）が行われているんですよ」" },
    { sp:"エルツ", t:"「え、ＰｖＰできるの！？」" },
    { sp:"ユミル", t:"「ええ、この直径百メートルの広場内では\nいくらダメージを受けてもＨＰは減りません。\n\nあと貸し切ると様々な条件を付加できます。\nたとえばＨＰが０になった者から\n強制排除とか」" },
    { sp:"エルツ", t:"「あれ、何かやってる」\n\n芝地に数人の冒険者が散らばっていた。\n互いに距離を取りながら、\n武器を構え振りかざしている。" },
    { sp:"ナレーション", t:"一人の法衣を纏った冒険者が杖を振りかざす。\n\n巨大な炎の玉が五人の中心で爆発する──\n熱風に煽られながら一斉に動き始める冒険者達。" },
    { sp:"スウィフト", t:"「すげぇ、爆発した！？」" },
    { sp:"エルツ", t:"「中でもあの全身鎧の人凄くなかった？\nあんだけ集中砲火食らってもビクともしないし、\nほとんど一撃で皆倒してたよ」" },
    { sp:"ナレーション", t:"熟練者のその立ち回り──\nその圧倒的な迫力にエルツは声を振り絞った。\n\n「これが......ＰｖＰ」\n\nいずれは自分もあんな戦闘が出来るようになるか。\nそれは期待でもあり、ちょっとした恐怖でもあった。", next:4 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S4: 装備Lv制限
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ 繁華街 武器防具屋", sprites:["🧑","🧑‍🦱","👩","👦"], dl:[
    { sp:"ナレーション", t:"繁華街をぶらつく四人。\n\nフォルクテッド・バロックという看板の\n武器防具屋へ入ると、\nエルム島とは格が違う装備が並んでいた。" },
    { sp:"SYSTEM", t:"── 装備一覧 ──\n\nバロックソード   150 ELK  [Lv5〜]\nバロックランス   216 ELK  [Lv5〜]\nバロックボウ     180 ELK  [Lv5〜]\nバロックナイフ   120 ELK  [Lv5〜]" },
    { sp:"エルツ", t:"「装備Ｌｖ制限......ってこれ」" },
    { sp:"スウィフト", t:"「全部Ｌｖ５制限ついてるよ。\nそれがなきゃ熟練者から\n初心者が強い装備もらえちゃうもんな」" },
    { sp:"エルツ", t:"「Ｌｖ５までここの装備はお預けか」" },
    { sp:"リンス", t:"「女の子もこの鎧装備しかないのかな......」" },
    { sp:"スウィフト", t:"「法衣とか皮装備とかもあるんじゃないかな。\nここから装備のバリエーションが\n増えてくるんだと思うよ」" },
    { sp:"チョッパー", t:"（お腹がぐ〜）" },
    { sp:"エルツ", t:"「そっか、もうそんな時間か。\n確かユミルがＤＩＦＯＲＥって店が\nいいって言ってたよね。行ってみよう」", next:5 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S5: レストランDIFORE
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ レストランDIFORE", sprites:["🧑","🧑‍🦱","👩","👦"], dl:[
    { sp:"ナレーション", t:"洒落た外観のレストラン、ＤＩＦＯＲＥ。\nアンティークで固めた雰囲気ある内観、\n壁に掛けられた絵画。\n\n席に通されると出された水には\nほんのりとレモンの香りが漂っていた。" },
    { sp:"エルツ", t:"「なんだよ、たかがレモン水くらいに\nビビりはしないさ。はっはっは」\n\n「お、おいしい！店員さんおかわり！」" },
    { sp:"スウィフト", t:"「やめんか！」" },
    { sp:"店員", t:"「あの、そちらはフィンガーボールと申しまして、\nお客様のお指を洗って頂くためのものなんです」" },
    { sp:"スウィフト", t:"「お前恥さらすなよ。\n顔から火が出るかと思ったよ......」" },
    { sp:"SYSTEM", t:"── ランチメニュー ──\n\nおすすめランチコース  77 ELK\nエイビス産綿兎の香草グリル  26 ELK\nDIFORE特製バッファローステーキ  66 ELK", sellElk:-77 },
    { sp:"ナレーション", t:"前菜からデザートまで、\nその味は確かなものだった。\n小柄なチョッパーですら完食を見せる程。\n\n一同は料理に心までも満たされて\n店を後にするのだった。", next:6 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S6: 魔法店LUNALEE
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ 魔法店LUNALEE", sprites:["🧑","🧑‍🦱","👩","👦"], dl:[
    { sp:"ナレーション", t:"食事を満喫した四人は再び繁華街へ。\n\nとりわけ一同を虜にしたのが\n魔法店『ＬＵＮＡＬＥＥ』。\n\n雑多に並べられた魔法の杖に、\n魔法力を高める法衣やアクセサリの数々。" },
    { sp:"エルツ", t:"「ちょっとしたカルチャーショックだな」" },
    { sp:"SYSTEM", t:"── 魔法店 商品 ──\n\nファイアロッド  150 ELK  [FireBall使用可能]\nウォーターロッド 150 ELK  [WaterBall使用可能]\nウーピィの綿服  132 ELK  [法衣・Lv3〜]" },
    { sp:"エルツ", t:"「一つ買ってみるか。とりあえず\n魔法がどんなものか知りたいから」", sellElk:-150 },
    { sp:"SYSTEM", t:"── ファイアロッド 入手 ──\n\n使用可能スキル: FireBall\n物理攻撃力 +1" },
    { sp:"リンス", t:"（ウーピィの綿服をじっと見つめながら）\n「......もうちょっと様子を見てから」" },
    { sp:"エルツ", t:"「いいね、コレ。買っちゃいなよ」" },
    { sp:"スウィフト", t:"「お前軽いな」" },
    { sp:"ナレーション", t:"不思議な世界に触れて、\nそれだけで一同の心は満たされていた。\n\nさあ、宿屋へ向かおう。", next:7 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S7: B&B 宿屋チェックイン
  // ─────────────────────────────────────────────────────────────
  { bg:["#100a00","#1a1006","#0a0804"], loc:"スティアルーフ B&B宿屋", sprites:["🧑","🧑‍🦱","👩","👦"], dl:[
    { sp:"ナレーション", t:"広場に面した木造三階建て。\n看板には風情あるインク文字で\n『Ｂ＆Ｂ』と大きく記されていた。" },
    { sp:"エルツ", t:"「ブラック......バナナ？」" },
    { sp:"スウィフト", t:"「どこの世界にＢ＆Ｂを\nブラックバナナって読む奴が居んだよ！\nしかも『＆』もすっ飛ばしてるし！」" },
    { sp:"ミカエル", t:"「ようこそ、いらっしゃいませ。\n【ブラックバナナ】へ！」\n\n爽やかな笑顔でそう出迎えた若い店員。" },
    { sp:"スウィフト", t:"「ななな！」" },
    { sp:"ミカエル", t:"「いやぁ、冗談ですよ。たまたま\n外での話し声が聞こえたもので。\n\nＢ＆Ｂのマスターを務めております、\nミカエルと申します。以後お見知りおきを」" },
    { sp:"SYSTEM", t:"── B&B 宿泊 ──\n\nシングルルーム  50 ELK/泊（朝食付き）\nスウィート     150 ELK/泊\nロイヤルスウィート 300 ELK/泊", innRest:true, sellElk:-50 },
    { sp:"エルツ", t:"「財政事情からすると、当然シングルだな。\nロイヤル、興味あるけど」" },
    { sp:"ナレーション", t:"一階の木の香り漂う自室でベッドに横になり、\n窓から覗く景色を眺めるエルツ。\n\n鮮やかなグラデーションを描く空と海の境界。\nその手前には繁華街と、遠めに港の様子。\n\n「暫く、ここでゆっくりするか」\n\n瞳を閉じた瞬間──\nエルツは深い眠りに落ちていた。", next:8 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S8: WHITEGARDEN 新入歓迎会
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ B&B宿屋", sprites:["🧑"], dl:[
    { sp:"ナレーション", t:"── メール受信 ──\n\n差出人: Swift\n宛先: Elz\n\n『何やってんだよエルツ。もう20分も待ったぞ！\n悪いけど先行ってるよ。お前が悪い :D\n後で絶対来いよ』" },
    { sp:"エルツ", t:"「やばい......！！」\n\nＢ＆Ｂを飛び出したエルツは\n風のような速さでコミュニティセンターへ直行する。\n二百メートル程の距離を全力疾走。" , loc:"スティアルーフ 中央広場", sprites:["🧑"]},
    { sp:"ケヴィン", t:"「お前、遅いよ！」" , loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🧑‍🦱","👩","🧔"]},
    { sp:"エルツ", t:"「エルツです。すみません、寝坊しました！\nよろしくお願いします！」", loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🧑‍🦱","👩","👦","👧"] },
    { sp:"スウィフト", t:"（飲んでいたカクテルを口から零して）\n「お前、本当に寝てたのか！\nマジあり得ないから！」", loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🧑‍🦱","👩","👦","👧"] },
    { sp:"ドナテロ", t:"「いや、彼は見込みあるな。\n歓迎会遅れてきてこれだけ堂々と\n寝坊ですって自己紹介できる奴は\nそうは居ないんじゃないか」\n\n整った顔立ちの茶髪の男がそう笑った。" , loc:"スティアルーフ コミュニティルーム", sprites:["🎭"]},
    { sp:"スニーピィ", t:"「アタッカーが多いこのコミュニティでは\n貴重な魔法源、スニーピィです。\nＬｖ２０。得意属性は炎。\nドナテロだけには負けません。よろしく！」" , loc:"スティアルーフ コミュニティルーム", sprites:["🎭","🧙"]},
    { sp:"ドナテロ", t:"「ドナテロ、Ｌｖ１８。槍以外に剣も使うぜ。\n夜露死苦」", loc:"スティアルーフ コミュニティルーム", sprites:["🎭","🧙"] },
    { sp:"リーベルト", t:"「リーベルトです。Ｌｖ１５。\nメインは弓ですが、短剣も使います」" , loc:"スティアルーフ コミュニティルーム", sprites:["🏹"]},
    { sp:"フランク", t:"「フランクです。Ｌｖ１５。\nメインは片手剣。リーベルトとペア組んでやってます」" , loc:"スティアルーフ コミュニティルーム", sprites:["🏹","🤗"]},
    { sp:"オルガ", t:"「オルガだ。Ｌｖ２３。\nこのゲームは稼動初期からやっている古参だが、\n人が増えるのはいい事だ。\n新しく入ってきた者には皆\nアドバイスを与えてやってくれ。以上」" , loc:"スティアルーフ コミュニティルーム", sprites:["⚔️"]},
    { sp:"ナレーション", t:"宴もたけなわ、そこへ──\n部屋の入口の扉が乱暴に開かれる。" , loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🧑‍🦱","👩","👦","👧"]},
    { sp:"ウィル", t:"「ああー！疲れたー！！\nシュラクのバカー！死ぬ、マジで死ぬよー！」\n\nドタドタと飛び込んできた小さな影が二つ。" , loc:"スティアルーフ コミュニティルーム", sprites:["😤","😄"]},
    { sp:"ドナテロ", t:"「噂をすればうるせぇ奴が来た」" , loc:"スティアルーフ コミュニティルーム", sprites:["🎭"]},
    { sp:"ウィル", t:"（チョッパーに気づき）\n「お？　誰々！？　誰！！？」\n\nじっとチョッパーを見つめる。\n「よし、お前子分にしてやるよ」" , loc:"スティアルーフ コミュニティルーム", sprites:["😤","👦","😄"]},
    { sp:"チョッパー", t:"「......チョッパー」" , loc:"スティアルーフ コミュニティルーム", sprites:["😤","👦","😄"]},
    { sp:"ウィル", t:"「よし、チョッパー今から狩り行くぞ！\nお前の腕を見せてみろ！」", loc:"スティアルーフ コミュニティルーム", sprites:["😤","👦","😄"] },
    { sp:"シュラク", t:"「お前、たった今狩り行ってきたばかりだろ！」", loc:"スティアルーフ コミュニティルーム", sprites:["😤","👦","😄"] },
    { sp:"ナレーション", t:"ウィルとシュラクがそのままソファの外へ\n掴み合い転がり始める。\n\n「いや、なんていうか賑やかですね」とエルツ。\n「大体いつもこうよ」とスニーピィが笑った。\n\n記念すべき夜の宴は夜明けまで続いた。", sprites:["🧑","🧙"], next:9 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S9: 月夜の舞闘祭 ルール説明
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1206","#1a2a0a","#100e04"], loc:"スティアルーフ 中央広場", sprites:["🧑","🧑‍🦱","👩","👦","👧"], dl:[
    { sp:"ナレーション", t:"美しい月夜。雲一つなく、\n月明かりに照らされて舞闘祭の幕が開く。\n\n「ＣｈａｎｇｅＡｒｍｏｒ！」\nメンバー内からそんな掛け声が上がり始め、\n戦闘用の装備へと衣装替えをするリーベルト。", sprites:["🧑","🏹"] },
    { sp:"エルツ", t:"「さっきのリーベルトさん、どうやって\n装備変えたんですか？」", sprites:["🧑","🏹"] },
    { sp:"ドナテロ", t:"「そうか、ボイスコマンド知らないのか。\n声でゲームコマンドを実行できるんだ。\n戦闘中でも使えるぜ」" , sprites:["🧑","🏹"]},
    { sp:"ドナテロ", t:"「ルールは到って簡単。\nこのフィールド内ではＨＰは減らない。\nつまり、果てるまで闘う。\n\n降伏・気絶・場外になった者は\n敗者とする」" , sprites:["🎭"] },
    { sp:"スニーピィ", t:"「でも、これって結局Ｌｖ高い者が有利じゃない？」", sprites:["🎭","🧙"] },
    { sp:"ドナテロ", t:"「そこはハンデを付ける。\n三組のチームに分けて、\n抽選アルファベットで組分けを決める」", sprites:["🎭","🧙"] },
    { sp:"SYSTEM", t:"── 月夜の舞闘祭 チーム編成 ──\n\n■ Aチーム『SwordMan』\n　エルツLv3 / ウィルLv5 / フランクLv15\n\n■ Bチーム『3S』\n　スウィフトLv3 / シュラクLv5 / スニーピィLv20\n\n■ Cチーム『Tricker』\n　リンスLv3 / ユミルLv7 / リーベルトLv15\n\n■ Dチーム『Striker』\n　チョッパーLv3 / ケヴィンLv8 / ドナテロLv18" , sprites:["🧑","🤗","😤"]},
    { sp:"フランク", t:"「よろしくエルツさん」" , sprites:["🧑","🤗","😤"]},
    { sp:"エルツ", t:"「フランクさん、頑張りましょう！\nよろしくお願いします！」", sprites:["🧑","🤗","😤"] },
    { sp:"ドナテロ", t:"「それでは一同構えて......\n\nはじめ！」\n\n月夜の下で舞闘祭の幕が今切って落とされた。", sprites:["🎭"], battle:true, multiEnemyTypes:["pvp_donatello","pvp_kevin","pvp_chopper"], battleNext:10 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S10: 月夜の舞闘祭 月下乱舞
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1206","#1a2a0a","#100e04"], loc:"スティアルーフ 中央広場",  sprites:["🧑","🤗","😤"], dl:[
    { sp:"ナレーション", t:"乱舞する剣と魔法──\n\n四チームが入り乱れる混戦の中、\nエルツは冷静に周囲を観察していた。\n\n次々と場外へ弾き飛ばされてゆく冒険者達。\n粒子となって消えてゆく姿。" },
    { sp:"ナレーション", t:"終わってみれば──Ａチーム優勝。\n\nフランクの緻密な指示とウィルの突撃力、\nそしてエルツの動体視力が組み合わさった\n奇跡の勝利だった。" },
    { sp:"オルガ", t:"「それでも、勝ったのだろう。大したものだな」",  sprites:["🧑","⚔️"] },
    { sp:"エルツ", t:"「いや、あれは偶然というか。\nフランクさんが居なければ到底勝てなかったし」" },
    { sp:"ケヴィン", t:"「何で俺負けたんだろ。Ｌｖ差あるのに......」" ,  sprites:["🧑","⚔️","🧔"]},
    { sp:"スニーピィ", t:"「あの時のエルツの動き、\n偶然とは言い切れないよ」",  sprites:["🧑","⚔️","🧔","🧙"] },
    { sp:"ドナテロ", t:"「いずれにせよ、これからが楽しみだな」\n\nその言葉に一同は皆思い思いに頷いた。",  sprites:["🧑","⚔️","🧔","🧙","🎭"], next:11 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S11: 夢集う処
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🧑‍🦱","👩","👦","👧"], dl:[
    { sp:"ナレーション", t:"戦いを終えた一同。\n疲労からか何人かはそのまま宿へ引き返した。\n残りのメンバーは満身創痍の身体を引きずり\nコミュニティルームへ。\n\n部屋ではオルガが一人酒を飲んでいた。",  sprites:["🧑","⚔️"] },
    { sp:"オルガ", t:"「それでは、俺はそろそろ失礼しよう。\n少し現実で入用が出来てな」",  sprites:["🧑","⚔️","🧙"] },
    { sp:"スニーピィ", t:"「でも今現実って夜中ですよ？」" ,  sprites:["🧑","⚔️","🧙"]},
    { sp:"ナレーション", t:"オルガはそれ以上は語らなかった。\n後ろ向きに手を振って去って行ったオルガに\nドナテロとスニーピィはふと顔を見合わせる。\n\n「なんかオルガさんいつもと雰囲気違ったな」\n「なんか寂しそうじゃなかった？」",  sprites:["🧑","🎭","🧙"] },
    { sp:"ケヴィン", t:"「おい、エルツ、ビリヤードやろうぜ。\n俺が勝ったら、酒の一、二杯今度奢れよ。高い酒な」", sprites:["🧑","🧔"]  },
    { sp:"エルツ", t:"「ああ、分かったよ」" , sprites:["🧑","🧔"] },
    { sp:"ナレーション", t:"宴は夜明けまで続いた。\n翌朝、Ｂ＆Ｂへ戻ったエルツ達は\nチェックアウトぎりぎりまでぐっすりと眠りついた。\n朝食は食べ損なったが、それもしょうがない。", next:12 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S12: 白亜の門と広がる世界
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1a30","#1a5080","#8ab8c8"], loc:"スティアルーフ 西門", sprites:["🧑","🧑‍🦱","👩"], dl:[
    { sp:"ナレーション", t:"「あれ、チョッパーは？」\n「なんか、今朝早くウィル君に\n連れられてったみたい」" },
    { sp:"エルツ", t:"「そっか、大丈夫かなチョッパー......\nまあ、なんとかなるか。多分」" },
    { sp:"ナレーション", t:"広場の西から延びた石畳の舗道。\n蒼い海水に両端を包まれたその舗道の先に、\n緑の草原と街とを隔てる白壁の門がある。\n\n通称『西門』──この街の象徴的な建築物。" },
    { sp:"エルツ", t:"「どんなモンスターが居るんだろ。楽しみだな」" },
    { sp:"リンス", t:"「見て、綺麗......」\n\n舗道端の石柵から身を乗り出した。\n透き通った海水に漂う遊魚たち。" },
    { sp:"ナレーション", t:"真白な外壁が太陽光を反射して輝く。\n門の向こうに広がるは圧倒的な緑の草原。\n\n広がる大自然と狩りの香り。\nそれはまさにエルツが夢に描いていた\n世界の姿そのものだった。" },
    { sp:"エルツ", t:"「行こうか」\n\nいざ、未知の原野へ。\n白亜の門の向こうに広がる世界を求めて──", next:13 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S13: VS ムーキャット
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#184010","#283020"], loc:"エイビス平原 西", sprites:["🧑","🧑‍🦱","👩"], dl:[
    { sp:"ナレーション", t:"広大な原野に足を踏み入れて二十分程。\n\n草原の草花を齧る小さな兎のような生物──\n尻尾に三十センチ程の真白な綿玉をつけた\n愛らしいウーピィが、長い耳をピンと張りながら\n三人の動向を窺っていた。" },
    { sp:"リンス", t:"「可愛い......」" },
    { sp:"エルツ", t:"「参ったな。あれじゃ攻撃できないよな。\nもっとこう、攻撃しやすい\n不細工なモンスターがいりゃいいんだけど」" },
    { sp:"スウィフト", t:"「猫？」\n\n容姿は猫。体中をオレンジ色の斑点で覆われた\n茶毛の生物がピタリと足を止めた。\n\n「ＭｏｏＭｏｏ！」" },
    { sp:"エルツ", t:"「ＭｏｏＣａｔ──ムーキャット。\nしかもこいつＬｖ４だって。」" },
    { sp:"ナレーション", t:"目の前の小さな影が跳躍する──\nアクティブモンスターだ！", battle:true, multiEnemyTypes:["moocat","moocat","moocat"], battleNext:14 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S14: 金策 / ムーキャット戦後
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#184010","#283020"], loc:"エイビス平原 西", sprites:["🧑","🧑‍🦱","👩"], dl:[
    { sp:"ナレーション", t:"あまりの苦戦に一同は思わず尻をついた。\n\n幸い一枚のカードを落とした事が\nせめてもの労いとなった。" },
    { sp:"エルツ", t:"「コカトリスはＬｖ５〜６の上に\n数匹で固まってる。リンクしたら全滅だよ」" },
    { sp:"スウィフト", t:"「ウーピィも狩れないし、\nムーキャットはメチャメチャ狩りにくいし......\nエルムの蟹乱獲の方が楽だったね」" },
    { sp:"エルツ", t:"「でも、きっと何か狩りのパターンはあるんだよ。\n現に初心者の冒険者は\n皆ここを目指してくるわけだから。\n\n情報収集が必要だな。\nもう少し周辺を探ってみよう」", next:15 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S15: 金策〈MoneyPlan〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#184010","#283020"], loc:"エイビス平原 西", sprites:["🧑","🧑‍🦱","👩"], dl:[
    { sp:"ナレーション", t:"昼過ぎまでのムーキャット狩りの収穫は\n『ムーキャットの爪』五枚──\n\nスティアルーフへ戻り道具屋で換金する。" },
    { sp:"SYSTEM", t:"── 売却 ──\n\nムーキャットの爪 ×５\n一枚23ELK → 合計 115ELK\n（三人分配: 各38ELK）" },
    { sp:"エルツ", t:"「たった23ELKか。\nこれじゃ昼飯代にもならないな」" },
    { sp:"スウィフト", t:"「やっぱりちゃんと三等分しない？\nそれじゃキツイだろエルツ」" },
    { sp:"エルツ", t:"「まずい、早く金策確立しないと\n破産するよコレ」\n\nとりあえず広場の屋台でフランクフルトと\n果実ジュースで昼食を済ませ、\nエルツはコミュニティＢＢＳを開いた。" },
    { sp:"SYSTEM", t:"── WhiteGarden Line ──\n\nTO ALL 金策について / Elz\nＬｖ３の三人パーティで狩れる\nモンスターって居ますか？\n（ウーピィ以外で）\n\n Sneepi\n東エイビス平原の森でマンドラゴラ\n狩ってみたら？\nドロップ率3割、単価50G前後。\nただスクリームには要注意！" },
    { sp:"スウィフト", t:"「スニーピィさんてほんといい人だね」" },
    { sp:"エルツ", t:"「そっか、じゃあこのマンドラゴラってのを\n狩りに行ってみようか。\n東エイビス平原は広場から逆の方向か」\n\n向う先は東エイビス平原。\n待ち受けるマンドラゴラとはどんな生物なのか。", next:16 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S16: VS マンドラゴラ
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#1a2a08","#182808"], loc:"エイビス平原 東", sprites:["🧑","🧑‍🦱","👩"], dl:[
    { sp:"ナレーション", t:"スティアルーフ東門をくぐり、東エイビス平原へ。\n\n西の広大な原野とは異なり、\n東は小さな森が散開する地形。\n林の中で不可思議な動きをする生物を発見──" },
    { sp:"スウィフト", t:"「見つけた......」\n\n体長六十センチ、巨大な木の根に蔓がゆらゆら。\nマンドラゴラだ。" },
    { sp:"エルツ", t:"「あいつって、あそこに生えてるんじゃないの？\n確かめてみるか」\n\n遠距離から銅の矢を撃ち込む。\n矢が命中した途端、マンドラゴラの動きが止まった。" },
    { sp:"ナレーション", t:"「ん......動かないな......どうしたんだ？」\n\n一歩踏み出したその時──\n地を這うように蔓の手を振り回しながら\n突進するマンドラゴラ！\n\n「ぎゃぁぁぁ！」", battle:true, battleType:"mandragora", battleNext:17 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S17: 中央広場「屋台市」
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#1a2a08","#182808"], loc:"エイビス平原 東", sprites:["🧑","🧑‍🦱","👩"], dl:[
    { sp:"エルツ", t:"「ふぅ、これがマンドラゴラか。\nあの鳴き声は厄介だけど、\n耐久力も無いし慣れれば狩りやすいかも。\nムーキャットよりは落ち着いて闘えそうだね」" },
    { sp:"スウィフト", t:"「確かに、あの鳴き声の前に予備動作もあるし。\n狩りやすいかも」" },
    { sp:"ナレーション", t:"スニーピィの言葉を信じ、ここで狩りを続けた一同。\n夕方までに十三匹のマンドラゴラを狩り、\nマンドラゴラの根を六枚入手。\n\n売却額 57ELK × 2枚 = 114ELK（各分配）\n\n報酬を手にした三人は\nドナテロに教えられた中央広場の屋台市へ。",loc:"スティアルーフ 中央広場 屋台市" },
    { sp:"スウィフト", t:"「あの海鮮あんかけ美味そうだな」",loc:"スティアルーフ 中央広場 屋台市" },
    { sp:"エルツ", t:"「色々あるんだな、目移りする。\nあれ何だろう？\n\nしゃぶしゃぶ？　入ってみようよ！」",loc:"スティアルーフ 中央広場 屋台市" },
    { sp:"SYSTEM", t:"── 湯揚〔ShangYang〕──\n\n□ 綿兎肉  10ELK\n□ 白羊肉  30ELK\n□ 角牛肉  50ELK\n\n※ ご飯おかわり自由",loc:"スティアルーフ 中央広場 屋台市" },
    { sp:"エルツ", t:"「ライス無料だって。いいね、ここ。\n皆ラム肉食える？\nじゃあ綿兎を一皿ずつと、\n白羊肉を三人で一皿頼もう」",loc:"スティアルーフ 中央広場 屋台市" },
    { sp:"ナレーション", t:"紅腐乳のタレをつけ、熱々の肉をライスと頬張る。\n温かい食事に気づけば会話も弾み、\nあっという間に夜が更けてゆく。\n\n人々を支える衣・食・住の生活。\nリアルに味わえるのもこの世界の醍醐味だった。",loc:"スティアルーフ 中央広場 屋台市", next:18 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S18: 経験値ペナルティ〈ExpPenalty〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🧑‍🦱","👩","🎭"], dl:[
    { sp:"ナレーション", t:"マンドラゴラ狩り二日目の夕方──\n\nしかしその後、Ｌｖ３のスウィフトとリンスに\n経験値が入らない事が発覚する。" },
    { sp:"スウィフト", t:"「あれ、今の経験値入ってない......」" },
    { sp:"リンス", t:"「私も」" },
    { sp:"ナレーション", t:"夜、コミュニティルームでドナテロに話すと──" },
    { sp:"ドナテロ", t:"「そいつは、経験値ペナルティだな」" },
    { sp:"SYSTEM", t:"── ExpPenalty〈経験値ペナルティ〉──\n\nパーティの場合、入手経験値は\n【最高Ｌｖプレイヤー】を基準にし、\n人数で割る（端数切捨て）" },
    { sp:"ドナテロ", t:"「Ｌｖの高いエルツが居る三人パーティで\nＬｖ５のモンスターを狩ると......\n入手経験値は下がるよな」" },
    { sp:"エルツ", t:"「そっか、それで経験値が入らなかったのか。\nじゃあ僕はパーティから抜けた方がいいね。\n\n二人でパーティ組む形にすれば\nＬｖ４のモンスターからも経験値が入るよ」" },
    { sp:"スウィフト", t:"「大丈夫、ソロになるって言っても\n離れるわけじゃないし、同じ場所で狩るよね」" },
    { sp:"エルツ", t:"「そう、要はエルムで蟹を狩ってた時と同じだよ」\n\n方針が決まった。\n冒険者達の歯車に、確かな変化が生まれ始めていた。", next:19 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S19: ログアウト〈LogOut〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🧑‍🦱","🧔","🎭","🧙"], dl:[
    { sp:"ナレーション", t:"その日の夕方も、コミュニティルームで談笑を楽しむ一同。\nエルツとケヴィンはビリヤードで賭け試合の最中。\n\nドナテロのブレイクエースで\nエルツが逆転勝利──100ELK獲得！" },
    { sp:"ケヴィン", t:"「ちょっと待って下さいよ。\nブレイクエースで勝ちって、これ無しでしょ！」" },
    { sp:"ドナテロ", t:"「一球は一球だろ。エルツ今度飯奢れよ」" },
    { sp:"ナレーション", t:"笑い声が収まった頃、\nスニーピィが静かに立ち上がった。" },
    { sp:"スニーピィ", t:"「さてと、そろそろ準備するか」" },
    { sp:"ドナテロ", t:"「もう、そんな時間か。明日からオフか。タルイな」" },
    { sp:"ナレーション", t:"そう──ログアウトの時間だった。\n現実の朝7時に相当する刻末まであと僅か。\nウィル・シュラク・チョッパー、\nユミル、ドナテロ、スニーピィ、ケヴィン......\n次々と部屋を去ってゆく。" },
    { sp:"スウィフト", t:"「それじゃ僕も行くよ。\n十日後くらいにまた会おう。\nなんかその時はＬｖ離されてそうで怖いな」" },
    { sp:"エルツ", t:"「僕、残ります」\n\nその言葉に笑いが漏れる。" },
    { sp:"スニーピィ", t:"「あんまり根詰めすぎるなよ。\n現実に生きる事も忘れずにってさ」" },
    { sp:"ドナテロ", t:"「もしパーティ組みたくなったら\nギルド行って100Gで\nシティＢＢＳ申し込んでみな。\nじゃあな」\n\n一人残ったエルツは窓から\n星空を見上げる。\n明日からはまた初心に返ろう──", next:20 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S20: 魔法演習
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#1a2a08","#182808"], loc:"エイビス平原 東", sprites:["🧑"], dl:[
    { sp:"エルツ", t:"「今日からしばらく一人か。\n\nそう言えば、ファイアロッドを\n買ったまま忘れてたな」\n\n装備を変え、軽い杖を手に取る。\n振るたびに空中へ赤い軌跡が現れる。\n「なんだコレ。面白いな」" },
    { sp:"SYSTEM", t:"── ファイアロッド ──\n\n▽ FireBall（消費SP：3）\n印言 FireBall〔ファイアボール〕\n刻印 FB" },
    { sp:"エルツ", t:"「印言と刻印って何だろう......\n\nとりあえず試してみるか」\n\n木陰で杖を振り回すがなにも起きない。\n恥を捨てて大声で叫ぶ──" },
    { sp:"エルツ", t:"「FireBall!!」\n\n乾いた効果音──\n足元に向かって飛び出した火球に\nエルツは慌てて飛びのいた。\n\n「うぉ！？\nそうか、振りながら発音するのか！」" },
    { sp:"エルツ", t:"「じゃあ刻印『ＦＢ』は......」\n\n杖先でＦＢの文字を描く。\nすると──印言と同じ火球が出現した。\n\n「なるほど、これが刻印か。\nよし、早速実戦で試してみよう！」" },
    { sp:"ナレーション", t:"意気揚々とマンドラゴラの森へ向かうエルツ。\n\n「FireBall!!」\n\n気分よく炎を放った直後、\nスクリームを完全に忘れていた事に気づく。\n麻痺して動けなくなったエルツに\n炎上したマンドラゴラが迫る──\n\n調子付くのはエルツの悪い癖。\n前途多難なソロ生活が今始まった。", next:21 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S21: ソロプレイ〈SoloPlay〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#1a2a08","#182808"], loc:"エイビス平原 東", sprites:["🧑"], dl:[
    { sp:"ナレーション", t:"ソロ狩りを始めて数日が経過した。\n\nマンドラゴラの三つの動作を完全に見切った今、\n一時間に約三匹というペースで一日六時間、\n平均狩数は二十匹弱。\n\nドロップ品：マンドラゴラの根 平均5枚（285ELK/日）\n生活費を差し引いてもお釣りがくる額だ。" },
    { sp:"エルツ", t:"「誰かと一緒に狩るのとは、また違う充実感があるな。\n\n今はただ与えられた時間を楽しもう」\n\n一人街の雑踏の中に溶け込みながら、\nエルツはショッピングを楽しんだり、\n鉄革の水筒を購入して長期戦に備えた。\n\nそうして、また今日も一日という時間が流れ去ってゆく。", next:22 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S22: 個別隊形〈セパレイトパーティ〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#184010","#283020"], loc:"エイビス平原 西", sprites:["🧑"], dl:[
    { sp:"ナレーション", t:"ソロ狩り五日目の朝。\nエルツはＬｖ５に到達し、\n新しいバロック装備を身に纏って西エイビス平原に居た。\n\n体長1.5〜2メートルの二本足の地鳥──コカトリス。\n以前三人で諦めた群れで行動するモンスターだ。" },
    { sp:"エルツ", t:"「一人じゃ無理か......」" },
    { sp:"ナレーション", t:"そこで目の前で三人組の冒険者が\nそれぞれ別々にコカトリスへ攻撃を仕掛ける光景を目撃する。\n\nパーティではなく、\nお互いをフォローし合う動作が無い。\nそれぞれが自分の獲物に集中している──" },
    { sp:"エルツ", t:"「そうか、そういう事か。\n\n一人ではこの獲物は狩れない。\nならば──街に戻って仲間を探すまでだ」\n\nその瞳に確かな答えを宿して、\nエルツは街へと引き返した。", next:23 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S23: シティBBS〈CityBBS〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0a06","#2a1408","#100808"], loc:"スティアルーフ ギルド", sprites:["🧑"], dl:[
    { sp:"ナレーション", t:"昼食も取らずギルドへ直行するエルツ。\n\n黒硝石の艶ある外観、磨き抜かれた大理石の床──\nまるで一流ホテルのロビーのようだった。" },
    { sp:"エルツ", t:"「あの、シティＢＢＳというものを\n勧められたんですが、それって何ですか？」" },
    { sp:"ナレーション", t:"カウンターの女性が丁寧に説明してくれた。\n\nシティＢＢＳ──ギルド運営の冒険者交流掲示板。\n申し込み料：100ELK。\n\n項目：攻略 / 雑談 / パーティのお誘い\n　　　アイテムトレード / 人員募集" },
    { sp:"SYSTEM", t:"── CityBBS 申し込み ──\n\n100 ELK を支払いました\n\n✅ CityBBS へのアクセスが\n　 解放されました" },
    { sp:"ナレーション", t:"広場のベンチでPBを開き、攻略掲示板を検索。\nキーワード：Lv上げ＋Lv5\n\n「Lv5からはセパレイトパーティでの\nコカトリス狩りが主流。\nコカ狩りってのは最初にぶち当たる壁だよ」" },
    { sp:"エルツ", t:"「最初の壁か......\nよし、パーティのお誘い掲示板を見てみよう」",openBbs:true },
    { sp:"エルツ", t:"「よし、経験者の輪に割り込んだ方が\n覚えが早いかもな」\n\nエルツは返信を書き込んだ。\n「13:00に西門か。もうすぐだな」\n\n踊りだす胸の鼓動──\nオンラインゲームの醍醐味は冒険者との触れ合い。\nそこにはソロでは味わえない可能性が広がっている。", next:24 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S24: VS コカトリス〈Cocatris〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#184010","#283020"], loc:"エイビス平原 西", sprites:["🧑","🌊","😜"], dl:[
    { sp:"ナレーション", t:"西門前でアリエスと合流。\n青髪の青年、爽やかな笑顔で一礼する。\nもう一人──バロック装備の長い黒髪の青年がエルツを頭から爪先まで見下ろした。\nカルマ、という冒険者だった。" },
    { sp:"アリエス", t:"「セパレイトパーティというのは\nパーティを組まない状態で組むチームの事です。\n１ＶＳ１の状況を作り出す事が出来ます。\n絶対条件──それぞれが一匹を最初から最後まで\n責任を持って倒す事です」" },
    { sp:"カルマ", t:"「そのくらい事前に調べてくるべきだと思うけど」" },
    { sp:"エルツ", t:"「すみません、事前準備が足りませんでした」" },
    { sp:"ナレーション", t:"狩場へ着くと、アリエスが釣りを担当。\n三匹のコカトリスに対して三人が散開──\n\n盾でつっつきをいなしながら剣を振るうエルツ。\n初コカトリスで一番早く仕留めたのはエルツだった。\n\nしかし次の群れで事故が起きる──\n隠れていた四匹目が出現！\n「四匹いるぞ！何やってんだバカ！！」", battle:true, multiEnemyTypes:["cocatris_karma_a","cocatris_karma_b","cocatris_karma_c"],battleNext:25 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S25: パーティリーダー〈PartyLeader〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#184010","#283020"], loc:"エイビス平原 西", sprites:["🧑","🌊"], dl:[
    { sp:"ナレーション", t:"カルマは捨て台詞を残し去っていった。\n\n残されたエルツとアリエスはその場に蹲う。\nアリエスが静かに口を開く。" },
    { sp:"アリエス", t:"「申し訳ないです、私のミスで」" },
    { sp:"エルツ", t:"「アリエスさんの責任じゃありませんよ。\nただの事故です」" },
    { sp:"アリエス", t:"「でも、凄いですね。\n初めてのコカ狩りで一人で二匹のリンク処理するなんて」" },
    { sp:"アリエス", t:"「エルツさん、良かったらフレンドになってくれませんか？」" },
    { sp:"ナレーション", t:"フレンド申請を受諾するエルツ。"},
    { sp:"ナレーション",t:"翌朝──今度はエルツ自らが\nCityBBSでパーティ募集を立てた。", loc:"スティアルーフ B&B宿屋", sprites:["🧑"] },
    { sp:"SYSTEM", t:"── CityBBS パーティのお誘い ──\n\n□投稿者 Elz " ,loc:"スティアルーフ B&B宿屋", sprites:["🧑"],openBbs:true},
    { sp:"ナレーション", t:"待ち合わせの西門に現れたのは\nツインテールの白銀髪の女の子──ペルシア。\n\n弓を肩に掛け、可愛らしく頭を下げる。\n「お待たせしてすみません。ペルシアです。よろしくお願いします」",loc:"スティアルーフ 西門", sprites:["🧑","🤫","🌸"] },
    { sp:"ナレーション",t:"平原には数多くのコカトリスが群れていた", loc:"エイビス平原 西", sprites:["🧑","🤫","🌸"]},
    { sp:"トマ", t:"「う～ん、緊張するなぁ。僕は戦闘があまり得意でなくてね。\n君たちの足を引っ張らないといいんだが。」" , sprites:["🧑","🤫","🌸"]},
    { sp:"ペルシア", t:"「大丈夫ですよ、トマさん。\n慎重に立ち回ればそれほど難しい狩りではないですよ」", sprites:["🧑","🤫","🌸"] },
    { sp:"ナレーション", t:"狩場でペルシアが見せた技──\n弦を五秒以上溜めて放つ光り輝く矢。\n\n「ＳＴＲＩＮＧ'ＳＳＨＯＴ！」\n\nこの女の子、只者ではない", sprites:["🧑","🤫","🌸"] },
    { sp:"ナレーション", t:"狩りにおけるペルシアの動きは明らかに洗練されており、エルツの自信を打ち砕くには十分だった。", sprites:["🧑","🤫","🌸"], next:26 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S26: Lv上げ or 金策
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#1a2a08","#182808"], loc:"エイビス平原 東", sprites:["🧑"], dl:[
    { sp:"ナレーション", t:"コカトリスのドロップ品「コカトリスの羽毛」は\n確率15〜20%、単価45ELK。\n\n一日三時間の狩りで15匹、期待値3枚（135ELK）。\n三人分配すると45ELK。\nスティアルーフの一日の生活費は約120ELK。\n\nつまり、コカ狩りは完全に赤字だ。" },
    { sp:"エルツ", t:"「Ｌｖ上げと金策は別に行う必要があるってことか。\n\nコカ狩りはＬｖ上げに専念して、\n金策は引き続きマンドラゴラ狩りで稼ごう」" },
    { sp:"ナレーション", t:"午後、単身マンドラゴラの森へ向かうエルツ。\nしかしこの日に限って、\nＬｖ11の冒険者が圧倒的な速度で乱獲していた。\n\n「乱獲か。しょうがない、別の場所を探そう」\n\nどこの森でも冒険者の姿が見受けられ、\nこの日は確たる収穫も無く帰還するのだった。", next:27 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S27: フレンドシップ〈Friendship〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1206","#1a2a0a","#100e04"], loc:"スティアルーフ 中央広場 屋台市", sprites:["🧑","🌊","🤫"], dl:[
    { sp:"ナレーション", t:"屋台市で湯揚の肉皿を頬張っていると、\nウーピィ装備の青年が隣に腰を下ろした──アリエスだった。\n\n「今日の成果はどうでした？」\n「それなりに。財政的には赤字だけど」" },
    { sp:"ナレーション", t:"そこへ長身のトマも合流。\nフレンドになった三人が初めて揃った夜。" },
    { sp:"トマ", t:"「嬉しいもんだね。フレンドになってもらった人から\nこうして誘いを受けるのは今回が初めてだよ」" },
    { sp:"アリエス", t:"「法衣──ウーピィ装備はSP＋6の効果があるんです。\n術士や弓使いが好んで着る理由はそれですよ」" },
    { sp:"エルツ", t:"「ああ、それでペルシアもウーピィ装備着てたのか」" },
    { sp:"ナレーション", t:"何気ない会話の中からでも得られる情報は大きい。\nビールを飲み交わしながら、\nオンラインゲームのフレンドという繋がりを\n大切にする事をエルツは改めて感じていた。\n\nこうした繋がりの一つ一つが\n真のフレンドシップの礎となるのだ。", next:28 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S28: 童憬
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ コミュニティルーム", sprites:["🧑","😤","😄"], dl:[
    { sp:"ナレーション", t:"ＷＡを覚えたエルツのマンドラゴラ狩りは\n一時間に五匹ペースへと向上した。\n狩場が空いていればアリエスを誘ってコカ狩りへ。\n\nそんな数日が過ぎた頃──\nコミュニティルームにウィルとシュラクが戻ってきた。" },
    { sp:"ウィル", t:"「エルツ、奢って！」" },
    { sp:"ナレーション", t:"所持金3354ELK。\nたまにはこういう奉仕も悪くない。\n三人で屋台市へ繰り出し、ウィルは怒涛の10人前を平らげた。\n\n食事代 314ELK──随分高くついた。" },
    { sp:"ウィル", t:"「食い過ぎた。ヘルプミー！へーループーミー！！」" },
    { sp:"ナレーション", t:"広場でウィルとシュラクが掴み合いになり、\nシュラクの水球が炸裂。\n\n続いてコミュニティルームの浴槽で\nウィルがWaterSphereを乱射し大惨事──\n\n賑やか極まりないやりとり。\nだが、若い二人のエネルギーに触れる事は\nエルツにとって新鮮だった。\n\n幼い、あの二人の目にはこの世界は\n一体どんな姿に映っているのだろう。", next:29 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S29: 先駆者の教え
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1206","#1a2a0a","#100e04"], loc:"スティアルーフ 中央広場", sprites:["🧑","⚔️"], dl:[
    { sp:"ナレーション", t:"翌朝、コミュニティルームへ向かうと\n窓辺に一人の人影があった。" },
    { sp:"オルガ", t:"「狩りには慣れたか」" },
    { sp:"ナレーション", t:"唐突な問いかけ。\nそして──\n\n「君の実力が見たい」\n\nオルガに導かれ中央広場へ出た二人は\n武器を取り出す。" },
    { sp:"エルツ", t:"「行きます！」" },
    { sp:"ナレーション", t:"全力の剣撃が悉くいなされる。\n完全な封殺──別格の実力差。\n\n「BikserSlash!!」\n\n最後の賭けも斧に弾き返されて膝をつく。" },
    { sp:"オルガ", t:"「剣筋は悪くない。\nこの世界へ来て、我流でそれだけ磨き上げるとは大したものだ。\nだが残念ながら、まだ圧倒的に戦闘経験が少ない。\nそれだけの事だ」" },
    { sp:"ナレーション", t:"オルガはその後、午前中いっぱいをかけて\nエルツに剣術の基本と新たな剣技を教えてくれた。\n\n── 三散華 ──\n一斬：右肩から左下へ。\n二斬：左肩から右下へ。\n三斬：頭から真下へ振り下ろし。" },
    { sp:"エルツ", t:"「やっぱりそう甘くはないか」\n\n先程までの気張った気持ちは消えていた。\nだが、この世界の新たな一面を見た事で\nエルツの中でまたこの世界の在り方は広がっていた。", next:30 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S30: 悲報
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ コミュニティルーム", sprites:["🧑","👩","👦","👧","🧙"], dl:[
    { sp:"ナレーション", t:"その日の夕方、ウィルとシュラクに引っ張り回され\nコカ狩りに精を尽くしたエルツはぐったりとソファーに倒れ込んだ。\n\n続々と集まるコミュニティメンバー。\nリンスのログインも確認できた。\nスウィフトはまだ灰色だ。" },
    { sp:"ナレーション", t:"そこへスニーピィがやってきた。\nどことなく寂しそうなその表情に、エルツは口を開く。" },
    { sp:"エルツ", t:"「何かあったんですか？」" },
    { sp:"スニーピィ", t:"「いや......そっか、皆まだ知らないのか。\n\nさっき知ったばかりだし......\nこれ言っていいのかな......」" },
    { sp:"スニーピィ", t:"── オルガさん引退するんだって ──" },
    { sp:"ナレーション", t:"その言葉を瞬時に飲み込めた者は誰一人として居なかった。\n\n「え、引退って......」\n「このゲームを辞めるって事だよ」\n\n沈み込む一同。\nオルガとの付き合いは長くないエルツにも、\nその言葉は衝撃だった。\n朝、あれだけ明るく接してくれていたというのに──" },
    { sp:"スニーピィ", t:"「刻末には送迎会をやるって。\n皆予定空けといて。\nそれと、オルガさんには内緒で。\n皆、なるべく自然に接してね」" },
    { sp:"ナレーション", t:"来る者が居れば去る者も居る──\nこの世界から去る理由が、エルツには分からなかった。\n今朝オルガが残してくれた優しい笑みを\nエルツは心の中で繰り返していた。", next:31 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S31: ブラックリスト〈Blacklist〉
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#184010","#283020"], loc:"エイビス平原 西", sprites:["🧑","🌸","🤩"], dl:[
    { sp:"ナレーション", t:"翌日、ペルシアから届いたメール。\n\n「ポンキチさんと今日13:00からパーティ組む事になったんですけど、\nエルツさんどうでしょうか？」\n\n気持ちに引きずられてはオルガに失礼だ。\nエルツは了承のメールを返した。" },
    { sp:"ナレーション", t:"西門で出会ったポンキチ──\n短くまとめた茶髪、高校生くらいの愛嬌のある顔。" },
    { sp:"ポンキチ", t:"「エルツさんですね！\n聞いてますよ！かなりのプレイヤースキルの持ち主だとか。\nかなりの美形ですね。お兄様って呼んでいいですか？」" },
    { sp:"ポンキチ", t:"「この間のパーティで面白い事あったんですよ。\n大リンクした後にそのメンバーから\n怒涛の罵倒メールが来まして......\nカルマって人です。\nお兄様、パーティ組む時は充分気をつけて下さいよ」" },
    { sp:"エルツ", t:"（思いっきり体験済みだった。\n\nでも、カルマもそこまで悪い奴じゃない。\n感情の表し方がストレートで不器用なだけだ）" },
    { sp:"ナレーション", t:"そうして白亜の門をくぐる三人。\n\nこの世界では「社交性」がプレイヤースキルの一つ。\n無闇なブラックリスト入りを避けるために──\n目指すべきは、なるべく人に悪い印象を与えない存在。\nそれがエルツの信条だった。" },
    { sp:"ポンキチ", t:"「お兄様！　コカトリス三匹の群れ見つけましたよ！\nちょうど良さそうなやつです。\nどうします？やってみます？」" },
    { sp:"ペルシア", t:"「私、釣りやりますね。\nお二人はそれぞれ一匹ずつ担当で！」" },
    { sp:"ナレーション", t:"それぞれが一匹を担当し、\nほぼ同時に仕留めるという完璧な連携を狙う" },
    { sp:"エルツ", t:"「よし、行こう！」" },
    { sp:"ポンキチ", t:"「最高です！お兄様！\nリンク処理も全員ノーダメ！\nこれがセパレイトパーティの真髄ですよ！」" },
    { sp:"ペルシア", t:"「エルツさん、すごい！\n見てた？最後のやつ、\nカウンターで一発で仕留めてた！」" },
    { sp:"エルツ", t:"「ペルシアのストリングスショットで\n釣りも完璧だったし、\nポンキチの死角突きが効いてた。\n\nこれが......理想のパーティだ」", battle:true, multiEnemyTypes:["cocatris_ponki_a","cocatris_ponki_b","cocatris_ponki_c"], battleNext:32 },
  ]},

  // ─────────────────────────────────────────────────────────────
  // S32: 理想形
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1808","#184010","#283020"], loc:"エイビス平原 西", sprites:["🧑","🌸","🤩"], dl:[
    { sp:"ナレーション", t:"三人の狩りは異様な高揚感に包まれた。\n\n釣り・ダメージ・回復を交互に回し\n一時間に六匹のハイペース。\n\nペルシアの流鏑馬のような華麗な矢。\nポンキチの死角からの短剣──\n\n「StingerBite〔スティンガー・バイト〕！」" },
    { sp:"エルツ", t:"「三散華──」\n\n一斬・二斬と当て、剣が光に包まれる。\n\n「三斬！」\n\nそして、エルツの身体から立ち昇る真白な光──\nＬｖ６に到達した！" },
    { sp:"ポンキチ", t:"「おめでとうエルツお兄様！\n正直、完敗でし。\nリンク処理も一人で二匹普通に倒してたし」" },
    { sp:"ペルシア", t:"「ね、だから言ったでしょ」" },
    { sp:"エルツ", t:"「いいパーティをありがとう。\n本当に二人のおかげだよ」" },
    { sp:"ナレーション", t:"今まで最高の効率、最高の会話。\nまさに理想系のパーティだった。\n\nだが──Ｌｖが上がった今、\nかつてのようにスウィフトやリンスと\nＬｖ上げを楽しむ事はできなくなった。\n\n固定パーティは難しい。\nだが、それもまた一つのこの世界の形。\n今はこの時を享受して受け入れよう。", next:33 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S33: 語られる真実
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🎭","🧙","⚔️"], dl:[
    { sp:"ナレーション", t:"夕方のコミュニティルーム。\nオルガの姿もあった。\n\n酒も入り酔いが回った頃、\nドナテロが静かに口を開く。" },
    { sp:"ドナテロ", t:"「野暮だとは分かって聞くんですが、オルガさん。\n何故です？」" },
    { sp:"ナレーション", t:"それは皆が知りたい疑問だった。\nだが誰も言葉にできなかった問い。\n\nオルガはグラスをテーブルに置き、\n静かに語り始めた。" },
    { sp:"オルガ", t:"「......子供が生まれた」" },
    { sp:"ナレーション", t:"「子供が生まれた！？」\n\n一気に解れる緊張。\n何だか肩透かしをくらったような、\nだが嬉しい気持ちが一同を包んだ。\n\n子供が生まれたから、仕事と育児に専念したい。\nそれがオルガの引退理由だった。" },
    { sp:"オルガ", t:"「ここＡＲＣＡＤＩＡには求めていた理想の世界がある。\nだが、自分がこの世界に依存し過ぎている事に気づいた。\n\n現実に守るべきものが出来た今、\nどちらを選択するかは決まっていた」" },
    { sp:"オルガ", t:"「............人は理想の世界では生きられない」" },
    { sp:"ナレーション", t:"その一言がエルツの胸に深く重く響いた。\n頭の中で反復されるその言葉を、\nエルツはただずっと噛みしめていた。", next:34 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S34: 時差ボケ
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1206","#1a2a0a","#100e04"], loc:"スティアルーフ 中央広場 屋台市", sprites:["🧑","🧑‍🦱"], dl:[
    { sp:"ナレーション", t:"氷刻22日の夕方──\nスウィフトが久しぶりにやってきた。\n\nこちらでは二週間。\nスウィフトにとっては現実の半日。\n完全な時差ボケだった。" },
    { sp:"スウィフト", t:"「何だよ、エルツＬｖ６になったの！？早すぎだろ！」" },
    { sp:"エルツ", t:"「この半日で、色々あったんだ。\n\nCityBBS、コカ狩り、ＷＡ、\nそれからオルガさんの引退の事──」" },
    { sp:"スウィフト", t:"「送別会か。予定空けとくよ。\nしっかり現実に生きようって\nその意志は自分も見習わないと」" },
    { sp:"エルツ", t:"「オルガさんが言ったんだ。\n人は理想の世界では生きられない、って」" },
    { sp:"スウィフト", t:"「深いね。でも僕もその通りだと思うよ。\n\n人は理想の世界だけじゃ生きられない──\nそれはつまり、現実世界で人は生きている、\nという言葉の裏返しだよ、きっと。\n\n現実でもがけばもがく程、\n理想が華やかに生きた形を持つんだよ」" },
    { sp:"エルツ", t:"「現実で生きているからこそ理想が生まれる、か」\n\nそれでも、理想の世界でもう少し生きていたい──\nそれが今のエルツの正直な心境だった。", next:35 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S35: Top of Community
  // ─────────────────────────────────────────────────────────────
  { bg:["#1a0e06","#2a1808","#1a1208"], loc:"スティアルーフ コミュニティルーム", sprites:["🧑","🧑‍🦱","👩","👦","👧"], dl:[
    { sp:"ナレーション", t:"氷刻24日──コミュニティルームはかつてない賑わいを見せていた。\n\nオルガの送別会。" },
    { sp:"ドナテロ", t:"「オルガさん、どうなんすか、グリードは倒せそうです？」", sprites:["🧑","🎭","🧙"] },
    { sp:"オルガ", t:"「どうだろうな。\n今狩ったとしたら多分、99.9%の確率で全滅か」", sprites:["🧑","🎭","🧙","⚔️"] },
    { sp:"スニーピィ", t:"「全然駄目じゃないですか」" , sprites:["🧑","🎭","🧙","⚔️"]},
    { sp:"ナレーション", t:"笑い声が溢れる中──\nコミュニティルームの扉が開き、\n今日の主役が姿を現した。\n\n一同が歓声を上げる。\nオルガは表情を綻ばせながら\n満面の笑みを見せた。\n\n――心からの祝福を――\n――さあ、宴の始まりだ――", sprites:["🧑","🎭","🧙","⚔️"], next:36 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S36: 星の送別会
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1206","#1a2a0a","#100e04"], loc:"スティアルーフ 中央広場", sprites:["🧑","👧","🎭","🧙","⚔️"], dl:[
    { sp:"ナレーション", t:"送別会は終始笑いに絶えなかった。\n皆笑顔で思い出を振り返り、絶えない笑いの中で昇華させる。\n\nこれは終わりではなく、新しい旅立ち──", sprites:["🧑","🧑‍🦱","👩","👦","👧"] },
    { sp:"ドナテロ", t:"「最後なんだから相手してやったらどうかね、オルガさん」" , sprites:["🧑","🎭","🧙","⚔️"]},
    { sp:"オルガ", t:"「そうだな。行くかドナテロ？」" , sprites:["🧑","🎭","🧙","⚔️"]},
    { sp:"ナレーション", t:"成り行きで決まった手合わせ。\n一同は胸を躍らせて中央広場へ飛び出す。\n\nトップバッターのドナテロが繰り出す\n至高の突き──\n\n「SteraFlitz〔ステラ・フリッツ〕！！」\n\nオルガは真正面から受け止め立ち尽くした。", sprites:["🎭","⚔️"] },
    { sp:"オルガ", t:"「いい突きだった......今まで受けた中で最高のな。\n\nこれからはこのコミュニティを背負う\n者としての自覚を身に付けて欲しい」" , sprites:["🎭","⚔️"] },
    { sp:"ドナテロ", t:"「いずれその後姿、追い越して見せますよ。必ずね」", sprites:["🎭","⚔️"]  },
    { sp:"ナレーション", t:"続くスニーピィ、ウィル・シュラク・チョッパーの三人、\nリーベルトとフランクのペア、ユミルとケヴィン──\n皆がオルガと手合わせをした。\n\nそして残るはエルツ、スウィフト、リンスの三名。", sprites:["🧑","🧑‍🦱","👩"]  },
    { sp:"エルツ", t:"「オルガさん、行きます！」", sprites:["🧑","🧑‍🦱","👩"], battle:true, multiEnemyTypes:["olga_pet","olga","olga_pet"], battleNext:37 }
  ]},

  // ─────────────────────────────────────────────────────────────
  // S37: 星の送別会 ─ 別れの言葉（オルガ戦後）
  // ─────────────────────────────────────────────────────────────
  { bg:["#0a1206","#1a2a0a","#100e04"], loc:"スティアルーフ 中央広場", sprites:["🧑","🧑‍🦱","👩","⚔️"], dl:[
    { sp:"ナレーション", t:"三散華を試みるエルツ。\nだが一段目の剣撃が当たらなければ技は不発だと\nオルガは見切っていた。\n\n全ての剣撃を弾かれ、最後にBikerSlashを放つも\n冷静に対処されて膝をつく。\n\n一矢も報いる事が出来なかった。\nだが、悔いは残っていなかった。\n全力を尽くしたのだ。" },
    { sp:"オルガ", t:"「いい剣筋だった。\nまたいつか手合わせしたいものだな」" },
    { sp:"ナレーション", t:"それはエルツにとって最高の賛辞だった。\n\n全ての闘いが終わり──\nオルガは兜を外し、その表情を晒した。\n\n「長いようで短かった。ここへ来てから数年。\nシンと出会い、このコミュニティを創設して、\nまさかここまで大所帯になるとは夢にも思わなかった」" },
    { sp:"オルガ", t:"「本心を言うならば、最後までこのコミュニティに身を添えたい。\n心からそう想う。\n\nだが不器用かな。\n現実に守るべきものが出来た今、\nこの世界へ身を置くのは難しくなった」", sprites:["⚔️"] },
    { sp:"ウィル", t:"「おっちゃん辞めんなよ！」" , sprites:["⚔️","😤"]},
    { sp:"スニーピィ", t:"「オルガさん、いつかお子さん大きくなったら、\nその時は家族でまたここへ戻ってきて下さいね」", sprites:["⚔️","🧙"] },
    { sp:"ケヴィン", t:"「俺達ずっと待ってますから！」", sprites:["⚔️","🧙","🧔"] },
    { sp:"オルガ", t:"「......ありがとう」", sprites:["⚔️"] },
    { sp:"ナレーション", t:"星明かりの下、\n別れの言葉が夜空に溶けてゆく。\n\nＷＨＩＴＥＧＡＲＤＥＮの柱が去る夜──\nだがここに集う冒険者達の絆は、\nどこにも消えていかない。\n\nアルカディア──\n理想郷の物語は、まだ続く。", sprites:["🧑","🧑‍🦱","👩","⚔️"], ending:true }
  ]},
];

// @@SECTION:MAIN_COMPONENT
export default function ArcadiaCh2() {
  // @@SECTION:STATE_ADVENTURE
  const [phase, setPhase] = useState("load");
  const [saveFile,  setSaveFile]  = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [bbsData,    setBbsData   ] = useState(null);  // null=未取得
  const [bbsLoading, setBbsLoading] = useState(false);
  const [bbsError,   setBbsError  ] = useState(false);
  const [bbsForceOpen, setBbsForceOpen] = useState(false);
  const [shopData,    setShopData]    = useState(null);   // 全店舗データ
  const [shopLoading, setShopLoading] = useState(false);  // フェッチ中フラグ
  const [shopError,   setShopError]   = useState(null);   // エラーメッセージ
  const [activeShop,  setActiveShop]  = useState(null);   // 表示中の店舗 id
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
  const [bbsSelectedThread, setBbsSelectedThread] = useState(null);
  const [bbsSelectedPost,   setBbsSelectedPost  ] = useState(null); 
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

  // ウィンドウサイズ（リサイズ・回転に動的対応）
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // @@SECTION:STATE_PLAYER
  const [hp, setHp] = useState(115);
  const [mhp, setMhp] = useState(115);
  const [mp, setMp] = useState(95);
  const [mmp, setMmp] = useState(95);
  const [elk, setElk] = useState(500);
  const [lv, setLv] = useState(3);
  const [exp, setExp] = useState(0);
  const [weapon, setWeapon] = useState("なし");
  const [weaponPatk, setWeaponPatk] = useState(0);   // 武器による物理ATK補正（銅の剣+6）削除
  const [statPoints, setStatPoints] = useState(6);
  const [statAlloc, setStatAlloc] = useState({patk:10,pdef:10,matk:10,spd:10});
  const [hasPb, setHasPb] = useState(true);
  const [hasMapScan, setHasMapScan] = useState(true);
  const [hasBbs, setHasBbs] = useState(false);
  const [inCom, setInCom] = useState(true);
  const [showWGInvite, setShowWGInvite] = useState(false);
  const [wgInviteData, setWgInviteData] = useState(null);
  const [wgInviteLoading, setWgInviteLoading] = useState(false);
  const [wgInviteError, setWgInviteError] = useState(null);
  const [chapter, setChapter] = useState(2);
  // ── MapScanバトルドロップカウンター ──────────────────────────────────────
  // { [enemyKey]: number } 戦闘勝利回数
  const [mapScanWinCount, setMapScanWinCount] = useState({});
  const mapScanPendingDropRef = useRef(null); // { dropKey, winCount }
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
  // ── シナリオ引継ぎフルコンボ ──────────────────────────────────────────────
  // MapScan繰り返し戦闘（select/pbのMapScan起動）はカウントしない。
  // コンボミス発生ターン中に即時0リセット。シナリオバトル完全勝利ごとに+1。
  const [scenarioFullCombo, setScenarioFullCombo] = useState(0);
  // true = シナリオ/ダイアログ起動バトル（フルコンボカウント対象）
  // false = MapScan・select画面起動バトル（カウント対象外）
  const isScenarioBattleRef = useRef(false);
  const comboMissedRef = useRef(false); // バトル中にコンボミスが1度でも発生したか
  const sceneIdxBeforeBattle = useRef(0); // 敗北時の戻り先シーン
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
  const [dlUrl, setDlUrl] = useState(null); // エンディング セーブエクスポート用
  const [endPhase, setEndPhase] = useState("rank"); // エンディング内フェーズ: "rank" → "save"

  // ── 属性システム（第二章） ────────────────────────────────────────────────
  const [enemyElementIdx, setEnemyElementIdx] = useState(0);
  const [elemDmgAccum, setElemDmgAccum] = useState(0);
  const [showElemMenu,  setShowElemMenu ] = useState(false); // 廃止予定・互換用（setのみ残す）
  const [showSpecMenu,  setShowSpecMenu ] = useState(false); // 廃止予定・互換用（setのみ残す）
  const [showSkillMenu, setShowSkillMenu] = useState(false); // 統合スキルメニュー
  const [elemBreakAnim, setElemBreakAnim] = useState(false);

  // ── パーティ構成（動的切り替え） ────────────────────────────────────────────
  const [currentPartyKeys, setCurrentPartyKeys] = useState(DEFAULT_PARTY_KEYS);

  // ── パーティーHP・MP（第二章専用） ──────────────────────────────────────
  // 主人公はメインのhp/mhp/mp/mmpで管理。仲間の個別HP/MPは partyHp/Mp で管理。
  const [partyHp,  setPartyHp ] = useState(() => buildPartyInit(DEFAULT_PARTY_KEYS).hp);
  const [partyMhp, setPartyMhp] = useState(() => buildPartyInit(DEFAULT_PARTY_KEYS).mhp);
  const [partyMp,  setPartyMp ] = useState(() => buildPartyInit(DEFAULT_PARTY_KEYS).mp);
  const [partyMmp, setPartyMmp] = useState(() => buildPartyInit(DEFAULT_PARTY_KEYS).mmp);

  // ── パーティーコマンド入力フェーズ（第二章専用） ────────────────────────
  // PARTY_MEMBERS: 固定順序でコマンド入力を回す
  // inputPhase: "command" = コマンド入力中, "execute" = 実行中（ボタン無効）
  // pendingCommands: { memberId → skillId } 収集バッファ
  // cmdInputIdx: 現在コマンド入力中のメンバーインデックス（0〜3）
  const [inputPhase, setInputPhase] = useState("command"); // "command" | "execute"
  const [pendingCommands, setPendingCommands] = useState({}); // { eltz,swift,linz,chopper → skillId }
  const [cmdInputIdx, setCmdInputIdx] = useState(0); // 0=エルツ,1=スウィフト,2=リンス,3=チョッパー
  // ターン実行キュー: { mode:"multi"|"single", cmds, targets } が入ったらuseEffectで実行
  const [pendingExecution, setPendingExecution] = useState(null);

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

 // 行動順序を逆転させる
  const [reverseActive, setReverseActive] = useState(0);

  // リバースエフェクト：null=非表示, 0〜9=フレーム番号（12fps×10f=5ループ）
  const [reverseAnimFrame, setReverseAnimFrame] = useState(null);
  const REVERSE_ANIM_URLS = [
    "https://superapolon.github.io/Arcadia_Assets/Animation/enemyskill/Reverse/Eff_reverse_00.webp",
    "https://superapolon.github.io/Arcadia_Assets/Animation/enemyskill/Reverse/Eff_reverse_01.webp",
  ];
  const REVERSE_ANIM_FPS    = 2;
  const REVERSE_ANIM_FRAMES = 5; // 5ループ × 2フレーム
  const REVERSE_ANIM_INTERVAL = Math.round(1000 / REVERSE_ANIM_FPS); // ≒83ms
  const reverseAnimTimerRef = useRef(null);

  const playReverseEffect = useCallback(() => {
    // 再生中は上書きしない
    if (reverseAnimTimerRef.current) return;
    let frame = 0;
    setReverseAnimFrame(0);
    reverseAnimTimerRef.current = setInterval(() => {
      frame++;
      if (frame < REVERSE_ANIM_FRAMES) {
        setReverseAnimFrame(frame);
      } else {
        clearInterval(reverseAnimTimerRef.current);
        reverseAnimTimerRef.current = null;
        setReverseAnimFrame(null);
      }
    }, REVERSE_ANIM_INTERVAL);
  }, []);

  // provokeActive > 0 のとき敵の行動を強制的にatkに変換する（残りターン数）。
  const [provokeActive,   setProvokeActive  ] = useState(0);

  // takedownActive > 0: このターン敵を行動不能にする（使用した次ターン反映）
  const [takedownActive,   setTakedownActive  ] = useState(0);


  // sleepActive > 0: 敵全員を行動不能にする残りターン数
  const [sleepActive,   setSleepActive  ] = useState(0);
  // overhealCooldown > 0: CD中。使用後2T経過で再使用可。

  // ── 新スキルstate ──────────────────────────────────────────────────────────
  const [bikerAtkBonus,        setBikerAtkBonus       ] = useState(0);
  const [straightShotActive,   setStraightShotActive  ] = useState(0);
  const [slowbladeActive,      setslowbladeActive        ] = useState(0);
  const [waterSphereActive,    setWaterSphereActive   ] = useState(0);
  const [memberCdMap,          setMemberCdMap         ] = useState({}); // ← 追加
  // playerStunActive > 0: 敵スキル（テイクダウン等）によりパーティが行動不能な残りターン数
  const [playerStunActive,     setPlayerStunActive    ] = useState(0);
   // ── プレイング分析ステート ──────────────────────────────────────────────
   const [battleAnalytics, setBattleAnalytics] = useState([]);
   const [totalElemBreaks, setTotalElemBreaks] = useState(0);
   const [currentBattleTotalTurns, setcurrentBattleTotalTurns] = useState(0);
   const [currentBattleComboTurns, setcurrentBattleComboTurns] = useState(0);
   const [currentBattleElemBreaks, setcurrentBattleElemBreaks] = useState(0);
   const [powerCandyUsed, setPowerCandyUsed] = useState({});
   const [speedCandyUsed, setSpeedCandyUsed] = useState({});
   const [eltzSpdBonus, setEltzSpdBonus] = useState(0);
   const currentBattleCmdCountsRef = useRef({});
   // ── 所持品ステート ──────────────────────────────────────────────────────
    // ── 品質ステータス計算ヘルパー ─────────────────────────────────────
    const QUALITY_RANK = { N:0, R:1, SR:2, SSR:3 };
    const QUALITY_MULT = 1.125;
    const applyQuality = (baseVal, quality) => {
      const rank = QUALITY_RANK[quality] ?? 0;
      if (baseVal === 0) return 0;
      return Math.ceil(baseVal * Math.pow(QUALITY_MULT, rank));
    };
    // アイテムの実効ステータスを品質込みで返す
    const effectiveStats = (item) => ({
      patk: applyQuality(item.basePatk ?? item.patk, item.quality ?? "N"),
      pdef: applyQuality(item.basePdef ?? item.pdef, item.quality ?? "N"),
    });

    const [inventory, setInventory] = useState([
      { id:"copper_sword",   name:"銅の剣",        type:"weapon",    basePatk:6,  basePdef:0, spd:0, quality:"N", quantity:1 },
      { id:"travelers_coat", name:"旅人の服",       type:"armor",     basePatk:0,  basePdef:3, spd:0, quality:"N", quantity:1 },
      { id:"beginner_cert",  name:"初心者講習の証", type:"accessory", basePatk:1,  basePdef:1, spd:0, quality:"N", quantity:1 },
    ]);
  // { id:string, name:string, type:"weapon"|"armor"|"accessory", desc:string }
  // ── 装備ステート ────────────────────────────────────────────────────────
  const [equippedWeapon,    setEquippedWeapon   ] = useState({ id:"copper_sword",   name:"銅の剣",        type:"weapon",    basePatk:6,  basePdef:0, spd:0, quality:"N", quantity:1 });
  const [equippedArmor,     setEquippedArmor    ] = useState({ id:"travelers_coat", name:"旅人の服",       type:"armor",     basePatk:0,  basePdef:3, spd:0, quality:"N", quantity:1 });
  const [equippedAccessory, setEquippedAccessory] = useState({ id:"beginner_cert",  name:"初心者講習の証", type:"accessory", basePatk:1,  basePdef:1, spd:0, quality:"N", quantity:1 });

  // ── 全体攻撃アニメーション（dragon_rush.webp） ──────────────────────────────
  // CSSアニメーションはiPad/Safariで状態が引き継がれるバグがあるため
  // JS(requestAnimationFrame)でscaleを直接制御する方式に変更
  const [showAtkAllAnim, setShowAtkAllAnim] = useState(false);
  const [atkAllAnimKey, setAtkAllAnimKey] = useState(0); // 再マウント用キー
  const [atkAllScale, setAtkAllScale] = useState(1);    // JS制御スケール値
  const atkAllRafRef = useRef(null);
  useEffect(() => {
    if (!showAtkAllAnim) {
      if (atkAllRafRef.current) { cancelAnimationFrame(atkAllRafRef.current); atkAllRafRef.current = null; }
      setAtkAllScale(1);
      return;
    }
    setAtkAllScale(1);
    const duration = 2000;
    const startScale = 0.5;
    const endScale   = 4;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAtkAllScale(startScale + (endScale - startScale) * progress);
      if (progress < 1) {
        atkAllRafRef.current = requestAnimationFrame(step);
      } else {
        atkAllRafRef.current = null;
        setShowAtkAllAnim(false);
      }
    };
    atkAllRafRef.current = requestAnimationFrame(step);
    return () => {
      if (atkAllRafRef.current) { cancelAnimationFrame(atkAllRafRef.current); atkAllRafRef.current = null; }
    };
  }, [showAtkAllAnim, atkAllAnimKey]);

  // ── ヒット・討伐エフェクト ─────────────────────────────────────────────────
  // hitEffects:   [{ id, slotIdx, dmg, type }]  type="normal"|"weak"|"elem_break"|"heal"
  // defeatEffects:[{ id, slotIdx }]
  // hitSlotIdsRef: Map<slotIdx, latestHitId> を ref で直接管理（stale closure 完全回避）
  //                再レンダリングは hitFlashTick で強制トリガーする
  const [hitEffects,    setHitEffects   ] = useState([]);
  const [defeatEffects, setDefeatEffects] = useState([]);
  const hitSlotIdsRef  = useRef(new Map());  // ref: タイマーから直接読み書き
  const [hitFlashTick, setHitFlashTick ] = useState(0); // 再レンダリング用カウンター
  const hitEffectIdRef = useRef(0);

  // ── ヒットスプライトアニメーション（Attack00 連番PNG）────────────────────────
  // hitSprites: [{ id, slotIdx, frame }]  frame: 0→1→2 (12fps, 0.25s = 3frames)
  const [hitSprites, setHitSprites] = useState([]);
  const HIT_SPRITE_URLS = [
    "https://superapolon.github.io/Arcadia_Assets/Animation/playerskill/Attack00/Eff_Attack00_1.png",
    "https://superapolon.github.io/Arcadia_Assets/Animation/playerskill/Attack00/Eff_Attack00_2.png",
    "https://superapolon.github.io/Arcadia_Assets/Animation/playerskill/Attack00/Eff_Attack00_3.png",
  ];
  const HIT_SPRITE_FPS    = 12;
  const HIT_SPRITE_FRAMES = 3;
  const HIT_SPRITE_INTERVAL = Math.round(1000 / HIT_SPRITE_FPS); // ≒83ms

  const typeTimerRef = useRef(null);
  const notifTimerRef = useRef(null);
  const textScrollRef = useRef(null);
  const tapStartYRef  = useRef(0);   // スクロール判定用
  const autoAdvTimerRef = useRef(null); // オート進行タイマー

  // ── SE（効果音）WebAudio API ─────────────────────────────────────────────────
  // 外部ファイル不要。AudioContext をオンデマンド生成し、プログラムでSEを合成する。
  // audioUnlocked.current が true のとき（ユーザー操作後）のみ再生。
  const seCtxRef = useRef(null);
  const getSECtx = useCallback(() => {
    if (!seCtxRef.current) {
      try { seCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return seCtxRef.current;
  }, []);

  // 通常斬撃音: MP3があればそちらを再生。なければ AudioContext 合成にフォールバック。
  const playSEHit = useCallback(() => {
    if (!audioUnlocked.current) return;
    const url = seUrl("se/hit");
    if (url) { try { const a = new Audio(url); a.volume = 0.8; a.play().catch(()=>{}); } catch(e){} return; }
    // ── フォールバック: プログラム合成 ──────────────────────────────────────
    const ctx = getSECtx(); if (!ctx) return;
    const t = ctx.currentTime;

    // ─① スウィッシュ（空気を斬る）: 高周波ノイズが素早く通過する ─
    const swSize = Math.floor(ctx.sampleRate * 0.055);
    const swBuf  = ctx.createBuffer(1, swSize, ctx.sampleRate);
    const swData = swBuf.getChannelData(0);
    for (let i = 0; i < swSize; i++) {
      const env = Math.sin((i / swSize) * Math.PI); // 山なりエンベロープ
      swData[i] = (Math.random() * 2 - 1) * env;
    }
    const sw = ctx.createBufferSource(); sw.buffer = swBuf;
    const swFlt = ctx.createBiquadFilter(); swFlt.type = "highpass"; swFlt.frequency.value = 3500;
    const swFlt2 = ctx.createBiquadFilter(); swFlt2.type = "lowpass";  swFlt2.frequency.value = 9000;
    const swGain = ctx.createGain();
    swGain.gain.setValueAtTime(0.0, t);
    swGain.gain.linearRampToValueAtTime(0.55, t + 0.022);
    swGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    sw.connect(swFlt); swFlt.connect(swFlt2); swFlt2.connect(swGain); swGain.connect(ctx.destination);
    sw.start(t); sw.stop(t + 0.056);

    // ─② 金属インパクト（刃が当たる瞬間）: ホワイトノイズを短く鋭く ─
    const impSize = Math.floor(ctx.sampleRate * 0.035);
    const impBuf  = ctx.createBuffer(1, impSize, ctx.sampleRate);
    const impData = impBuf.getChannelData(0);
    for (let i = 0; i < impSize; i++) {
      impData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impSize, 2.5);
    }
    const imp = ctx.createBufferSource(); imp.buffer = impBuf;
    const impFlt = ctx.createBiquadFilter(); impFlt.type = "bandpass"; impFlt.frequency.value = 2200; impFlt.Q.value = 1.2;
    const impGain = ctx.createGain();
    impGain.gain.setValueAtTime(0.7, t + 0.04);
    impGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    imp.connect(impFlt); impFlt.connect(impGain); impGain.connect(ctx.destination);
    imp.start(t + 0.04); imp.stop(t + 0.076);

    // ─③ 金属共鳴（刃の余韻）: 短いピッチ下降トーン ─
    const ring = ctx.createOscillator(); ring.type = "sawtooth";
    ring.frequency.setValueAtTime(900, t + 0.042);
    ring.frequency.exponentialRampToValueAtTime(320, t + 0.13);
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0.12, t + 0.042);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    const ringFlt = ctx.createBiquadFilter(); ringFlt.type = "lowpass"; ringFlt.frequency.value = 4000;
    ring.connect(ringFlt); ringFlt.connect(ringGain); ringGain.connect(ctx.destination);
    ring.start(t + 0.042); ring.stop(t + 0.14);
  }, [getSECtx]);

  // 弱点ヒット音: MP3があればそちらを再生。なければ AudioContext 合成にフォールバック。
  const playSEWeakHit = useCallback(() => {
    if (!audioUnlocked.current) return;
    const url = seUrl("se/weak_hit");
    if (url) { try { const a = new Audio(url); a.volume = 0.85; a.play().catch(()=>{}); } catch(e){} return; }
    // ── フォールバック: プログラム合成 ──────────────────────────────────────
    const ctx = getSECtx(); if (!ctx) return;
    const t = ctx.currentTime;

    // ─ 2段ヒット ─
    [0, 0.07].forEach((delay, hi) => {
      // スウィッシュ
      const swSize = Math.floor(ctx.sampleRate * 0.05);
      const swBuf = ctx.createBuffer(1, swSize, ctx.sampleRate);
      const swData = swBuf.getChannelData(0);
      for (let i = 0; i < swSize; i++) swData[i] = (Math.random() * 2 - 1) * Math.sin((i / swSize) * Math.PI);
      const sw = ctx.createBufferSource(); sw.buffer = swBuf;
      const swF = ctx.createBiquadFilter(); swF.type = "highpass"; swF.frequency.value = 4000;
      const swG = ctx.createGain();
      swG.gain.setValueAtTime(0.45, t + delay);
      swG.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05);
      sw.connect(swF); swF.connect(swG); swG.connect(ctx.destination);
      sw.start(t + delay); sw.stop(t + delay + 0.051);

      // インパクト
      const impSize = Math.floor(ctx.sampleRate * 0.03);
      const impBuf = ctx.createBuffer(1, impSize, ctx.sampleRate);
      const impData = impBuf.getChannelData(0);
      for (let i = 0; i < impSize; i++) impData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impSize, 3);
      const imp = ctx.createBufferSource(); imp.buffer = impBuf;
      const impF = ctx.createBiquadFilter(); impF.type = "bandpass"; impF.frequency.value = 2800; impF.Q.value = 1.5;
      const impG = ctx.createGain();
      impG.gain.setValueAtTime(0.8, t + delay + 0.038);
      impG.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.068);
      imp.connect(impF); impF.connect(impG); impG.connect(ctx.destination);
      imp.start(t + delay + 0.038); imp.stop(t + delay + 0.069);
    });

    // ─ 弱点ヒット特有：高音の金属共鳴が長く残る ─
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + 0.08 + i * 0.01);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.38);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, t + 0.08 + i * 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t + 0.08 + i * 0.01); osc.stop(t + 0.39);
    });
  }, [getSECtx]);

  // 討伐音: MP3があればそちらを再生。なければ AudioContext 合成にフォールバック。
  const playSEDefeat = useCallback(() => {
    if (!audioUnlocked.current) return;
    const url = seUrl("se/defeat");
    if (url) { try { const a = new Audio(url); a.volume = 0.9; a.play().catch(()=>{}); } catch(e){} return; }
    // ── フォールバック: プログラム合成 ──────────────────────────────────────
    const ctx = getSECtx(); if (!ctx) return;
    const t = ctx.currentTime;

    // ─① 重いスウィッシュ（大振り） ─
    const swSize = Math.floor(ctx.sampleRate * 0.08);
    const swBuf = ctx.createBuffer(1, swSize, ctx.sampleRate);
    const swData = swBuf.getChannelData(0);
    for (let i = 0; i < swSize; i++) swData[i] = (Math.random() * 2 - 1) * Math.sin((i / swSize) * Math.PI);
    const sw = ctx.createBufferSource(); sw.buffer = swBuf;
    const swF = ctx.createBiquadFilter(); swF.type = "bandpass"; swF.frequency.value = 1200; swF.Q.value = 0.5;
    const swG = ctx.createGain();
    swG.gain.setValueAtTime(0.6, t); swG.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    sw.connect(swF); swF.connect(swG); swG.connect(ctx.destination);
    sw.start(t); sw.stop(t + 0.081);

    // ─② 鋭いインパクト（討伐の一撃） ─
    const impSize = Math.floor(ctx.sampleRate * 0.05);
    const impBuf = ctx.createBuffer(1, impSize, ctx.sampleRate);
    const impData = impBuf.getChannelData(0);
    for (let i = 0; i < impSize; i++) impData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impSize, 2);
    const imp = ctx.createBufferSource(); imp.buffer = impBuf;
    const impF = ctx.createBiquadFilter(); impF.type = "bandpass"; impF.frequency.value = 1800; impF.Q.value = 0.9;
    const impG = ctx.createGain();
    impG.gain.setValueAtTime(1.0, t + 0.06); impG.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    imp.connect(impF); impF.connect(impG); impG.connect(ctx.destination);
    imp.start(t + 0.06); imp.stop(t + 0.111);

    // ─③ 低音ドーン（ボディブロー感） ─
    const boom = ctx.createOscillator(); boom.type = "sine";
    boom.frequency.setValueAtTime(90, t + 0.06);
    boom.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    const boomG = ctx.createGain();
    boomG.gain.setValueAtTime(0.55, t + 0.06); boomG.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    boom.connect(boomG); boomG.connect(ctx.destination);
    boom.start(t + 0.06); boom.stop(t + 0.51);

    // ─④ 金属余韻（刃が空気を振動させる） ─
    [520, 780].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t + 0.07);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.45);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08 - i * 0.02, t + 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = 3000;
      osc.connect(flt); flt.connect(g); g.connect(ctx.destination);
      osc.start(t + 0.07); osc.stop(t + 0.46);
    });
  }, [getSECtx]);

  // ── ヒット・討伐エフェクト発火ヘルパー ────────────────────────────────────────
  // slotIdx: multiEnemies の配列インデックス（単体バトルは常に 0）
  const fireHitEffect = useCallback((slotIdx, dmg, type = "normal") => {
    const id = ++hitEffectIdRef.current;
    setHitEffects(prev => [...prev, { id, slotIdx, dmg, type }]);
    setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== id)), 700);
    // ref に直接書き込み（stale closure なし）→ tick で再レンダリングを強制
    hitSlotIdsRef.current.set(slotIdx, id);
    setHitFlashTick(t => t + 1);
    setTimeout(() => {
      // 自分のIDがまだ最新のときだけ削除
      if (hitSlotIdsRef.current.get(slotIdx) === id) {
        hitSlotIdsRef.current.delete(slotIdx);
        setHitFlashTick(t => t + 1); // 再レンダリングを強制して brightness を戻す
      }
    }, 320);
    // SE再生
    if (type === "weak") playSEWeakHit(); else playSEHit();

    // ── ヒットスプライトアニメーション起動（Attack00 連番PNG 12fps/3f） ──────
    const spriteId = id;
    setHitSprites(prev => [...prev, { id: spriteId, slotIdx, frame: 0 }]);
    let sprFrame = 0;
    const advance = setInterval(() => {
      sprFrame++;
      if (sprFrame < HIT_SPRITE_FRAMES) {
        setHitSprites(prev => prev.map(s => s.id === spriteId ? { ...s, frame: sprFrame } : s));
      } else {
        clearInterval(advance);
        setHitSprites(prev => prev.filter(s => s.id !== spriteId));
      }
    }, HIT_SPRITE_INTERVAL);
  }, [playSEHit, playSEWeakHit]);

  const fireDefeatEffect = useCallback((slotIdx) => {
    const id = ++hitEffectIdRef.current;
    setDefeatEffects(prev => [...prev, { id, slotIdx }]);
    setTimeout(() => setDefeatEffects(prev => prev.filter(e => e.id !== id)), 1300);
    // 討伐時は全スロットを即クリア
    hitSlotIdsRef.current.clear();
    setHitEffects(prev => prev.filter(e => e.slotIdx !== slotIdx));
    setHitFlashTick(t => t + 1);
    // SE再生
    playSEDefeat();
  }, [playSEDefeat]);
          useEffect(() => {
            if (pbTab !== 4 || shopData || shopLoading) return;
            setShopLoading(true);
            fetch(SHOP_DATA_URL)
              .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
              .then(json => { setShopData(json); setShopLoading(false); })
              .catch(err => { setShopError(err.message); setShopLoading(false); });
          }, [pbTab, shopData, shopLoading]);
  // @@SECTION:BGM_CONTROL ──────────────────────────────────────────────────────
  // BGM制御 ref・fadeOut/fadeIn/switchBgm/unlockAudio/playFanfare
  // AutoPlay Policy 対応：ユーザー操作前は pendingBgmRef に積み、操作後に再生開始
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
    // WebAudio AudioContext が suspended の場合に resume（iOS対策）
    if (seCtxRef.current && seCtxRef.current.state === "suspended") {
      seCtxRef.current.resume().catch(() => {});
    }
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
  // BBS データ fetch（初回のみ）
  useEffect(() => {
    if (bbsData || bbsLoading || bbsError) return;
    setBbsLoading(true);
    fetch("https://superapolon.github.io/Arcadia_Assets/bbs/ch2.json")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => { setBbsData(json); setBbsLoading(false); })
      .catch(() => { setBbsError(true); setBbsLoading(false); });
  }, []);
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

  const gainItem = useCallback((item) => {
    const q = item.quality ?? "N";
    setInventory(prev => {
      const existing = prev.find(i => i.id === item.id && (i.quality ?? "N") === q);
      if (existing) {
        if (existing.quantity >= 999) { showNotif(`${item.name} はこれ以上持てません`); return prev; }
        showNotif(`📦 ${item.name}【${q}】を入手した！ (×${existing.quantity + 1})`);
        return prev.map(i => (i.id === item.id && (i.quality ?? "N") === q) ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (prev.length >= 100) { showNotif("所持品がいっぱいです！"); return prev; }
      showNotif(`📦 ${item.name}【${q}】を入手した！`);
      return [...prev, { ...item, quality: q, quantity: 1 }];
    });
  }, [showNotif]);

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
    if (dl.openBbs) {
      setHasBbs(true);
      setTimeout(() => {
        setOverlay("pb");
        setPbTab(6);
        setBbsForceOpen(true);
      },1600);
    }

    // Battle フラグあり → テキストを表示してタップを待つ（onTapDlg でバトル突入）
    // ※ showDl からは即バトル突入しない。タップ・オートで onTapDlg が処理する。

    // Ending
    if (dl.ending) {
      startType(dl.t, () => setTimeout(() => { setFade(true); setTimeout(() => { setPhase("end"); setFade(false); }, 600); }, 1200));
      return;
    }

    startType(dl.t, () => {
      if (dl.choices) { setChoices(dl.choices); return; }
      // バトルフラグあり → オートでもここでは何もしない（タップで onTapDlg が処理）
      if (dl.battle) return;
      // Ending → autoでも止める（タップ待ち）
      if (dl.ending) return;
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

  // ── BGM切り替え（フェーズ・シーン・ダイアログ行・バトル敵が変わるたびに呼ぶ）──
  // dl.loc が指定されている場合はそのlocでBGMを解決する
  useEffect(() => {
    const sc2   = SCENES[sceneIdx];
    const dl2   = sc2?.dl[dlIdx];
    const sceneLoc = dl2?.loc ?? sc2?.loc;
    const nextId   = resolveBgmId(phase, sceneLoc, currentEnemyType);
    switchBgm(nextId);
  }, [phase, sceneIdx, dlIdx, currentEnemyType, switchBgm]);

  // アンマウント時にBGM・オートタイマーを停止
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (fanfareRef.current) fanfareRef.current.pause();
      if (autoAdvTimerRef.current) clearTimeout(autoAdvTimerRef.current);
    };
  }, []);

  // エンディング再突入時に endPhase をランク画面へリセット
  useEffect(() => {
    if (phase === "end") setEndPhase("rank");
  }, [phase]);

  // ウィンドウリサイズ・画面回転をトラッキング
  useEffect(() => {
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    if (screen?.orientation) screen.orientation.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (screen?.orientation) screen.orientation.removeEventListener("change", onResize);
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



    // ── バトル突入フラグ ────────────────────────────────────────────────────
    if (dl.battle) {
      sceneIdxBeforeBattle.current = sceneIdx; // 敗北時の戻り先を記録
      isScenarioBattleRef.current = true; // シナリオ起動バトル（フルコンボカウント対象）
      comboMissedRef.current = false; // コンボミスフラグをリセット
      // マルチ敵バトル
      if (dl.multiEnemyTypes && Array.isArray(dl.multiEnemyTypes)) {
        const types = dl.multiEnemyTypes;
        const firstDef = battleDefs[types[0]];
        setBattleEnemy(firstDef);
        setCurrentEnemyType(types[0]);
        setEnemyHp(firstDef.maxHp);
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
        setBattleNext(dl.battleNext !== undefined ? dl.battleNext : sceneIdx + 1);
        setEnemyElementIdx(0); setElemDmgAccum(0); setShowElemMenu(false); setShowSpecMenu(false); setElemBreakAnim(false);
        { const pKeys = BATTLE_PARTY_MAP[types[0]] || DEFAULT_PARTY_KEYS;
          setCurrentPartyKeys(pKeys);
          const pi = buildPartyInit(pKeys);
          setPartyHp(pi.hp); setPartyMhp(pi.mhp); setPartyMp(pi.mp); setPartyMmp(pi.mmp); }
        setInputPhase("command"); setPendingCommands({}); setPendingTargets({}); setPendingTargetSelect(null); setCmdInputIdx(0);
        setEnemySpdDebuff(0); setEnrageCount(0); setEnemyAtkDebuff(0); setPartySpdBuff(0);  setProvokeActive(0); setTakedownActive(0); setSleepActive(0); setBikerAtkBonus(0); setStraightShotActive(0);  setWaterSphereActive(0); setslowbladeActive(0); setPlayerStunActive(0);  
        setPhase("battle");
        return;
      }
      // 単体バトル
      const eKey = dl.battleType || "seagull";
      const ed = battleDefs[eKey];
      setBattleEnemy(ed);
      setCurrentEnemyType(eKey);
      setEnemyHp(ed.maxHp);
      setBtlLogs([`⚔ ${ed.name} との戦闘が始まった！`]);
      setGuarding(false); setVictory(false); setDefeat(false); setTurn(0); setNoDmgStreak(0);
      setBattleResultBonus({ comboMult:1.0, gradeMult:1.0 });
      setEnemyTurnIdx(0);
      setEnemyNextAction((ed.pattern || ["atk"])[0]);
      setBattleNext(dl.battleNext !== undefined ? dl.battleNext : sceneIdx + 1);
      setEnemyElementIdx(0); setElemDmgAccum(0); setShowElemMenu(false); setShowSpecMenu(false); setElemBreakAnim(false);
      { const pKeys = BATTLE_PARTY_MAP[eKey] || DEFAULT_PARTY_KEYS;
        setCurrentPartyKeys(pKeys);
        const pi = buildPartyInit(pKeys);
        setPartyHp(pi.hp); setPartyMhp(pi.mhp); setPartyMp(pi.mp); setPartyMmp(pi.mmp); }
      setInputPhase("command"); setPendingCommands({}); setPendingTargets({}); setPendingTargetSelect(null); setCmdInputIdx(0);
      setEnemySpdDebuff(0); setEnrageCount(0); setEnemyAtkDebuff(0); setPartySpdBuff(0); setProvokeActive(0); setTakedownActive(0); setSleepActive(0); setBikerAtkBonus(0); setStraightShotActive(0); setWaterSphereActive(0);setslowbladeActive(0); setPlayerStunActive(0);
      setMultiEnemies(null);
      setPhase("battle");
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
  }, [choices, typing, sceneIdx, dlIdx, battleDefs]);

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
      sceneIdxBeforeBattle.current = sceneIdx; // 敗北時の戻り先を記録
      isScenarioBattleRef.current = true; // シナリオ起動バトル（フルコンボカウント対象）
      comboMissedRef.current = false; // コンボミスフラグをリセット
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
        { const pKeys = BATTLE_PARTY_MAP[types[0]] || DEFAULT_PARTY_KEYS;
          setCurrentPartyKeys(pKeys);
          const pi = buildPartyInit(pKeys);
          setPartyHp(pi.hp); setPartyMhp(pi.mhp); setPartyMp(pi.mp); setPartyMmp(pi.mmp); }
        setInputPhase("command"); setPendingCommands({}); setPendingTargets({}); setPendingTargetSelect(null); setCmdInputIdx(0);
        setEnemySpdDebuff(0); setEnrageCount(0); setEnemyAtkDebuff(0); setPartySpdBuff(0);  setProvokeActive(0); setTakedownActive(0); setSleepActive(0); setBikerAtkBonus(0); ssetStraightShotActive(0); etWaterSphereActive(0);setslowbladeActive(0)
        setMemberCdMap({});  // 1行でリセット完了
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
      { const pKeys = BATTLE_PARTY_MAP[eKey] || DEFAULT_PARTY_KEYS;
        setCurrentPartyKeys(pKeys);
        const pi = buildPartyInit(pKeys);
        setPartyHp(pi.hp); setPartyMhp(pi.mhp); setPartyMp(pi.mp); setPartyMmp(pi.mmp); }
      setInputPhase("command"); setPendingCommands({}); setPendingTargets({}); setPendingTargetSelect(null); setCmdInputIdx(0);
      setEnemySpdDebuff(0); setEnrageCount(0); setEnemyAtkDebuff(0); setPartySpdBuff(0); setProvokeActive(0); setTakedownActive(0); setSleepActive(0); setBikerAtkBonus(0); setStraightShotActive(0); setWaterSphereActive(0);setslowbladeActive(0); setPlayerStunActive(0);
      setMemberCdMap({});  // 1行でリセット完了
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
  // ─── パーティ定義（currentPartyKeysから動的生成） ─────────────────────────
  // currentPartyKeys はバトル突入時に BATTLE_PARTY_MAP から設定される
  const PARTY_DEFS = currentPartyKeys.map(k => {
    const c = ALL_CHAR_DEFS[k];
    if (!c) return null;
    if (k === "eltz") return { ...c, spd: c.spd + eltzSpdBonus };
    return c;
  }).filter(Boolean);
  const ENEMY_BASE_SPD = 12; // シムルー基本SPD

  // ─── すくみ判定ヘルパー ────────────────────────────────────────────────
  function judgeRPS(playerAction, enemyAction) {
    if (enemyAction === "unavoidable") {
      if (playerAction === "counter" || playerAction === "dodge") return "lose_unavoidable";
      return "neutral";
    }
    if (playerAction === "atk"     && enemyAction === "counter") return "lose";
    if (playerAction === "counter" && enemyAction === "atk")     return "win";
    if (playerAction === "counter" && enemyAction === "dodge")   return "lose";   // 敵dodge+反撃
    if (playerAction === "dodge"   && enemyAction === "counter") return "win";    // dodge+反撃
    if (playerAction === "dodge"   && enemyAction === "atk")     return "lose";   // 被弾
    if (playerAction === "atk"     && enemyAction === "dodge")   return "win";    // 直撃
    if (playerAction === "dodge"   && enemyAction === "dodge")   return "neutral"; // 相殺
    return "neutral";
  }

  const ENEMY_ACTION_LABEL = {
    atk:              { icon:"⚔",  text:"強攻" },
    counter:          { icon:"🔄", text:"カウンター" },
    dodge:            { icon:"💨", text:"回避" },
    unavoidable:      { icon:"💥", text:"回避不能攻撃！" },
    atk_all:          { icon:"🌊", text:"全体攻撃！" },
    enrage:           { icon:"🔴", text:"怒り状態！" },
    // SKILL_DEFS のスキルは動的にフォールバック（下のヘルパーで解決）
  };
  // 敵行動ラベル取得ヘルパー（SKILL_DEFSにもフォールバック）
  const getEnemyActionLabel = (actionId) => {
    if (ENEMY_ACTION_LABEL[actionId]) return ENEMY_ACTION_LABEL[actionId];
    const sk = SKILL_DEFS[actionId];
    if (sk) return { icon: sk.icon, text: sk.label };
    return { icon:"⚔", text: actionId };
  };
  // ── スキルCDの一元取得ヘルパー ────────────────────────────────────────────
  // SKILL_DEFS に cooldown > 0 のスキルを全て網羅する。
  // ── 変更後（sharedCd分岐を削除、依存配列も整理）──
  const getSkillCd = useCallback((skillId, memberId) => {
    return memberCdMap[skillId]?.[memberId] ?? 0;
  }, [memberCdMap]);
  // @@SECTION:LOGIC_SELECT_CMD ──────────────────────────────────────────────────
  // onSelectCommand：コマンド登録・CD/MP/スキル制限チェック・戦闘不能スキップ
  // ─── コマンド登録（コマンドフェーズ専用） ───────────────────────────────
  const onSelectCommand = useCallback((skillId) => {
    if (victory || defeat || inputPhase !== "command") return;
    setShowElemMenu(false);
    setShowSpecMenu(false);
    setShowSkillMenu(false);

    const member = PARTY_DEFS[cmdInputIdx];
    const elemSk = ELEMENT_SKILL_DEFS.find(s => s.id === skillId);
    const baseSk = BATTLE_SKILLS.find(s => s.id === skillId);
    // 特殊スキルは全てコスト0として扱う
    const SPECIAL_IDS = [
      "provoke","takedown","overheal","sleep",
      "biker_slash","sansanka","stinger_bite","straight_shot","arrow_rain","water_sphere",
      // 新規追加
      "trick_attack","flat_strike","slow_blade","penetrate","spiral_axe","double_arrow",
      "double_bite","deep_edge","seesaw","windmill","onslaught",
      "fireball","stone_blitz","air_cutter","thunderbolt",
    ];
    const specialSk = SPECIAL_IDS.includes(skillId) ? { id:skillId, cost:0, dmg:[0,0] } : null;
    const sk = elemSk || baseSk || specialSk;
    if (!sk) return;
    // キャラ別スキル使用可否チェック（skills リストで統合管理）
    if (!member.skills.includes(skillId)) {
      showNotif(`${member.name}はこのスキルを使えない！`); return;
    }
    // エルツ専用：武器依存スキルチェック
    // 基本4種は素手でも使用可。それ以外は武器のWEAPON_SKILL_MAPに従う。
    if (member.id === "eltz" && !ELTZ_BASE_SKILLS.includes(skillId)) {
      if (!equippedWeapon) {
        showNotif("武器を装備しないとこのスキルは使えない！"); return;
      }
      const allowedByWeapon = WEAPON_SKILL_MAP[equippedWeapon.id] ?? [];
      if (!allowedByWeapon.includes(skillId)) {
        showNotif(`「${equippedWeapon.name}」ではこのスキルは使えない！`); return;
      }
    }
    const sk_def = SKILL_DEFS[skillId];
    if (sk_def && sk_def.cooldown > 0) {
      const cd = getSkillCd(skillId, member.id);
      if (cd > 0) {
        showNotif(`${sk_def.label} CD中（残${cd}T）`);
        return;
      }
    }

    const currentMp = member.id === "eltz" ? mp : (partyMp[member.id] ?? 0);
    if (sk.cost > 0 && currentMp < sk.cost) { showNotif(`${member.name}のMPが足りない！`); return; }

    // 複数敵バトル かつ 攻撃系スキル → ターゲット選択モードへ
    const sk_def_t = SKILL_DEFS[skillId];
    const needsTarget = !!multiEnemies
      && (sk_def_t?.target ?? "single") === "single"
      && (sk_def_t?.hits ?? 0) > 0;
    if (needsTarget) {
      setPendingCommands(prev => ({ ...prev, [member.id]: skillId }));
      setPendingTargetSelect({ memberIdx: cmdInputIdx, skillId });
      return;
    }

    // ターゲット不要（heal/dodge または単体バトル）
    const newTargets = multiEnemies ? { ...pendingTargets, [member.id]: 0 } : pendingTargets;

    const newCmds = { ...pendingCommands, [member.id]: skillId };
    const newTgts = { ...newTargets };

    // 戦闘不能（HP0）メンバーをスキップしながら次のcmdInputIdxを求める
    let nextIdx = cmdInputIdx + 1;
    while (nextIdx < PARTY_DEFS.length) {
      const nm = PARTY_DEFS[nextIdx];
      const nmHp = nm.id === "eltz" ? hp : (partyHp[nm.id] ?? 0);
      if (nmHp > 0) break;
      // 戦闘不能 → dodgeを自動割り当てしてスキップ（healで復活させない）
      newCmds[nm.id] = "dodge";
      if (multiEnemies) newTgts[nm.id] = 0;
      nextIdx++;
    }

    if (multiEnemies) setPendingTargets(newTgts);

    if (nextIdx < PARTY_DEFS.length) {
      setPendingCommands(newCmds);
      setCmdInputIdx(nextIdx);
    } else {
      setPendingCommands({});
      if (multiEnemies) setPendingTargets({});
      setCmdInputIdx(0);
      setInputPhase("execute");
      setPendingExecution(multiEnemies
        ? { mode:"multi", cmds:newCmds, targets:newTgts }
        : { mode:"single", cmds:newCmds, targets:null });
    }
  }, [victory, defeat, inputPhase, cmdInputIdx, pendingCommands, pendingTargets, hp, mp, partyHp, partyMp, showNotif, multiEnemies, equippedWeapon, getSkillCd]);

  // @@SECTION:LOGIC_SELECT_TGT ──────────────────────────────────────────────────
  // onSelectTarget：ターゲット確定（複数敵専用）・戦闘不能スキップ
  // ─── ターゲット確定（複数敵専用） ─────────────────────────────────────────
  const onSelectTarget = useCallback((targetIdx) => {
    if (!pendingTargetSelect) return;
    const { memberIdx, skillId } = pendingTargetSelect;
    const member = PARTY_DEFS[memberIdx];
    const newCmds = { ...pendingCommands }; // skillIdは既に登録済み
    const newTgts = { ...pendingTargets, [member.id]: targetIdx };
    setPendingTargetSelect(null);

    // 戦闘不能（HP0）メンバーをスキップしながら次のcmdInputIdxを求める
    let nextIdx = memberIdx + 1;
    while (nextIdx < PARTY_DEFS.length) {
      const nm = PARTY_DEFS[nextIdx];
      const nmHp = nm.id === "eltz" ? hp : (partyHp[nm.id] ?? 0);
      if (nmHp > 0) break;
      // 戦闘不能 → dodgeを自動割り当てしてスキップ（healで復活させない）
      newCmds[nm.id] = "dodge";
      newTgts[nm.id] = 0;
      nextIdx++;
    }

    if (nextIdx < PARTY_DEFS.length) {
      setPendingTargets(newTgts);
      setCmdInputIdx(nextIdx);
    } else {
      setPendingCommands({});
      setPendingTargets({});
      setCmdInputIdx(0);
      setInputPhase("execute");
      setPendingExecution({ mode:"multi", cmds:newCmds, targets:newTgts });
    }
  }, [pendingTargetSelect, pendingTargets, pendingCommands, multiEnemies, hp, partyHp]);

  // @@SECTION:LOGIC_MULTI_TURN ──────────────────────────────────────────────────
  // 複数敵バトルのターン実行（multiEnemies配列を使用）
  // 5フェーズ構成：プリフェイズ → メインフェイズ → エンドフェイズ → コンボジャッジ → アップデート
  const executeMultiTurn = useCallback((cmds, targets) => {
    const enemies = multiEnemies;
    if (!enemies) return;

    const spdBuff = partySpdBuff > 0 ? 3 : 0;
  // 修正後（2567行目・3171行目 共通）
  const equipPatk = (equippedWeapon    ? effectiveStats(equippedWeapon).patk    : 0)
                  + (equippedArmor     ? effectiveStats(equippedArmor).patk     : 0)
                  + (equippedAccessory ? effectiveStats(equippedAccessory).patk : 0);
  const equipPdef = (equippedWeapon    ? effectiveStats(equippedWeapon).pdef    : 0)
                  + (equippedArmor     ? effectiveStats(equippedArmor).pdef     : 0)
                  + (equippedAccessory ? effectiveStats(equippedAccessory).pdef : 0);
    const defBonus = Math.floor((statAlloc.pdef + equipPdef - 10) * 1.2);
    // 各メンバーの実効DEF（エルツはstatAlloc+装備、仲間はALL_CHAR_DEFS.def基値）
    const getMemberDef = (memberId) => {
      if (memberId === "eltz") return defBonus;
      return ALL_CHAR_DEFS[memberId]?.def ?? 0;
    };
    const atkBonus = weaponPatk + Math.floor((statAlloc.patk + equipPatk - 10) * 1.5) + bikerAtkBonus;
    // コンボ攻撃力ボーナス：10ヒットごとに×1.1（累積）
    const comboAtkTier = Math.floor(noDmgStreak / 10);
    const comboAtkMult = comboAtkTier > 0 ? Math.pow(1.1, comboAtkTier) : 1.0;

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
    const skillsUsedThisTurn = new Map(); // Map<skillId, memberId>
    let curHp = hp;
    let curMp = mp;
    let curPartyHp = { ...partyHp };
    let curPartyMp = { ...partyMp };
    let curEnemies = enemies.map(e => ({ ...e }));
    let curEnemyHp = 0; // マルチ敵モードではcurEnemiesを使用するが、フォールバックコード用に定義
    const memberDmg = Object.fromEntries(currentPartyKeys.map(k => [k, 0]));  // 各メンバーの受けたダメージ合計
    const memberHeal = Object.fromEntries(currentPartyKeys.map(k => [k, 0])); // 各メンバーのメインフェイズ回復量
    let earthSlashUsed = false;
    let iceSlashUsed = false;
    let thunderSlashUsed = false;
    let fireSlashUsed = false;
    const elemUsed = { elem_fire:false, elem_ice:false, elem_thunder:false, elem_earth:false };
    let provokeUsed = false;
    let takedownUsed = false;
    let sleepUsed = false;
    let overhealUsed      = false;
    let bikerSlashUsed    = false;
    let sansankaUsed      = false;
    let stingerUsed       = false;
    let straightShotUsed  = false;
    let slowbladeUsed     = false;
    let arrowRainUsed     = false;
    let waterSphereUsed   = false;
    let enemyReverseSet   = -1;
    let elemBreakTriggered = false;
    let newElemAccum = elemDmgAccum;
    let newPlayerStunTurns = 0; // 敵スキルによるパーティ行動不能の付与ターン数
    // エフェクト蓄積バッファ（ターン処理後にまとめてsetStateする）
    const pendingHitFx    = []; // { slotIdx, dmg, type }
    const pendingDefeatFx = []; // { slotIdx }

    logs.push(`─ ターン ${turn + 1} ─`);
    setcurrentBattleTotalTurns(prev => prev + 1);

    // ── リバース中ログ表示 ──
     const reverseUsedThisTurn = Object.values(cmds).includes("reverse");
    const isReversed = reverseActive > 0 
    if (isReversed) {
      logs.push(`🔃 リバース中！ フェイズ順序が逆転（残${reverseActive}T）`);
      playReverseEffect();
    }

    // ══════════════════════════════════════════════════════════════════
    // プリフェイズ：回避・カウンター宣言
    //   counter / dodge は「最速判定」。ここで意図を宣言し、
    //   メインフェイズの敵行動タイミングで解決する。
    // ══════════════════════════════════════════════════════════════════
    const memberDodge   = Object.fromEntries(currentPartyKeys.map(k => [k, (cmds[k] ?? "atk") === "dodge"]));
    const memberCounter = Object.fromEntries(currentPartyKeys.map(k => [k, (cmds[k] ?? "atk") === "counter"]));
    currentPartyKeys.forEach(k => {
      const m = PARTY_DEFS.find(p => p.id === k);
      if (!m) return;
      if (memberDodge[k])   logs.push(`${m.icon}${m.name} 💨 回避態勢！（敵の攻撃を待つ）`);
      if (memberCounter[k]) logs.push(`${m.icon}${m.name} 🔄 カウンター構え！（敵の強攻を待つ）`);
    });
    aliveEnemies.forEach(e => {
      const eAction = e.def.pattern[e.turnIdx % e.def.pattern.length];
      if (eAction === "counter") logs.push(`${e.def.em}${e.def.name} 🔄 カウンター構え！`);
      if (eAction === "dodge")   logs.push(`${e.def.em}${e.def.name} 💨 回避態勢！`);
    });


    // ── フェイズ順序（リバース時は逆転） ──────────────────────────────────
    const runPrephase  = () => { /* 既存のプリフェイズ処理をそのままここに移動 */
    // ══════════════════════════════════════════════════════════════════
    // プリフェイズ：攻撃スキル（isPrephase:true かつ hits>0）
    //   counter/dodge はログ宣言のみ。攻撃系プリフェイズはここでダメージ処理。
    // ══════════════════════════════════════════════════════════════════
    //logs.push(`── プリフェイズ ──`);
    for (const actor of actors.filter(a => a.type === "player")) {
      const skillId = cmds[actor.id] ?? "atk";
      const sk_def  = SKILL_DEFS[skillId];
      if (!sk_def || !sk_def.isPrephase) continue;
      if (sk_def.hits === 0 || skillId === "counter" || skillId === "dodge") continue; // counter/dodge はメインフェイズで解決

      const memberAtkBonus = actor.id === "eltz" ? atkBonus : (ALL_CHAR_DEFS[actor.id]?.atk ?? 0);
      const weaponType = actor.id === "eltz" ? (equippedWeapon?.weaponType ?? "none") : "none";

      const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";

      // ── 全体攻撃 ──────────────────────────────────────────────────────
      if (sk_def.target === "all") {
        if (typeof curEnemies !== "undefined" && curEnemies) {
          const aoeDmgs = resolveAoeDamage({
            skillId, atkBonus: memberAtkBonus, weaponType,
            comboMult: 1.0, isStunned: false,
            enemies: curEnemies,
          });
          const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
          logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ 全敵にダメージ！`);
          curEnemies.forEach((e, i) => {
            if (e.defeated) return;
            const { perHit } = aoeDmgs[i];
            const dmg = Math.max(1, perHit) * sk_def.hits;
            curEnemies[i].hp = Math.max(0, e.hp - dmg);
            if (curEnemies[i].hp <= 0) curEnemies[i].defeated = true;
            pendingHitFx.push({ slotIdx: i, dmg, type: "normal" });
            if (curEnemies[i].defeated) pendingDefeatFx.push({ slotIdx: i });
            logs.push(`  → ${e.def.em}${e.def.name} に${dmg}ダメージ！`);
          });
        } else {
          const { perHit } = resolveSkillDamage({
            skillId, atkBonus: memberAtkBonus, weaponType,
            comboMult: 1.0, targetDef: 0, targetMagDef: 0, isStunned: false,
          });
          const dmg = Math.max(1, perHit) * sk_def.hits;
          curEnemyHp = Math.max(0, curEnemyHp - dmg);
          pendingHitFx.push({ slotIdx: 0, dmg, type: "normal" });
          const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
          logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ ${dmg}ダメージ！`);
        }

      // ── 単体攻撃 ──────────────────────────────────────────────────────
      } else {
        const aliveIdx = curEnemies.findIndex(e => !e.defeated);
        if (aliveIdx < 0) continue; // 全滅済みならスキップ
        const tIdx = (actor.targetIdx != null && !curEnemies[actor.targetIdx]?.defeated)
          ? actor.targetIdx : aliveIdx;
        const tEnemyDefPre = curEnemies[tIdx]?.def;
        const { totalDmg } = resolveSkillDamage({
          skillId, atkBonus: memberAtkBonus, weaponType,
          comboMult: 1.0,
          targetDef:    tEnemyDefPre?.pdef ?? 0,
          targetMagDef: tEnemyDefPre?.mdef ?? 0,
          isStunned: false,
        });
        const finalDmg = Math.max(1, totalDmg);
        curEnemies[tIdx].hp = Math.max(0, curEnemies[tIdx].hp - finalDmg);
        if (curEnemies[tIdx].hp <= 0) {
          curEnemies[tIdx].defeated = true;
          pendingDefeatFx.push({ slotIdx: tIdx });
        }
        pendingHitFx.push({ slotIdx: tIdx, dmg: finalDmg, type: "normal" });
        logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel} → ${curEnemies[tIdx].def.em}${curEnemies[tIdx].def.name} ${finalDmg}ダメージ！`);
      }

      skillsUsedThisTurn.set(skillId, actor.id);
    }
    };
    const runMainphase = () => { /* 既存のメインフェイズ処理をそのままここに移動 */
     // logs.push(`── メインフェイズ ──`);  // ← 元からある行（削除しない）

      for (const actor of actors) {
        if (actor.type === "player") {
          const skillId = cmds[actor.id] ?? "atk";
          const sk_def  = SKILL_DEFS[skillId];
          const isEltz  = actor.id === "eltz";
          if (!sk_def) continue;
        
          // ── プリフェイズ/エンドフェイズ スキルはメインフェイズをスキップ ────────
          // counter/dodge(isPrephase) は敵行動タイミングで解決済み
          // overheal等(isEndphase) はエンドフェイズブロックで処理
          if (sk_def.isPrephase || sk_def.isEndphase) continue;
        
          // ── MP消費 ────────────────────────────────────────────────────────────
          if (sk_def.cost > 0) {
            if (isEltz) curMp = Math.max(0, curMp - sk_def.cost);
            else curPartyMp[actor.id] = Math.max(0, (curPartyMp[actor.id]??0) - sk_def.cost);
          }
        
          // ── 回復スキル（hits=0 かつ healFlat>0） ──────────────────────────────
          if (sk_def.hits === 0 && sk_def.healFlat > 0) {
            // 戦闘不能メンバーは回復をスキップ
            const actorCurrentHp = isEltz ? curHp : (curPartyHp[actor.id] ?? 0);
            if (actorCurrentHp <= 0) { skillsUsedThisTurn.set(skillId, actor.id); continue; }
            const healAmt = sk_def.healFlat;
            if (sk_def.healTarget === "party") {
              // パーティ全体（通常healはselfなのでここはoverheal等の即時全体回復用）
              curHp = Math.min(curHp + healAmt, mhp);
              for (const k of currentPartyKeys.filter(k2 => k2 !== "eltz")) {
                if ((curPartyHp[k] ?? 0) <= 0) continue;
                curPartyHp[k] = Math.min((curPartyHp[k]??0) + healAmt, partyMhp[k]);
              }
              logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}！ 全員HP+${healAmt}`);
            } else {
              // 自己回復
              if (isEltz) curHp = Math.min(curHp + healAmt, mhp);
              else curPartyHp[actor.id] = Math.min((curPartyHp[actor.id]??0)+healAmt, partyMhp[actor.id]);
              memberHeal[actor.id] = (memberHeal[actor.id]??0) + healAmt;
              logs.push(`${actor.icon}${actor.name} ${sk_def.icon} HP+${healAmt}`);
            }
            // 副作用（baff/debuff）記録
            skillsUsedThisTurn.set(skillId, actor.id);
            continue;
          }
        
          // ── 補助スキル（hits=0 かつ healFlat=0）─────────────────────────────
          // enemyStun / enemyForceAction / selfBuff のみ → ログ出してskillsUsedに積む
          if (sk_def.hits === 0) {
            let logMsg = `${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}！`;
            if (sk_def.reversePhase > 0) {
             // setReverseActive(sk_def.reversePhase);
            }
            if (sk_def.enemyForceAction === "atk") {
              provokeUsed = true;
              logMsg += ` 全敵を${sk_def.enemyForceActionTurns}T強攻固定！`;
            }
            if (sk_def.enemyStun > 0) {
              if (skillId === "takedown") takedownUsed = true;
              else if (skillId === "straight_shot") straightShotUsed = true;
              else if (skillId === "slow_blade") slowbladeUsed = true;
              else sleepUsed = true;
              logMsg += ` 全敵を${sk_def.enemyStun}T行動不能！`;
            }
            if (sk_def.selfBuff && sk_def.selfBuff.spd > 0) {
              logMsg += ` 味方SPD+${sk_def.selfBuff.spd}（${sk_def.selfBuff.turns}T）！`;
            }
            if (!sk_def.reversePhase) logs.push(logMsg);  // ← リバースはログ非表示
            skillsUsedThisTurn.set(skillId, actor.id);
            continue;
          }
        
          // ── 攻撃スキル ────────────────────────────────────────────────────────
          const weaponType     = equippedWeapon?.weaponType ?? "none";
          const memberAtkBonus = isEltz
            ? atkBonus
            : (ALL_CHAR_DEFS[actor.id]?.atk ?? 0);
        
          // 行動不能状態判定（comboBonus用）
          // ※ 単体バトルは takedownActive/sleepActive/straightShotActive で判断
          // ※ マルチバトルは各敵のstunフラグ（将来拡張）。現状は単体と同じ値を参照
          const isTargetStunned = (takedownActive > 0 || sleepActive > 0 || straightShotActive > 0|| slowbladeActive > 0);
        
          // ── 全体攻撃 ──────────────────────────────────────────────────────
          if (sk_def.target === "all") {
            if (typeof curEnemies !== "undefined" && curEnemies) {
              const aoeDmgs = resolveAoeDamage({
                skillId, atkBonus: memberAtkBonus, weaponType,
                comboMult: comboAtkMult, isStunned: isTargetStunned,
                enemies: curEnemies,
              });
              curEnemies.forEach((e, i) => {
                if (e.defeated) return;
                const { perHit } = aoeDmgs[i];
                const dmg = Math.max(1, perHit) * sk_def.hits;
                curEnemies[i].hp = Math.max(0, e.hp - dmg);
                if (curEnemies[i].hp <= 0) curEnemies[i].defeated = true;
                pendingHitFx.push({ slotIdx: i, dmg, type: "normal" });
                if (curEnemies[i].defeated) pendingDefeatFx.push({ slotIdx: i });
              });
              const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
              logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ 全敵にダメージ！`);
              curEnemies.forEach((e, i) => {
                if (e.defeated) return;
                const { perHit } = aoeDmgs[i];
                const dmg = Math.max(1, perHit) * sk_def.hits;
                logs.push(`  → ${e.def.em}${e.def.name} に${dmg}ダメージ！`);
              });
            } else {
              const { perHit } = resolveSkillDamage({
                skillId, atkBonus: memberAtkBonus, weaponType,
                comboMult: comboAtkMult, targetDef: 0, targetMagDef: 0,
                isStunned: isTargetStunned,
              });
              const dmg = Math.max(1, perHit) * sk_def.hits;
              curEnemyHp = Math.max(0, curEnemyHp - dmg);
              pendingHitFx.push({ slotIdx: 0, dmg, type: "normal" });
              const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
              logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ ${dmg}ダメージ！`);
            }
            skillsUsedThisTurn.set(skillId, actor.id);
            continue;
          }
        
          // ── 単体攻撃：ターゲット解決 ──────────────────────────────────────────
          // マルチバトル用（curEnemiesが存在する場合）
          let tIdx = actor.targetIdx ?? 0;
          if (typeof curEnemies !== "undefined" && curEnemies) {
            if (!curEnemies[tIdx] || curEnemies[tIdx].defeated) {
              const fb = curEnemies.findIndex(e => !e.defeated);
              if (fb < 0) { logs.push(`${actor.icon}${actor.name} 攻撃対象なし`); continue; }
              tIdx = fb;
            }
          }
        
          // 対象敵のアクション取得（カウンター判定用）
          const tDef = typeof curEnemies !== "undefined" && curEnemies
            ? curEnemies[tIdx]
            : null;
          const eActionForJudge = tDef
            ? tDef.def.pattern[tDef.turnIdx % tDef.def.pattern.length]
            : eAction; // 単体バトルはターン冒頭で決定済みの eAction を使用
        
          // atk vs 敵counter → 敵ターン側（eAction==="counter"ブロック）で一括処理するためここではスキップ
          if (skillId === "atk" && eActionForJudge === "counter" && !sk_def.pierceCounter) {
            continue;
          }
        
          // ── 属性計算 ──────────────────────────────────────────────────────────
          const tEnemyDef = tDef ? tDef.def : null;
          const meElemCycle = tEnemyDef.elementCycle ?? null;
          const meElemKey   = meElemCycle
            ? meElemCycle[enemyElementIdx % meElemCycle.length]
            : null;
          let elemMult  = 1.0;
          let isWeakHit = false;
          if (sk_def.element && meElemKey && meElemKey !== "none") {
            const rel = ELEMENT_RELATIONS[sk_def.element];
            isWeakHit = rel ? meElemKey === rel.weak    : false;
            const isResist = rel ? meElemKey === rel.resist : false;
            elemMult  = isWeakHit ? 2.0 : isResist ? 0.5 : 1.0;
          }
        
          // ── ダメージ計算 ──────────────────────────────────────────────────────
          const { totalDmg } = resolveSkillDamage({
            skillId, atkBonus:memberAtkBonus, weaponType,
            comboMult:comboAtkMult,
            targetDef:    tEnemyDef?.pdef ?? 0,
            targetMagDef: tEnemyDef?.mdef ?? 0,
            isStunned:isTargetStunned,
          });
          const finalDmg = Math.max(1, Math.round(totalDmg * elemMult));
        
          // HP反映
          if (tDef) {
            // マルチバトル
            curEnemies[tIdx].hp = Math.max(0, tDef.hp - finalDmg);
            if (curEnemies[tIdx].hp <= 0) curEnemies[tIdx].defeated = true;
            pendingHitFx.push({ slotIdx:tIdx, dmg:finalDmg, type:isWeakHit?"weak":"normal" });
            if (curEnemies[tIdx].defeated) pendingDefeatFx.push({ slotIdx:tIdx });
          } else {
            // 単体バトル
            curEnemyHp = Math.max(0, curEnemyHp - finalDmg);
            pendingHitFx.push({ slotIdx:0, dmg:finalDmg, type:isWeakHit?"weak":"normal" });
          }
        
          // ログ
          const tEmName = tDef ? `${tDef.def.em}${tDef.def.name}` : "???";
          const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
          const eLabel   = isWeakHit ? " ⚡弱点!" : elemMult===0.5 ? " 耐性½" : "";
          logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel} → ${tEmName} ${finalDmg}ダメージ！${eLabel}`);
        
          // 属性ブレイク蓄積
          if (isWeakHit && !elemBreakTriggered) {
            newElemAccum += finalDmg;
            if (newElemAccum >= ELEMENT_BREAK_THRESHOLD) {
              elemBreakTriggered = true; newElemAccum = 0;
              logs.push(`💥 ELEMENT BREAK！`);
              setElemBreakAnim(true); setTimeout(()=>setElemBreakAnim(false), 1500);
              setcurrentBattleElemBreaks(prev => prev + 1);
            }
          }
        
          // ── 攻撃+回復複合（hits>0 かつ healFlat>0 のスキル：シーソー等） ──
          if (sk_def.healFlat > 0) {
            const isEltzHeal = actor.id === "eltz";
            const actorComboHp = isEltzHeal ? curHp : (curPartyHp[actor.id] ?? 0);
            if (actorComboHp > 0) {
              const healAmt = sk_def.healFlat;
              if (isEltzHeal) curHp = Math.min(curHp + healAmt, mhp);
              else curPartyHp[actor.id] = Math.min((curPartyHp[actor.id]??0) + healAmt, partyMhp[actor.id]);
              memberHeal[actor.id] = (memberHeal[actor.id]??0) + healAmt;
              logs.push(`${actor.icon}${actor.name} ⚖ HP+${healAmt}（複合回復）`);
            }
          }
          if (sk_def.enemyStun > 0) {
            if (skillId === "takedown") takedownUsed = true;
            else if (skillId === "straight_shot") straightShotUsed = true;
            else if (skillId === "slow_blade") slowbladeUsed = true;
            else sleepUsed = true;
          }
  
          skillsUsedThisTurn.set(skillId, actor.id);
        
        } else {
          // ── 敵行動 ──────────────────────────────────────────────────────────
          const slot = actor.enemySlot;
          const e = curEnemies.find(e => e.slot === slot);
          if (!e || e.defeated) continue;
  
            const prephaseStunUsed = [...skillsUsedThisTurn.keys()].some(sid => {
            const sk = SKILL_DEFS[sid];
            return sk && sk.isPrephase && sk.enemyStun >= 1 && sk.hits > 0;
          });
          if (elemBreakTriggered || prephaseStunUsed || takedownUsed || takedownActive > 0 || sleepUsed || sleepActive > 0 || straightShotUsed || straightShotActive > 0 || slowbladeUsed || slowbladeActive > 0) {
          
            if (elemBreakTriggered && !takedownUsed && takedownActive === 0 && !sleepUsed && sleepActive === 0 && !straightShotUsed && straightShotActive === 0 && !slowbladeUsed && slowbladeActive === 0) {
              logs.push(`${e.def.em}${e.def.name} 💥 ELEMENT BREAKで行動不能！`);
            } else {
              const stunLabel = prephaseStunUsed
                ? "🗡 スタン"
                : (takedownUsed || takedownActive > 0) ? "🦵 テイクダウン"
                : (straightShotUsed || straightShotActive > 0) ? "😵 ストレートショット"
                : (slowbladeUsed || slowbladeActive > 0) ? "😵 スローブレード" 
                : "😴 スリープ";
              logs.push(`${e.def.em}${e.def.name} ${stunLabel}で行動不能！`);
            }
            // turnIdx更新はアップデートフェイズで一括処理するためここでは更新しない
            continue;
          }
  
          const rawEAction = actor.skill;
          const eAction = (provokeUsed || provokeActive > 0) ? "atk" : rawEAction;
          if ((provokeUsed || provokeActive > 0) && rawEAction !== "atk") {
            logs.push(`👊 挑発中！ ${e.def.name}の行動を強制的に強攻に変換！`);
          }
  
          const isEnraged = enrageCount > 0 && !iceSlashUsed;
          const atkHalf = enemyAtkDebuff > 0 || waterSphereActive > 0;
          const totalMult = (isEnraged ? 2.0 : 1.0) * (atkHalf ? 0.5 : 1.0);
          const rageLabel = isEnraged ? "🔴" : "";
          const halfLabel = atkHalf ? "（ATK½）" : "";
  
          // ターゲット（SPD最低のメンバー）
          const spdSorted = [...PARTY_DEFS].sort((a, b) => a.spd - b.spd);
          const tMember = spdSorted[0];
          const tid = tMember.id;
          const tDodge   = memberDodge[tid]   ?? false;
          const tCounter = memberCounter[tid] ?? false;
          if (eAction === "dodge") {
            if (tCounter) {
              const baseRaw = randInt(e.def.atk[0], e.def.atk[1]) + Math.floor(e.def.atk[1] * 0.3);
              const cd = Math.max(1, Math.round(baseRaw * totalMult) - getMemberDef(tid));
              if (tid === "eltz") { curHp = Math.max(0, curHp - cd); }
              else { curPartyHp[tid] = Math.max(0, (curPartyHp[tid] ?? 0) - cd); }
              memberDmg[tid] = (memberDmg[tid] ?? 0) + cd;
              logs.push(`${e.def.em}${e.def.name} 💨 回避！ ${tMember.icon}${tMember.name}のカウンターをかわし → ${tMember.icon}${tMember.name}に ${cd} ダメージで反撃！（${tMember.name}の強攻を無効化）`);
            } else if (tDodge) {
              logs.push(`💨 回避相殺！ ${tMember.icon}${tMember.name} vs ${e.def.em}${e.def.name}（互いに無効）`);
            } else {
              logs.push(`${e.def.em}${e.def.name} 💨 回避！`);
            }
          } else if (eAction === "enrage") {
            logs.push(`${e.def.em}${e.def.name} 🔴 怒り状態に！`);
          } else if (eAction === "atk_all") {
            // 全体攻撃：回避・カウンター無効、全員にダメージ
            const baseAtk = Math.round(randInt(e.def.atk[0], e.def.atk[1]) * totalMult);
            logs.push(`${e.def.em}${e.def.name} 🌊全体攻撃${halfLabel}`);
            for (const k of currentPartyKeys) {
              const mDef = getMemberDef(k);
              const mDmg = Math.max(1, baseAtk - mDef);
              if (k === "eltz") { curHp = Math.max(0, curHp - mDmg); }
              else { curPartyHp[k] = Math.max(0, (curPartyHp[k] ?? 0) - mDmg); }
              memberDmg[k] = (memberDmg[k] ?? 0) + mDmg;
              logs.push(`  → ${ALL_CHAR_DEFS[k]?.icon ?? ""}${ALL_CHAR_DEFS[k]?.name ?? k} ${mDmg}ダメージ！`);
            }
            setShowAtkAllAnim(false); // 一旦リセットして再マウントを強制
            setTimeout(() => { setAtkAllAnimKey(k => k + 1); setShowAtkAllAnim(true); }, 0);
          } else if (eAction === "unavoidable") {
            // 回避不能：counter/dodge両方無効、ターゲット単体に直撃
            const [minD, maxD] = e.def.unavoidableAtk ?? [30,45];
            const dmg = Math.max(1, Math.round(randInt(minD, maxD) * totalMult) - getMemberDef(tid));
            logs.push(`${e.def.em}${rageLabel}💥回避不能${halfLabel} ${tMember.icon}${tMember.name}に${dmg}ダメージ！`);
            if (tid === "eltz") { curHp = Math.max(0, curHp - dmg); }
            else { curPartyHp[tid] = Math.max(0, (curPartyHp[tid] ?? 0) - dmg); }
            memberDmg[tid] = (memberDmg[tid] ?? 0) + dmg;
          } else if (eAction === "counter") {
            // 敵カウンター：攻撃(atk)したメンバー全員に個別ダメージ、dodge→回避+反撃、counter→相殺
            // まずdodge/counterの代表判定（spdSorted[0]基準）
            if (tDodge) {
              const csk = BATTLE_SKILLS.find(s => s.id === "dodge");
              const dodgeDmg = Math.max(1, Math.round((randInt(csk.dmg[0], csk.dmg[1]) + (tid === "eltz" ? atkBonus : 0)) * comboAtkMult) - (e.def.pdef ?? 0));
              const eIdx = curEnemies.findIndex(en => en.slot === slot);
              curEnemies[eIdx].hp = Math.max(0, e.hp - dodgeDmg);
              if (curEnemies[eIdx].hp <= 0) { curEnemies[eIdx].defeated = true; pendingDefeatFx.push({ slotIdx: eIdx }); }
              pendingHitFx.push({ slotIdx: eIdx, dmg: dodgeDmg, type: "normal" });
              logs.push(`${tMember.icon}${tMember.name} 💨 回避成功！ ${e.def.name}のカウンターをかわし → ${e.def.em}${e.def.name}に${dodgeDmg}ダメージで反撃！`);
            } else if (tCounter) {
              logs.push(`🔄 カウンター相殺！ ${tMember.icon}${tMember.name} vs ${e.def.em}${e.def.name}（互いの攻撃無効化）`);
            } else {
              // atk を選択したメンバー全員に個別カウンターダメージ（executePartyTurnと同式）
              let anyAtk = false;
              for (const k of currentPartyKeys) {
                if (cmds[k] !== "atk") continue;
                anyAtk = true;
                const m = PARTY_DEFS.find(p => p.id === k);
                const baseRaw = randInt(e.def.atk[0], e.def.atk[1]) + Math.floor(e.def.atk[1] * 0.3);
                const cd = Math.max(1, Math.round(baseRaw * totalMult) - getMemberDef(k));
                if (k === "eltz") { curHp = Math.max(0, curHp - cd); }
                else { curPartyHp[k] = Math.max(0, (curPartyHp[k] ?? 0) - cd); }
                memberDmg[k] = (memberDmg[k] ?? 0) + cd;
                logs.push(`${e.def.em}${rageLabel}🔄 ${e.def.name}カウンター！${halfLabel} ${m.icon}${m.name}に ${cd} ダメージ！（${m.name}の強攻を無効化）`);
              }
              if (!anyAtk) {
                // heal等の非攻撃行動のみ：カウンター不成立
                logs.push(`${e.def.em}${e.def.name} 🔄 カウンター構え...しかし不発！`);
              }
            }
          } else if (SKILL_DEFS[eAction] && !["atk","counter","dodge","unavoidable","atk_all","enrage"].includes(eAction)) {
            // ── 敵がプレイヤースキルを使用 ──────────────────────────────────
            const sk_def = SKILL_DEFS[eAction];
            const eAtkBonus = Math.round((e.def.atk[0] + e.def.atk[1]) / 2); // 敵ATKの平均値をatkBonusに
  
            if (sk_def.target === "all") {
              // 全体攻撃スキル
              const baseAtk = Math.round(randInt(e.def.atk[0], e.def.atk[1]) * totalMult);
              const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
              logs.push(`${e.def.em}${e.def.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ 全体攻撃${halfLabel}`);
              for (const k of currentPartyKeys) {
                const mDef = getMemberDef(k);
                const dmgPerHit = Math.max(1, Math.round(baseAtk * sk_def.dmgMult) - mDef);
                const totalSkDmg = dmgPerHit * sk_def.hits;
                if (k === "eltz") { curHp = Math.max(0, curHp - totalSkDmg); }
                else { curPartyHp[k] = Math.max(0, (curPartyHp[k] ?? 0) - totalSkDmg); }
                memberDmg[k] = (memberDmg[k] ?? 0) + totalSkDmg;
                logs.push(`  → ${ALL_CHAR_DEFS[k]?.icon ?? ""}${ALL_CHAR_DEFS[k]?.name ?? k} ${totalSkDmg}ダメージ！`);
              }
            } else {
              // 単体攻撃スキル（SPD最低のメンバーを狙う）
              const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
              const baseRaw = Math.round(randInt(e.def.atk[0], e.def.atk[1]) * totalMult * sk_def.dmgMult);
              const dmgPerHit = Math.max(1, baseRaw - getMemberDef(tid));
              const totalSkDmg = dmgPerHit * sk_def.hits;
              if (tid === "eltz") { curHp = Math.max(0, curHp - totalSkDmg); }
              else { curPartyHp[tid] = Math.max(0, (curPartyHp[tid] ?? 0) - totalSkDmg); }
              memberDmg[tid] = (memberDmg[tid] ?? 0) + totalSkDmg;
              if (sk_def.label === "リバース"){
                enemyReverseSet = sk_def.reversePhaze ?? 5;
              logs.push(`${e.def.em}${e.def.name}がリバースを発動！　何かがおかしい。空間が逆転する`);
              }else {
                logs.push(`${e.def.em}${rageLabel}${sk_def.icon}${e.def.name}が${sk_def.label}${hitLabel}！${halfLabel} ${tMember.icon}${tMember.name}に${totalSkDmg}ダメージ！`);
              }
            }
            // 敵スキルにパーティスタン効果がある場合
            if (sk_def.enemyStun > 0) {
              newPlayerStunTurns = Math.max(newPlayerStunTurns, sk_def.enemyStun);
              logs.push(`${e.def.em}${e.def.name} 🦵 パーティを${sk_def.enemyStun}T行動不能にした！`);
            }
          } else {
            // 通常強攻：counter→反撃×1.5、dodge/atk→被弾
            if (tCounter) {
              const csk = BATTLE_SKILLS.find(s => s.id === "counter");
              const bd = Math.max(1, Math.round((randInt(csk.dmg[0], csk.dmg[1]) * 1.5 + (tid === "eltz" ? atkBonus : 0)) * comboAtkMult) - (e.def.pdef ?? 0));
              const eIdx = curEnemies.findIndex(en => en.slot === slot);
              curEnemies[eIdx].hp = Math.max(0, e.hp - bd);
              if (curEnemies[eIdx].hp <= 0) { curEnemies[eIdx].defeated = true; pendingDefeatFx.push({ slotIdx: eIdx }); }
              pendingHitFx.push({ slotIdx: eIdx, dmg: bd, type: "normal" });
              logs.push(`${tMember.icon}${tMember.name} 🔄カウンター成功！ → ${e.def.em}${e.def.name} ${bd}ダメージ（×1.5）！ ${tMember.name}は被弾を免れた！`);
            } else {
              // dodge も atk も通常被弾
              const d = Math.max(1, Math.round(randInt(e.def.atk[0], e.def.atk[1]) * totalMult) - getMemberDef(tid));
              if (tid === "eltz") { curHp = Math.max(0, curHp - d); }
              else { curPartyHp[tid] = Math.max(0, (curPartyHp[tid] ?? 0) - d); }
              memberDmg[tid] = (memberDmg[tid] ?? 0) + d;
              const dodgeLabel = tDodge ? "（回避しようとしたが直撃！）" : "";
              logs.push(`${e.def.em}${rageLabel}⚔${e.def.name}！${halfLabel} ${tMember.icon}${tMember.name}に${d}ダメージ！${dodgeLabel}`);
            }
          }
          // turnIdx更新はアップデートフェイズで一括処理
        }
      }
    };
    const runEndphase  = () => { /* 既存のエンドフェイズ処理をそのままここに移動 */
        // ══════════════════════════════════════════════════════════════════
    // エンドフェイズ：最遅延行動（オーバーヒール）
    // ══════════════════════════════════════════════════════════════════
    // ── エンドフェイズ：isEndphase:true のスキルを処理 ─────────────────────
   // logs.push(`── エンドフェイズ ──`);
    for (const actor of actors.filter(a => a.type === "player")) {
      const skillId = cmds[actor.id] ?? "atk";
      const sk_def  = SKILL_DEFS[skillId];
      if (!sk_def || !sk_def.isEndphase) continue;

      // ── ダメージスキル（hits > 0 かつ healFlat === 0）────────────────────
      if (sk_def.hits > 0 && sk_def.healFlat === 0) {
        const memberAtkBonus = actor.id === "eltz" ? atkBonus : (ALL_CHAR_DEFS[actor.id]?.atk ?? 0);
        const weaponType = actor.id === "eltz" ? (equippedWeapon?.weaponType ?? "none") : "none";

        const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";

        // ── 全体攻撃 ──────────────────────────────────────────────────────
        if (sk_def.target === "all") {
          if (typeof curEnemies !== "undefined" && curEnemies) {
            const aoeDmgs = resolveAoeDamage({
              skillId, atkBonus: memberAtkBonus, weaponType,
              comboMult: 1.0, isStunned: false,
              enemies: curEnemies,
            });
            curEnemies.forEach((e, i) => {
              if (e.defeated) return;
              const { perHit } = aoeDmgs[i];
              const dmg = Math.max(1, perHit) * sk_def.hits;
              curEnemies[i].hp = Math.max(0, e.hp - dmg);
              if (curEnemies[i].hp <= 0) curEnemies[i].defeated = true;
              pendingHitFx.push({ slotIdx: i, dmg, type: "normal" });
              if (curEnemies[i].defeated) pendingDefeatFx.push({ slotIdx: i });
            });
            const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
            logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ 全敵にダメージ！`);
          } else {
            const { perHit } = resolveSkillDamage({
              skillId, atkBonus: memberAtkBonus, weaponType,
              comboMult: 1.0, targetDef: 0, targetMagDef: 0, isStunned: false,
            });
            const dmg = Math.max(1, perHit) * sk_def.hits;
            curEnemyHp = Math.max(0, curEnemyHp - dmg);
            pendingHitFx.push({ slotIdx: 0, dmg, type: "normal" });
            const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
            logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ ${dmg}ダメージ！`);
          }

        // ── 単体攻撃 ──────────────────────────────────────────────────────
        } else {
          if (curEnemyHp <= 0) continue;
          const eDef  = ed?.pdef ?? 0;
          const eMdef = ed?.mdef ?? 0;
          const { perHit } = resolveSkillDamage({
            skillId, atkBonus: memberAtkBonus, weaponType,
            comboMult: 1.0, targetDef: eDef, targetMagDef: eMdef,
            isStunned: false,
          });
          const finalDmg = Math.max(1, perHit) * sk_def.hits;
          curEnemyHp = Math.max(0, curEnemyHp - finalDmg);
          pendingHitFx.push({ slotIdx: 0, dmg: finalDmg, type: "normal" });
          logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel} → ${ed.em}${ed.name} ${finalDmg}ダメージ！`);
        }

        skillsUsedThisTurn.set(skillId, actor.id);
      }
          // ── 補助スキル（hits=0 かつ healFlat=0）─────────────────────────────
          // enemyStun / enemyForceAction / selfBuff のみ → ログ出してskillsUsedに積む
          if (sk_def.hits === 0) {
            let logMsg = `${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}！`;
            
            if (sk_def.enemyStun > 0) {
              if (skillId === "takedown") takedownUsed = true;
              else if (skillId === "straight_shot") straightShotUsed = true;
              else if (skillId === "slow_blade") slowbladeUsed = true;
              else sleepUsed = true;
              logMsg += ` 全敵を${sk_def.enemyStun}T行動不能！`;
            }
            if (sk_def.selfBuff && sk_def.selfBuff.spd > 0) {
              logMsg += ` 味方SPD+${sk_def.selfBuff.spd}（${sk_def.selfBuff.turns}T）！`;
            }
            if (!sk_def.reversePhase) logs.push(logMsg);  // ← リバースはログ非表示
            skillsUsedThisTurn.set(skillId, actor.id);
        
          }
      // ── 回復スキル（healFlat > 0）────────────────────────────────────────
      if (sk_def.healFlat > 0) {
        // 戦闘不能メンバーは回復をスキップ
        const isEltzEnd = actor.id === "eltz";
        const actorEndHp = isEltzEnd ? curHp : (curPartyHp[actor.id] ?? 0);
        if (actorEndHp > 0) {
        const healAmt = sk_def.healFlat;
        if (sk_def.healTarget === "party") {
          curHp = Math.min(curHp + healAmt, mhp);
          for (const k of currentPartyKeys.filter(k2 => k2 !== "eltz")) {
            if ((curPartyHp[k]??0) <= 0) continue;
            curPartyHp[k] = Math.min((curPartyHp[k]??0)+healAmt, partyMhp[k]);
          }
          logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}発動！ 全員HP+${healAmt}！`);
        } else {
          const isEltz2 = actor.id === "eltz";
          if (isEltz2) curHp = Math.min(curHp + healAmt, mhp);
          else curPartyHp[actor.id] = Math.min((curPartyHp[actor.id]??0)+healAmt, partyMhp[actor.id]);
          logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}発動！ HP+${healAmt}！`);
        }
        overhealUsed = true;
        skillsUsedThisTurn.set(skillId, actor.id);
        }
      }
    } 
    };

    if (isReversed) {
      logs.push(`── エンドフェイズ ──`);  runEndphase();
      logs.push(`── メインフェイズ ──`);  runMainphase();
      logs.push(`── プリフェイズ ──`);    runPrephase();
    } else {
      logs.push(`── プリフェイズ ──`);    runPrephase();
      logs.push(`── メインフェイズ ──`);  runMainphase();
      logs.push(`── エンドフェイズ ──`);  runEndphase();
    }

    // ══════════════════════════════════════════════════════════════════
    // コンボジャッジ
    //   通常：全員無被弾 → 成立
    //   heal使用時（unavoidable含むターン）：被ダメ - 回復量 ≤ 0 で全員成立
    //   overheal使用時：被ダメージ合計 ≤ 回復量(80) なら成立（従来仕様維持）
    //   コンボ加算はパーティ人数分
    // ══════════════════════════════════════════════════════════════════
    logs.push(`── コンボジャッジ ──`);

    const OVERHEAL_AMT = 120;
    const partySize = currentPartyKeys.length;
    // このターンに敵がunavoidableを使用したか確認
    const hadUnavoidable = aliveEnemies.some(e => e.def.pattern[e.turnIdx % e.def.pattern.length] === "unavoidable");
    // いずれかのメンバーがhealを使用したか
    const healUsedThisTurn = currentPartyKeys.some(k => (memberHeal[k] ?? 0) > 0);
    let comboOk;
    if (overhealUsed) {
      // オーバーヒールターン：メンバー全員の被ダメ ≤ 回復量か確認（従来仕様維持）
      comboOk = currentPartyKeys.every(k => (memberDmg[k] ?? 0) <= OVERHEAL_AMT);
      if (!comboOk) {
        const failNames = currentPartyKeys
          .filter(k => (memberDmg[k] ?? 0) > OVERHEAL_AMT)
          .map(k => PARTY_DEFS.find(p => p.id === k)?.name ?? k);
        logs.push(`💔 ${failNames.join("・")} の被ダメージ(${failNames.map(n => {
          const k = currentPartyKeys.find(key => (PARTY_DEFS.find(p=>p.id===key)?.name??key)===n);
          return memberDmg[k]??0;
        }).join("・")}) がオーバーヒール(${OVERHEAL_AMT})を超過`);
      }
    } else if (hadUnavoidable && healUsedThisTurn) {
      // 回避不能ターン＋heal使用：被ダメ - 回復量 ≤ 0 で全員コンボ成立
      comboOk = currentPartyKeys.every(k => (memberDmg[k] ?? 0) - (memberHeal[k] ?? 0) <= 0);
      if (!comboOk) {
        const failKeys = currentPartyKeys.filter(k => (memberDmg[k] ?? 0) - (memberHeal[k] ?? 0) > 0);
        const failInfo = failKeys.map(k => {
          const name = PARTY_DEFS.find(p => p.id === k)?.name ?? k;
          return `${name}(被ダメ${memberDmg[k]??0}-回復${memberHeal[k]??0}=${( memberDmg[k]??0)-(memberHeal[k]??0)})`;
        }).join("・");
        logs.push(`💔 ${failInfo} がヒール後もダメージ超過`);
      }
    } else {
      comboOk = currentPartyKeys.every(k => (memberDmg[k] ?? 0) === 0);
    }
    const newStreak = comboOk ? noDmgStreak + partySize : 0;
    if (comboOk) {
      const gain = 5 + newStreak;
      curMp = Math.min(curMp + gain, mmp);
      for (const k of Object.keys(curPartyMp)) curPartyMp[k] = Math.min((curPartyMp[k] ?? 0) + gain, partyMmp[k] ?? 0);
      if (newStreak >= 3) logs.push(`✨PARTY COMBO ${newStreak}! 全員MP+${gain}！`);
      else logs.push(`🔗 コンボ継続 ${newStreak}！ MP +${gain}`);
      setcurrentBattleComboTurns(prev => prev + 1);
    } else {
      logs.push(`💥 コンボ断絶`);
      // ミスした戦闘はシナリオフルコンボに加算しない（既存カウントはリセットしない）
      if (isScenarioBattleRef.current) { comboMissedRef.current = true; }
    }

    // ══════════════════════════════════════════════════════════════════
    // アップデート：属性チェンジ・バフ/デバフ更新
    // ══════════════════════════════════════════════════════════════════
    // ── アップデートフェイズ：副作用一括適用 ──────────────────────────────
    logs.push(`── アップデート ──`);

    const sideEffects = applySkillSideEffects({
      skillsUsedThisTurn,
      enemySpdDebuff, enemyAtkDebuff, partySpdBuff,
      provokeActive,
      takedownActive,
      sleepActive,
      straightShotActive,  
      waterSphereActive,
      slowbladeActive,
      bikerAtkBonus,
      enrageCount,
      reverseActive,   // ← 追加
      cdMap: memberCdMap,   // すでに { skillId: { memberId: value } } 形式
    });

  
    // 属性チェンジログ（isBossかつelementCycle持ちの敵のみ）
    // ※ 既存の属性チェンジログ処理はここに残す

    // ステート一括セット
    setEnemySpdDebuff(sideEffects.enemySpdDebuff);
    setEnemyAtkDebuff(sideEffects.enemyAtkDebuff);
    setPartySpdBuff(sideEffects.partySpdBuff);
    setProvokeActive(sideEffects.provokeActive);
    setTakedownActive(sideEffects.takedownActive);
    setSleepActive(sideEffects.sleepActive);
    setStraightShotActive(sideEffects.straightShotActive); 
    setslowbladeActive(sideEffects.slowbladeActive);    
    setBikerAtkBonus(sideEffects.bikerAtkBonus);
    setEnrageCount(sideEffects.enrageCount);
    setWaterSphereActive(sideEffects.waterSphereActive);
    setReverseActive(enemyReverseSet >= 0 ? enemyReverseSet : sideEffects.reverseActive);  // ← 追加

    // 個別setterは全廃。1つのsetMemberCdMapで管理
    setMemberCdMap(sideEffects.nextCdMap);

    // ステート一括更新
    // ── アップデートフェイズで全生存敵のturnIdxを進める（メインフェイズでは変更しない） ──
    curEnemies.forEach((e, i) => {
      if (!e.defeated) {
        curEnemies[i].turnIdx = (e.turnIdx + 1) % e.def.pattern.length;
      }
    });
    setHp(Math.min(curHp, mhp));
    setMp(Math.max(0, curMp));
    setPartyHp(curPartyHp);
    setPartyMp(curPartyMp);
    setMultiEnemies(curEnemies);
    // ── エフェクト発火（スロットごとに総ダメージを合算して1エフェクト） ─────
    const hitFxBySlot = {};
    pendingHitFx.forEach(fx => {
      if (!hitFxBySlot[fx.slotIdx]) hitFxBySlot[fx.slotIdx] = { dmg: 0, type: "normal" };
      hitFxBySlot[fx.slotIdx].dmg += fx.dmg;
      if (fx.type === "weak") hitFxBySlot[fx.slotIdx].type = "weak";
    });
    Object.entries(hitFxBySlot).forEach(([slotIdx, fx]) => fireHitEffect(Number(slotIdx), fx.dmg, fx.type));
    pendingDefeatFx.forEach(fx => fireDefeatEffect(fx.slotIdx));
    setElemDmgAccum(newElemAccum);
    // isBoss かつ elementCycle を持つ敵（オルガ等）が存在する場合、毎ターン idx を進める
    const bossWithCycle = curEnemies.find(e => e.def.isBoss && e.def.elementCycle && e.def.elementCycle.length > 0);
    if (bossWithCycle) {
      const cycle = bossWithCycle.def.elementCycle;
      const nextKey = cycle[(enemyElementIdx + 1) % cycle.length];
      const info = ELEMENT_NAMES[nextKey];
      if (info) logs.push(`${bossWithCycle.def.em}${bossWithCycle.def.name} 属性チェンジ → ${info.icon}${info.label}`);
      setEnemyElementIdx(prev => (prev + 1) % cycle.length);
    }
    // プレイヤースタン：新規付与があればセット、なければデクリメント
    if (newPlayerStunTurns > 0) {
      setPlayerStunActive(newPlayerStunTurns);
    } else if (playerStunActive > 0) {
      setPlayerStunActive(prev => Math.max(0, prev - 1));
    }
    setTurn(t => t + 1);
    setNoDmgStreak(newStreak);
    setBtlAnimEnemy(true); setTimeout(() => setBtlAnimEnemy(false), 400);
    setBtlLogs(prev => [...prev, ...logs].slice(-20));

    // 全滅チェック
    const allDefeated = curEnemies.every(e => e.defeated);
    if (allDefeated) {
      setVictory(true);
      hitSlotIdsRef.current.clear(); setHitFlashTick(t => t + 1); setHitEffects([]);  // フラッシュ残留リセット
      setInputPhase("command"); setCmdInputIdx(0);
      // シナリオ起動バトルかつ最終ターンコンボOKなら継続フルコンボ+1（MapScan除外・コンボミス除外）
      if (isScenarioBattleRef.current && !comboMissedRef.current) setScenarioFullCombo(v => v + 1);
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
      // エルツが行動不能 → 即敗北
      setDefeat(true);
      hitSlotIdsRef.current.clear(); setHitFlashTick(t => t + 1); setHitEffects([]);  // フラッシュ残留リセット
      setInputPhase("command"); setCmdInputIdx(0);
      setBtlLogs(prev => [...prev, "💀 エルツが行動不能！ 敗北..."]);
    } else {
      // 仲間のHP0チェック → 戦闘不能ログ追記（ゲーム継続）
      const downedKeys = currentPartyKeys.filter(k => k !== "eltz" && (curPartyHp[k] ?? 0) <= 0);
      if (downedKeys.length > 0) {
        const downedNames = downedKeys.map(k => ALL_CHAR_DEFS[k]?.name ?? k).join("・");
        setBtlLogs(prev => [...prev, `💀 ${downedNames} が戦闘不能！`]);
      }
      setInputPhase("command");
      setCmdInputIdx(0);
    }
  }, [
    multiEnemies, hp, mp, mhp, mmp, partyHp, partyMhp, partyMp, partyMmp,
    statAlloc, weaponPatk, partySpdBuff, enemySpdDebuff, enrageCount, enemyAtkDebuff,
    provokeActive, takedownActive, sleepActive,
    bikerAtkBonus, straightShotActive, waterSphereActive, slowbladeActive, memberCdMap,
    reverseActive, playerStunActive, enemyElementIdx,
    noDmgStreak, turn, lv, showNotif, handleExpGain,
    fireHitEffect, fireDefeatEffect, playReverseEffect,
  ]);

  // @@SECTION:LOGIC_PARTY_TURN ──────────────────────────────────────────────────
  // 単体敵バトルのターン実行（battleEnemy単体を使用）
  // 5フェーズ構成：プリフェイズ → メインフェイズ → エンドフェイズ → コンボジャッジ → アップデート
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
    const skillsUsedThisTurn = new Map(); // Map<skillId, memberId>
    let curEnemyHp = enemyHp;
    let curHp = hp;
    let curMp = mp;
    let curPartyHp = { ...partyHp };
    let curPartyMp = { ...partyMp }; // 仲間MP（ターン内で変動）

    // 修正後（2567行目・3171行目 共通）
    const equipPatk = (equippedWeapon    ? effectiveStats(equippedWeapon).patk    : 0)
                    + (equippedArmor     ? effectiveStats(equippedArmor).patk     : 0)
                    + (equippedAccessory ? effectiveStats(equippedAccessory).patk : 0);
    const equipPdef = (equippedWeapon    ? effectiveStats(equippedWeapon).pdef    : 0)
                    + (equippedArmor     ? effectiveStats(equippedArmor).pdef     : 0)
                    + (equippedAccessory ? effectiveStats(equippedAccessory).pdef : 0);
    const defBonus = Math.floor((statAlloc.pdef + equipPdef - 10) * 1.2);
    const getMemberDef = (memberId) => {
      if (memberId === "eltz") return defBonus;
      return ALL_CHAR_DEFS[memberId]?.def ?? 0;
    };
    const atkBonus = weaponPatk + Math.floor((statAlloc.patk + equipPatk - 10) * 1.5) + bikerAtkBonus;
    // コンボ攻撃力ボーナス：10ヒットごとに×1.1（累積）
    const comboAtkTier = Math.floor(noDmgStreak / 10);
    const comboAtkMult = comboAtkTier > 0 ? Math.pow(1.1, comboAtkTier) : 1.0;

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
    let bikerSlashUsed    = false;
    let sansankaUsed      = false;
    let stingerUsed       = false;
    let straightShotUsed  = false;
    let slowbladeUsed     = false;
    let arrowRainUsed     = false;
    let waterSphereUsed   = false;
    // 属性スキル使用フラグ（CDセット用）
    const elemUsed = { elem_fire:false, elem_ice:false, elem_thunder:false, elem_earth:false };
    let newPlayerStunTurns = 0; // 敵スキルによるパーティ行動不能の付与ターン数
    // このターンで敵行動が割り込んだ後の全メンバーの被弾フラグ
    const memberDmg = Object.fromEntries(currentPartyKeys.map(k => [k, 0]));  // 各メンバーの受けたダメージ合計
    const memberHeal = Object.fromEntries(currentPartyKeys.map(k => [k, 0])); // 各メンバーのメインフェイズ回復量
    // エフェクト蓄積バッファ（単体バトルでは slotIdx = 0 固定）
    const pendingHitFx    = []; // { slotIdx, dmg, type }
    const pendingDefeatFx = []; // { slotIdx }

    // ── 現在有効なバフ・デバフ表示 ──────────────────────────────────────
    logs.push(`─ ターン ${turn + 1} ─`);
    setcurrentBattleTotalTurns(prev => prev + 1);
    // リバース中はターン開始時にエフェクト再生
    if (reverseActive > 0) playReverseEffect();
    if (enemySpdDebuff > 0)     logs.push(`⬇️ ${ed.name} SPD -5 デバフ中（残${enemySpdDebuff}T）`);
    if (enrageCount > 0)        logs.push(`🔴 ${ed.name} 怒り状態！ 攻撃力×2（残${enrageCount}T）-- 氷結斬で解除可能`);
    if (enemyAtkDebuff > 0)     logs.push(`🔥 ${ed.name} ATK半減中（残${enemyAtkDebuff}T）`);
    if (partySpdBuff > 0)       logs.push(`⚡ パーティ SPD +3 バフ中（残${partySpdBuff}T）`);
    if (provokeActive > 0)      logs.push(`👊 挑発中！ ${ed.name}の行動を強制的に強攻に変換（残${provokeActive}T）`);
    if (takedownActive > 0)     logs.push(`🦵 スタン中！ ${ed.name}が行動不能（残${takedownActive}T）`);
    if (sleepActive > 0)        logs.push(`😴 スタン中！ ${ed.name}が行動不能（残${sleepActive}T）`);
    if (straightShotActive > 0) logs.push(`😵 スタン中！ ${ed.name}が行動不能（残${straightShotActive}T）`);
    if (slowbladeActive > 0)    logs.push(`😵 スタン中！ ${ed.name}が行動不能（残${slowbladeActive}T）`);
    if (waterSphereActive > 0)  logs.push(`💧 水濡れ中！ ${ed.name}のATK半減（残${waterSphereActive}T）`);

    // ══════════════════════════════════════════════════════════════════
    // プリフェイズ：回避・カウンター宣言
    //   counter / dodge は「最速判定」。ここで意図を宣言し、
    //   メインフェイズの敵行動タイミングで解決する。
    // ══════════════════════════════════════════════════════════════════
    const memberDodge   = Object.fromEntries(currentPartyKeys.map(k => [k, (cmds[k] ?? "atk") === "dodge"]));
    const memberCounter = Object.fromEntries(currentPartyKeys.map(k => [k, (cmds[k] ?? "atk") === "counter"]));

    currentPartyKeys.forEach(k => {
      const m = PARTY_DEFS.find(p => p.id === k);
      if (!m) return;
      if (memberDodge[k])   logs.push(`${m.icon} ${m.name} 💨 回避態勢！（敵の攻撃を待つ）`);
      if (memberCounter[k]) logs.push(`${m.icon} ${m.name} 🔄 カウンター構え！（敵の強攻を待つ）`);
    });
    if (eAction === "counter") logs.push(`${ed.em} ${ed.name} 🔄 カウンター構え！`);
    if (eAction === "dodge")   logs.push(`${ed.em} ${ed.name} 💨 回避態勢！`);

    // ══════════════════════════════════════════════════════════════════
    // プリフェイズ：攻撃スキル（isPrephase:true かつ hits>0）
    //   counter/dodge はログ宣言のみ。攻撃系プリフェイズはここでダメージ処理。
    // ══════════════════════════════════════════════════════════════════
    logs.push(`── プリフェイズ ──`);
    for (const actor of actors.filter(a => a.type === "player")) {
      const skillId = cmds[actor.id] ?? "atk";
      const sk_def  = SKILL_DEFS[skillId];
      if (!sk_def || !sk_def.isPrephase) continue;
      if (sk_def.hits === 0 || skillId === "counter" || skillId === "dodge") continue; // counter/dodge はメインフェイズで解決

      const memberAtkBonus = actor.id === "eltz" ? atkBonus : (ALL_CHAR_DEFS[actor.id]?.atk ?? 0);
      const weaponType = actor.id === "eltz" ? (equippedWeapon?.weaponType ?? "none") : "none";

      const { perHit, totalDmg } = resolveSkillDamage({
        skillId, atkBonus: memberAtkBonus, weaponType,
        comboMult: 1.0, targetDef: 0, targetMagDef: 0,
        isStunned: false,
      });

      const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";

      // ── 全体攻撃 ──────────────────────────────────────────────────────
      if (sk_def.target === "all") {
        if (curEnemyHp <= 0) continue;
        const { perHit } = resolveSkillDamage({
          skillId, atkBonus: memberAtkBonus, weaponType,
          comboMult: 1.0,
          targetDef:    ed.pdef ?? 0,
          targetMagDef: ed.mdef ?? 0,
          isStunned: false,
        });
        const dmg = Math.max(1, perHit) * sk_def.hits;
        curEnemyHp = Math.max(0, curEnemyHp - dmg);
        pendingHitFx.push({ slotIdx: 0, dmg, type: "normal" });
        const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
        logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ 全敵に${dmg}ダメージ！`);

      // ── 単体攻撃 ──────────────────────────────────────────────────────
      } else {
        if (curEnemyHp <= 0) continue;
        const finalDmg = Math.max(1, totalDmg);
        curEnemyHp = Math.max(0, curEnemyHp - finalDmg);
        pendingHitFx.push({ slotIdx: 0, dmg: finalDmg, type: "normal" });
        logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel} → ${ed.em}${ed.name} ${finalDmg}ダメージ！`);
      }

      skillsUsedThisTurn.set(skillId, actor.id);
    }
    logs.push(`── メインフェイズ ──`);  // ← 元からある行（削除しない）

    // ══════════════════════════════════════════════════════════════════
    // メインフェイズ：SPD順で行動実行
    //   ・味方スキル（overheal以外）・敵行動（全体攻撃・回避不能含む）を解決
    //   ・counter / dodge はメインフェイズではスキップ（敵行動タイミングで解決）
    // ══════════════════════════════════════════════════════════════════
    for (const actor of actors) {
      // 敵が既に倒されていたら敵行動はスキップ
      if (actor.type === "enemy" && curEnemyHp <= 0) continue;

      if (actor.type === "player") {
        const skillId = cmds[actor.id] ?? "atk";
        const sk_def  = SKILL_DEFS[skillId];
        const isEltz  = actor.id === "eltz";
        if (!sk_def) continue;
      
        // ── プリフェイズ/エンドフェイズ スキルはメインフェイズをスキップ ────────
        // counter/dodge(isPrephase) は敵行動タイミングで解決済み
        // overheal等(isEndphase) はエンドフェイズブロックで処理
        if (sk_def.isPrephase || sk_def.isEndphase) continue;
      
        // ── MP消費 ────────────────────────────────────────────────────────────
        if (sk_def.cost > 0) {
          if (isEltz) curMp = Math.max(0, curMp - sk_def.cost);
          else curPartyMp[actor.id] = Math.max(0, (curPartyMp[actor.id]??0) - sk_def.cost);
        }
      
        // ── 回復スキル（hits=0 かつ healFlat>0） ──────────────────────────────
        if (sk_def.hits === 0 && sk_def.healFlat > 0) {
          // 戦闘不能メンバーは回復をスキップ
          const actorCurrentHp2 = isEltz ? curHp : (curPartyHp[actor.id] ?? 0);
          if (actorCurrentHp2 <= 0) { skillsUsedThisTurn.set(skillId, actor.id); continue; }
          const healAmt = sk_def.healFlat;
          if (sk_def.healTarget === "party") {
            // パーティ全体（通常healはselfなのでここはoverheal等の即時全体回復用）
            curHp = Math.min(curHp + healAmt, mhp);
            for (const k of currentPartyKeys.filter(k2 => k2 !== "eltz")) {
              if ((curPartyHp[k] ?? 0) <= 0) continue;
              curPartyHp[k] = Math.min((curPartyHp[k]??0) + healAmt, partyMhp[k]);
            }
            logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}！ 全員HP+${healAmt}`);
          } else {
            // 自己回復
            if (isEltz) curHp = Math.min(curHp + healAmt, mhp);
            else curPartyHp[actor.id] = Math.min((curPartyHp[actor.id]??0)+healAmt, partyMhp[actor.id]);
            memberHeal[actor.id] = (memberHeal[actor.id]??0) + healAmt;
            logs.push(`${actor.icon}${actor.name} ${sk_def.icon} HP+${healAmt}`);
          }
          // 副作用（baff/debuff）記録
          skillsUsedThisTurn.set(skillId, actor.id);
          continue;
        }
      
        // ── 補助スキル（hits=0 かつ healFlat=0）─────────────────────────────
        // enemyStun / enemyForceAction / selfBuff のみ → ログ出してskillsUsedに積む
        if (sk_def.hits === 0) {
          
          let logMsg = `${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}！`;
          if (sk_def.enemyForceAction === "atk") {
            provokeUsed = true;
            logMsg += ` 全敵を${sk_def.enemyForceActionTurns}T強攻固定！`;
          }
          if (sk_def.enemyStun > 0) {
            if (skillId === "takedown") takedownUsed = true;
            else if (skillId === "straight_shot") straightShotUsed = true;
            else if (skillId === "slow_blade") slowbladeUsed = true;
            else sleepUsed = true;
            logMsg += ` 全敵を${sk_def.enemyStun}T行動不能！`;
          }
          if (sk_def.selfBuff && sk_def.selfBuff.spd > 0) {
            logMsg += ` 味方SPD+${sk_def.selfBuff.spd}（${sk_def.selfBuff.turns}T）！`;
          }
          logs.push(logMsg);
          skillsUsedThisTurn.set(skillId, actor.id);
          continue;
        }
      
        // ── 攻撃スキル ────────────────────────────────────────────────────────
        const weaponType     = equippedWeapon?.weaponType ?? "none";
        const memberAtkBonus = isEltz
          ? atkBonus
          : (ALL_CHAR_DEFS[actor.id]?.atk ?? 0);
      
        // 行動不能状態判定（comboBonus用）
        // ※ 単体バトルは takedownActive/sleepActive/straightShotActive で判断
        // ※ マルチバトルは各敵のstunフラグ（将来拡張）。現状は単体と同じ値を参照
        const isTargetStunned = (takedownActive > 0 || sleepActive > 0 || straightShotActive > 0|| slowbladeActive > 0);
      
        // ── 全体攻撃 ──────────────────────────────────────────────────────
        if (sk_def.target === "all") {
          const { perHit } = resolveSkillDamage({
            skillId, atkBonus: memberAtkBonus, weaponType,
            comboMult: comboAtkMult,
            targetDef:    ed.pdef ?? 0,
            targetMagDef: ed.mdef ?? 0,
            isStunned: isTargetStunned,
          });
          const dmg = Math.max(1, perHit) * sk_def.hits;
          curEnemyHp = Math.max(0, curEnemyHp - dmg);
          pendingHitFx.push({ slotIdx: 0, dmg, type: "normal" });
          const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
          logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ 全敵に${dmg}ダメージ！`);
          skillsUsedThisTurn.set(skillId, actor.id);
          continue;
        }
      
        // ── 単体攻撃：ターゲット解決 ──────────────────────────────────────────
        // マルチバトル用（curEnemiesが存在する場合）
        let tIdx = actor.targetIdx ?? 0;
        if (typeof curEnemies !== "undefined" && curEnemies) {
          if (!curEnemies[tIdx] || curEnemies[tIdx].defeated) {
            const fb = curEnemies.findIndex(e => !e.defeated);
            if (fb < 0) { logs.push(`${actor.icon}${actor.name} 攻撃対象なし`); continue; }
            tIdx = fb;
          }
        }
      
        // 対象敵のアクション取得（カウンター判定用）
        const tDef = typeof curEnemies !== "undefined" && curEnemies
          ? curEnemies[tIdx]
          : null;
        const eActionForJudge = tDef
          ? tDef.def.pattern[tDef.turnIdx % tDef.def.pattern.length]
          : eAction; // 単体バトルはターン冒頭で決定済みの eAction を使用
      
        // atk vs 敵counter → 敵行動フェーズで一括処理するためここではスキップ
        if (skillId === "atk" && eActionForJudge === "counter" && !sk_def.pierceCounter) {
          continue;
        }
      
        // ── 属性計算 ──────────────────────────────────────────────────────────
        const tEnemyDef = tDef ? tDef.def : ed;
        const meElemCycle = tEnemyDef.elementCycle ?? null;
        const meElemKey   = meElemCycle
          ? meElemCycle[enemyElementIdx % meElemCycle.length]
          : null;
        let elemMult  = 1.0;
        let isWeakHit = false;
        if (sk_def.element && meElemKey && meElemKey !== "none") {
          const rel = ELEMENT_RELATIONS[sk_def.element];
          isWeakHit = rel ? meElemKey === rel.weak    : false;
          const isResist = rel ? meElemKey === rel.resist : false;
          elemMult  = isWeakHit ? 2.0 : isResist ? 0.5 : 1.0;
        }
      
        // ── ダメージ計算 ──────────────────────────────────────────────────────
        // executePartyTurn は単体バトル専用。tDef は常に null なので単体計算のみ
          const { totalDmg } = resolveSkillDamage({
            skillId, atkBonus:memberAtkBonus, weaponType,
            comboMult:comboAtkMult,
            targetDef:    ed.pdef ?? 0,
            targetMagDef: ed.mdef ?? 0,
            isStunned:isTargetStunned,
          });
          const finalDmg = Math.max(1, Math.round(totalDmg * elemMult));
      
        // HP反映
        if (tDef) {
          // マルチバトル
          curEnemies[tIdx].hp = Math.max(0, tDef.hp - finalDmg);
          if (curEnemies[tIdx].hp <= 0) curEnemies[tIdx].defeated = true;
          pendingHitFx.push({ slotIdx:tIdx, dmg:finalDmg, type:isWeakHit?"weak":"normal" });
          if (curEnemies[tIdx].defeated) pendingDefeatFx.push({ slotIdx:tIdx });
        } else {
          // 単体バトル
          curEnemyHp = Math.max(0, curEnemyHp - finalDmg);
          pendingHitFx.push({ slotIdx:0, dmg:finalDmg, type:isWeakHit?"weak":"normal" });
        }
      
        // ログ
        const tEmName  = tDef ? `${tDef.def.em}${tDef.def.name}` : `${ed.em}${ed.name}`;
        const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
        const eLabel   = isWeakHit ? " ⚡弱点!" : elemMult===0.5 ? " 耐性½" : "";
        logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel} → ${tEmName} ${finalDmg}ダメージ！${eLabel}`);
      
        // 属性ブレイク蓄積
        if (isWeakHit && !elemBreakTriggered) {
          newElemAccum += finalDmg;
          if (newElemAccum >= ELEMENT_BREAK_THRESHOLD) {
            elemBreakTriggered = true; newElemAccum = 0;
            logs.push(`💥 ELEMENT BREAK！`);
            setElemBreakAnim(true); setTimeout(()=>setElemBreakAnim(false), 1500);
            setcurrentBattleElemBreaks(prev => prev + 1);
          }
        }
      
        // ── 攻撃+回復複合（hits>0 かつ healFlat>0 のスキル：シーソー等） ──
        if (sk_def.healFlat > 0) {
          const isEltzHeal = actor.id === "eltz";
          const actorComboHp2 = isEltzHeal ? curHp : (curPartyHp[actor.id] ?? 0);
          if (actorComboHp2 > 0) {
            const healAmt = sk_def.healFlat;
            if (isEltzHeal) curHp = Math.min(curHp + healAmt, mhp);
            else curPartyHp[actor.id] = Math.min((curPartyHp[actor.id]??0) + healAmt, partyMhp[actor.id]);
            memberHeal[actor.id] = (memberHeal[actor.id]??0) + healAmt;
            logs.push(`${actor.icon}${actor.name} ⚖ HP+${healAmt}（複合回復）`);
          }
        }

        // ── 攻撃+スタン複合（hits>0 かつ enemyStun>0 のスキル：テイクダウン等） ──
        if (sk_def.enemyStun > 0) {
          if (skillId === "takedown") takedownUsed = true;
          else if (skillId === "straight_shot") straightShotUsed = true;
          else if (skillId === "slow_blade") slowbladeUsed = true;
          else sleepUsed = true;
        }

        skillsUsedThisTurn.set(skillId, actor.id);
      
      } else {
        // ── 敵行動 ──────────────────────────────────────────────────────────
        if (elemBreakTriggered) {
          logs.push(`${ed.em} ${ed.name}の行動は属性破壊で無効化された！`);
          continue;
        }
          const prephaseStunUsed = [...skillsUsedThisTurn.keys()].some(sid => {
          const sk = SKILL_DEFS[sid];
          return sk && sk.isPrephase && sk.enemyStun >= 1 && sk.hits > 0;
        });
        const isStunned = prephaseStunUsed || takedownUsed || takedownActive > 0 || sleepUsed || sleepActive > 0 || straightShotUsed || straightShotActive > 0 || slowbladeUsed || slowbladeActive > 0 ;
        if (isStunned) {
          const stunLabel = prephaseStunUsed
            ? "🗡 スタン"
            : (takedownUsed || takedownActive > 0) ? "🦵 テイクダウン"
            : (straightShotUsed || straightShotActive > 0) ? "😵 ストレートショット"
            : (slowbladeUsed || slowbladeActive > 0) ? "😵 スローブレード"
            : "😴 スリープ";
          logs.push(`${ed.em}${ed.name} ${stunLabel}で行動不能！`);
          continue;
        }

        const isProvokeActive = provokeUsed || provokeActive > 0;
        const resolvedEAction = isProvokeActive ? "atk" : eAction;
        const isEnraged = enrageCount > 0 && !iceSlashUsed;
        const atkHalf = enemyAtkDebuff > 0 || waterSphereActive > 0;
        const totalMult = (isEnraged ? 2.0 : 1.0) * (atkHalf ? 0.5 : 1.0);
        const rageLabel = isEnraged ? "🔴" : "";
        const halfLabel = atkHalf ? "（ATK半減）" : "";

        // ターゲット決定（SPD最低のメンバー）
        const spdSorted = [...PARTY_DEFS].sort((a, b) => a.spd - b.spd);
        const targetMember = spdSorted[0];
        const tid = targetMember.id;
        const tDodge   = memberDodge[tid]   ?? false;
        const tCounter = memberCounter[tid] ?? false;

        if (resolvedEAction === "enrage") {
          logs.push(`${ed.em} 🔴 ${ed.name}が怒り状態に！ 3ターン攻撃力×2！`);

        } else if (resolvedEAction === "atk_all") {
          // 全体攻撃：回避・カウンター無効
          const baseRaw = randInt(ed.atk[0], ed.atk[1]);
          const dmg = Math.max(1, Math.round(baseRaw * totalMult) - defBonus);
          const label = isEnraged ? "🔴🌊 怒り全体攻撃！" : "🌊 全体攻撃！";
          logs.push(`${ed.em} ${label}${halfLabel} 全員に ${dmg} ダメージ！`);
          curHp = Math.max(0, curHp - dmg);
          memberDmg["eltz"] = (memberDmg["eltz"] ?? 0) + dmg;
          for (const k of currentPartyKeys.filter(k => k !== "eltz")) {
            curPartyHp[k] = Math.max(0, (curPartyHp[k] ?? 0) - dmg);
            memberDmg[k] = (memberDmg[k] ?? 0) + dmg;
          }
          setShowAtkAllAnim(false); // 一旦リセットして再マウントを強制
          setTimeout(() => { setAtkAllAnimKey(k => k + 1); setShowAtkAllAnim(true); }, 0);

        } else if (resolvedEAction === "unavoidable") {
          // 回避不能：counter/dodge両方無効、ターゲット単体に直撃
          const [minD, maxD] = ed.unavoidableAtk ?? [30, 45];
          const dmg = Math.max(1, Math.round(randInt(minD, maxD) * totalMult) - defBonus);
          logs.push(`${ed.em} ${rageLabel}💥 回避不能攻撃！${halfLabel} ${targetMember.icon} ${targetMember.name}に ${dmg} ダメージ！`);
          if (tid === "eltz") { curHp = Math.max(0, curHp - dmg); }
          else { curPartyHp[tid] = Math.max(0, (curPartyHp[tid] ?? 0) - dmg); }
          memberDmg[tid] = (memberDmg[tid] ?? 0) + dmg;

        } else if (resolvedEAction === "dodge") {
          // 敵dodge：counter→敵回避+反撃、dodge→相殺、atk→敵行動なし（プレイヤーは既に直撃済み）
          if (tCounter) {
            const baseRaw = randInt(ed.atk[0], ed.atk[1]) + Math.floor(ed.atk[1] * 0.3);
            const memberDefBonus = tid === "eltz" ? defBonus : (ALL_CHAR_DEFS[tid]?.def ?? 0);
            const cd = Math.max(1, Math.round(baseRaw * totalMult) - memberDefBonus);
            if (tid === "eltz") { curHp = Math.max(0, curHp - cd); }
            else { curPartyHp[tid] = Math.max(0, (curPartyHp[tid] ?? 0) - cd); }
            memberDmg[tid] = (memberDmg[tid] ?? 0) + cd;
            logs.push(`${ed.em} ${ed.name} 💨 回避！ ${targetMember.icon}${targetMember.name}のカウンターをかわし → ${targetMember.icon}${targetMember.name}に ${cd} ダメージで反撃！（${targetMember.name}の強攻を無効化）`);
          } else if (tDodge) {
            logs.push(`💨 回避相殺！ ${targetMember.icon}${targetMember.name} vs ${ed.em}${ed.name}（互いに無効）`);
          } else {
            logs.push(`${ed.em} ${ed.name} 💨 回避！（行動なし）`);
          }

        } else if (resolvedEAction === "counter") {
          // 敵カウンター：攻撃者の行動で解決
          // tDodge  → 回避成功 + 反撃ダメージ
          // tCounter→ 相殺（互いに無効）
          // その他  → atk選択メンバー全員に個別カウンターダメージ
          if (tDodge) {
            const csk = BATTLE_SKILLS.find(s => s.id === "dodge");
            const dodgeDmg = Math.max(1, Math.round((randInt(csk.dmg[0], csk.dmg[1]) + (tid === "eltz" ? atkBonus : 0)) * comboAtkMult) - (ed.pdef ?? 0));
            curEnemyHp = Math.max(0, curEnemyHp - dodgeDmg);
            pendingHitFx.push({ slotIdx: 0, dmg: dodgeDmg, type: "normal" });
            logs.push(`${targetMember.icon} ${targetMember.name} 💨 回避成功！ ${ed.name}のカウンターをかわし → ${dodgeDmg} ダメージで反撃！`);
          } else if (tCounter) {
            logs.push(`🔄 カウンター相殺！ ${targetMember.icon}${targetMember.name} vs ${ed.name}（互いの攻撃を無効化）`);
          } else {
            // atk を選択したメンバー全員に個別カウンターダメージ
            let anyAtk = false;
            for (const k of currentPartyKeys) {
              if (cmds[k] !== "atk") continue;
              anyAtk = true;
              const m = PARTY_DEFS.find(p => p.id === k);
              const baseRaw = randInt(ed.atk[0], ed.atk[1]) + Math.floor(ed.atk[1] * 0.3);
              const mDef = k === "eltz" ? defBonus : (ALL_CHAR_DEFS[k]?.def ?? 0);
              const dmg = Math.max(1, Math.round(baseRaw * totalMult) - mDef);
              if (k === "eltz") { curHp = Math.max(0, curHp - dmg); }
              else { curPartyHp[k] = Math.max(0, (curPartyHp[k] ?? 0) - dmg); }
              memberDmg[k] = (memberDmg[k] ?? 0) + dmg;
              logs.push(`${ed.em} ${rageLabel}🔄 ${ed.name}カウンター！${halfLabel} ${m.icon}${m.name}に ${dmg} ダメージ！（${m.name}の強攻を無効化）`);
            }
            if (!anyAtk) {
              // heal等の非攻撃行動のみ：カウンター不成立
              logs.push(`${ed.em} ${ed.name} 🔄 カウンター構え...しかし不発！`);
            }
          }

        } else if (SKILL_DEFS[resolvedEAction] && !["atk","counter","dodge","unavoidable","atk_all","enrage"].includes(resolvedEAction)) {
          // ── 敵がプレイヤースキルを使用（単体バトル） ─────────────────────
          const sk_def = SKILL_DEFS[resolvedEAction];
          if (sk_def.target === "all") {
            const baseAtk = Math.round(randInt(ed.atk[0], ed.atk[1]) * totalMult);
            const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
            logs.push(`${ed.em}${ed.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ 全体攻撃${halfLabel}`);
            for (const k of currentPartyKeys) {
              const mDef = getMemberDef(k);
              const dmgPerHit = Math.max(1, Math.round(baseAtk * sk_def.dmgMult) - mDef);
              const totalSkDmg = dmgPerHit * sk_def.hits;
              if (k === "eltz") { curHp = Math.max(0, curHp - totalSkDmg); }
              else { curPartyHp[k] = Math.max(0, (curPartyHp[k] ?? 0) - totalSkDmg); }
              memberDmg[k] = (memberDmg[k] ?? 0) + totalSkDmg;
              logs.push(`  → ${ALL_CHAR_DEFS[k]?.icon ?? ""}${ALL_CHAR_DEFS[k]?.name ?? k} ${totalSkDmg}ダメージ！`);
            }
          } else {
            const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
            const baseRaw = Math.round(randInt(ed.atk[0], ed.atk[1]) * totalMult * (sk_def.dmgMult || 1.0));
            const totalSkDmg = Math.max(1, baseRaw - getMemberDef(tid)) * (sk_def.hits || 1);
            if (tid === "eltz") { curHp = Math.max(0, curHp - totalSkDmg); }
            else { curPartyHp[tid] = Math.max(0, (curPartyHp[tid] ?? 0) - totalSkDmg); }
            memberDmg[tid] = (memberDmg[tid] ?? 0) + totalSkDmg;
            logs.push(`${ed.em}${rageLabel}${sk_def.icon}${ed.name}が${sk_def.label}${hitLabel}！${halfLabel} ${targetMember.icon}${targetMember.name}に${totalSkDmg}ダメージ！`);
          }
          // パーティスタン効果
          if (sk_def.enemyStun > 0) {
            newPlayerStunTurns = Math.max(newPlayerStunTurns, sk_def.enemyStun);
            logs.push(`${ed.em}${ed.name} 🦵 パーティを${sk_def.enemyStun}T行動不能にした！`);
          }

        } else {
          // 敵通常強攻
          // dodge vs atk → 敵攻撃直撃（被弾）
          // counter vs atk → カウンター反撃×1.5、被弾なし
          // atk/other → 通常被弾
          if (tCounter) {
            const csk = BATTLE_SKILLS.find(s => s.id === "counter");
            const bonusDmg = Math.max(1, Math.round((randInt(csk.dmg[0], csk.dmg[1]) * 1.5 + (tid === "eltz" ? atkBonus : 0)) * comboAtkMult) - (ed.pdef ?? 0));
            curEnemyHp = Math.max(0, curEnemyHp - bonusDmg);
            pendingHitFx.push({ slotIdx: 0, dmg: bonusDmg, type: "normal" });
            logs.push(`${targetMember.icon} ${targetMember.name} 🔄 カウンター成功！ → ${ed.name}に ${bonusDmg} ダメージ（×1.5）！ ${targetMember.name}は被弾を免れた！`);
          } else {
            // dodge も atk も通常被弾
            const baseRaw = randInt(ed.atk[0], ed.atk[1]);
            const dmg = Math.max(1, Math.round(baseRaw * totalMult) - defBonus);
            if (tid === "eltz") { curHp = Math.max(0, curHp - dmg); }
            else { curPartyHp[tid] = Math.max(0, (curPartyHp[tid] ?? 0) - dmg); }
            memberDmg[tid] = (memberDmg[tid] ?? 0) + dmg;
            const dodgeLabel = tDodge ? "（回避しようとしたが直撃！）" : "";
            logs.push(`${ed.em} ${rageLabel}⚔ ${ed.name}強攻！${halfLabel} ${targetMember.icon}${targetMember.name}に ${dmg} ダメージ！${dodgeLabel}`);
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // エンドフェイズ：最遅延行動（オーバーヒール）
    // ══════════════════════════════════════════════════════════════════
    // ── エンドフェイズ：isEndphase:true のスキルを処理 ─────────────────────
    logs.push(`── エンドフェイズ ──`);
    for (const actor of actors.filter(a => a.type === "player")) {
      const skillId = cmds[actor.id] ?? "atk";
      const sk_def  = SKILL_DEFS[skillId];
      if (!sk_def || !sk_def.isEndphase) continue;

      // ── ダメージスキル（hits > 0 かつ healFlat === 0）────────────────────
      if (sk_def.hits > 0 && sk_def.healFlat === 0) {
        const memberAtkBonus = actor.id === "eltz" ? atkBonus : (ALL_CHAR_DEFS[actor.id]?.atk ?? 0);
        const weaponType = actor.id === "eltz" ? (equippedWeapon?.weaponType ?? "none") : "none";

        const { perHit, totalDmg } = resolveSkillDamage({
          skillId, atkBonus: memberAtkBonus, weaponType,
          comboMult: 1.0, targetDef: 0, targetMagDef: 0,
          isStunned: false,
        });

        const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";

        // ── 全体攻撃 ──────────────────────────────────────────────────────
        if (sk_def.target === "all") {
          const { perHit } = resolveSkillDamage({
            skillId, atkBonus: memberAtkBonus, weaponType,
            comboMult: 1.0,
            targetDef:    ed.pdef ?? 0,
            targetMagDef: ed.mdef ?? 0,
            isStunned: false,
          });
          const dmg = Math.max(1, perHit) * sk_def.hits;
          curEnemyHp = Math.max(0, curEnemyHp - dmg);
          pendingHitFx.push({ slotIdx: 0, dmg, type: "normal" });
          const hitLabel = sk_def.hits > 1 ? ` (${sk_def.hits}hit)` : "";
          logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel}！ 全敵に${dmg}ダメージ！`);

        // ── 単体攻撃 ──────────────────────────────────────────────────────
        } else {
          if (curEnemyHp <= 0) continue;
          const finalDmg = Math.max(1, totalDmg);
          curEnemyHp = Math.max(0, curEnemyHp - finalDmg);
          pendingHitFx.push({ slotIdx: 0, dmg: finalDmg, type: "normal" });
          logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}${hitLabel} → ${ed.em}${ed.name} ${finalDmg}ダメージ！`);
        }

        skillsUsedThisTurn.set(skillId, actor.id);
      }

      // ── 回復スキル（healFlat > 0）────────────────────────────────────────
      if (sk_def.healFlat > 0) {
        // 戦闘不能メンバーは回復をスキップ
        const isEltzEnd2 = actor.id === "eltz";
        const actorEndHp2 = isEltzEnd2 ? curHp : (curPartyHp[actor.id] ?? 0);
        if (actorEndHp2 > 0) {
          const healAmt = sk_def.healFlat;
          if (sk_def.healTarget === "party") {
            curHp = Math.min(curHp + healAmt, mhp);
            for (const k of currentPartyKeys.filter(k2 => k2 !== "eltz")) {
              if ((curPartyHp[k]??0) <= 0) continue;
              curPartyHp[k] = Math.min((curPartyHp[k]??0)+healAmt, partyMhp[k]);
            }
            logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}発動！ 全員HP+${healAmt}！`);
          } else {
            const isEltz2 = actor.id === "eltz";
            if (isEltz2) curHp = Math.min(curHp + healAmt, mhp);
            else curPartyHp[actor.id] = Math.min((curPartyHp[actor.id]??0)+healAmt, partyMhp[actor.id]);
            logs.push(`${actor.icon}${actor.name} ${sk_def.icon}${sk_def.label}発動！ HP+${healAmt}！`);
          }
          overhealUsed = true;
          skillsUsedThisTurn.set(skillId, actor.id);
        }
      }
    }
    // ══════════════════════════════════════════════════════════════════
    // コンボジャッジ
    //   通常：全員無被弾 → 成立
    //   heal使用時（unavoidable含むターン）：被ダメ - 回復量 ≤ 0 で全員成立
    //   overheal使用時：被ダメージ合計 ≤ 回復量(80) なら成立（従来仕様維持）
    //   コンボ加算はパーティ人数分
    // ══════════════════════════════════════════════════════════════════
    logs.push(`── コンボジャッジ ──`);

    const OVERHEAL_AMT = 120;
    const partySize = currentPartyKeys.length;
    // このターン敵がunavoidableを使用したか
    const hadUnavoidable = eAction === "unavoidable";
    // いずれかのメンバーがhealを使用したか
    const healUsedThisTurn = currentPartyKeys.some(k => (memberHeal[k] ?? 0) > 0);
    let comboOk;
    if (overhealUsed) {
      // オーバーヒールターン（従来仕様維持）
      comboOk = currentPartyKeys.every(k => (memberDmg[k] ?? 0) <= OVERHEAL_AMT);
      if (!comboOk) {
        const failKeys = currentPartyKeys.filter(k => (memberDmg[k] ?? 0) > OVERHEAL_AMT);
        const failInfo = failKeys.map(k => {
          const name = PARTY_DEFS.find(p => p.id === k)?.name ?? k;
          return `${name}(被ダメ${memberDmg[k]??0})`;
        }).join("・");
        logs.push(`💔 ${failInfo} がオーバーヒール(${OVERHEAL_AMT})超過`);
      }
    } else if (hadUnavoidable && healUsedThisTurn) {
      // 回避不能ターン＋heal使用：被ダメ - 回復量 ≤ 0 で全員コンボ成立
      comboOk = currentPartyKeys.every(k => (memberDmg[k] ?? 0) - (memberHeal[k] ?? 0) <= 0);
      if (!comboOk) {
        const failKeys = currentPartyKeys.filter(k => (memberDmg[k] ?? 0) - (memberHeal[k] ?? 0) > 0);
        const failInfo = failKeys.map(k => {
          const name = PARTY_DEFS.find(p => p.id === k)?.name ?? k;
          return `${name}(被ダメ${memberDmg[k]??0}-回復${memberHeal[k]??0}=${(memberDmg[k]??0)-(memberHeal[k]??0)})`;
        }).join("・");
        logs.push(`💔 ${failInfo} がヒール後もダメージ超過`);
      }
    } else {
      comboOk = currentPartyKeys.every(k => (memberDmg[k] ?? 0) === 0);
    }
    const newStreak = comboOk ? noDmgStreak + partySize : 0;
    if (comboOk) {
      const gain = 5 + newStreak;
      curMp = Math.min(curMp + gain, mmp);
      for (const key of Object.keys(curPartyMp)) {
        curPartyMp[key] = Math.min((curPartyMp[key] ?? 0) + gain, partyMmp[key] ?? 0);
      }
      if (newStreak >= 3) logs.push(`✨ PARTY COMBO ${newStreak}! 全員MP +${gain} 回復！`);
      else logs.push(`🔗 コンボ継続 ${newStreak}！ MP +${gain}`);
      setcurrentBattleComboTurns(prev => prev + 1);
    } else {
      logs.push(`💥 コンボ断絶`);
      // ミスした戦闘はシナリオフルコンボに加算しない（既存カウントはリセットしない）
      if (isScenarioBattleRef.current) { comboMissedRef.current = true; }
    }

    // ══════════════════════════════════════════════════════════════════
    // アップデート：属性チェンジ・バフ/デバフ更新
    // ══════════════════════════════════════════════════════════════════
    // ── アップデートフェイズ：副作用一括適用 ──────────────────────────────
    logs.push(`── アップデート ──`);

    const sideEffects = applySkillSideEffects({
      skillsUsedThisTurn,
      enemySpdDebuff, enemyAtkDebuff, partySpdBuff,
      provokeActive,
      takedownActive,
      sleepActive,
      straightShotActive,   // ← 追加
      waterSphereActive,
      bikerAtkBonus,
      enrageCount,
      reverseActive,   // ← 追加
      cdMap: memberCdMap,   // すでに { skillId: { memberId: value } } 形式
    });

    // 属性チェンジログ（isBossかつelementCycle持ちの敵のみ）
    if (elementCycle && ed.isBoss) {
      const nextKey = elementCycle[nextElementIdx];
      const info = ELEMENT_NAMES[nextKey];
      if (info) logs.push(`${ed.em}${ed.name} 属性チェンジ → ${info.icon}${info.label}`);
    }

    // ステート一括セット
    setEnemySpdDebuff(sideEffects.enemySpdDebuff);
    setEnemyAtkDebuff(sideEffects.enemyAtkDebuff);
    setPartySpdBuff(sideEffects.partySpdBuff);
    setProvokeActive(sideEffects.provokeActive);
    setTakedownActive(sideEffects.takedownActive);
    setSleepActive(sideEffects.sleepActive);
    setStraightShotActive(sideEffects.straightShotActive); 
    setslowbladeActive(sideEffects.slowbladeActive); 
    setBikerAtkBonus(sideEffects.bikerAtkBonus);
    setEnrageCount(sideEffects.enrageCount);
    setWaterSphereActive(sideEffects.waterSphereActive);
    setReverseActive(sideEffects.reverseActive);   // ← 追加

    // 個別setterは全廃。1つのsetMemberCdMapで管理
    setMemberCdMap(sideEffects.nextCdMap);

    // ── ステート一括更新 ────────────────────────────────────────────────────
    setHp(Math.min(curHp, mhp));
    setMp(Math.max(0, curMp));
    setPartyHp(curPartyHp);
    setPartyMp(curPartyMp);
    setEnemyHp(curEnemyHp);
    setElemDmgAccum(newElemAccum);
    if (elementCycle) setEnemyElementIdx(nextElementIdx);
    // プレイヤースタン：新規付与があればセット、なければデクリメント
    if (newPlayerStunTurns > 0) {
      setPlayerStunActive(newPlayerStunTurns);
    } else if (playerStunActive > 0) {
      setPlayerStunActive(prev => Math.max(0, prev - 1));
    }
    setTurn(t => t + 1);
    setNoDmgStreak(newStreak);
    setEnemyTurnIdx(nextEnemyTurnIdx);
    setEnemyNextAction(pattern[nextEnemyTurnIdx]);
    setBtlAnimEnemy(true); setTimeout(() => setBtlAnimEnemy(false), 400);
    // ── エフェクト発火（スロットごとに総ダメージを合算して1エフェクト） ─────
    const hitFxBySlot2 = {};
    pendingHitFx.forEach(fx => {
      if (!hitFxBySlot2[fx.slotIdx]) hitFxBySlot2[fx.slotIdx] = { dmg: 0, type: "normal" };
      hitFxBySlot2[fx.slotIdx].dmg += fx.dmg;
      if (fx.type === "weak") hitFxBySlot2[fx.slotIdx].type = "weak";
    });
    Object.entries(hitFxBySlot2).forEach(([slotIdx, fx]) => fireHitEffect(Number(slotIdx), fx.dmg, fx.type));
    if (curEnemyHp <= 0 && pendingHitFx.length > 0) fireDefeatEffect(0);

    // ── 勝敗判定 ────────────────────────────────────────────────────────────
    if (curEnemyHp <= 0) {
      setBtlLogs(prev => [...prev, ...logs].slice(-18));
      setVictory(true);
      hitSlotIdsRef.current.clear(); setHitFlashTick(t => t + 1); setHitEffects([]);  // フラッシュ残留リセット
      setInputPhase("command"); setCmdInputIdx(0);
      // シナリオ起動バトルかつ最終ターンコンボOKなら継続フルコンボ+1（MapScan除外・コンボミス除外）
      if (isScenarioBattleRef.current && !comboMissedRef.current) setScenarioFullCombo(v => v + 1);
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
      // エルツが行動不能 → 即敗北
      setBtlLogs(prev => [...prev, ...logs].slice(-18));
      setDefeat(true);
      hitSlotIdsRef.current.clear(); setHitFlashTick(t => t + 1); setHitEffects([]);  // フラッシュ残留リセット
      setInputPhase("command"); setCmdInputIdx(0);
      setBtlLogs(prev => [...prev, "💀 エルツが行動不能！ 敗北..."]);
    } else {
      // 仲間のHP0チェック → 戦闘不能ログ追記（ゲーム継続）
      const downedKeys = currentPartyKeys.filter(k => k !== "eltz" && (curPartyHp[k] ?? 0) <= 0);
      if (downedKeys.length > 0) {
        const downedNames = downedKeys.map(k => ALL_CHAR_DEFS[k]?.name ?? k).join("・");
        logs.push(`💀 ${downedNames} が戦闘不能！`);
      }
      setBtlLogs(prev => [...prev, ...logs].slice(-18));
      setInputPhase("command");
      setCmdInputIdx(0);
    }
  }, [
    battleEnemy, currentEnemyType, battleDefs, enemyTurnIdx,
    enemyElementIdx, elemDmgAccum, enemySpdDebuff,
    enrageCount, enemyAtkDebuff, partySpdBuff,
    provokeActive,
    takedownActive, sleepActive, 
    bikerAtkBonus, 
    straightShotActive, 
    slowbladeActive,
    waterSphereActive,
    enemyHp, hp, mp, mhp, mmp, partyHp, partyMhp, partyMp, partyMmp,
    statAlloc, weaponPatk, noDmgStreak, lv,
    showNotif, handleExpGain, turn,
    fireHitEffect, fireDefeatEffect, playerStunActive, playReverseEffect,
  ]);

  // @@SECTION:LOGIC_PENDING_EXEC ────────────────────────────────────────────────
  // pendingExecution → ターン実行（クロージャ問題の解決）
  // onCommand/onSelectTargetから直接execute*を呼ぶと古いクロージャを参照する場合がある。
  // stateにキューイングしてuseEffectで実行することで常に最新のexecute*を使う。
  useEffect(() => {
    if (!pendingExecution) return;
    setPendingExecution(null);
    if (pendingExecution.mode === "multi") {
      executeMultiTurn(pendingExecution.cmds, pendingExecution.targets);
    } else {
      executePartyTurn(pendingExecution.cmds);
    }
  }, [pendingExecution, executeMultiTurn, executePartyTurn]);

  // ── プレイヤースタン中：コマンドフェーズ開始時に全員 heal を自動セットして即実行 ──
  useEffect(() => {
    if (playerStunActive <= 0) return;
    if (victory || defeat) return;
    if (inputPhase !== "command") return;
    // 全員 heal（行動不能扱い）を自動割り当て
    const stunCmds = Object.fromEntries(PARTY_DEFS.map(m => [m.id, "heal"]));
    const stunTgts = multiEnemies
      ? Object.fromEntries(PARTY_DEFS.map(m => [m.id, 0]))
      : null;
    setBtlLogs(prev => [...prev, `🦵 行動不能！ パーティは動けない（残${playerStunActive}T）`].slice(-20));
    setInputPhase("execute");
    setPendingExecution(multiEnemies
      ? { mode:"multi", cmds:stunCmds, targets:stunTgts }
      : { mode:"single", cmds:stunCmds, targets:null });
  }, [playerStunActive, inputPhase, victory, defeat, multiEnemies]);
  // @@SECTION:LOGIC_BATTLE_CMD ──────────────────────────────────────────────────
  // onCancelCommand（コマンドキャンセル）・exitBattle（バトル終了・勝敗処理）
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
      setMemberCdMap({});   // ← 追加
      showNotif("💀 敗北...");
      setFade(true);
      setTimeout(() => { setSceneIdx(sceneIdxBeforeBattle.current); setDlIdx(0); setPhase("game"); setFade(false); }, 400);
      return;
    }
    const isMapscanBattle = battleNext === "mapscan";
    const nextSc = (battleNext !== null && battleNext !== "mapscan") ? battleNext : sceneIdx;
    setVictoryNextSc(isMapscanBattle ? "mapscan" : nextSc);
    if (mapScanPendingDropRef.current) {
      const { dropKey, winCount } = mapScanPendingDropRef.current;
      mapScanPendingDropRef.current = null;
      const table = MAP_SCAN_DROPS[dropKey];
      if (table) {
        const isRare = winCount % 3 === 0;
        const drop = isRare ? table.rare : table.normal;
        if (drop) {
          if (drop.type === "elk") {
            setElk(e => e + drop.amount);
            setTimeout(() => showNotif(`${isRare ? "💎 レア！ " : "💰 "}${drop.amount} ELK 獲得！`), 100);
          } else if (drop.type === "item") {
            gainItem(drop.item);
            if (isRare) setTimeout(() => showNotif(`💎 レアドロップ！ ${drop.item.name}！`), 100);
          }
        }
      }
    }
    if (isScenarioBattleRef.current) {
      setBattleAnalytics(prev => [...prev, {
        battleType: currentEnemyType,
        totalTurns: currentBattleTotalTurns,
        comboTurns: currentBattleComboTurns,
        elemBreaks: currentBattleElemBreaks,
      }]);
      setTotalElemBreaks(prev => prev + currentBattleElemBreaks);
    }
    setcurrentBattleTotalTurns(0);
    setcurrentBattleComboTurns(0);
    setcurrentBattleElemBreaks(0);
    // マルチバトルの場合は全敵のELK/EXPを合算
    const totalMult = (battleResultBonus.comboMult ?? 1.0) * (battleResultBonus.gradeMult ?? 1.0);
    const gainElk = multiEnemies
      ? multiEnemies.reduce((s, e) => s + (e.def.elk ?? 0), 0)
      : (battleEnemy ? battleEnemy.elk : 0);
    const baseExp = multiEnemies
      ? multiEnemies.reduce((s, e) => s + (e.def.exp ?? 0), 0)
      : (battleEnemy ? battleEnemy.exp : 0);
    const displayExp = Math.round(baseExp * totalMult);
    // ドロップ情報を収集してリザルトに渡す
    const dropInfo = (() => {
      if (!mapScanPendingDropRef.current) return [];
      const { dropKey, winCount } = mapScanPendingDropRef.current;
      const table = MAP_SCAN_DROPS[dropKey];
      if (!table) return [];
      const isRare = winCount % 3 === 0;
      const drop = isRare ? table.rare : table.normal;
      if (!drop) return [];
      if (drop.type === "elk") return [{ label:`${isRare?"💎":"💰"} ${drop.amount} ELK`, isRare }];
      if (drop.type === "item") return [{ label:`${isRare?"💎":"📦"} ${drop.item.name}`, isRare }];
      return [];
    })();
    setBattleResult({ gainExp:displayExp, gainElk, comboMult:battleResultBonus.comboMult??1.0, gradeMult:battleResultBonus.gradeMult??1.0, dropItems:dropInfo });
    setMemberCdMap({});   // ← 追加
        setFade(true);
        setTimeout(() => { setMultiEnemies(null); setPhase("victory"); setFade(false); }, 300);
      }, [defeat, mhp, mmp, battleNext, sceneIdx, showNotif, battleEnemy, battleResultBonus, multiEnemies,currentBattleTotalTurns,currentBattleComboTurns,currentBattleElemBreaks,currentEnemyType]);
  // ── MapScanドロップテーブル ─────────────────────────────────────────────
  const MAP_SCAN_DROPS = {
    seagull:       { normal:{ type:"elk", amount:20 },  rare:{ type:"item", item:{ id:"copper_sword", name:"銅の剣", type:"weapon", basePatk:6,  basePdef:0,  spd:0, quality:"N"  } } },
    shamerlot:     { normal:{ type:"elk", amount:30 },  rare:{ type:"elk", amount:90 } },
    shamerlot_lv3: { normal:{ type:"elk", amount:50 },  rare:{ type:"elk", amount:150 } },
    shamerlot_lv5: { normal:{ type:"elk", amount:80 },  rare:{ type:"elk", amount:240  } },
    moocat:        { normal:{ type:"elk", amount:55 },  rare:{ type:"item", item:{ id:"baroque_sword", name:"バロックソード", type:"weapon", basePatk:11,  basePdef:0,  spd:0, quality:"N"  } } },
    mandragora:    { normal:{ type:"elk", amount:65 },  rare:{ type:"item", item:{ id:"baroque_armor", name:"バロックアーマー", type:"armor", basePatk:0,  basePdef:11,  spd:0, quality:"N"  } } },
    cocatris:      { normal:{ type:"elk", amount:88 },  rare:{ type:"item", item:{ id:"baroque_ring", name:"バロックリング", type:"accessory", basePatk:2,  basePdef:2,  spd:0, quality:"N"  } } },
  };
  // ──────────── RENDER ────────────
  const sc = SCENES[sceneIdx] || SCENES[0];
  const dl_cur = sc.dl[dlIdx] || sc.dl[0] || {};
  // ── ダイアログ単位の動的背景・スプライト上書き ──────────────────────────
  // dl.loc    : この行だけ背景をlocキーで切り替える（LOC_TO_SCENE_IMGと対応）
  // dl.bg     : この行だけグラデーション配列 [c0,c1,c2] で上書き
  // dl.sprites: この行だけスプライト配列を上書き
  const activeLoc = dl_cur.loc ?? sc.loc;
  const activeBg  = dl_cur.bg  ?? sc.bg;
  const activeSprites = dl_cur.sprites ?? sc.sprites;
  const bg = activeBg;
  const sceneImgKey = LOC_TO_SCENE_IMG[activeLoc];
  const sceneBgUrl = sceneImgKey ? assetUrl(sceneImgKey) : null;
  const sceneBgSt = SCENE_BG_STYLE[activeLoc] ?? { size: "cover", position: "center" };
  const bgStyle = sceneBgUrl
    ? { background: `url(${sceneBgUrl}) ${sceneBgSt.position}/${sceneBgSt.size} no-repeat, linear-gradient(180deg, ${bg[0]} 0%, ${bg[1]} 50%, ${bg[2]} 100%)` }
    : { background: `linear-gradient(180deg, ${bg[0]} 0%, ${bg[1]} 50%, ${bg[2]} 100%)` };

  const keyframes = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=Share+Tech+Mono&display=swap');
    @keyframes idle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} } @keyframes dlSprIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
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
    @keyframes hitFloat { 0%{opacity:1;transform:translate(-50%,-50%) scale(1.2)} 60%{opacity:1;transform:translate(-50%,-130%) scale(1)} 100%{opacity:0;transform:translate(-50%,-180%) scale(0.7)} }
    @keyframes hitFlash { 0%{opacity:0.85} 50%{opacity:0.2} 100%{opacity:0} }
    @keyframes defeatFlash { 0%{opacity:0} 20%{opacity:0.7} 60%{opacity:0.4} 100%{opacity:0} }
    @keyframes defeatEnemyOut { 0%{opacity:1;transform:scale(1) rotate(0deg)} 30%{opacity:1;transform:scale(1.1) rotate(-3deg)} 70%{opacity:0.3;transform:scale(0.6) rotate(8deg) translateY(20px)} 100%{opacity:0;transform:scale(0.2) rotate(15deg) translateY(50px)} }
    @keyframes defeatLabel { 0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)} 30%{opacity:1;transform:translate(-50%,-50%) scale(1.3)} 60%{opacity:1;transform:translate(-50%,-50%) scale(1.0)} 100%{opacity:0;transform:translate(-50%,-50%) scale(0.8)} }
    @keyframes arcadiaBlnk { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes dissolve { 0%{opacity:1;filter:blur(0px);transform:scale(1)} 20%{opacity:0.85;filter:blur(1px);transform:scale(1.04)} 60%{opacity:0.3;filter:blur(6px);transform:scale(0.88)} 100%{opacity:0;filter:blur(14px);transform:scale(0.7)} }
    @keyframes hitShake { 0%{transform:translateX(0) scale(1)} 15%{transform:translateX(-7px) scale(1.04)} 35%{transform:translateX(6px) scale(1.03)} 55%{transform:translateX(-4px) scale(1.01)} 75%{transform:translateX(3px) scale(1.01)} 100%{transform:translateX(0) scale(1)} }
    @keyframes dragonApproach { 0%{transform:translate(0,0)} 10%{transform:translate(-2px,1px)} 20%{transform:translate(2px,-1px)} 30%{transform:translate(-1px,2px)} 40%{transform:translate(1px,-2px)} 50%{transform:translate(-2px,1px)} 60%{transform:translate(2px,0px)} 70%{transform:translate(-1px,1px)} 80%{transform:translate(1px,-1px)} 90%{transform:translate(-2px,2px)} 100%{transform:translate(0,0)} }
    @keyframes dragonImpact { 0%{transform:translate(0,0) scale(1)} 8%{transform:translate(-18px,8px) scale(1.02)} 16%{transform:translate(16px,-10px) scale(1.03)} 24%{transform:translate(-14px,12px) scale(1.02)} 32%{transform:translate(12px,-8px) scale(1.01)} 40%{transform:translate(-8px,6px) scale(1.01)} 50%{transform:translate(6px,-4px) scale(1)} 60%{transform:translate(-4px,3px) scale(1)} 75%{transform:translate(2px,-2px) scale(1)} 100%{transform:translate(0,0) scale(1)} }
    @keyframes dragonFlash { 0%{opacity:0.83} 100%{opacity:0} }
    @keyframes dragonFlashBurst { 0%{opacity:0;transform:scale(0.1)} 5%{opacity:1;transform:scale(1)} 70%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(1)} }
    @keyframes rankReveal { 0%{opacity:0;transform:scale(0.3) rotate(-12deg)} 50%{opacity:1;transform:scale(1.18) rotate(3deg)} 75%{transform:scale(0.96) rotate(-1deg)} 100%{opacity:1;transform:scale(1) rotate(0deg)} }
    @keyframes rankGlow { 0%,100%{opacity:1} 50%{opacity:0.82} }
    @keyframes rankPlatePulse { 0%,100%{box-shadow:0 0 20px rgba(0,200,255,0.25),inset 0 0 20px rgba(0,200,255,0.05)} 50%{box-shadow:0 0 50px rgba(0,200,255,0.5),inset 0 0 40px rgba(0,200,255,0.12)} }
    @keyframes rankParticle { 0%{opacity:0;transform:translateY(0) scale(0)} 20%{opacity:1;transform:translateY(-20px) scale(1)} 100%{opacity:0;transform:translateY(-80px) scale(0.3)} }
    @keyframes rankSlideIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
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
        if (victoryNextSc === "mapscan") {
          setOverlay("pb");
          setPbTab(2);
          setPhase("game");
        } else if (victoryNextSc !== null) {
          setSceneIdx(victoryNextSc);
          setDlIdx(0);
          setPhase("game");
        } else {
          setPhase("title");
        }
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
      <div style={{position:"fixed",inset:0,width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#020608 0%,#050d14 40%,#0a1420 100%)",fontFamily:"'Noto Serif JP',serif",overflow:"hidden",userSelect:"none"}}>
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

        <div style={{position:"relative",zIndex:2,textAlign:"center",padding:"0 24px",width:"100%",maxWidth:"min(460px, 90vw)"}}>

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

            {/* ドロップ */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
              <span style={{fontSize:11,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>ドロップ</span>
              <span style={{fontSize:12,fontFamily:"'Share Tech Mono',monospace",
                color: dropItems.length > 0 ? (dropItems.some(d=>d.isRare) ? C.gold : C.accent2) : C.muted
              }}>
                {dropItems.length > 0 ? dropItems.map(d=>d.label).join(" / ") : "なし"}
              </span>
            </div>
          </div>

         {/* ボタン */}
         <VictoryButton onFanfareStart={handleFanfareStart} onProceed={handleProceed} />

          {/* 連戦ボタン（MapScanバトルのみ表示） */}
          {victoryNextSc === "mapscan" && (() => {
            const _eType = currentEnemyType;
            const _ed    = battleDefs[_eType];
            if (!_ed) return null;
            return (
              <div style={{marginTop:12}}>
                <button
                  onClick={() => {
                    if (fanfareRef.current) { fanfareRef.current.pause(); fanfareRef.current = null; }
                    isFanfareRef.current = false;
                    // ドロップ付与（前回戦闘分）
                    if (mapScanPendingDropRef.current) {
                      const { dropKey, winCount } = mapScanPendingDropRef.current;
                      mapScanPendingDropRef.current = null;
                      const table = MAP_SCAN_DROPS[dropKey];
                      if (table) {
                        const isRare = winCount % 3 === 0;
                        const drop = isRare ? table.rare : table.normal;
                        if (drop) {
                          if (drop.type === "elk") { setElk(e => e + drop.amount); showNotif(`${isRare?"💎 レア！ ":"💰 "}${drop.amount} ELK！`); }
                          else if (drop.type === "item") { gainItem(drop.item); }
                        }
                      }
                    }
                    // 連戦開始
                    const _wins = (mapScanWinCount[_eType] ?? 0) + 1;
                    setMapScanWinCount(prev => ({ ...prev, [_eType]: _wins }));
                    mapScanPendingDropRef.current = { dropKey: _eType, winCount: _wins };
                    setBattleEnemy(_ed);
                    setCurrentEnemyType(_eType);
                    setEnemyHp(_ed.maxHp);
                    setBtlLogs([`⚔ ${_ed.name} との戦闘が始まった！`]);
                    setGuarding(false); setVictory(false); setDefeat(false); setTurn(0); setNoDmgStreak(0);
                    setBattleResultBonus({ comboMult:1.0, gradeMult:1.0 });
                    setEnemyTurnIdx(0); setEnemyNextAction((_ed.pattern||["atk"])[0]);
                    setEnemyElementIdx(0); setElemDmgAccum(0); setShowElemMenu(false); setShowSpecMenu(false); setElemBreakAnim(false);
                    const pKeys = BATTLE_PARTY_MAP[_eType] || DEFAULT_PARTY_KEYS;
                    setCurrentPartyKeys(pKeys);
                    const pi = buildPartyInit(pKeys);
                    setPartyHp(pi.hp); setPartyMhp(pi.mhp); setPartyMp(pi.mp); setPartyMmp(pi.mmp);
                    setInputPhase("command"); setPendingCommands({}); setPendingTargets({}); setPendingTargetSelect(null); setCmdInputIdx(0);
                    setEnemySpdDebuff(0); setEnrageCount(0); setEnemyAtkDebuff(0); setPartySpdBuff(0);
                    setProvokeActive(0);  setTakedownActive(0);
                    setSleepActive(0); 
                    setBikerAtkBonus(0); 
                    setStraightShotActive(0); 
                    setslowbladeActive(0); 
                    setWaterSphereActive(0);
                    setMultiEnemies(null);
                    setBattleNext("mapscan");
                    setFade(true);
                    setTimeout(() => { setPhase("battle"); setFade(false); }, 300);
                  }}
                  style={{padding:"10px 36px",background:"transparent",border:`1px solid ${C.accent2}`,color:C.accent2,fontSize:13,letterSpacing:4,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",transition:"all 0.3s"}}
                  onMouseEnter={e => { e.currentTarget.style.background = `${C.accent2}22`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  {_ed.em} 連戦 ▶
                </button>
              </div>
            );
          })()}

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

  // @@SECTION:LOGIC_SAVE_LOAD ───────────────────────────────────────────────────
  // セーブデータのバリデーション・適用・ファイル読み込み処理
  // validateSave → applySaveData → handleFile の順で呼ばれる
  // ── ファイル読み込み処理 ──────────────────────────────────────────────────
  const validateSave = (obj) => {
    if (!obj || typeof obj !== "object")         return "JSONの形式が不正です";
    if (!obj.version?.startsWith("arcadia_ch"))  return "ARCADIAのセーブデータではありません";
    if (obj.version?.startsWith("arcadia_ch2"))  return "第二章のセーブデータは第二章には引き継げません。第三章で読み込んでください。";
    if (!obj.player)                             return "player データが見つかりません";
    if (typeof obj.player.lv !== "number")       return "セーブデータが破損しています（lv）";
    return null;
  };

  const applySaveData = (sd) => {
    const p = sd.player;
    setChapter(p.chapter ?? 2);
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
    setHasBbs(p.hasBbs ?? false);
    // 第一章からのシナリオフルコンボ引き継ぎ（フィールドがなければ0）
    setScenarioFullCombo(sd.scenarioCombo ?? 0);
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
      style={{position:"fixed",inset:0,width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#020810 0%,#050d14 40%,#0a1020 100%)`,fontFamily:"'Noto Serif JP',serif",textAlign:"center",padding:32,overflow:"hidden"}}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
    >
      <style>{loadKeyframes}</style>
      <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,200,255,0.012) 2px,rgba(0,200,255,0.012) 4px)",pointerEvents:"none"}}/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:"min(640px, 92vw)",animation:"fadeIn 1s ease"}}>
        <div style={{fontSize:10,letterSpacing:8,color:C.muted,marginBottom:8,fontFamily:"'Share Tech Mono',monospace"}}>VRMMORPG · EPISODE 2</div>
        <div style={{fontSize:52,fontWeight:700,letterSpacing:12,color:C.white,textShadow:`0 0 30px ${C.accent}`,marginBottom:4}}>ARCADIA</div>
        <div style={{fontSize:12,letterSpacing:6,color:C.accent,marginBottom:32,fontFamily:"'Share Tech Mono',monospace"}}>─── Lexia の章 ───</div>
        <div style={{width:240,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"0 auto 28px"}}/>

        <div style={{fontSize:12,color:C.text,marginBottom:20,letterSpacing:1,lineHeight:1.9}}>
          第一章のセーブデータを読み込んで<br/>エルツのステータスを引き継ぎます。<br/>
          <span style={{color:C.muted,fontSize:11}}>※ 第二章のセーブデータは第二章では引き継げません</span>
        </div>

        <label
          style={{display:"block",border:`2px dashed ${dragOver ? C.accent : C.border}`,borderRadius:8,padding:"32px 20px",cursor:"pointer",marginBottom:16,background:dragOver ? "rgba(0,200,255,0.06)" : "rgba(10,26,38,0.4)",animation:dragOver ? "dropZoneOver 0.8s infinite" : "dropZonePulse 2s infinite",transition:"background 0.2s"}}
        >
          <input type="file" accept=".json" onChange={e => handleFile(e.target.files?.[0])} style={{display:"none"}} />
          <div style={{fontSize:32,marginBottom:12}}>{dragOver ? "📂" : "💾"}</div>
          <div style={{fontSize:13,color:dragOver ? C.accent : C.text,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
            {dragOver ? "ここにドロップ！" : "クリック or ドラッグ＆ドロップ"}
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:8}}>arcadia_save_ch1_*.json</div>
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

  // @@SECTION:RENDER_LOADED ─────────────────────────────────────────────────────
  // セーブデータ確認画面（ロード後・タイトル前）
  if (phase === "loaded" && saveFile) {
    const p = saveFile.player;
    const savedDate = saveFile.savedAt ? new Date(saveFile.savedAt).toLocaleString("ja-JP") : "不明";
    return (
      <div style={{position:"fixed",inset:0,width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#020810 0%,#050d14 100%)`,fontFamily:"'Noto Serif JP',serif",textAlign:"center",padding:32}}>
        <style>{loadKeyframes}</style>
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:"min(640px, 92vw)",animation:"fadeIn 0.6s ease"}}>
          <div style={{fontSize:11,letterSpacing:6,color:C.accent2,marginBottom:16,fontFamily:"'Share Tech Mono',monospace"}}>── SAVE DATA LOADED ──</div>
          <div style={{background:"rgba(10,26,38,0.85)",border:`1px solid ${C.border}`,borderRadius:8,padding:"20px 28px",marginBottom:24,textAlign:"left"}}>
            <div style={{fontSize:10,letterSpacing:6,color:C.muted,marginBottom:10,fontFamily:"'Share Tech Mono',monospace",textAlign:"center"}}>CHAPTER {saveFile.chapter ?? 1} DATA</div>
            <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginBottom:12,textAlign:"center"}}>{savedDate}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px",fontSize:13,color:C.text,fontFamily:"'Share Tech Mono',monospace",lineHeight:1.8}}>
              <div><span style={{color:C.muted}}>NAME</span>  Eltz</div>
              <div><span style={{color:C.muted}}>Lv</span>    {p.lv}</div>
              <div><span style={{color:C.muted}}>HP</span>    {Math.round(p.hp)}/{p.mhp}</div>
              <div><span style={{color:C.muted}}>MP</span>    {Math.round(p.mp)}/{p.mmp}</div>
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
    <div style={{position:"fixed",inset:0,width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#020810 0%,#050d14 40%,#0a1828 100%)`,backgroundImage:`url(https://superapolon.github.io/Arcadia_Assets/title/title_bg_ch2.webp)`,backgroundSize:"cover",backgroundPosition:"center",fontFamily:"'Noto Serif JP',serif",overflow:"hidden"}}>
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
          onClick={() => { unlockAudio("bgm/title"); setSceneIdx(0); setDlIdx(0); setPhase("movie"); }}
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
      unlockAudio(null);
      isScenarioBattleRef.current = false; // MapScan起動（フルコンボカウント対象外）
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
      setEnemySpdDebuff(0); setEnrageCount(0); setEnemyAtkDebuff(0); setPartySpdBuff(0); setProvokeActive(0); setTakedownActive(0); setSleepActive(0); setStraightShotActive(0); setWaterSphereActive(0); setPlayerStunActive(0);
      setslowbladeActive(0);
      setPhase("battle");
    };

    const startStory = () => {
      unlockAudio(null);
      setSceneIdx(0); setDlIdx(0);
      setPhase("movie");
    };

    return (
      <div style={{position:"fixed",inset:0,width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#020810 0%,#050d14 50%,#0a1828 100%)`,fontFamily:"'Noto Serif JP',serif",overflow:"hidden"}}>
        <style>{keyframes}</style>
        <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,200,255,0.012) 2px,rgba(0,200,255,0.012) 4px)",pointerEvents:"none"}}/>

        <div style={{position:"relative",zIndex:2,textAlign:"center",animation:"fadeIn 0.6s ease",width:"100%",maxWidth:"min(640px, 92vw)",padding:"0 24px"}}>
          <div style={{fontSize:10,letterSpacing:6,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginBottom:8}}>MODE SELECT</div>
          <div style={{fontSize:18,color:C.white,fontWeight:700,letterSpacing:3,marginBottom:4}}>モードを選択</div>
          <div style={{width:200,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"0 auto 28px"}}/>

          {/* ─ ストーリーモード ─ */}
          <button
            onClick={startStory}
            style={{
              width:"100%", padding:"18px 20px", marginBottom:14,
              background:`${C.accent2}0a`,
              border:`1px solid ${C.accent2}55`,
              borderRadius:8, cursor:"pointer",
              textAlign:"left", transition:"all 0.2s",
              display:"flex", alignItems:"center", gap:16,
            }}
            onMouseEnter={e => { e.currentTarget.style.background=`${C.accent2}1a`; e.currentTarget.style.borderColor=C.accent2; }}
            onMouseLeave={e => { e.currentTarget.style.background=`${C.accent2}0a`; e.currentTarget.style.borderColor=`${C.accent2}55`; }}>
            <div style={{fontSize:32,lineHeight:1,flexShrink:0}}>📖</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,color:C.accent2,fontWeight:700,letterSpacing:1,marginBottom:2}}>ストーリーモード</div>
              <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,marginBottom:5}}>─── Lexia の章 ───</div>
              <div style={{fontSize:11,color:C.text,lineHeight:1.5}}>シナリオを最初から読み進める。戦闘もストーリーに組み込まれている</div>
            </div>
            <div style={{fontSize:18,color:`${C.accent2}88`,flexShrink:0}}>▶</div>
          </button>

          {/* ─ 区切り ─ */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{flex:1,height:1,background:`linear-gradient(90deg,transparent,${C.border})`}}/>
            <div style={{fontSize:9,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2}}>BATTLE SELECT</div>
            <div style={{flex:1,height:1,background:`linear-gradient(90deg,${C.border},transparent)`}}/>
          </div>

          {/* ─ バトル選択 ─ */}
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
      <div style={{position:"fixed",inset:0,width:"100%",height:"100%",background:"#000",overflow:"hidden"}}>
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
    // ── ランクテーブル ──────────────────────────────────────────────────────
    const RANK_TABLE = [
      { min:0,  max:0,  rank:"H",   color:"#4a7a9a", glow:"#4a7a9a",     shadow:"rgba(74,122,154,0.6)" },
      { min:1,  max:1,  rank:"G",   color:"#5a8a6a", glow:"#5a8a6a",     shadow:"rgba(90,138,106,0.6)" },
      { min:2,  max:2,  rank:"F",   color:"#7a9a5a", glow:"#7a9a5a",     shadow:"rgba(122,154,90,0.6)" },
      { min:3,  max:3,  rank:"E",   color:"#9aaa4a", glow:"#9aaa4a",     shadow:"rgba(154,170,74,0.6)" },
      { min:4,  max:4,  rank:"D",   color:"#c8a030", glow:"#c8a030",     shadow:"rgba(200,160,48,0.6)" },
      { min:5,  max:5,  rank:"C",   color:"#e0803a", glow:"#e0803a",     shadow:"rgba(224,128,58,0.6)" },
      { min:6,  max:6,  rank:"B",   color:"#e06060", glow:"#e06060",     shadow:"rgba(224,96,96,0.6)" },
      { min:7,  max:7,  rank:"A",   color:"#d040d0", glow:"#d040d0",     shadow:"rgba(208,64,208,0.7)" },
      { min:8,  max:8,  rank:"AA",  color:"#8060ff", glow:"#8060ff",     shadow:"rgba(128,96,255,0.7)" },
      { min:9,  max:9,  rank:"AAA", color:"#00c8ff", glow:"#00c8ff",     shadow:"rgba(0,200,255,0.8)" },
      { min:10, max:10, rank:"S",   color:"#f0c040", glow:"#f0c040",     shadow:"rgba(240,192,64,0.9)" },
      { min:11, max:11, rank:"SS",  color:"#ffffff", glow:"#00ffcc",     shadow:"rgba(0,255,204,1.0)" },
      { min:12, max:99, rank:"SSS", color:"#ffffff", glow:"#ff80ff",     shadow:"rgba(255,128,255,1.0)" },
    ];
    const rankInfo = RANK_TABLE.find(r => scenarioFullCombo >= r.min && scenarioFullCombo <= r.max) ?? RANK_TABLE[0];

    // ランク別の称号メッセージ
    const RANK_TITLES = {
      "H":   { title:"旅の始まり",         msg:"旅はまだ始まったばかり──\n次の冒険ではさらなる高みへ。" },
      "G":   { title:"一歩を踏み出した者", msg:"一歩一歩が、英雄への道となる。\n諦めるな、冒険者よ。" },
      "F":   { title:"見習い冒険者",       msg:"確かな成長の跡が見える。\n磨けば光る原石がここにある。" },
      "E":   { title:"駆け出しの勇者",     msg:"戦いの感覚が、少しずつ\n掴めてきたのではないか。" },
      "D":   { title:"歴戦の冒険者",       msg:"数々の戦いを潜り抜けてきた。\nその経験は必ず力となる。" },
      "C":   { title:"誇り高き剣士",       msg:"その剣筋は真っ直ぐだ。\n仲間もきっと信頼している。" },
      "B":   { title:"勇猛果敢な戦士",     msg:"戦場での冷静さと勇気──\n共に持ち合わせた証である。" },
      "A":   { title:"伝説への挑戦者",     msg:"その力、本物だ。\nアルカディアが震えている。" },
      "AA":  { title:"精鋭の冒険者",       msg:"並外れた判断力と技術──\n語り継がれるに値する戦いだった。" },
      "AAA": { title:"頂を目指す者",       msg:"完璧に近いプレイ。\n世界はその名を覚えている。" },
      "S":   { title:"ARCADIA の英雄",     msg:"全てのバトルで力を出し切った。\nこれ以上の冒険者はそうはいない。" },
      "SS":  { title:"伝説の冒険者",       msg:"完全無欠──！\n君の名は、永遠に刻まれるだろう。" },
      "SSS": { title:"神話の体現者",       msg:"これは──もはや伝説の域を超えている。\nアルカディアに、新たな神話が生まれた。" },
    };
    const rankMsg = RANK_TITLES[rankInfo.rank] ?? RANK_TITLES["H"];

    // ── セーブデータ生成 ────────────────────────────────────────────────────
    const buildSaveData = () => ({
      version:    "arcadia_ch2_v1",
      chapter:    chapter,
      savedAt:    new Date().toISOString(),
      player: {
        hp, mhp, mp, mmp,
        elk, lv, exp,
        weapon, weaponPatk,
        statPoints,
        statAlloc: { ...statAlloc },
        hasPb, hasMapScan, inCom, hasBbs,
      },
      scenarioCombo: scenarioFullCombo,
    });

    const handleExport = () => {
      const data = buildSaveData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      if (dlUrl) URL.revokeObjectURL(dlUrl);
      setDlUrl(URL.createObjectURL(blob));
    };

    const resetToTitle = () => {
      setPhase("title"); setSceneIdx(0); setDlIdx(0);
      setElk(50); setHp(100); setMhp(100); setMp(80); setMmp(80);
      setLv(1); setExp(0);
      setWeapon("銅の短剣"); setWeaponPatk(3);
      setStatPoints(0); setStatAlloc({patk:10,pdef:10,matk:10,spd:10});
      setHasPb(false); setHasMapScan(false); setInCom(false); setHasBbs(false);
    };

    // ── endPhase: "rank" → "save" ───────────────────────────────────────────

    // ランクのフォントサイズ（文字数で調整）
    const rankFontSize = rankInfo.rank.length === 1 ? 180 : rankInfo.rank.length === 2 ? 140 : 110;

    // SS/SSS専用：虹色グロー
    const isSS = rankInfo.rank === "SS" || rankInfo.rank === "SSS";
    const rankLetterStyle = {
      fontFamily:"'Share Tech Mono',monospace",
      fontSize:rankFontSize,
      fontWeight:700,
      color: rankInfo.color,
      lineHeight:1,
      animation:"rankReveal 0.9s cubic-bezier(0.22,1,0.36,1) forwards, rankGlow 2.4s ease-in-out 1s infinite",
      display:"block",
      letterSpacing: rankInfo.rank.length > 1 ? 8 : 0,
      filter: rankInfo.rank === "SSS"
        ? "drop-shadow(0 0 30px #ff80ff) drop-shadow(0 0 60px #00ffcc) drop-shadow(0 0 90px #ff80ff)"
        : isSS
        ? "drop-shadow(0 0 30px #00ffcc) drop-shadow(0 0 60px #00c8ff)"
        : `drop-shadow(0 0 20px ${rankInfo.glow}) drop-shadow(0 0 40px ${rankInfo.glow}88)`,
    };

    // ── ランク画面 ──────────────────────────────────────────────────────────
    if (endPhase === "rank") return (
      <div
        style={{position:"fixed",inset:0,width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`radial-gradient(ellipse at 50% 40%, ${rankInfo.shadow} 0%, #030508 55%, #010205 100%)`,fontFamily:"'Noto Serif JP',serif",textAlign:"center",padding:32,overflow:"hidden",cursor:"pointer"}}
        onClick={() => setEndPhase("save")}
      >
        <style>{keyframes}</style>

        {/* 背景スキャンライン */}
        <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px)",pointerEvents:"none"}}/>

        {/* パーティクル装飾（ランクA以上） */}
        {["A","AA","AAA","S","SS","SSS"].includes(rankInfo.rank) && [0,1,2,3,4,5,6,7].map(i => (
          <div key={i} style={{
            position:"absolute",
            left:`${12 + i * 11}%`,
            bottom:`${15 + (i % 3) * 12}%`,
            width:6,
            height:6,
            borderRadius:"50%",
            background:rankInfo.glow,
            animation:`rankParticle ${1.4 + i * 0.3}s ease-out ${i * 0.4}s infinite`,
            opacity:0,
            pointerEvents:"none",
          }}/>
        ))}

        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:"min(640px, 92vw)",animation:"fadeIn 0.8s ease"}}>

          {/* ヘッダー */}
          <div style={{fontSize:10,letterSpacing:10,color:"rgba(255,255,255,0.3)",marginBottom:8,fontFamily:"'Share Tech Mono',monospace",animation:"rankSlideIn 0.8s ease"}}>
            ─ ADVENTURER RANK ─
          </div>
          <div style={{fontSize:11,letterSpacing:6,color:"rgba(255,255,255,0.2)",marginBottom:40,fontFamily:"'Share Tech Mono',monospace",animation:"rankSlideIn 0.9s ease"}}>
            SCENARIO FULL COMBO : {scenarioFullCombo}
          </div>

          {/* ランク文字 メインディスプレイ */}
          <div style={{
            position:"relative",
            margin:"0 auto 32px",
            width:"min(320px, 80vw)",
            height: rankFontSize * 1.3,
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            borderRadius:12,
            border:`1px solid ${rankInfo.glow}44`,
            background:`radial-gradient(ellipse at 50% 50%, ${rankInfo.shadow} 0%, rgba(0,0,0,0.4) 70%)`,
            animation:"rankPlatePulse 2.5s ease-in-out 0.8s infinite",
          }}>
            <span style={rankLetterStyle}>{rankInfo.rank}</span>
          </div>

          {/* 称号 */}
          <div style={{
            fontSize:16,
            fontWeight:700,
            color:rankInfo.color,
            letterSpacing:4,
            marginBottom:16,
            animation:"rankSlideIn 1.2s ease",
            textShadow:`0 0 12px ${rankInfo.glow}88`,
          }}>
            ─ {rankMsg.title} ─
          </div>

          {/* メッセージ */}
          <div style={{
            fontSize:13,
            color:"rgba(200,232,248,0.85)",
            lineHeight:2.2,
            letterSpacing:1,
            marginBottom:48,
            whiteSpace:"pre-line",
            animation:"rankSlideIn 1.4s ease",
          }}>
            {rankMsg.msg}
          </div>

          {/* 進行ヒント */}
          <div style={{fontSize:11,color:"rgba(255,255,255,0.2)",letterSpacing:3,fontFamily:"'Share Tech Mono',monospace",animation:"blnk 1.6s ease-in-out infinite"}}>
            TAP TO CONTINUE
          </div>
        </div>
      </div>
    );

    // ── セーブ画面（従来のエンディング） ────────────────────────────────────
    return (
      <div style={{position:"fixed",inset:0,width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg,#030a06 0%,#0a1a0a 50%,#0d2010 100%)`,fontFamily:"'Noto Serif JP',serif",textAlign:"center",padding:40}}>
        <style>{keyframes}</style>
        <div style={{animation:"fadeIn 1.2s ease",maxWidth:"min(640px, 92vw)",width:"100%",overflowY:"auto",maxHeight:"100%",paddingBottom:40}}>
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
              <div><span style={{color:C.muted}}>HP</span>    {Math.round(hp)} / {mhp}</div>
              <div><span style={{color:C.muted}}>MP</span>    {Math.round(mp)} / {mmp}</div>
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
            第三章へ引き継ぐには、セーブデータをダウンロードして<br/>
            ARCADIA Ch.3 で読み込んでください。<br/>
            <span style={{color:`${C.red}cc`,fontSize:11}}>※ このセーブデータは第二章には引き継げません</span>
          </div>
          <button
            onClick={handleExport}
            style={{width:"100%",padding:"14px 0",marginBottom:12,background:`linear-gradient(135deg,rgba(0,200,255,0.15),rgba(0,255,204,0.1))`,border:`1px solid ${C.accent}`,color:C.accent,fontSize:14,letterSpacing:4,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",borderRadius:4}}
          >
            💾 セーブデータを生成
          </button>
          {dlUrl ? (
            <div style={{marginBottom:24}}>
              <a
                href={dlUrl}
                download={`arcadia_save_ch2_lv${lv}.json`}
                style={{display:"block",width:"100%",padding:"12px 0",boxSizing:"border-box",textAlign:"center",background:"rgba(0,255,204,0.12)",border:`1px solid ${C.accent2}`,color:C.accent2,fontSize:13,letterSpacing:4,fontFamily:"'Share Tech Mono',monospace",cursor:"pointer",borderRadius:4,textDecoration:"none"}}
              >
                ⬇ arcadia_save_ch2_lv{lv}.json
              </a>
              <div style={{fontSize:11,color:C.muted,marginTop:8,fontFamily:"'Share Tech Mono',monospace",opacity:0.7}}>
                上のリンクをタップ / 長押しして保存してください
              </div>
            </div>
          ) : (
            <div style={{height:32,marginBottom:24}}/>
          )}

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
    // multiEnemies の場合は先頭敵のタイプでBATTLE_BG_MAPを引く
    const multiBgType = multiEnemies ? multiEnemies[0]?.type : null;
    const multiBgKey  = multiBgType ? BATTLE_BG_MAP[multiBgType] : null;
    const multiBgUrl  = multiBgKey ? assetUrl(multiBgKey) : null;
    const multiBgSt   = BATTLE_BG_STYLE[multiBgType] ?? { size: "cover", position: "center 40%" };
    const battleBg = multiEnemies
      ? multiBgUrl
        ? `url(${multiBgUrl}) ${multiBgSt.position}/${multiBgSt.size} no-repeat, linear-gradient(180deg,${ed.bg[0]} 0%,${ed.bg[1]} 50%,${ed.bg[2]} 100%)`
        : `linear-gradient(180deg,${ed.bg[0]} 0%,${ed.bg[1]} 50%,${ed.bg[2]} 100%)`
      : battleBgUrl
        ? `url(${battleBgUrl}) ${bgSt.position}/${bgSt.size} no-repeat, linear-gradient(180deg,${ed.bg[0]} 0%,${ed.bg[1]} 50%,${ed.bg[2]} 100%)`
        : `linear-gradient(180deg,${ed.bg[0]} 0%,${ed.bg[1]} 50%,${ed.bg[2]} 100%)`;

    // ── レイアウト：縦長（portrait）判定 ────────────────────────────────────
    // iPad横向き（1024×768等）は横長レイアウト、縦向きはportrait
    // タブレット判定: 短辺が600px以上かつ長辺が900px以上
    const isTablet = Math.min(windowSize.w, windowSize.h) >= 600 && Math.max(windowSize.w, windowSize.h) >= 900;
    const isPortrait = windowSize.h > windowSize.w;
    // portrait時の敵エリア比率：タブレットは58%、スマホは55%
    const portraitEnemyFlex = isTablet ? "0 0 58%" : "0 0 55%";

    // ── 属性システム表示用データ ────────────────────────────────────────────
    const elementCycle = ed.elementCycle || null;
    const currentElemKey = elementCycle ? elementCycle[enemyElementIdx % elementCycle.length] : null;
    const currentElemInfo = currentElemKey ? ELEMENT_NAMES[currentElemKey] : null;
    const elemBarPct = Math.min(100, (elemDmgAccum / ELEMENT_BREAK_THRESHOLD) * 100);

    // ── パーティーメンバー表示データ（currentPartyKeysから動的生成） ─────────
    const spdBuffDisp = partySpdBuff > 0 ? 3 : 0;
    const partyMembers = currentPartyKeys.map(k => {
      const c = ALL_CHAR_DEFS[k];
      if (!c) return null;
      if (k === "eltz") return { key:"eltz", name:c.name, icon:c.icon, hp, mhp, mp, mmp, spd:c.spd + spdBuffDisp };
      return { key:k, name:c.name, icon:c.icon, hp:partyHp[k]??c.mhp, mhp:partyMhp[k]??c.mhp, mp:partyMp[k]??c.mmp, mmp:partyMmp[k]??c.mmp, spd:c.spd + spdBuffDisp };
    }).filter(Boolean);
    // 現在コマンド入力中のメンバー
    const currentCmdMember = PARTY_DEFS[cmdInputIdx];
    // 敵の実効SPD（デバフ考慮）
    const effectiveEnemySpdDisp = Math.max(1, 12 - (enemySpdDebuff > 0 ? 5 : 0));

    return (
      <div style={{position:"fixed",inset:0,display:"flex",flexDirection:"column",background:battleBg,fontFamily:"'Noto Serif JP',serif",userSelect:"none",overflow:"hidden",
        animation: showAtkAllAnim ? "dragonApproach 0.18s linear infinite" : "none",
      }}>
        <style>{keyframes}</style>
        {/* ── ドラゴン突進フラッシュ（末尾に白く大フラッシュ） ── */}
        {showAtkAllAnim && (
          <>
            {/* レイヤー1: 2.0秒間 opacity 0.83 で漂う白紫グラデ */}
            <div style={{
              position:"fixed", inset:0, zIndex:500, pointerEvents:"none",
              background:"radial-gradient(ellipse at center, rgba(255,255,255,0.6) 0%, rgba(200,150,255,0.5) 50%, rgba(80,40,180,0.4) 100%)",
              animation:"dragonFlash 2.0s linear forwards",
            }} />
            {/* レイヤー2: 2.0秒後に一気に全画面を覆い0.0秒でフェードアウト */}
            <div style={{
              position:"fixed", inset:0, zIndex:501, pointerEvents:"none",
              background:"radial-gradient(ellipse at center, rgba(255,255,255,1) 0%, rgba(230,190,255,1) 30%, rgba(160,80,255,0.95) 65%, rgba(80,20,200,0.85) 100%)",
              animationDelay:"3.6s",
              animation:"dragonFlashBurst 0.0s ease-out 2.0s forwards",
              opacity:0,
            }} />
          </>
        )}
        {notif && <div style={{position:"absolute",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(10,26,38,0.95)",border:`1px solid ${C.accent}`,color:C.accent,padding:"8px 20px",fontSize:13,letterSpacing:1,zIndex:100,whiteSpace:"nowrap",fontFamily:"'Share Tech Mono',monospace",animation:"notifIn 0.3s ease"}}>{notif}</div>}



        {/* ── ヒット・討伐エフェクト フルスクリーンオーバーレイ ────────────────
             overflow:hidden を持つ子コンテナを避けるため fixed で最前面に描画。
             エネミー表示エリアは横長時に画面左62%、縦長時に上52%を占める。
             マルチ敵(3枠)は等幅分割、単体敵は中央。                          */}
        {(() => {
          const enemyAreaW = isPortrait ? 100 : 62;   // vw%
          const enemyAreaH = isPortrait ? (isTablet ? 58 : 55) : 100;   // vh%
          const slotCount  = multiEnemies ? multiEnemies.length : 1;

          // スロットインデックス → 画面座標（vw/vh）
          const slotCenter = (idx) => {
            const slotW = enemyAreaW / slotCount;
            const cx = slotW * idx + slotW * 0.5;     // vw
            const cy = isPortrait ? enemyAreaH * 0.42 : 42; // vh
            return { cx, cy };
          };

          return (
            <>
              {/* ヒットスプライト（Attack00 連番PNG 12fps/3f 背景透過） */}
              {hitSprites.map(sp => {
                const { cx, cy } = slotCenter(sp.slotIdx);
                const sprSize = multiEnemies ? "clamp(130px,16vw,140px)" : "clamp(160px,22vw,200px)";
                return (
                  <img
                    key={sp.id}
                    src={HIT_SPRITE_URLS[sp.frame]}
                    style={{
                      position:"fixed",
                      left:`${cx}vw`, top:`${cy}vh`,
                      transform:"translate(-50%,-50%)",
                      width:sprSize, height:sprSize,
                      pointerEvents:"none", zIndex:299,
                      imageRendering:"pixelated",
                      mixBlendMode:"screen",
                    }}
                    alt=""
                  />
                );
              })}

              {/* ヒット数字 */}
              {hitEffects.map(fx => {
                const { cx, cy } = slotCenter(fx.slotIdx);
                const isWeak = fx.type === "weak";
                return (
                  <div key={fx.id} style={{
                    position:"fixed",
                    left:`${cx}vw`, top:`${cy}vh`,
                    transform:"translate(-50%,-50%)",
                    pointerEvents:"none", zIndex:300,
                    fontFamily:"'Share Tech Mono',monospace",fontWeight:900,letterSpacing:2,
                    fontSize: isWeak
                      ? (multiEnemies ? "clamp(26px,4.5vw,40px)" : "clamp(38px,7vw,62px)")
                      : (multiEnemies ? "clamp(20px,3.5vw,32px)" : "clamp(30px,6vw,52px)"),
                    color: isWeak ? "#ffee44" : "#ffffff",
                    textShadow: isWeak ? "0 0 16px #ffcc00, 0 0 32px #ff8800" : "0 0 10px #00ffccaa, 0 0 2px #000",
                    animation:"hitFloat 0.65s ease-out forwards",
                    whiteSpace:"nowrap",
                  }}>
                    {isWeak && <span style={{fontSize:"0.65em",marginRight:3}}>⚡</span>}
                    -{fx.dmg}
                  </div>
                );
              })}

              {/* 討伐フラッシュ */}
              {defeatEffects.map(fx => {
                const { cx, cy } = slotCenter(fx.slotIdx);
                const flashW = multiEnemies ? Math.round(100 / slotCount) : 62;
                return (
                  <React.Fragment key={fx.id}>
                    <div style={{
                      position:"fixed",
                      left:`${cx}vw`, top:`${cy}vh`,
                      width:`${flashW}vw`, height:`${isPortrait ? (isTablet ? 58 : 55) : 70}vh`,
                      transform:"translate(-50%,-50%)",
                      pointerEvents:"none", zIndex:299,
                      background:"radial-gradient(ellipse at center, rgba(255,220,80,0.65) 0%, rgba(255,100,0,0.3) 45%, transparent 72%)",
                      animation:"defeatFlash 1.2s ease-out forwards",
                    }}/>
                    <div style={{
                      position:"fixed",
                      left:`${cx}vw`, top:`${cy}vh`,
                      transform:"translate(-50%,-50%)",
                      pointerEvents:"none", zIndex:300,
                      fontFamily:"'Share Tech Mono',monospace",fontWeight:900,
                      letterSpacing: multiEnemies ? 3 : 6,
                      fontSize: multiEnemies ? "clamp(11px,2vw,18px)" : "clamp(20px,4vw,34px)",
                      color:C.gold, whiteSpace:"nowrap",
                      textShadow:`0 0 24px ${C.gold}, 0 0 48px #ff8800, 0 0 2px #000`,
                      animation:"defeatLabel 1.1s ease-out forwards",
                    }}>DEFEATED</div>
                  </React.Fragment>
                );
              })}

              {/* リバースエフェクト（リバース中ターン開始時・12fps×10f=5ループ） */}
              {reverseAnimFrame !== null && (
                <img
                  src={REVERSE_ANIM_URLS[reverseAnimFrame % 2]}
                  style={{
                    position:"fixed",
                    left:0, top:0,
                    width:`${enemyAreaW}vw`,
                    height:`${enemyAreaH}vh`,
                    objectFit:"cover",
                    pointerEvents:"none", zIndex:400,
                    mixBlendMode:"screen",
                  }}
                  alt=""
                />
              )}
            </>
          );
        })()}

        {/* ── 戦闘SKIP ─────────────────────────────────────────────────────── */}
        {!victory && !defeat && (
          <button
            onClick={() => {
              // 全敵を撃破扱い・プレイヤー勝利状態にしてexitBattleへ
              if (multiEnemies) {
                setMultiEnemies(prev => prev.map(e => ({ ...e, hp: 0, defeated: true })));
              } else {
                setEnemyHp(0);
              }
              setScenarioFullCombo(0);
              setcurrentBattleTotalTurns(0);
              setcurrentBattleComboTurns(0);
              setcurrentBattleElemBreaks(0);
              setMemberCdMap({});   // ← 追加
              isScenarioBattleRef.current = false;
              setVictory(true);
            }}
            style={{position:"absolute",top:6,right:8,zIndex:200,padding:"3px 10px",fontSize:10,letterSpacing:2,fontFamily:"'Share Tech Mono',monospace",background:"rgba(5,13,20,0.7)",border:`1px solid ${C.muted}`,color:C.muted,borderRadius:3,cursor:"pointer",opacity:0.6}}
          >
            SKIP
          </button>
        )}

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

        {/* ── メインエリア：横長=左右2カラム、縦長=上下2段 ── */}
        <div style={{flex:1,display:"flex",flexDirection:isPortrait?"column":"row",overflow:"hidden",minHeight:0}}>

          {/* 上段（縦長）or 左カラム（横長）：エネミー表示 */}
          <div style={{
            flex: isPortrait ? portraitEnemyFlex : "0 0 62%",
            display:"flex",flexDirection:"column",
            alignItems:"center",
            justifyContent:multiEnemies?"stretch":"flex-start",
            padding:multiEnemies?"8px":0,
            position:"relative",overflow:"hidden",gap:0,
          }}>

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
              <div style={{display:"flex",flexDirection:"row",alignItems:"stretch",justifyContent:"center",gap:5,width:"100%",flex:1,minHeight:0,height:"100%",paddingTop:pendingTargetSelect ? 28 : 0}}>
                {multiEnemies.map((me, idx) => {
                  const meDef = me.def;
                  const isSimuluuSlot = me.type === "simuluu" || me.type === "simuluu_ch2";
                  const meImg = isSimuluuSlot ? SIMULUU_IMG_URL : (ENEMY_IMG_MAP[me.type] ? assetUrl(ENEMY_IMG_MAP[me.type]) : null);
                  const meHpPct = Math.max(0, me.hp / meDef.maxHp * 100);
                  const meIsBoss = meDef.isBoss;
                  const meNextAction = meDef.pattern[me.turnIdx % meDef.pattern.length];
                  const meLabel = getEnemyActionLabel(meNextAction);
                  const meIsUnavoidable = meNextAction === "unavoidable";
                  const meColor = meIsUnavoidable ? C.red : meNextAction === "counter" ? "#f97316" : meNextAction === "dodge" ? C.muted : "#60a5fa";
                  const isTargetable = !!pendingTargetSelect && !me.defeated;
                  const cardBorder = isTargetable ? `2px solid ${C.accent}` : "none";
                  const cardBg = "transparent";
                  // ── 属性情報（elementCycle 持ちの敵のみ表示） ──
                  // isBoss(シムルー)はenemyElementIdx使用、それ以外(シャメロット等)は固定[0]
                  const meElemCycle = meDef.elementCycle || null;
                  const meElemIdxToUse = (meElemCycle && meDef.isBoss) ? enemyElementIdx : 0;
                  const meElemKey   = meElemCycle ? meElemCycle[meElemIdxToUse % meElemCycle.length] : null;
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
                        boxShadow: "none",
                      }}>

                      {/* ── 上部：BOSSラベル + 属性インジケーター（シングルと同スタイル） or 倒れ ── */}
                      <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0,minHeight:14}}>
                        {meIsBoss && !me.defeated && (
                          <div style={{fontSize:8,letterSpacing:3,color:C.red,fontFamily:"'Share Tech Mono',monospace",animation:"dngr 1s infinite"}}>BOSS</div>
                        )}
                        {meElemInfo && !me.defeated && (
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,background:"rgba(5,13,20,0.84)",border:`1px solid ${meElemInfo.color}88`,borderRadius:5,padding:"3px 10px",minWidth:meIsBoss?120:80,width:"94%"}}>
                            <div style={{fontSize:7,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,whiteSpace:"nowrap"}}>CURRENT ELEMENT</div>
                            <div style={{fontSize:meIsBoss?13:11,fontWeight:900,color:meElemInfo.color,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,textShadow:`0 0 10px ${meElemInfo.color}`,whiteSpace:"nowrap"}}>
                              {meElemInfo.icon} {meElemInfo.label}
                            </div>
                            <div style={{width:"90%",height:3,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${elemBarPct}%`,background:`linear-gradient(90deg,${meElemInfo.color}88,${meElemInfo.color})`,transition:"width 0.3s",borderRadius:2}}/>
                            </div>
                            <div style={{fontSize:7,color:meElemInfo.color,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,whiteSpace:"nowrap"}}>
                              蓄積 {elemDmgAccum}/{ELEMENT_BREAK_THRESHOLD}
                            </div>
                          </div>
                        )}
                        {me.defeated && (
                          <div style={{fontSize:meIsBoss?36:24,lineHeight:1,marginTop:8,animation:"fadeIn 0.4s 1.0s ease both"}}>💀</div>
                        )}
                      </div>

                      {/* ── 中央：エネミー画像（flex:1 で縦最大） ── */}
                      {(!me.defeated || true) && (
                        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",width:"100%",minHeight:0,padding:"3px 0",
                          animation: me.defeated ? "dissolve 1.0s ease-out forwards" : "none",
                        }}>
                          {/* シェイクラッパー：ヒット時のみ揺れる */}
                          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
                            animation: (!me.defeated && hitSlotIdsRef.current.has(idx)) ? "hitShake 0.32s ease-out" : "none",
                          }}>
                          {meImg
                            ? <img src={meImg} alt={meDef.name} style={{
                                width:"100%", maxWidth:"96%",
                                height:"100%", maxHeight:"100%",
                                objectFit:"contain",
                                animation: me.defeated ? "none" : (meIsBoss ? "bossFloat 2s infinite" : "idle 2.2s infinite"),
                                filter: me.defeated
                                  ? (meIsBoss
                                    ? "drop-shadow(0 0 16px #ff4466cc) drop-shadow(0 0 4px #ff000088)"
                                    : "drop-shadow(0 2px 8px rgba(0,0,0,0.8))")
                                  : (!me.defeated && hitSlotIdsRef.current.has(idx)
                                    ? (meIsBoss
                                        ? "drop-shadow(0 0 16px #ff4466cc) drop-shadow(0 0 4px #ff000088)"
                                        : "drop-shadow(0 2px 8px rgba(0,0,0,0.8))")
                                    : (meIsBoss
                                        ? "drop-shadow(0 0 16px #ff4466cc) drop-shadow(0 0 4px #ff000088)"
                                        : "drop-shadow(0 2px 8px rgba(0,0,0,0.8))")),
                                transform: (!me.defeated && btlAnimEnemy) ? "scale(1.07)" : "scale(1)",
                                transition: me.defeated ? "none" : "transform 0.1s",
                              }} />
                            : <div style={{
                                fontSize: meIsBoss ? "clamp(64px,10vw,120px)" : "clamp(40px,6vw,80px)",
                                lineHeight:1,
                                animation: me.defeated ? "none" : (meIsBoss ? "bossFloat 2s infinite" : "idle 2.2s infinite"),
                                filter: meIsBoss ? "drop-shadow(0 0 12px #ff4466)" : "none",
                              }}>{meDef.em}</div>
                          }
                          </div>
                        </div>
                      )}

                      {/* ── 下部：属性・名前・HP・行動バッジ ── */}
                      {!me.defeated && (
                        <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0,background:"rgba(5,13,20,0.72)",borderRadius:"0 0 6px 6px",padding:"4px 2px 2px"}}>
                          {/* 敵名 */}
                          <div style={{fontSize:8,color:C.white,fontFamily:"'Share Tech Mono',monospace",textAlign:"center",lineHeight:1.2,width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"0 2px"}}>
                            {meDef.name.replace("Simuluu ─ ","").replace("シャメロット ","Lv").replace(" 試練の主","")}
                          </div>
                          {/* HPバー */}
                          <div style={{width:"92%",height:4,background:C.panel2,borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${meHpPct}%`,background: meIsBoss ? `linear-gradient(90deg,${C.red},#ff8844)` : `linear-gradient(90deg,${C.accent2},${C.accent})`,transition:"width 0.4s",borderRadius:2}}/>
                          </div>
                          <div style={{fontSize:8,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>{Math.round(me.hp)}/{meDef.maxHp}</div>
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

                      {/* エフェクトはフルスクリーンオーバーレイで描画（overflow:hiddenを回避） */}
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

              {/* コンボ（マルチ敵・絶対配置オーバーレイ） */}
              {noDmgStreak >= 3 && (
                <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%, -50%)",zIndex:10,pointerEvents:"none",textAlign:"center",animation:"comboPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both"}}>
                  <div style={{fontSize:"clamp(36px, 8vw, 64px)",fontWeight:900,fontFamily:"'Share Tech Mono',monospace",color:C.gold,letterSpacing:2,lineHeight:1,animation:"comboPulse 1s infinite",WebkitTextStroke:`1px #ffffff44`}}>
                    {noDmgStreak}
                    <span style={{fontSize:"0.45em",letterSpacing:4,display:"block",marginTop:2,color:"#ffe08a"}}>COMBO</span>
                  </div>
                  <div style={{fontSize:10,color:"#ffe08a",fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,marginTop:4,opacity:0.85}}>MP +{5 + noDmgStreak} / turn</div>
                  {Math.floor(noDmgStreak / 10) > 0 && (
                    <div style={{fontSize:10,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,marginTop:2}}>
                      ⚔ ATK ×{Math.pow(1.1, Math.floor(noDmgStreak / 10)).toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* ── 単体敵表示（縦フル3段） ─────────────────────────────────── */
            <>
             {/* ── 単体敵エリア：relative コンテナ内に画像・UI を absolute 重ね ── */}
             <div style={{position:"absolute",inset:0,overflow:"hidden"}}>

            {/* コンボ（絶対配置オーバーレイ） */}
            {noDmgStreak >= 3 && (
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%, -50%)",zIndex:10,pointerEvents:"none",textAlign:"center",animation:"comboPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both"}}>
                <div style={{fontSize:"clamp(36px, 8vw, 64px)",fontWeight:900,fontFamily:"'Share Tech Mono',monospace",color:C.gold,letterSpacing:2,lineHeight:1,animation:"comboPulse 1s infinite",WebkitTextStroke:`1px #ffffff44`}}>
                  {noDmgStreak}
                  <span style={{fontSize:"0.45em",letterSpacing:4,display:"block",marginTop:2,color:"#ffe08a"}}>COMBO</span>
                </div>
                <div style={{fontSize:10,color:"#ffe08a",fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,marginTop:4,opacity:0.85}}>MP +{5 + noDmgStreak} / turn</div>
                {Math.floor(noDmgStreak / 10) > 0 && (
                  <div style={{fontSize:10,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,marginTop:2}}>
                    ⚔ ATK ×{Math.pow(1.1, Math.floor(noDmgStreak / 10)).toFixed(2)}
                  </div>
                )}
              </div>
            )}

               {/* 背面：エネミー画像 */}
               <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",
                 animation: victory ? "dissolve 1.0s ease-out forwards" : "none",
               }}>
                 {/* シェイクラッパー：ヒット時のみ揺れる */}
                 <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%",
                   animation: (!victory && hitSlotIdsRef.current.has(0)) ? "hitShake 0.32s ease-out" : "none",
                 }}>
                 {enemyImgUrl
                   ? <img src={enemyImgUrl} alt={ed.name} style={{
                       width:"auto",
                       height: isTablet ? "clamp(160px, 70vh, 600px)" : "clamp(120px, 63vh, 500px)",
                       maxWidth:"96%",
                       maxHeight:"100%",
                       objectFit:"contain",
                       animation: victory ? "none" : (isBoss?"bossFloat 2s infinite":"idle 2s infinite"),
                       filter: victory
                         ? (isBoss?`drop-shadow(0 0 24px ${C.red}) drop-shadow(0 0 6px #ff000066)`:"drop-shadow(0 4px 16px rgba(0,0,0,0.7))")
                         : (!victory && hitSlotIdsRef.current.has(0)
                           ? (isBoss?`drop-shadow(0 0 24px ${C.red}) drop-shadow(0 0 6px #ff000066)`:"drop-shadow(0 4px 16px rgba(0,0,0,0.7))")
                           : (isBoss?`drop-shadow(0 0 24px ${C.red}) drop-shadow(0 0 6px #ff000066)`:"drop-shadow(0 4px 16px rgba(0,0,0,0.7))")),
                       transform: (!victory && btlAnimEnemy) ? "scale(1.05)" : "scale(1)",
                       transition: victory ? "none" : "transform 0.1s",
                     }} />
                   : <div style={{
                       fontSize:"clamp(60px, 10vh, 140px)",
                       lineHeight:1,
                       animation: victory ? "none" : (isBoss?"bossFloat 2s infinite":"idle 2s infinite"),
                       filter:isBoss?`drop-shadow(0 0 24px ${C.red})`:"none",
                       transform:btlAnimEnemy?"scale(1.08)":"scale(1)", transition:"transform 0.1s",
                     }}>{ed.em}</div>
                 }
                 </div>
               </div>

               {/* 前面上段：BOSSラベル + 属性インジケーター（top固定） */}
               <div style={{position:"absolute",top:4,left:0,right:0,display:"flex",flexDirection:"column",alignItems:"center",gap:4,zIndex:2,pointerEvents:"none"}}>
                 {isBoss && (
                   <div style={{fontSize:11,letterSpacing:6,color:C.red,fontFamily:"'Share Tech Mono',monospace",animation:"dngr 1s infinite",whiteSpace:"nowrap"}}>─── BOSS ───</div>
                 )}
                 {currentElemInfo && (
                   <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"rgba(5,13,20,0.84)",border:`1px solid ${currentElemInfo.color}88`,borderRadius:6,padding:"4px 14px",minWidth:130}}>
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

               {/* 前面下段：名前 + デバフ + HPバー + NEXTバッジ（bottom固定） */}
               <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",gap:4,paddingBottom:6}}>
                 <div style={{width:"92%",display:"flex",flexDirection:"column",gap:4}}>
                   <div style={{background:"rgba(5,13,20,0.82)",padding:"5px 10px",borderRadius:4,display:"flex",flexDirection:"column",gap:3}}>
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
                     <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace",textAlign:"center"}}>{Math.round(enemyHp)} / {ed.maxHp}</div>
                   </div>
                   {!victory && !defeat && enemyNextAction && (() => {
                     const eLabel = getEnemyActionLabel(enemyNextAction);
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
               </div>

               {/* エフェクトはフルスクリーンオーバーレイで描画（overflow:hiddenを回避） */}
             </div>
            </>
          )}
          {/* ── 全体攻撃アニメーション（dragon_rush.webp）オーバーレイ ── */}
          {/* CSSアニメーション廃止: iPad/SafariでCSS animation stateが引き継がれる問題を回避 */}
          {/* JS(RAF)でatkAllScaleを直接更新することで毎回必ずscale=1からスタートする    */}
          {showAtkAllAnim && (
            <img
              key={atkAllAnimKey}
              src="https://superapolon.github.io/Arcadia_Assets/Animation/enemyskill/dragon_rush.webp"
              alt=""
              style={{
                position:"absolute",
                top:"50%",
                left:"50%",
                width:"250%",
                height:"250%",
                objectFit:"contain",
                pointerEvents:"none",
                zIndex:60,
                transform:`translate(-50%, -50%) scale(${atkAllScale})`,
                transformOrigin:"center center",
              }}
              onError={() => setShowAtkAllAnim(false)}
            />
          )}

          </div>
          <div style={{
            flex: isPortrait ? "1 1 0" : "0 0 38%",
            display:"flex",flexDirection:"column",
            background:"rgba(5,13,20,0.82)",
            borderLeft: isPortrait ? "none" : `1px solid ${C.border}44`,
            borderTop:  isPortrait ? `1px solid ${C.border}44` : "none",
            overflow:"hidden",
          }}>

            {/* すくみガイド */}
            <div style={{padding:"3px 8px",borderBottom:`1px solid ${C.border}33`,display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:8,color:"#00ffcc88",fontFamily:"'Share Tech Mono',monospace"}}>⚔→🔄負 </span>
              <span style={{fontSize:8,color:"#f9731688",fontFamily:"'Share Tech Mono',monospace"}}>🔄→💨負 </span>
              <span style={{fontSize:8,color:"#a78bfa88",fontFamily:"'Share Tech Mono',monospace"}}>💨→⚔負 </span>
              <span style={{fontSize:8,color:"#ff446688",fontFamily:"'Share Tech Mono',monospace"}}>💥回避不能</span>
            </div>

            {/* バトルログ */}
            <div style={{flex:1,overflowY:"auto",padding:"5px 10px",minHeight:0}}>
              {/* ── シナリオフルコンボ（ログ1行目・枠区切り） ── */}
              {isScenarioBattleRef.current && (
                <div style={{display:"flex",alignItems:"baseline",gap:6,borderBottom:`1px solid ${C.border}55`,marginBottom:3,flexWrap:"nowrap",overflow:"hidden"}}>
                  <span style={{fontSize:8,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,flexShrink:0,whiteSpace:"nowrap"}}>SCENARIO FULL COMBO</span>
                  <span style={{fontSize:13,fontWeight:700,fontFamily:"'Share Tech Mono',monospace",
                    color: scenarioFullCombo === 0 ? C.muted : C.gold,
                    textShadow: scenarioFullCombo > 0 ? `0 0 8px ${C.gold}88` : "none",
                    letterSpacing:1,flexShrink:0,
                  }}>{scenarioFullCombo}</span>
                </div>
              )}
              {btlLogs.map((l,i) => {
                // ログ色判定
                let logColor;
                const hasHeal      = l.includes("HP+") || l.includes("オーバーヒール") || l.includes("大回復");
                // 味方が攻撃側になる「に+ダメージ」ログ（回避成功・カウンター成功の反撃）
                const isAllyAttack = l.includes("回避成功！") || l.includes("カウンター成功！");
                const hasTakenDmg  = !isAllyAttack && !l.includes("全敵に") && (
                  /に\s*\d+\s*ダメージ/.test(l) ||
                  /全員\s*(に\s*)?\d+\s*ダメージ/.test(l) ||
                  /^\s*→\s*.+\s*\d+\s*ダメージ/.test(l)
                );
                const hasDmg       = l.includes("ダメージ");
                if (hasHeal) {
                  logColor = "#4ade80";
                } else if (hasTakenDmg) {
                  logColor = "#f87171";
                } else if (hasDmg || isAllyAttack) {
                  logColor = "#60a5fa";
                } else {
                  logColor = C.white;
                }
                return (
                  <div key={i} style={{fontSize:11,color:logColor,lineHeight:1.7,animation:i===btlLogs.length-1?"slideUp 0.3s ease":"none",opacity:i===btlLogs.length-1?1:0.75}}>{l}</div>
                );
              })}
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
                    <div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 8px",marginBottom:4,background:`linear-gradient(90deg,${C.accent}18,transparent)`,border:`1px solid ${C.accent}55`,borderRadius:6}}>
                      {/* スプライト: 下半身欠けOK・頭が見えるよう object-position:top */}
                      <div style={{flexShrink:0,width:isPortrait?68:88,height:isPortrait?96:120,overflow:"hidden",borderRadius:4,border:`1px solid ${C.accent}66`,background:"rgba(0,200,255,0.06)",filter:`drop-shadow(0 0 8px ${C.accent}55)`}}>
                        {cmSprUrl
                          ? <img src={cmSprUrl} alt={cm.name} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top center"}} />
                          : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:56}}>{cm.icon}</div>
                        }
                      </div>
                      {/* 名前・HP・MP */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:6}}>
                          <span style={{color:C.accent,fontSize:10}}>▶</span>
                          <span style={{fontSize:13,color:C.white,fontFamily:"'Noto Serif JP',serif",fontWeight:700}}>{cm.name}</span>
                          <span style={{fontSize:9,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginLeft:"auto"}}>T{turn} {cmdInputIdx+1}/{PARTY_DEFS.length}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>HP</span>
                          <span style={{fontSize:12,color:cmHpColor,fontFamily:"'Share Tech Mono',monospace",animation:cmHpPct<=25?"dngr 0.8s infinite":"none"}}>{Math.round(cm.hp)}<span style={{fontSize:10,color:C.muted}}>/{cm.mhp}</span></span>
                        </div>
                        <div style={{height:6,background:C.panel2,borderRadius:3,marginBottom:6,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${cmHpPct}%`,background:`linear-gradient(90deg,${cmHpColor}99,${cmHpColor})`,transition:"width 0.4s",borderRadius:3}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>MP</span>
                          <span style={{fontSize:12,color:"#60a5fa",fontFamily:"'Share Tech Mono',monospace"}}>{Math.round(cm.mp)}<span style={{fontSize:10,color:C.muted}}>/{cm.mmp}</span></span>
                        </div>
                        <div style={{height:5,background:C.panel2,borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${cmMpPct}%`,background:"linear-gradient(90deg,#2255cc,#60a5fa)",transition:"width 0.4s",borderRadius:3}}/>
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
                    {/* ── SPD比較（1行） ── */}
                    {(() => {
                      const spdBuffActive = partySpdBuff > 0;
                      const enemyEntries = multiEnemies
                        ? multiEnemies.filter(me => !me.defeated).map(me => ({
                            icon: me.def.em,
                            spd: Math.max(1, (me.def.spd ?? 12) - (enemySpdDebuff > 0 ? 5 : 0)),
                            isEnemy: true, debuffed: enemySpdDebuff > 0,
                          }))
                        : [{ icon: ed.em, spd: effectiveEnemySpdDisp, isEnemy: true, debuffed: enemySpdDebuff > 0 }];
                      const partyEntries = partyMembers.map(m => ({
                        icon: m.icon, spd: m.spd, isEnemy: false, buffed: spdBuffActive,
                      }));
                      // SPD降順で並べる
                      const sorted = [...enemyEntries, ...partyEntries].sort((a, b) => b.spd - a.spd);
                      return (
                        <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:5,padding:"3px 6px",background:"rgba(5,13,20,0.7)",border:`1px solid ${C.border}44`,borderRadius:4,flexWrap:"wrap"}}>
                          <span style={{fontSize:7,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,flexShrink:0,marginRight:2}}>SPD</span>
                          {sorted.map((e, i) => {
                            const col = e.isEnemy ? (e.debuffed ? C.gold : C.red) : (e.buffed ? C.accent2 : C.accent);
                            return (
                              <React.Fragment key={i}>
                                {i > 0 && <span style={{fontSize:7,color:C.muted,flexShrink:0}}>{"'"}</span>}
                                <span style={{fontSize:9,fontFamily:"'Share Tech Mono',monospace",color:col,flexShrink:0,whiteSpace:"nowrap"}}>
                                  {e.icon}{e.spd}{e.debuffed?"⬇":e.buffed?"⚡":""}
                                </span>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      );
                    })()}

{showSkillMenu ? (
                      /* ── 統合スキルサブメニュー ── */
                      (() => {
                        // 属性スキル定義（elem系）
                        const ELEM_SKILL_DEF_MAP = Object.fromEntries(
                          ELEMENT_SKILL_DEFS.map(esk => [esk.id, esk])
                        );
                        // 特殊スキル定義
                        const SPEC_DEF = {
                          provoke:       { icon:"👊", label:"挑発",              color:"#f97316", cd: memberCdMap["provoke"]?.[currentCmdMember.id]      ?? 0, desc:"敵行動を3T強攻に変換" },
                          takedown:      { icon:"🦵", label:"テイクダウン",       color:"#ef4444", cd: memberCdMap["takedown"]?.[currentCmdMember.id]     ?? 0, desc:"全敵を1T行動不能" },
                          overheal:      { icon:"💚", label:"オーバーヒール",     color:"#22c55e", cd: memberCdMap["overheal"]?.[currentCmdMember.id]     ?? 0, desc:"エンドフェイズ全体回復" },
                          sleep:         { icon:"😴", label:"スリープ",           color:"#a78bfa", cd: memberCdMap["sleep"]?.[currentCmdMember.id]        ?? 0, desc:"敵を2T眠らせ行動不能" },
                          biker_slash:   { icon:"⚡", label:"バイカースラッシュ", color:"#facc15", cd: memberCdMap["biker_slash"]?.[currentCmdMember.id]   ?? 0, desc:`単体ダメージ＋ATK+5(累積/最大20) [+${bikerAtkBonus}]` },
                          sansanka:      { icon:"⚔", label:"三散華",             color:"#00ffcc", cd: memberCdMap["sansanka"]?.[currentCmdMember.id]      ?? 0, desc:"3連撃×3回ダメージ" },
                          stinger_bite:  { icon:"🗡", label:"スティンガーバイト", color:"#f43f5e", cd: memberCdMap["stinger_bite"]?.[currentCmdMember.id]  ?? 0, desc:"行動不能の敵に×2ダメージ" },
                          straight_shot: { icon:"🏹", label:"ストレートショット", color:"#38bdf8", cd: memberCdMap["straight_shot"]?.[currentCmdMember.id] ?? 0, desc:"単体ダメージ＋1T行動不能" },
                          arrow_rain:    { icon:"🏹", label:"アローレイン",       color:"#a3e635", cd: memberCdMap["arrow_rain"]?.[currentCmdMember.id]    ?? 0, desc:"プリフェイズ全敵に弓矢ダメージ" },
                          water_sphere:  { icon:"🌊", label:"ウォータースフィア", color:"#22d3ee", cd: memberCdMap["water_sphere"]?.[currentCmdMember.id]  ?? 0, desc:"単体ダメージ＋水濡れ3T(敵ATK½)" },
                          // ── 新規追加 ──────────────────────────────────────────────────────────────
                          trick_attack:  { icon:"🗡", label:"トリックアタック",   color:"#c084fc", cd: memberCdMap["trick_attack"]?.[currentCmdMember.id]  ?? 0, desc:"プリフェイズスタン攻撃" },
                          flat_strike:   { icon:"⚔", label:"フラットストライク", color:"#00ffcc", cd: memberCdMap["flat_strike"]?.[currentCmdMember.id]   ?? 0, desc:"単体物理ダメージ" },
                          slow_blade:    { icon:"🗡", label:"スローブレード",     color:"#94a3b8", cd: memberCdMap["slow_blade"]?.[currentCmdMember.id]    ?? 0, desc:"エンドフェイズ単体物理ダメージ" },
                          penetrate:     { icon:"⚔", label:"ペネトレイト",       color:"#fb923c", cd: memberCdMap["penetrate"]?.[currentCmdMember.id]     ?? 0, desc:"単体物理ダメージ" },
                          spiral_axe:    { icon:"🪓", label:"スパイラルアックス", color:"#f87171", cd: memberCdMap["spiral_axe"]?.[currentCmdMember.id]    ?? 0, desc:"単体物理ダメージ" },
                          double_arrow:  { icon:"🏹", label:"ダブルアロー",       color:"#a3e635", cd: memberCdMap["double_arrow"]?.[currentCmdMember.id]  ?? 0, desc:"2連射ダメージ" },
                          double_bite:   { icon:"🗡", label:"ダブルバイト",       color:"#f43f5e", cd: memberCdMap["double_bite"]?.[currentCmdMember.id]   ?? 0, desc:"プリフェイズ2連撃ダメージ" },
                          deep_edge:     { icon:"⚔", label:"ディープエッジ",     color:"#60a5fa", cd: memberCdMap["deep_edge"]?.[currentCmdMember.id]     ?? 0, desc:"エンドフェイズ単体物理ダメージ" },
                          seesaw:        { icon:"⚔", label:"シーソー",           color:"#34d399", cd: memberCdMap["seesaw"]?.[currentCmdMember.id]        ?? 0, desc:"単体物理ダメージ" },
                          windmill:      { icon:"🌀", label:"風車",       color:"#22d3ee", cd: memberCdMap["windmill"]?.[currentCmdMember.id]      ?? 0, desc:"全敵物理ダメージ" },
                          onslaught:     { icon:"🪓", label:"オンスロート",       color:"#ef4444", cd: memberCdMap["onslaught"]?.[currentCmdMember.id]     ?? 0, desc:"エンドフェイズ全体物理大ダメージ" },
                          fireball:      { icon:"🔥", label:"ファイアボール",     color:"#ff6633", cd: memberCdMap["fireball"]?.[currentCmdMember.id]      ?? 0, desc:"単体火属性ダメージ" },
                          stone_blitz:   { icon:"🪨", label:"ストーンブリッツ",  color:"#a8a29e", cd: memberCdMap["stone_blitz"]?.[currentCmdMember.id]   ?? 0, desc:"単体土属性ダメージ" },
                          air_cutter:    { icon:"💨", label:"エアカッター",       color:"#7dd3fc", cd: memberCdMap["air_cutter"]?.[currentCmdMember.id]    ?? 0, desc:"全敵風属性ダメージ" },
                          thunderbolt:   { icon:"⚡", label:"サンダーボルト",     color:"#ffee44", cd: memberCdMap["thunderbolt"]?.[currentCmdMember.id]   ?? 0, desc:"全体雷属性ダメージ" },
                        };
                        const memberMp = currentCmdMember.id === "eltz" ? mp : (partyMp[currentCmdMember.id] ?? 0);
                        const extraEffectMap = {
                          "elem_ice":     "❄怒り解除",
                          "elem_thunder": "⚡SPD+3(3T)",
                          "elem_fire":    "🔥ATK½(3T)",
                          "elem_earth":   "🌿敵SPD-5",
                        };
                        // BASE_SKILLS以外のスキルを skills から抽出
                        const BASE_IDS = ["atk","counter","dodge","heal"];
                        const subSkillIds = currentCmdMember.skills.filter(id => {
                          if (BASE_IDS.includes(id)) return false;
                          // エルツは装備武器のWEAPON_SKILL_MAPに従ってフィルタ
                          if (currentCmdMember.id === "eltz") {
                            if (!equippedWeapon) return false;
                            return (WEAPON_SKILL_MAP[equippedWeapon.id] ?? []).includes(id);
                          }
                          return true;
                        });
                        return (
                          <div>
                            {/* ヘッダー：敵属性情報（属性スキル持ちのみ表示） */}
                            {currentElemInfo && subSkillIds.some(id => ELEM_SKILL_DEF_MAP[id]) && (
                              <div style={{fontSize:9,color:currentElemInfo.color,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,textAlign:"center",marginBottom:4}}>
                                {`敵属性: ${currentElemInfo.icon}${currentElemInfo.label} ─ 弱点を突け！`}
                              </div>
                            )}
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:4}}>
                              {subSkillIds.map(skillId => {
                                const esk = ELEM_SKILL_DEF_MAP[skillId];
                                const spDef = SPEC_DEF[skillId];
                                if (!esk && !spDef) return null;

                                if (esk) {
                                  // 属性スキルボタン
                                  const canAfford = memberMp >= esk.cost;
                                  const isEffective = currentElemKey && esk.targetElement === currentElemKey;
                                  const isIceWithEnrage = esk.id === "elem_ice" && enrageCount > 0;
                                  const elemCd = getSkillCd(esk.id, currentCmdMember.id);
                                  const canUse = canAfford && elemCd === 0;
                                  const borderColor = isEffective ? esk.color : `${esk.color}44`;
                                  const bgColor = isEffective ? `${esk.color}22` : C.panel;
                                  const extraEffect = extraEffectMap[esk.id];
                                  const btnSt = canUse
                                    ? { padding:"5px 4px", background:bgColor, border:`1px solid ${borderColor}`, color:esk.color, fontSize:10, cursor:"pointer", borderRadius:4, fontFamily:"'Noto Serif JP',serif", position:"relative" }
                                    : { padding:"5px 4px", background:C.panel, border:`1px solid ${C.border}`, color:C.muted, fontSize:10, cursor:"not-allowed", borderRadius:4, fontFamily:"'Noto Serif JP',serif", opacity:0.5, position:"relative" };
                                  return (
                                    <button key={skillId} onClick={() => canUse && onSelectCommand(skillId)} style={btnSt}>
                                      {isEffective && <div style={{position:"absolute",top:-2,right:-2,fontSize:7,background:esk.color,color:"#000",borderRadius:2,padding:"0 3px",fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>有効!</div>}
                                      {isIceWithEnrage && <div style={{position:"absolute",top:-2,left:-2,fontSize:7,background:C.red,color:"#fff",borderRadius:2,padding:"0 3px",fontFamily:"'Share Tech Mono',monospace",fontWeight:700,animation:"dngr 0.6s infinite"}}>解除!</div>}
                                      <div style={{fontSize:16}}>{esk.icon}</div>
                                      <div style={{fontSize:9,marginTop:1}}>{esk.label}</div>
                                      <div style={{fontSize:7,color:canAfford?C.muted:"#553333"}}>MP {esk.cost}</div>
                                      {elemCd > 0 && <div style={{fontSize:6,color:C.red,marginTop:1}}>{elemCd}T後</div>}
                                      {elemCd === 0 && extraEffect && <div style={{fontSize:6,color:isIceWithEnrage?C.red:esk.color,marginTop:1,opacity:0.9}}>{extraEffect}</div>}
                                    </button>
                                  );
                                } else {
                                  // 特殊スキルボタン
                                  const cd = spDef.cd;
                                  const canUse = cd === 0;
                                  const stl = canUse
                                    ? { padding:"6px 4px", background:C.panel, border:`1px solid ${spDef.color}66`, color:spDef.color, fontSize:10, cursor:"pointer", borderRadius:4, fontFamily:"'Noto Serif JP',serif", position:"relative" }
                                    : { padding:"6px 4px", background:C.panel, border:`1px solid ${C.border}`, color:C.muted, fontSize:10, cursor:"not-allowed", borderRadius:4, fontFamily:"'Noto Serif JP',serif", opacity:0.5, position:"relative" };
                                  return (
                                    <button key={skillId} onClick={() => canUse && onSelectCommand(skillId)} style={stl}>
                                      {cd > 0 && <div style={{position:"absolute",top:-2,right:-2,fontSize:7,background:C.red,color:"#fff",borderRadius:2,padding:"0 3px",fontFamily:"'Share Tech Mono',monospace"}}>CD{cd}</div>}
                                      <div style={{fontSize:18}}>{spDef.icon}</div>
                                      <div style={{fontSize:9,marginTop:2,fontWeight:700}}>{spDef.label}</div>
                                      <div style={{fontSize:7,color:canUse?`${spDef.color}bb`:C.muted,marginTop:2,lineHeight:1.3}}>{spDef.desc}</div>
                                    </button>
                                  );
                                }
                              })}
                            </div>
                            <button onClick={() => setShowSkillMenu(false)} style={{width:"100%",padding:"4px",background:"transparent",border:`1px solid ${C.border}44`,color:C.muted,fontSize:9,cursor:"pointer",borderRadius:4,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>
                              ← 戻る
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      /* ── 通常アクションボタン ── */
                      <div>
                        {(() => {
                          const BASE_IDS = ["atk","counter","dodge","heal"];
                          const hasSubSkills = currentCmdMember.skills.some(id => !BASE_IDS.includes(id));
                          const totalCols = 4 + (hasSubSkills ? 1 : 0);
                          const gtc = Array(totalCols).fill("1fr").join(" ");
                          return (
                        <div style={{display:"grid",gridTemplateColumns:gtc,gap:3,marginBottom:3}}>
                          {BATTLE_SKILLS.map(sk => {
                            const memberMp = currentCmdMember.id === "eltz" ? mp : (partyMp[currentCmdMember.id] ?? 0);
                            const canAfford = sk.cost === 0 || memberMp >= sk.cost;
                            const disabled = inputPhase !== "command";
                            const weaponAllowed = currentCmdMember.id !== "eltz"
                              || ELTZ_BASE_SKILLS.includes(sk.id)
                              || (equippedWeapon && (WEAPON_SKILL_MAP[equippedWeapon.id] ?? []).includes(sk.id));
                            const btnStyle = (canAfford && !disabled && weaponAllowed)
                              ? { padding:"5px 3px", background:C.panel, border:`1px solid ${sk.color}44`, color:sk.color, fontSize:10, cursor:"pointer", borderRadius:4, fontFamily:"'Noto Serif JP',serif" }
                              : { padding:"5px 3px", background:C.panel, border:`1px solid ${C.border}`, color:C.muted, fontSize:10, cursor:"not-allowed", borderRadius:4, fontFamily:"'Noto Serif JP',serif", opacity:0.5 };
                            return (
                              <button key={sk.id} onClick={() => canAfford && !disabled && weaponAllowed && onSelectCommand(sk.id)} style={btnStyle}>
                                <div style={{fontSize:16}}>{sk.icon}</div>
                                <div style={{fontSize:9,marginTop:2}}>{sk.label}</div>
                                {sk.cost > 0 && <div style={{fontSize:7,color:canAfford?C.muted:"#553333"}}>MP {sk.cost}</div>}
                              </button>
                            );
                          })}
                          {/* 統合スキルボタン */}
                          {hasSubSkills && (() => {
                            const BASE_IDS_inner = ["atk","counter","dodge","heal"];
                            const subIds = currentCmdMember.skills.filter(sid => !BASE_IDS_inner.includes(sid));
                            // ── 変更後（分岐を削除してすべて getSkillCd に統一）──
                            const hasCdAll = subIds.every(sid => {
                              return getSkillCd(sid, currentCmdMember.id) > 0;
                            });
                            const weaponSkillOk = currentCmdMember.id !== "eltz"
                              || (equippedWeapon && subIds.some(id => (WEAPON_SKILL_MAP[equippedWeapon.id] ?? []).includes(id)));
                            const canOpen = inputPhase === "command" && weaponSkillOk;
                            return (
                              <button
                                onClick={() => canOpen && setShowSkillMenu(true)}
                                style={{padding:"5px 3px",background:C.panel,border:`1px solid ${hasCdAll||!canOpen?"#55555566":"#00ffcc44"}`,color:canOpen?(hasCdAll?C.muted:C.accent2):C.muted,fontSize:10,cursor:canOpen?"pointer":"not-allowed",borderRadius:4,fontFamily:"'Noto Serif JP',serif",opacity:canOpen?1:0.5}}>
                                <div style={{fontSize:16}}>⚡</div>
                                <div style={{fontSize:9,marginTop:2}}>スキル</div>
                              </button>
                            );
                          })()}
                        </div>
                          );
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
    <div style={{position:"fixed",inset:0,width:"100%",height:"100%",display:"flex",flexDirection:"column",...bgStyle,fontFamily:"'Noto Serif JP',serif",userSelect:"none",overflow:"hidden",transition:"background 1s"}}>
      <style>{keyframes}</style>

      {/* Overlay fade */}
      {fade && <div style={{position:"absolute",inset:0,background:"#050d14",opacity:1,zIndex:50,transition:"opacity 0.3s"}}/>}

      {/* Notification */}
      {notif && <div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:"rgba(5,13,20,0.95)",border:`1px solid ${C.accent}`,color:C.accent,padding:"8px 20px",fontSize:12,letterSpacing:1,zIndex:100,whiteSpace:"nowrap",fontFamily:"'Share Tech Mono',monospace",animation:"notifIn 0.3s ease",borderRadius:2}}>{notif}</div>}

      {/* Scanlines */}
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,200,255,0.01) 3px,rgba(0,200,255,0.01) 4px)",pointerEvents:"none",zIndex:1}}/>

      {/* HUD top */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 14px",background:"rgba(5,13,20,0.7)",borderBottom:`1px solid ${C.border}`,zIndex:10,position:"relative"}}>
        <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>{activeLoc}</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>
            <span style={{color:isHpLow?C.red:C.accent2,animation:isHpLow?"dngr 0.8s infinite":"none"}}>HP {Math.round(hp)}</span>
            <span style={{color:C.muted}}> / </span>
            <span style={{color:C.muted}}>{mhp}</span>
          </div>
          <div style={{fontSize:10,color:"#60a5fa",fontFamily:"'Share Tech Mono',monospace"}}>MP {Math.round(mp)}</div>
          <div style={{fontSize:10,color:C.gold,fontFamily:"'Share Tech Mono',monospace"}}>💰 {elk}</div>
          <div style={{fontSize:10,color:C.muted,fontFamily:"'Share Tech Mono',monospace"}}>Lv.{lv}</div>
        </div>
      </div>

      {/* Sprite area */}
      <div style={{flex:1,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"20px 20px 0",position:"relative",zIndex:5,minHeight:200}}>
        {/* Scene-specific atmosphere */}
        {activeLoc.includes("洞窟") && (
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

        {(() => {
          const count = activeSprites.length;

          // ── スプライトエリアの実高さ ────────────────────────────────────────
          const CHROME_H = 32 + 171 + 12 + 20; // HUD + dialog + margin + padding
          const areaH = windowSize.h - CHROME_H;
          const maxHCap = Math.round(areaH * 0.99);

          // ── 1キャラあたりの幅を画面幅フル活用で算出 ─────────────────────
          // gap を 4px に詰め、左右パディングも 8px に縮小して余白を最小化
          const GAP = 4;
          const PAD = 8;
          const gapTotal = GAP * (count - 1);
          const availW = windowSize.w - PAD * 2;
          // 各キャラのスロット幅（scale=1.00 のキャラが収まる基準幅）
          // scaleの平均値で正規化することで合計幅が availW に近づく
          const scales = activeSprites.map((sp, i) => {
            const sz = SPRITE_SIZE[sp] ?? { scale: 0.83, heroScale: 1.00 };
            return i === 0 ? sz.heroScale : sz.scale;
          });
          const scaleSum = scales.reduce((a, b) => a + b, 0);
          // height基準: エリア高さ × アスペクト比 で上限を設ける
          const SPR_ASPECT = 0.55;
          const hBasedW = Math.round(areaH * 0.99 * SPR_ASPECT);

          return (
            <div style={{display:"flex",gap:GAP,alignItems:"flex-end",justifyContent:"center",flexWrap:"nowrap",width:"100%",paddingLeft:PAD,paddingRight:PAD,boxSizing:"border-box"}}>
              {activeSprites.map((sp, i) => {
                const sprKey = SPRITE_MAP[sp];
                const sprUrl = sprKey ? assetUrl(sprKey) : null;
                const isHero = i === 0;
                const sz = SPRITE_SIZE[sp] ?? { scale: 0.83, heroScale: 1.00, offsetY: 0, fallbackSize: 40 };
                const dispScale = isHero ? sz.heroScale : sz.scale;
                // 各キャラの幅 = (availW - gapTotal) × (自分のscale / scaleの合計)
                // → 合計幅がほぼ availW になり、身長差比率も保たれる
                const wFromScale = Math.round((availW - gapTotal) * dispScale / scaleSum);
                // height基準の上限（縦長でもはみ出さない）
                const sprW = Math.min(wFromScale, Math.round(hBasedW * dispScale));
                const heroFilter = isHero ? "drop-shadow(0 0 8px rgba(0,200,255,0.3))" : "none";
                return sprUrl
                  ? <img key={sp+i} src={sprUrl} alt={sp} style={{width:sprW,height:"auto",maxHeight:maxHCap,flexShrink:0,marginBottom:sz.offsetY,animation:`idle ${2+i*0.3}s ${i*0.2}s infinite, dlSprIn 0.35s ease`,filter:heroFilter}} />
                  : <div key={sp+i} style={{fontSize:sz.fallbackSize,width:sprW,flexShrink:0,animation:`idle ${2+i*0.3}s ${i*0.2}s infinite, dlSprIn 0.35s ease`,filter:heroFilter,marginBottom:sz.offsetY,textShadow:"0 4px 8px rgba(0,0,0,0.5)"}}>{sp}</div>;
              })}
            </div>
          );
        })()}
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
            {/* シーンスキップボタン：次のバトルシーンまで飛ぶ */}
            {(() => {
              // 現在位置より後ろに battle:true を持つダイアログが存在するか確認
              let hasBattle = false;
              for (let si = sceneIdx; si < SCENES.length; si++) {
                const sc = SCENES[si];
                if (!sc || !sc.dl) continue;
                const startDl = si === sceneIdx ? dlIdx + 1 : 0;
                for (let di = startDl; di < sc.dl.length; di++) {
                  if (sc.dl[di]?.battle) { hasBattle = true; break; }
                }
                if (hasBattle) break;
              }
              if (!hasBattle) return null;
              return (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onPointerUp={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation();
                    // 次のバトルダイアログを探してジャンプ
                    for (let si = sceneIdx; si < SCENES.length; si++) {
                      const sc = SCENES[si];
                      if (!sc || !sc.dl) continue;
                      const startDl = si === sceneIdx ? dlIdx + 1 : 0;
                      for (let di = startDl; di < sc.dl.length; di++) {
                        if (sc.dl[di]?.battle) {
                          setAutoAdv(false);
                          if (autoAdvTimerRef.current) clearTimeout(autoAdvTimerRef.current);
                          setFade(true);
                          setTimeout(() => {
                            setSceneIdx(si);
                            setDlIdx(di);
                            setFade(false);
                          }, 300);
                          return;
                        }
                      }
                    }
                  }}
                  style={{padding:"2px 8px",fontSize:9,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,border:`1px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",borderRadius:2,transition:"all 0.2s",flexShrink:0}}
                  onMouseEnter={e => { e.currentTarget.style.color=C.gold; e.currentTarget.style.borderColor=C.gold; }}
                  onMouseLeave={e => { e.currentTarget.style.color=C.muted; e.currentTarget.style.borderColor=C.border; }}
                  title="次の戦闘シーンまでスキップ"
                >
                  ⚔ SKIP
                </button>
              );
            })()}
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
            {["STATUS","MAIL","MAP","ANALYSIS","Shop","Inventory",...(hasBbs ? ["CityBBS"] : [])].map((tab,i) => (
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
                  ["HP", `${Math.round(hp)} / ${mhp}`],
                  ["MP", `${Math.round(mp)} / ${mmp}`],
                  ["ELK", elk],
                  ["武器",     equippedWeapon    ? equippedWeapon.name    : weapon],
                  ["防具",     equippedArmor     ? equippedArmor.name     : "なし"],
                  ["装飾",     equippedAccessory ? equippedAccessory.name : "なし"],
                  ["物理ATK",  weaponPatk + statAlloc.patk
                  + (equippedWeapon    ? effectiveStats(equippedWeapon).patk    : 0)
                  + (equippedArmor     ? effectiveStats(equippedArmor).patk     : 0)
                  + (equippedAccessory ? effectiveStats(equippedAccessory).patk : 0)],
                   ["物理DEF",  statAlloc.pdef
                  + (equippedWeapon    ? effectiveStats(equippedWeapon).pdef    : 0)
                  + (equippedArmor     ? effectiveStats(equippedArmor).pdef     : 0)
                  + (equippedAccessory ? effectiveStats(equippedAccessory).pdef : 0)],
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
                    {/* ─ クリケットより ─ */}
                    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:4,padding:"10px 14px",marginBottom:12}}>
                      <div style={{color:C.accent2,marginBottom:6,fontSize:11,borderBottom:`1px solid ${C.border}44`,paddingBottom:6}}>クリケットより</div>
                      <div style={{color:C.muted,fontSize:11,lineHeight:1.8}}>{"P.BOOKの初期設定を\n完了してください。\n\n冒険者よ、健闘を祈る！"}</div>
                    </div>
                    {/* ─ ユミルより（White Garden招待状） ─ */}
                    {inCom && (
                      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:4,padding:"10px 14px"}}>
                        <div style={{color:C.accent2,marginBottom:6,fontSize:11,borderBottom:`1px solid ${C.border}44`,paddingBottom:6}}>ユミルより</div>
                        <div style={{color:C.muted,fontSize:11,lineHeight:1.8,marginBottom:12}}>{"White Garden へようこそ！\n一緒に頑張ろうね。🌸\n\nSinさんからの入団状が届いているよ。\n必ず読んでね！"}</div>
                        <button
                          onClick={() => {
                            setShowWGInvite(true);
                            if (!wgInviteData && !wgInviteLoading) {
                              setWgInviteLoading(true);
                              setWgInviteError(null);
                              fetch("https://superapolon.github.io/Arcadia_Assets/mail/whitegarden_invite.json")
                                .then(r => r.ok ? r.json() : Promise.reject(r.status))
                                .then(json => { setWgInviteData(json); setWgInviteLoading(false); })
                                .catch(err => { setWgInviteError(`読み込み失敗 (${err})`); setWgInviteLoading(false); });
                            }
                          }}
                          style={{width:"100%",padding:"9px 0",background:`${C.accent2}11`,border:`1px solid ${C.accent2}55`,color:C.accent2,fontSize:11,cursor:"pointer",borderRadius:4,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,transition:"all 0.2s"}}
                          onMouseEnter={e=>{e.currentTarget.style.background=`${C.accent2}22`;e.currentTarget.style.borderColor=C.accent2;}}
                          onMouseLeave={e=>{e.currentTarget.style.background=`${C.accent2}11`;e.currentTarget.style.borderColor=`${C.accent2}55`;}}
                        >🌸 WHITE GARDEN 入団状を開く</button>
                      </div>
                    )}
                  </div>
                ) : <div>メールなし</div>}
                {/* ─ フルスクリーン入団状オーバーレイ ─ */}
                {showWGInvite && (
                  <div style={{position:"fixed",inset:0,background:"rgba(5,13,20,0.98)",zIndex:200,display:"flex",flexDirection:"column",animation:"fadeIn 0.25s",fontFamily:"'Noto Serif JP',serif"}}>
                    <style>{`.wg-scroll::-webkit-scrollbar{width:4px}.wg-scroll::-webkit-scrollbar-track{background:transparent}.wg-scroll::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}.wg-scroll{scrollbar-width:thin;scrollbar-color:${C.border} transparent}`}</style>
                    {/* ヘッダー */}
                    <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,background:"rgba(5,13,20,0.97)",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:9,letterSpacing:5,color:C.muted,fontFamily:"'Share Tech Mono',monospace",marginBottom:2}}>WHITE GARDEN</div>
                        <div style={{fontSize:13,color:C.accent2,fontWeight:"bold",letterSpacing:2}}>🌸 入団状</div>
                      </div>
                      <button
                        onClick={() => setShowWGInvite(false)}
                        style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",borderRadius:2,transition:"all 0.2s"}}
                        onMouseEnter={e=>{e.currentTarget.style.color=C.white;e.currentTarget.style.borderColor=C.accent2;}}
                        onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;}}
                      >✕ 閉じる</button>
                    </div>
                    {/* 本文スクロールエリア */}
                    <div className="wg-scroll" style={{flex:1,overflowY:"auto",padding:"28px 24px 40px",maxWidth:640,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
                      {wgInviteLoading && (
                        <div style={{textAlign:"center",marginTop:80,color:C.muted,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,animation:"arcadiaBlnk 1s step-end infinite"}}>
                          <div style={{fontSize:20,marginBottom:12}}>🌸</div>読み込み中...
                        </div>
                      )}
                      {wgInviteError && (
                        <div style={{textAlign:"center",marginTop:80,color:C.red,fontFamily:"'Share Tech Mono',monospace",fontSize:12,letterSpacing:1}}>
                          <div style={{fontSize:20,marginBottom:12}}>⚠</div>{wgInviteError}
                        </div>
                      )}
                      {wgInviteData && !wgInviteLoading && (() => {
                        const d = wgInviteData;
                        return (
                          <>
                            {d.title && <div style={{fontSize:18,fontWeight:"bold",color:C.white,letterSpacing:2,marginBottom:6,textAlign:"center"}}>{d.title}</div>}
                            {d.subtitle && <div style={{fontSize:11,color:C.accent2,letterSpacing:4,marginBottom:24,textAlign:"center",fontFamily:"'Share Tech Mono',monospace"}}>{d.subtitle}</div>}
                            <div style={{width:200,height:1,background:`linear-gradient(90deg,transparent,${C.accent2},transparent)`,margin:"0 auto 28px"}}/>
                            {Array.isArray(d.sections) && d.sections.map((sec, i) => (
                              <div key={i} style={{marginBottom:24}}>
                                {sec.heading && (
                                  <div style={{fontSize:11,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,marginBottom:10,borderLeft:`2px solid ${C.accent2}`,paddingLeft:8}}>{sec.heading}</div>
                                )}
                                {sec.body && (
                                  <p style={{color:C.text,fontSize:13,lineHeight:2.15,margin:"0 0 10px 0",whiteSpace:"pre-wrap",letterSpacing:0.4,fontFamily:"'Noto Serif JP',serif"}}>{sec.body}</p>
                                )}
                                {Array.isArray(sec.items) && (
                                  <div style={{paddingLeft:8}}>
                                    {sec.items.map((item,j) => (
                                      <div key={j} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:`1px solid ${C.border}22`,color:C.text,fontSize:12,lineHeight:1.7,fontFamily:"'Noto Serif JP',serif"}}>
                                        <span style={{color:C.accent2,flexShrink:0}}>●</span>
                                        <span>{item}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            {d.from && (
                              <>
                                <div style={{width:200,height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"28px auto 20px"}}/>
                                <div style={{textAlign:"right",color:C.muted,fontSize:11,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1}}>{d.from}</div>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {/* フッター */}
                    <div style={{padding:"10px 18px 14px",borderTop:`1px solid ${C.border}`,background:"rgba(5,13,20,0.97)",flexShrink:0,display:"flex",justifyContent:"flex-end"}}>
                      <button
                        onClick={() => setShowWGInvite(false)}
                        style={{padding:"8px 28px",background:`${C.accent2}1a`,border:`1px solid ${C.accent2}`,color:C.accent2,fontSize:11,cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,borderRadius:2,transition:"all 0.2s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background=`${C.accent2}33`;}}
                        onMouseLeave={e=>{e.currentTarget.style.background=`${C.accent2}1a`;}}
                      >← メールに戻る</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {pbTab === 2 && (
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.muted}}>
                <div style={{color:C.accent,marginBottom:8,letterSpacing:2,fontSize:11}}>── MAP SCAN ──</div>
                {hasMapScan ? (
                  <div>
                    <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:"8px 10px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:C.accent2}}>📍</span>
                      <span style={{color:C.white,fontSize:11}}>{activeLoc}</span>
                    </div>
                    {/* ─ 狩り場エンカウント ─ */}
                    <div style={{color:C.gold,fontSize:10,letterSpacing:2,marginBottom:6}}>── エンカウント ──</div>
                    {[
                      { key:"seagull",       label:"海岸線",   note:"Lv.1 カモメ型" },
                      { key:"shamerlot",     label:"岩場",     note:"Lv.1 シャメロット" },
                      { key:"shamerlot_lv3", label:"岩場 深部",note:"Lv.3 シャメロット" },
                      { key:"shamerlot_lv5", label:"岩場 最奥",note:"Lv.5 シャメロット" },
                      { key:"moocat",        label:"西エイビス平原",   note:"Lv.4 ムーキャット" },
                      { key:"mandragora",    label:"東エイビス平原の森",  note:"Lv.4 マンドラゴラ" },
                      { key:"cocatris",      label:"東エイビス平原",note:"Lv.5 コカトリス" },
                    ].map(({ key, label, note }) => {
                      const def = battleDefs[key];
                      const lvDiff = def.lv - lv;
                      const canFight = true;
                      const expNote = lvDiff >= 1 ? `EXP ×${lvDiff>=3?2.0:lvDiff===2?1.5:1.2}` : lvDiff === 0 ? "EXP 等倍" : "経験値なし";
                      const expColor = lvDiff >= 1 ? C.accent2 : lvDiff === 0 ? C.muted : C.red;
                      const dropTable = MAP_SCAN_DROPS[key];
                      const wins = mapScanWinCount[key] ?? 0;
                      const nextWins = wins + 1;
                      const nextIsRare = nextWins % 3 === 0;
                      const nextDrop = dropTable ? (nextIsRare ? dropTable.rare : dropTable.normal) : null;
                      const nextDropLabel = !nextDrop ? "" : nextDrop.type === "elk" ? `${nextDrop.amount} ELK` : nextDrop.item.name;
                      const rowStyle = { display:"flex", alignItems:"center", gap:6, padding:"7px 8px", marginBottom:4, background:C.panel, border:`1px solid ${C.border}`, borderRadius:2 };
                      return (
                        <div key={key} style={rowStyle}>
                          <span style={{fontSize:16}}>{def.em}</span>
                          <div style={{flex:1}}>
                            <div style={{color:C.text,fontSize:11}}>{label}</div>
                            <div style={{color:C.muted,fontSize:9}}>{note} &nbsp;
                              <span style={{color:expColor}}>{expNote}</span>
                            </div>
                            {dropTable && (
                              <div style={{marginTop:3,display:"flex",flexDirection:"column",gap:1}}>
                                {/* 通常ドロップ（毎回） */}
                                <div style={{fontSize:8,fontFamily:"'Share Tech Mono',monospace",display:"flex",gap:4,alignItems:"center"}}>
                                  <span style={{color:C.muted}}>毎回:</span>
                                  <span style={{color:C.accent2}}>
                                    {dropTable.normal.type==="elk" ? `💰 ${dropTable.normal.amount} ELK` : `📦 ${dropTable.normal.item.name}`}
                                  </span>
                                </div>
                                {/* レアドロップ（3回ごと） */}
                                <div style={{fontSize:8,fontFamily:"'Share Tech Mono',monospace",display:"flex",gap:4,alignItems:"center"}}>
                                  <span style={{color:C.muted}}>3回毎:</span>
                                  <span style={{color:C.gold}}>
                                    {dropTable.rare.type==="elk" ? `💎 ${dropTable.rare.amount} ELK` : `💎 ${dropTable.rare.item.name}`}
                                  </span>
                                </div>
                                {/* 次回ドロップ予告 */}
                                <div style={{fontSize:8,fontFamily:"'Share Tech Mono',monospace",display:"flex",gap:4,alignItems:"center"}}>
                                  <span style={{color:C.muted}}>次回:</span>
                                  <span style={{color: nextIsRare ? C.gold : C.accent2}}>
                                    {nextIsRare ? "💎 " : "💰 "}{nextDropLabel}
                                  </span>
                                  <span style={{color:`${C.muted}88`}}>({wins}勝)</span>
                                </div>
                              </div>
                            )}
                          </div>
                          <button onClick={() => {
                            setOverlay(null);
                            setBattleDefs(prev => prev); // flush
                            isScenarioBattleRef.current = false; // MapScan起動（フルコンボカウント対象外）
                            const ed = battleDefs[key];
                            setBattleEnemy(ed);
                            setCurrentEnemyType(key);
                            setEnemyHp(ed.maxHp);
                            setBtlLogs([`⚔ ${ed.name} との戦闘が始まった！`]);
                            setGuarding(false); setVictory(false); setDefeat(false); setTurn(0); setNoDmgStreak(0);
                            setBattleResultBonus({ comboMult: 1.0, gradeMult: 1.0 });
                            setEnemyTurnIdx(0); setEnemyNextAction((ed.pattern||["atk"])[0]);
                            const _curWins = (mapScanWinCount[key] ?? 0) + 1;
                            setMapScanWinCount(prev => ({ ...prev, [key]: _curWins }));
                            mapScanPendingDropRef.current = { dropKey: key, winCount: _curWins };
                            setBattleNext("mapscan");
                            setPhase("battle");
                          }} style={{padding:"4px 10px",background:`${C.accent}11`,border:`1px solid ${C.accent}44`,color:C.accent,fontSize:10,cursor:"pointer",letterSpacing:1,flexShrink:0}}>
                            戦う
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : <div style={{color:C.muted,padding:8}}>MapScan 未解放<br/><span style={{fontSize:10}}>交易所のローズと話すと解放されます</span></div>}
              </div>
            )}
            {pbTab === 3 && (
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.text}}>
               <div style={{color:C.accent,marginBottom:12,letterSpacing:2,fontSize:11}}>── PLAYING ANALYSIS ──</div>

               {/* ── パワーキャンディ：コンボ100%達成戦闘 ── */}
               <div style={{marginBottom:24}}>
                 <div style={{color:C.gold,fontSize:11,letterSpacing:2,marginBottom:6}}>⚔ POWER CANDY</div>
                 <div style={{fontSize:10,color:C.muted,marginBottom:10,lineHeight:1.7}}>
                    各バトルで全コマンドをコンボ達成（全員無被弾）すると、<br/>
                    エルツの物理攻撃力 <span style={{color:C.accent2}}>+1</span> を贈呈します。
                 </div>
                 {battleAnalytics.length === 0 ? (
                 <div style={{color:C.muted,fontSize:10,padding:"8px 0"}}>── 記録なし（シナリオバトルを戦うと記録されます）──</div>
                  ) : (
                  battleAnalytics.map((b, idx) => {
                  const pct = b.totalTurns > 0 ? Math.round(b.comboTurns / b.totalTurns * 100) : 0;
                  const isPerfect = pct === 100 && b.totalTurns > 0;
                  const used = powerCandyUsed[idx];
                  return (
                    <div key={idx} style={{background:C.panel,border:`1px solid ${isPerfect ? C.gold : C.border}`,borderRadius:4,padding:"8px 10px",marginBottom:6}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontSize:11,color:C.white}}>Battle {idx + 1}｜{b.battleType}</span>
                        <span style={{fontSize:13,color:isPerfect ? C.gold : C.muted,fontWeight:700,fontFamily:"'Share Tech Mono',monospace"}}>{pct}%</span>
                        </div>
                       {/* コンボ率バー */}
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                            <span style={{fontSize:9,color:C.muted,flexShrink:0}}>コンボ率</span>
                            <div style={{flex:1,height:6,background:C.panel2,borderRadius:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${pct}%`,background:isPerfect?`linear-gradient(90deg,${C.gold},${C.accent2})`:`linear-gradient(90deg,${C.accent},${C.accent2})`,    borderRadius:3,transition:"width 0.4s"}}/>
                              </div>
                              <span style={{fontSize:10,color:isPerfect?C.gold:C.muted,minWidth:52,textAlign:"right",fontFamily:"'Share Tech Mono',monospace"}}>
                               {b.comboTurns}/{b.totalTurns}T
                             </span>
                           </div>
                           {isPerfect && !used && (
                            <button
                            onClick={() => {
                            setStatAlloc(sa => ({ ...sa, patk: sa.patk + 1 }));
                            setPowerCandyUsed(prev => ({ ...prev, [idx]: true }));
                            showNotif("🍬 パワーキャンディ！ 物理ATK +1！");
                           }}
                            style={{width:"100%",padding:"7px",background:`${C.gold}1a`,border:`1px solid ${C.gold}`,color:C.gold,fontSize:11,cursor:"pointer",borderRadius:4,fontFamily:"'Share Tech Mono',monospace",letterSpacing:2,transition:"all 0.2s"}}
                            onMouseEnter={e => { e.currentTarget.style.background = `${C.gold}33`; }}
                           onMouseLeave={e => { e.currentTarget.style.background = `${C.gold}1a`; }}
                           >🍬 パワーキャンディを受け取る（物理ATK +1）</button>
                           )}
                            {used && (
                            <div style={{textAlign:"center",fontSize:10,color:C.muted,padding:"4px 0"}}>✅ 受け取り済み</div>
                            )}
                           {!isPerfect && (
                           <div style={{fontSize:9,color:C.muted,textAlign:"center",padding:"2px 0"}}>コンボ率100%を達成するとキャンディを受け取れます</div>
                            )}
                         </div>
                           );
                         })
                       )}
                     </div>

               {/* ── スピードキャンディ：属性ブレイク累計 ── */}
               <div>
                 <div style={{color:C.accent2,fontSize:11,letterSpacing:2,marginBottom:6}}>💨 SPEED CANDY</div>
                 <div style={{fontSize:10,color:C.muted,marginBottom:10,lineHeight:1.7}}>
                   属性ブレイク累計達成でエルツのSPD <span style={{color:C.accent2}}>+1</span>（最大3回）<br/>
                    <span style={{fontSize:9}}>属性スキルで弱点に蓄積50ダメ以上与えるとブレイク発生</span>
                </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,background:C.panel,border:`1px solid ${C.border}`,borderRadius:4,padding:"8px 12px"}}>
                   <span style={{fontSize:10,color:C.muted,flex:1}}>累計属性ブレイク数</span>
                    <span style={{fontSize:18,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",fontWeight:700}}>{totalElemBreaks}</span>
                    <span style={{fontSize:10,color:C.muted}}>回</span>
                 </div>
              {[1,2,3].map(threshold => {
                const achieved = totalElemBreaks >= threshold;
                const used2 = speedCandyUsed[threshold];
                return (
                  <div key={threshold} style={{background:C.panel,border:`1px solid ${achieved ? C.accent2 : C.border}`,borderRadius:4,padding:"8px 12px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1}}>
                      <span style={{fontSize:11,color:achieved ? C.accent2 : C.muted}}>
                        💫 {threshold}回ブレイク達成
                      </span>
                      <div style={{fontSize:9,color:C.muted,marginTop:2}}>
                        {achieved ? "達成済み ✓" : `あと ${threshold - totalElemBreaks} 回`}
                      </div>
                    </div>
                    {achieved && !used2 && (
                      <button
                        onClick={() => {
                          setEltzSpdBonus(prev => prev + 1);
                          setSpeedCandyUsed(prev => ({ ...prev, [threshold]: true }));
                          showNotif("🍬 スピードキャンディ！ SPD +1！");
                        }}
                        style={{padding:"6px 14px",background:`${C.accent2}1a`,border:`1px solid ${C.accent2}`,color:C.accent2,fontSize:10,cursor:"pointer",borderRadius:4,fontFamily:"'Share Tech Mono',monospace",letterSpacing:1,whiteSpace:"nowrap",flexShrink:0,transition:"all 0.2s"}}
                        onMouseEnter={e => { e.currentTarget.style.background = `${C.accent2}33`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${C.accent2}1a`; }}
                      >🍬 SPD +1</button>
                    )}
                    {used2 && <span style={{fontSize:10,color:C.muted,flexShrink:0}}>✅ 受取済</span>}
                    {!achieved && <span style={{fontSize:10,color:`${C.muted}66`,flexShrink:0}}>未達成</span>}
                  </div>
                );
              })}
              {eltzSpdBonus > 0 && (
                <div style={{marginTop:10,padding:"6px 12px",background:`${C.accent2}11`,border:`1px solid ${C.accent2}44`,borderRadius:4,fontSize:10,color:C.accent2,fontFamily:"'Share Tech Mono',monospace",textAlign:"center"}}>
                  現在のSPDボーナス: +{eltzSpdBonus}（エルツ SPD {12 + eltzSpdBonus}）
                </div>
              )}
            </div>
          </div>
        )}
        {pbTab === 4 && (() => {

// ★ アンロック判定ヘルパー
// unlock フィールドがない場合は常に true
const isUnlocked = (unlock) => {
  if (!unlock) return true;
  const reqChapter    = unlock.chapter    ?? 1;
  const reqMinScene   = unlock.minScene   ?? 0;
  const reqMaxChapter = unlock.maxChapter ?? Infinity;

  // maxChapter を超えていたら非表示
  if (chapter > reqMaxChapter) return false;

  // chapter が足りない
  if (chapter < reqChapter) return false;

  // chapter が一致している場合のみ minScene チェック
  if (chapter === reqChapter && sceneIdx < reqMinScene) return false;

  return true;
};

// ── ローディング ──
if (shopLoading) return (
  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.muted,textAlign:"center",marginTop:40,letterSpacing:2,lineHeight:2}}>
    <div style={{fontSize:20,marginBottom:10,animation:"arcadiaBlnk 1s step-end infinite"}}>🏪</div>
    SHOP DATA LOADING...
  </div>
);

// ── エラー ──
if (shopError) return (
  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.red,textAlign:"center",marginTop:40,letterSpacing:2,lineHeight:2}}>
    <div style={{fontSize:18,marginBottom:10}}>⚠</div>
    データ取得に失敗しました<br/>
    <span style={{fontSize:10,color:C.muted}}>{shopError}</span>
  </div>
);

if (!shopData) return null;

// 解放済み店舗のみ絞り込む
const shops   = (shopData.shops ?? []).filter(s => isUnlocked(s.unlock));
const curShop = shops.find(s => s.id === activeShop) ?? null;

return (
  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.text}}>

    {/* ── ヘッダー ── */}
    <div style={{color:C.accent,marginBottom:8,letterSpacing:2,fontSize:11}}>── SHOP ──</div>
    <div style={{fontSize:10,color:C.muted,marginBottom:12}}>
      所持ELK: <span style={{color:C.gold}}>{elk}</span>
    </div>

    {/* ── 店舗タブ ── */}
    {shops.length === 0 ? (
      <div style={{color:C.muted,fontSize:11,textAlign:"center",marginTop:20,letterSpacing:2,lineHeight:2}}>
        利用できる店舗がありません
      </div>
    ) : (
      <>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
          {shops.map(shop => {
            const active = activeShop === shop.id;
            return (
              <button
                key={shop.id}
                onClick={() => setActiveShop(active ? null : shop.id)}
                style={{
                  padding:"5px 12px", fontSize:10, letterSpacing:1, cursor:"pointer",
                  border:`1px solid ${active ? C.accent : C.border}`,
                  background: active ? `${C.accent}22` : "transparent",
                  color: active ? C.accent : C.muted,
                  borderRadius:3, fontFamily:"'Share Tech Mono',monospace", transition:"all 0.15s",
                }}
                onMouseEnter={e=>{ if(!active) e.currentTarget.style.color=C.white; }}
                onMouseLeave={e=>{ if(!active) e.currentTarget.style.color=C.muted; }}
              >{shop.name}</button>
            );
          })}
        </div>

        {/* ── 商品リスト ── */}
        {curShop ? (() => {
          // 解放済みアイテムのみ絞り込む
          const visibleItems = curShop.items.filter(item => isUnlocked(item.unlock));
          return (
            <>
              <div style={{fontSize:10,color:C.accent2,letterSpacing:2,marginBottom:10,borderLeft:`2px solid ${C.accent2}`,paddingLeft:8}}>
                {curShop.name}
              </div>
              {visibleItems.length === 0 ? (
                <div style={{color:C.muted,fontSize:11,textAlign:"center",marginTop:16,letterSpacing:1}}>
                  現在取り扱い商品はありません
                </div>
              ) : visibleItems.map(item => {
                const canAfford = elk >= item.price;
                const ownedQty  = inventory.filter(i => i.id === item.id).reduce((s,i) => s + (i.quantity ?? 1), 0);
                return (
                  <div key={item.id}
                    style={{display:"flex",alignItems:"center",gap:8,background:C.panel,border:`1px solid ${C.border}`,borderRadius:4,padding:"10px 12px",marginBottom:8}}
                  >
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:C.white,marginBottom:2}}>
                        {item.name}
                        {ownedQty > 0 && (
                          <span style={{fontSize:10,color:C.gold,marginLeft:8}}>所持 ×{ownedQty}</span>
                        )}
                      </div>
                      <div style={{fontSize:10,color:C.muted}}>
                        {item.type === "weapon"    && `ATK +${item.basePatk}`}
                        {item.type === "armor"     && `DEF +${item.basePdef}`}
                        {item.type === "accessory" && `ATK +${item.basePatk}  DEF +${item.basePdef}`}
                      </div>
                    </div>
                    <div style={{fontSize:12,color:C.gold,flexShrink:0,marginRight:8}}>{item.price} ELK</div>
                    <button
                      disabled={!canAfford}
                      onClick={() => {
                        if (!canAfford) return;
                        setElk(e => e - item.price);
                        gainItem({ id:item.id, name:item.name, type:item.type, basePatk:item.basePatk, basePdef:item.basePdef, quality:"N" });
                        showNotif(`🛍 ${item.name} を購入した！`);
                      }}
                      style={{
                        flexShrink:0, padding:"5px 12px",
                        background: canAfford ? `${C.accent2}1a` : "transparent",
                        border:    `1px solid ${canAfford ? C.accent2 : C.border}`,
                        color:      canAfford ? C.accent2 : C.muted,
                        fontSize:11, cursor: canAfford ? "pointer" : "not-allowed",
                        borderRadius:3, fontFamily:"'Share Tech Mono',monospace", transition:"all 0.2s",
                      }}
                      onMouseEnter={e=>{ if(canAfford) e.currentTarget.style.background=`${C.accent2}33`; }}
                      onMouseLeave={e=>{ if(canAfford) e.currentTarget.style.background=`${C.accent2}1a`; }}
                    >購入</button>
                  </div>
                );
              })}
            </>
          );
        })() : (
          <div style={{color:C.muted,fontSize:11,textAlign:"center",marginTop:20,letterSpacing:2,lineHeight:2}}>
            上の店舗ボタンを選択してください
          </div>
        )}
      </>
    )}
  </div>
);
})()}

              {pbTab === 5 && (() => {
                const QUALITIES = ["N","R","SR","SSR"];
                const Q_COLOR = { N:C.muted, R:"#4fc3f7", SR:"#ce93d8", SSR:C.gold };
                const Q_NEXT  = { N:"R", R:"SR", SR:"SSR" };

                // 品質ごとの個数集計（全アイテム合算）
                const qCount = { N:0, R:0, SR:0, SSR:0 };
                inventory.forEach(item => { qCount[item.quality ?? "N"] += (item.quantity ?? 1); });

                // 精錬処理
                const refine = (item, idx) => {
                  const q = item.quality ?? "N";
                  if (!Q_NEXT[q]) return; // SSRは精錬不可
                  const nextQ = Q_NEXT[q];
                  setInventory(prev => {
                    const cur = prev[idx];
                    if (!cur || (cur.quantity ?? 1) < 2) {
                      showNotif(`精錬には同品質の${item.name}が2個必要です`);
                      return prev;
                    }
                    const newQty = (cur.quantity ?? 1) - 2;
                    // 同名・次品質スロットを探す
                    const nextIdx = prev.findIndex((i, ii) => ii !== idx && i.id === item.id && (i.quality ?? "N") === nextQ);
                    let next = newQty === 0
                      ? prev.filter((_, ii) => ii !== idx)
                      : prev.map((i, ii) => ii === idx ? { ...i, quantity: newQty } : i);
                    if (nextIdx !== -1) {
                      const adjustedIdx = newQty === 0 ? (nextIdx > idx ? nextIdx - 1 : nextIdx) : nextIdx;
                      next = next.map((i, ii) => ii === adjustedIdx ? { ...i, quantity: (i.quantity ?? 1) + 1 } : i);
                    } else {
                      const newItem = { ...item, quality: nextQ, quantity: 1 };
                      next = newQty === 0
                        ? [...next, newItem]
                        : [...next, newItem];
                    }
                    showNotif(`✨ ${item.name}【${q}×2】→【${nextQ}】に精錬！`);
                    return next;
                  });
                };

                const descOf = (item) => {
                  const s = effectiveStats(item);
                  const parts = [];
                  if (s.patk > 0) parts.push(`物理ATK +${s.patk}`);
                  if (s.pdef > 0) parts.push(`物理DEF +${s.pdef}`);
                  return parts.join(" / ") || "―";
                };

                return (
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.text}}>
                    <div style={{color:C.accent,marginBottom:8,letterSpacing:2,fontSize:11}}>── INVENTORY ──</div>

                    {/* 品質個数サマリー */}
                    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                      {QUALITIES.map(q => (
                        <div key={q} style={{padding:"3px 8px",border:`1px solid ${Q_COLOR[q]}55`,borderRadius:3,fontSize:10,color:Q_COLOR[q],background:`${Q_COLOR[q]}11`}}>
                          【{q}】{qCount[q]}個
                        </div>
                      ))}
                      <div style={{fontSize:10,color:C.muted,alignSelf:"center",marginLeft:"auto"}}>
                        {inventory.length} / 100スロット
                      </div>
                    </div>

                    {inventory.length === 0 ? (
                      <div style={{color:C.muted,fontSize:10,padding:"8px 0"}}>── 所持品なし ──</div>
                    ) : (
                      inventory.map((item, idx) => {
                        const q = item.quality ?? "N";
                        const typeColor = item.type === "weapon" ? C.accent2 : item.type === "armor" ? "#a78bfa" : C.gold;
                        const typeLabel = item.type === "weapon" ? "武器" : item.type === "armor" ? "防具" : "装飾";
                        const isEquipped =
                          (item.type === "weapon"    && equippedWeapon?.id    === item.id && (equippedWeapon?.quality ?? "N")    === q) ||
                          (item.type === "armor"     && equippedArmor?.id     === item.id && (equippedArmor?.quality ?? "N")     === q) ||
                          (item.type === "accessory" && equippedAccessory?.id === item.id && (equippedAccessory?.quality ?? "N") === q);
                        const setFn =
                          item.type === "weapon"    ? setEquippedWeapon    :
                          item.type === "armor"     ? setEquippedArmor     :
                                                      setEquippedAccessory;
                        const canRefine = !!Q_NEXT[q] && (item.quantity ?? 1) >= 2;
                        return (                       
                        <div key={`${item.id}_${q}_${idx}`} style={{display:"flex",alignItems:"center",gap:6,
                          background:`${Q_COLOR[q]}0d`,                                           // ① 背景色：品質カラー薄塗り
                          border:`1px solid ${isEquipped ? C.accent2 : Q_COLOR[q]}88`,            // ② 枠線：品質カラー
                          borderRadius:4,padding:"8px 10px",marginBottom:5}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2,flexWrap:"wrap"}}>
                              <span style={{fontSize:9,color:typeColor,border:`1px solid ${typeColor}55`,borderRadius:2,padding:"1px 5px",flexShrink:0}}>{typeLabel}</span>
                              {/* ③ 品質バッジ：背景塗りつぶし・文字黒 */}
                              <span style={{fontSize:9,color:"#000",background:Q_COLOR[q],border:`1px solid ${Q_COLOR[q]}`,borderRadius:2,padding:"1px 6px",flexShrink:0,fontWeight:"bold"}}>【{q}】</span>
                                <span style={{fontSize:12,color:C.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</span>
                                {/* 個数 */}
                                <span style={{fontSize:10,color:C.gold,fontFamily:"'Share Tech Mono',monospace",flexShrink:0,marginLeft:2}}>×{item.quantity ?? 1}</span>
                              </div>
                              <div style={{fontSize:9,color:C.muted,lineHeight:1.5}}>{descOf(item)}</div>
                            </div>

                            {/* 精錬ボタン */}
                            {Q_NEXT[q] && (
                              <button
                                onClick={() => refine(item, idx)}
                                disabled={!canRefine}
                                style={{flexShrink:0,padding:"4px 8px",background:canRefine?`${C.gold}22`:"transparent",border:`1px solid ${canRefine?C.gold:C.border}55`,color:canRefine?C.gold:C.muted,fontSize:9,cursor:canRefine?"pointer":"default",borderRadius:3,fontFamily:"'Share Tech Mono',monospace",whiteSpace:"nowrap"}}
                                onMouseEnter={e=>{ if(canRefine) e.currentTarget.style.background=`${C.gold}44`; }}
                                onMouseLeave={e=>{ if(canRefine) e.currentTarget.style.background=`${C.gold}22`; }}
                                title={canRefine?`2個→【${Q_NEXT[q]}】に精錬`:`精錬には×2必要`}
                              >⚗ {Q_NEXT[q]}へ</button>
                            )}

                            {/* 装備ボタン */}
                            <button
                              onClick={() => {
                                setFn(isEquipped ? null : item);
                                showNotif(isEquipped ? `${item.name}【${q}】を外した` : `${item.name}【${q}】を装備した！`);
                              }}
                              style={{flexShrink:0,padding:"4px 10px",background:isEquipped?`${C.accent2}22`:"transparent",border:`1px solid ${isEquipped?C.accent2:C.border}`,color:isEquipped?C.accent2:C.muted,fontSize:10,cursor:"pointer",borderRadius:3,fontFamily:"'Share Tech Mono',monospace"}}
                              onMouseEnter={e=>{ e.currentTarget.style.background=`${C.accent2}22`; }}
                              onMouseLeave={e=>{ e.currentTarget.style.background=isEquipped?`${C.accent2}22`:"transparent"; }}
                            >{isEquipped ? "装備中" : "装備"}</button>

                            {/* 捨てるボタン */}
                            <button
                              onClick={() => {
                                if (!window.confirm(`「${item.name}【${q}】」を1個捨てますか？`)) return;
                                if (isEquipped) setFn(null);
                                setInventory(prev => {
                                  const cur = prev[idx];
                                  if (!cur) return prev;
                                  if ((cur.quantity ?? 1) <= 1) return prev.filter((_, i) => i !== idx);
                                  return prev.map((i, ii) => ii === idx ? { ...i, quantity: (i.quantity ?? 1) - 1 } : i);
                                });
                              }}
                              style={{flexShrink:0,padding:"4px 10px",background:"transparent",border:`1px solid ${C.red}55`,color:C.red,fontSize:10,cursor:"pointer",borderRadius:3,fontFamily:"'Share Tech Mono',monospace"}}
                              onMouseEnter={e=>{ e.currentTarget.style.background=`${C.red}22`; }}
                              onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}
                            >捨てる</button>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}
              {pbTab === 6 && (() => {
  // 強制表示フラグのリセット
  if (bbsForceOpen) setBbsForceOpen(false);
  const BBS_URL = "https://superapolon.github.io/Arcadia_Assets/bbs/ch2.json";

  const visibleThreads = (bbsData ?? []).filter(t => sceneIdx >= (t.unlockAt ?? 0));

  const getDepth = (post, posts) => {
    let depth = 0; let cur = post;
    while (cur.replyTo) { cur = posts.find(p => p.id === cur.replyTo); if (!cur) break; depth++; }
    return depth;
  };

  const INDENT = 14;
  const selThread = bbsSelectedThread ? visibleThreads.find(t => t.id === bbsSelectedThread) : null;
  const selPost   = selThread ? selThread.posts.find(p => p.id === bbsSelectedPost) : null;

  return (
    <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 12, color: C.text }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: 5, color: C.muted, marginBottom: 4 }}>CITY BBS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 14, color: C.accent, fontWeight: 700, letterSpacing: 2 }}>シティBBS</div>
          {bbsLoading && <div style={{ fontSize: 9, color: C.muted, animation: "arcadiaBlnk 1s step-end infinite" }}>読み込み中...</div>}
          {bbsError  && (
            <button
              onClick={() => { setBbsError(false); setBbsData(null); }}
              style={{ fontSize: 9, color: C.red, background: "transparent", border: `1px solid ${C.red}55`, borderRadius: 2, padding: "2px 8px", cursor: "pointer" }}
            >再読込</button>
          )}
        </div>
        <div style={{ width: "100%", height: 1, background: `linear-gradient(90deg,${C.accent}88,transparent)` }} />
      </div>

      {bbsError ? (
        <div style={{ color: C.red, fontSize: 11, padding: "16px 0", textAlign: "center" }}>
          データの読み込みに失敗しました
        </div>
      ) : bbsLoading ? (
        <div style={{ color: C.muted, fontSize: 11, padding: "16px 0", textAlign: "center" }}>
          ── 接続中 ──
        </div>
      ) : visibleThreads.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 11, padding: "16px 0", textAlign: "center" }}>
          ── 掲示板は空です ──
        </div>
      ) : (
        visibleThreads.map(thread => (
          <div key={thread.id} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: C.gold, letterSpacing: 3, marginBottom: 6 }}>▼ {thread.board}</div>
            {thread.posts.map(post => {
              const depth    = getDepth(post, thread.posts);
              const isRoot   = depth === 0;
              const selected = bbsSelectedPost === post.id && bbsSelectedThread === thread.id;
              const subject  = post.subject ?? thread.subject;
              return (
                <div
                  key={post.id}
                  onClick={() => {
                    if (selected) { setBbsSelectedThread(null); setBbsSelectedPost(null); }
                    else { setBbsSelectedThread(thread.id); setBbsSelectedPost(post.id); }
                  }}
                  style={{ paddingLeft: 8 + depth * INDENT, paddingTop: 5, paddingBottom: 5, paddingRight: 8, cursor: "pointer", background: selected ? `${C.accent}11` : "transparent", borderLeft: selected ? `2px solid ${C.accent}` : "2px solid transparent", transition: "all 0.15s", marginBottom: 1 }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = `${C.accent}08`; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
                    {depth > 0 && <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{"→".repeat(depth)} </span>}
                    <span style={{ fontSize: 11, color: selected ? C.accent : isRoot ? C.white : C.text, fontWeight: isRoot ? 700 : 400, flex: 1, minWidth: 0 }}>{subject}</span>
                    <span style={{ fontSize: 9, color: C.muted, flexShrink: 0, whiteSpace: "nowrap" }}>/{post.author}</span>
                    <span style={{ fontSize: 9, color: C.muted, flexShrink: 0 }}>({post.authorTag} {post.date})</span>
                  </div>
                </div>
              );
            })}
            {bbsSelectedThread === thread.id && selPost && (
              <div style={{ marginTop: 10, background: "rgba(10,26,38,0.9)", border: `1px solid ${C.border}`, borderTop: `2px solid ${C.accent}55`, borderRadius: 4, padding: "14px 16px", animation: "slideUp 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, color: C.muted }}>□ 投稿者</span>
                  <span style={{ fontSize: 12, color: C.accent2, fontWeight: 700 }}>{selPost.author}</span>
                  <span style={{ fontSize: 9, color: C.muted }}>({selPost.authorTag})</span>
                  <span style={{ fontSize: 9, color: C.muted, marginLeft: "auto" }}>{selPost.date}</span>
                </div>
                <div style={{ fontSize: 11, color: C.accent, letterSpacing: 1, marginBottom: 10, borderBottom: `1px solid ${C.border}55`, paddingBottom: 8 }}>
                  {selPost.subject ?? thread.subject}
                </div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 2, whiteSpace: "pre-wrap", letterSpacing: 0.3 }}>
                  {selPost.body}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
})()}
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
          { id:1, label:"新大陸上陸", sub:"Chapter 1", scenes:[
            { idx:0,  label:"S00 スティアルーフ 港" },
            { idx:1,  label:"S01 繁華街" },
            { idx:2,  label:"S02 コミュニティセンター" },
            { idx:3,  label:"S03 中央広場" },
          ]},
          { id:2, label:"街の探索", sub:"Chapter 2", scenes:[
            { idx:4,  label:"S04 武器防具屋" },
            { idx:5,  label:"S05 レストランDIFORE" },
            { idx:6,  label:"S06 魔法店LUNALEE" },
            { idx:7,  label:"S07 B&B宿屋" },
          ]},
          { id:3, label:"舞闘祭", sub:"Chapter 3", scenes:[
            { idx:8,  label:"S08 舞闘祭前夜" },
            { idx:9,  label:"S09 中央広場・第一試合" },
            { idx:10, label:"S10 中央広場・混戦" },
            { idx:11, label:"S11 舞闘祭後・コミュニティルーム" },
          ]},
          { id:4, label:"エイビス平原 西", sub:"Chapter 4", scenes:[
            { idx:12, label:"S12 西門出発" },
            { idx:13, label:"S13 ムーキャット初戦" },
            { idx:14, label:"S14 ムーキャット苦戦" },
            { idx:15, label:"S15 ムーキャット狩り継続" },
          ]},
          { id:5, label:"エイビス平原 東", sub:"Chapter 5", scenes:[
            { idx:16, label:"S16 マンドラゴラ探索" },
            { idx:17, label:"S17 マンドラゴラ初戦" },
            { idx:18, label:"S18 コミュニティルーム・オルガ登場" },
            { idx:19, label:"S19 仲間集合" },
          ]},
          { id:6, label:"ソロ狩り", sub:"Chapter 6", scenes:[
            { idx:20, label:"S20 ソロ狩り開始" },
            { idx:21, label:"S21 ソロ狩り中盤" },
            { idx:22, label:"S22 Lv5到達" },
            { idx:23, label:"S23 ギルド依頼受付" },
          ]},
          { id:7, label:"カルマとの遭遇", sub:"Chapter 7", scenes:[
            { idx:24, label:"S24 アリエス合流・カルマ登場" },
            { idx:25, label:"S25 カルマ去る・WA習得" },
            { idx:26, label:"S26 コカトリス狩り" },
            { idx:27, label:"S27 屋台市・ウーピィ青年" },
          ]},
          { id:8, label:"仲間との再会", sub:"Chapter 8", scenes:[
            { idx:28, label:"S28 WA狩り向上" },
            { idx:29, label:"S29 新展開" },
            { idx:30, label:"S30 夕方・一同集合" },
            { idx:31, label:"S31 ペルシア・ポン吉パーティ" },
            { idx:32, label:"S32 三人狩り・高揚感" },
          ]},
          { id:9, label:"送別会", sub:"Chapter 9", scenes:[
            { idx:33, label:"S33 コミュニティルーム・オルガ" },
            { idx:34, label:"S34 スウィフト再合流" },
            { idx:35, label:"S35 送別会準備" },
            { idx:36, label:"S36 送別会・オルガ戦" },
            { idx:37, label:"S37 別れの言葉・エンディング" },
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
                                  .then(r => {
                                    console.log(`[Novel] fetch ${url} → ${r.status} ${r.ok ? "OK" : "NG"}`);
                                    return r.ok ? r.text() : Promise.reject(r.status);
                                  })
                                  .then(text => {
                                    console.log(`[Novel] s${s.idx} text length=${text?.length}`);
                                    setNovelCache(prev => ({ ...prev, [s.idx]: text ?? null }));
                                  })
                                  .catch(err => {
                                    console.warn(`[Novel] fetch failed s${s.idx}:`, err);
                                    setNovelCache(prev => ({ ...prev, [s.idx]: NOVEL_FETCH_ERR }));
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
                    const novelCached = novelCache[novelSelScene];
                    const isFetchErr  = novelCached === NOVEL_FETCH_ERR;
                    const novelText   = (novelCached && !isFetchErr) ? novelCached : null;
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
                        {isFetchErr
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
