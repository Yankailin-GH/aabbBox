const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/core-breach-legacy.html'), 'utf8');
const maps = new Function(source.slice(source.indexOf('const MAP_DEFINITIONS = ['), source.indexOf('const BASE_GAME_SPEED')) + ';return MAP_DEFINITIONS;')();
const gameSource = source.slice(source.indexOf('class QuantumTDGame {'), source.indexOf('function traceUnitPolygon'));

function setup(savedSession) {
  const store = new Map([['quantum_td_stars', '[3,2,1]']]);
  if (savedSession !== undefined) store.set('quantum_td_active_session_portrait_v1', savedSession);
  const elements = new Map();
  const document = {
    body: { classList: { toggle() {} } },
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { style: {}, textContent: '', getContext: () => ({}), addEventListener() {} });
      return elements.get(id);
    }
  };
  const storage = { getItem: key => store.get(key) ?? null };
  const Game = new Function('document', 'localStorage', 'navigator', 'MAP_DEFINITIONS', 'ENEMY_TYPES', 'TOWER_TYPES', 'COMMANDER_SKILLS',
    gameSource + ';return QuantumTDGame;')(document, storage, { userAgent: '' }, maps, { crawler: {} }, ['pulse'], { emp: {} });
  // Keep entry, map reset and home visibility real; omit browser layout/audio/rendering.
  for (const method of ['initCanvasSize', 'bindEvents', 'setupOrientationSensors', 'updateOrientationLayout', 'updateHUD', 'animate', 'cancelScheduledClose', 'clearPendingBuildTile', 'closeInspector', 'showToast', 'updateFullscreenButtons', 'closeModal', 'requestGameFullScreen', 'setCommanderSkill']) {
    Game.prototype[method] = function () {};
  }
  Game.prototype.restoreGameState = () => { throw new Error('Entry must not restore a saved battle'); };
  Game.prototype.trigger3sAlarmCountdown = function () { this.startedCountdown = true; };
  return { Game, elements, store };
}

test('opening or refreshing always waits on stage selection, including with a saved battle', () => {
  const saved = JSON.stringify({ mapIndex: 2, wave: 12, hp: 8, energy: 999, towers: [{ gx: 1, gy: 1, type: 'pulse', level: 3 }] });
  for (const session of [undefined, saved, 'invalid-json']) {
    const { Game, elements, store } = setup(session);
    const game = new Game();
    assert.equal(elements.get('screen-home').style.display, 'flex');
    assert.equal(game.isInBattle, false);
    assert.equal(game.isPaused, true);
    assert.equal(game.wave, 0);
    assert.equal(game.towers.length, 0);
    assert.equal(game.startedCountdown, undefined);
    assert.equal(store.get('quantum_td_active_session_portrait_v1'), session);
    assert.equal(elements.get('home-stars-1').textContent, '⭐⭐☆');
  }
});

test('explicit stage selection starts a fresh chosen map after an old battle', () => {
  const { Game, elements } = setup(JSON.stringify({ mapIndex: 2, wave: 12 }));
  const game = new Game();
  game.wave = 12;
  game.energy = 999;
  game.towers = [{ type: 'pulse' }];
  game.pendingCommanderSkill = 'emp';
  game.startStageFromHome(1);
  assert.equal(game.currentMapIndex, 1);
  assert.equal(game.wave, 0);
  assert.equal(game.energy, 400);
  assert.equal(game.towers.length, 0);
  assert.equal(game.isInBattle, true);
  assert.equal(game.isPaused, false);
  assert.equal(elements.get('screen-home').style.display, 'none');
  assert.equal(game.startedCountdown, true);
});
