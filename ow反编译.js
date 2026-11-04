'use strict';
const fs = require('fs');
const path = require('path');

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { process.stderr.write('node unpack.js <zip|目录> <输出目录>\n'); process.exit(1); }
const out = path.resolve(dst);
fs.mkdirSync(out, { recursive: true });

const unzip = (buf, dir) => {
  let i = 0;
  while (i < buf.length - 4 && buf.readUInt32LE(i) === 0x04034b50) {
    const ns = buf.readUInt16LE(i + 26), es = buf.readUInt16LE(i + 28), cs = buf.readUInt32LE(i + 18);
    const name = buf.slice(i + 30, i + 30 + ns).toString('utf8');
    const st = i + 30 + ns + es;
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buf.slice(st, st + cs));
    i = st + cs;
  }
};

const work = fs.statSync(src).isDirectory() ? src : path.join(out, '__unzip__');
const unzipped = work !== src;
if (unzipped) { fs.mkdirSync(work, { recursive: true }); unzip(fs.readFileSync(src), work); }
const code = fs.readFileSync(path.join(work, 'ow-program.js'), 'utf8');

const grab = (from, open, close) => {
  let d = 0, str = false, esc = false;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (str) { if (c === '"') str = false; continue; }
    if (c === '"') { str = true; continue; }
    if (c === open) d++;
    else if (c === close) { d--; if (!d) return code.slice(from, i + 1); }
  }
  return '';
};

const meta = JSON.parse(grab(code.indexOf('const META = ') + 13, '{', '}'));
const vInit = JSON.parse(grab(code.indexOf('const V = ') + 10, '[', ']'));
const lInit = JSON.parse(grab(code.indexOf('const L = ') + 10, '[', ']'));
const varName = i => (meta.vars[i] || {}).name || `var${i}`;
const listName = i => (meta.lists[i] || {}).name || `list${i}`;

const unparen = s => {
  s = s.trim();
  while (s[0] === '(') {
    let d = 0, str = false, esc = false, ok = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (str) { if (c === '"') str = false; continue; }
      if (c === '"') { str = true; continue; }
      if (c === '(') d++;
      else if (c === ')') { d--; if (!d) { ok = i === s.length - 1; break; } }
    }
    if (!ok) break;
    s = s.slice(1, -1).trim();
  }
  return s;
};

const splitTop = (s, sep) => {
  const out = []; let d = 0, str = false, esc = false, st = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (str) { if (c === '"') str = false; continue; }
    if (c === '"') { str = true; continue; }
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') d--;
    else if (d === 0 && c === sep) { out.push(s.slice(st, i)); st = i + 1; }
  }
  out.push(s.slice(st));
  return out;
};

const findTop = (s, op) => {
  let d = 0, str = false, esc = false, last = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (str) { if (c === '"') str = false; continue; }
    if (c === '"') { str = true; continue; }
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') d--;
    else if (d === 0 && s.startsWith(op, i)) {
      if (op === '+' || op === '-') {
        const prev = s.slice(0, i).trimEnd().slice(-1);
        if (!prev || /[\\(\[{=,+\-*/!<>&|?:]/.test(prev)) continue;
      }
      last = i; i += op.length - 1;
    }
  }
  return last;
};

const genId = () => 'b_' + Math.random().toString(36).substring(2, 10);
const BL = (opcode, inputs, menus, substacks) => {
  return { id: genId(), opcode, inputs: inputs || {}, menus: menus || {}, substacks: substacks || {} };
};
const parseListRef = s => { const m = String(s).trim().match(/^L\[(\d+)\]$/); return m ? +m[1] : -1; };
const menuVal = s => { s = String(s).trim(); return s[0] === '"' ? JSON.parse(s) : valueOf(s); };

const owCall = (name, args) => {
  switch (name) {
    case 'div': return BL('operator_divide', { A: valueOf(args[0]), B: valueOf(args[1]) });
    case 'mod': return BL('operator_mod', { A: valueOf(args[0]), B: valueOf(args[1]) });
    case 'mathop': {
      const a0 = (args[0] || '').trim();
      const isStr = a0[0] === '"';
      return BL('operator_math', { NUM: valueOf(args[1]), ...(isStr ? {} : { OPERATOR: valueOf(args[0]) }) }, isStr ? { OPERATOR: JSON.parse(a0) } : {});
    }
    case 'random': return BL('string_random', { FROM: valueOf(args[0]), TO: valueOf(args[1]) });
    case 'eq': return BL('operator_eq', { A: valueOf(args[0]), B: valueOf(args[1]) });
    case 'listItem': return BL('data_list_item', { IDX: valueOf(args[1]) }, { NAME: listName(parseListRef(args[0])) });
    case 'getX': return BL('motion_x');
    case 'getY': return BL('motion_y');
    case 'getRotation': return BL('motion_rotation');
    case 'getSize': return BL('looks_size');
    case 'getGhost': return BL('looks_ghost');
    case 'getStretchX': return BL('looks_stretch_x');
    case 'getStretchY': return BL('looks_stretch_y');
    case 'getZ': return BL('motion_z');
    case 'getPitch': return BL('motion_pitch');
    case 'getRoll': return BL('motion_roll');
    case 'costume': return BL('looks_costumenumbername', {}, { NUMBER_NAME: JSON.parse(args[1]) });
    case 'backdrop': return BL('looks_backdropnumbername', {}, { NUMBER_NAME: JSON.parse(args[0]) });
    case 'answer': return BL('sensing_answer');
    case 'timer': return BL('sensing_timer');
    case 'mouseX': return BL('sensing_mousex');
    case 'mouseY': return BL('sensing_mousey');
    case 'mouseDown': return BL('sensing_mouse_down', {}, { BUTTON: JSON.parse(args[0]) });
    case 'currentTime': return BL('sensing_current_time', {}, { WHAT: JSON.parse(args[0]) });
    case 'daysSince2000': return BL('sensing_dayssince2000');
    case 'username': return BL('sensing_username');
    case 'loudness': return BL('sensing_loudness');
    case 'keyPressed': return BL('sensing_key', {}, { KEY: JSON.parse(args[0]) });
    case 'touching': return BL('sensing_touching', { A: valueOf(args[0]) }, { WHAT: JSON.parse(args[1]) });
    case 'distanceTo': return BL('sensing_distanceto', {}, { DISTANCETOMENU: JSON.parse(args[1]) });
    case 'of': return BL('sensing_of', {}, { OBJECT: JSON.parse(args[0]), PROPERTY: JSON.parse(args[1]) });
    case 'cameraGet': {
      const k = JSON.parse(args[0]);
      const mp = { x: 'camera_get_x', y: 'camera_get_y', z: 'camera_get_z', rotation: 'camera_get_rotation',
        pitch: 'camera_get_pitch', roll: 'camera_get_roll', length: 'camera_res_length', width: 'camera_res_width' };
      return BL(mp[k] || 'camera_get_x');
    }
    case 'mouseMoved': return BL(args[0].includes('x') ? 'mouse_moved_x' : 'mouse_moved_y');
    case 'mouseMovedBy': return BL(args[0].includes('x') ? 'mouse_move_x' : 'mouse_move_y');
    case 'mouseLocked': return BL('mouse_locked');
    case 'resText': return BL('res_text', { TEXT: valueOf(args[0]), FONT: valueOf(args[1]) });
    case 'resName': return BL('res_name', { OBJ: valueOf(args[0]) });
    case 'resIsText': return BL('res_is_text', { OBJ: valueOf(args[0]) });
    case 'resIsResource': return BL('res_is_resource', { OBJ: valueOf(args[0]) });
  }
  return 0;
};

const valueOf = s => {
  s = String(s).trim();
  if (!s) return 0;
  if (s[0] === '"') return JSON.parse(s);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === 'true') return 1;
  if (s === 'false') return 0;

  const inner = unparen(s);
  if (inner !== s) return valueOf(inner);

  let r = s.match(/^ow\.num\(([^]*)\)$/);
  if (r) return Number(r[1]);

  r = s.match(/^ow\.([A-Za-z_]\w*)\(([^]*)\)$/);
  if (r) return owCall(r[1], splitTop(r[2], ',').map(x => x.trim()));

  r = s.match(/^V\[(\d+)\]$/);
  if (r) return BL('data_var_get', {}, { NAME: varName(+r[1]) });
  r = s.match(/^L\[(\d+)\]\.length$/);
  if (r) return BL('data_list_length', {}, { NAME: listName(+r[1]) });
  r = s.match(/^L\[(\d+)\]\.slice\(\)$/);
  if (r) return BL('data_list_get', {}, { NAME: listName(+r[1]) });
  r = s.match(/^L\[(\d+)\]\.some\(v => ow\.eq\(v, ([^]*)\)\)$/);
  if (r) return BL('data_list_contains', { ITEM: valueOf(r[2]) }, { NAME: listName(+r[1]) });
  r = s.match(/^\(L\[(\d+)\]\.findIndex\(v => ow\.eq\(v, ([^]*)\)\) \+ 1\)$/);
  if (r) return BL('data_list_indexof', { ITEM: valueOf(r[2]) }, { NAME: listName(+r[1]) });

  r = s.match(/^String\(([^]*)\)\.length$/);
  if (r) return BL('string_length', { TEXT: valueOf(r[1]) });
  r = s.match(/^String\(([^]*)\)\.slice\(([^]*) - 1, ([^]*)\)$/);
  if (r) {
    const text = valueOf(r[1]);
    const from = valueOf(r[2]);
    if (r[2].trim() === r[3].trim()) return BL('string_letter', { TEXT: text, I: from });
    return BL('string_letter', { TEXT: text, I: from, J: valueOf(r[3]) });
  }
  r = s.match(/^String\(([^]*)\)\.includes\(String\(([^]*)\)\)$/);
  if (r) return BL('string_contains', { STRING1: valueOf(r[1]), STRING2: valueOf(r[2]) });

  let i = findTop(s, ' + ');
  if (i >= 0) {
    const a = s.slice(0, i).trim(), b = s.slice(i + 3).trim();
    if (a.startsWith('String(') && b.startsWith('String(')) {
      const inner = x => x.trim().slice(7, -1);
      return BL('string_join', { A: valueOf(inner(a)), B: valueOf(inner(b)) });
    }
    return BL('operator_add', { A: valueOf(a), B: valueOf(b) });
  }
  i = findTop(s, ' - ');
  if (i >= 0) return BL('operator_subtract', { A: valueOf(s.slice(0, i)), B: valueOf(s.slice(i + 3)) });
  i = findTop(s, ' * ');
  if (i >= 0) return BL('operator_multiply', { A: valueOf(s.slice(0, i)), B: valueOf(s.slice(i + 3)) });
  i = findTop(s, ' > ');
  if (i >= 0) return BL('operator_gt', { A: valueOf(s.slice(0, i)), B: valueOf(s.slice(i + 3)) });
  i = findTop(s, ' < ');
  if (i >= 0) return BL('operator_lt', { A: valueOf(s.slice(0, i)), B: valueOf(s.slice(i + 3)) });
  i = findTop(s, ' && ');
  if (i >= 0) return BL('operator_and', { A: valueOf(unparen(s.slice(0, i))), B: valueOf(unparen(s.slice(i + 4))) });
  i = findTop(s, ' || ');
  if (i >= 0) return BL('operator_or', { A: valueOf(unparen(s.slice(0, i))), B: valueOf(unparen(s.slice(i + 4))) });
  r = s.match(/^!\(([^]*)\)$/);
  if (r) return BL('operator_not', { A: valueOf(r[1]) });
  r = s.match(/^Math\.round\(([^]*)\)$/);
  if (r) return BL('operator_round', { NUM: valueOf(r[1]) });
  return 0;
};

const SM = (re, fn) => [re, fn];
const STMT = [
  SM(/^V\[(\d+)\] = ow\.num\(V\[\1\]\) \+ ([^]*)$/, m => BL('data_change_var', { VALUE: valueOf(m[2]) }, { NAME: varName(+m[1]) })),
  SM(/^V\[(\d+)\] = ([^]*)$/, m => BL('data_set_var', { VALUE: valueOf(m[2]) }, { NAME: varName(+m[1]) })),
  SM(/^L\[(\d+)\]\.push\(([^]*)\)$/, m => BL('data_list_add', { ITEM: valueOf(m[2]) }, { NAME: listName(+m[1]) })),
  SM(/^L\[(\d+)\]\.length = 0$/, m => BL('data_list_clear', {}, { NAME: listName(+m[1]) })),
  SM(/^ow\.listDelete\(L\[(\d+)\], ([^]*)\)$/, m => BL('data_list_delete', { IDX: valueOf(m[2]) }, { NAME: listName(+m[1]) })),
  SM(/^ow\.listInsert\(L\[(\d+)\], ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('data_list_insert', { IDX: valueOf(a[0]), ITEM: valueOf(a[1]) }, { NAME: listName(+m[1]) }); }),
  SM(/^ow\.listReplace\(L\[(\d+)\], ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('data_list_replace', { IDX: valueOf(a[0]), ITEM: valueOf(a[1]) }, { NAME: listName(+m[1]) }); }),

  SM(/^ow\.setX\((\d+), ow\.getX\(\1\) \+ ([^]*)\)$/, m => BL('motion_add_x', { VALUE: valueOf(m[2]) })),
  SM(/^ow\.setY\((\d+), ow\.getY\(\1\) \+ ([^]*)\)$/, m => BL('motion_add_y', { VALUE: valueOf(m[2]) })),
  SM(/^ow\.setX\((\d+), ([^]*)\)$/, m => BL('motion_set_x', { VALUE: valueOf(m[2]) })),
  SM(/^ow\.setY\((\d+), ([^]*)\)$/, m => BL('motion_set_y', { VALUE: valueOf(m[2]) })),
  SM(/^ow\.setRotation\((\d+), ow\.getRotation\(\1\) \+ ([^]*)\)$/, m => BL('motion_turn_right', { DEG: valueOf(m[2]) })),
  SM(/^ow\.setRotation\((\d+), ow\.getRotation\(\1\) - ([^]*)\)$/, m => BL('motion_turn_left', { DEG: valueOf(m[2]) })),
  SM(/^ow\.setRotation\((\d+), ([^]*)\)$/, m => BL('motion_set_rotation', { DEG: valueOf(m[2]) })),
  SM(/^ow\.moveSteps\((\d+), ([^]*)\)$/, m => BL('motion_movesteps', { STEPS: valueOf(m[2]) })),
  SM(/^ow\.goto\((\d+), ([^]*)\)$/, m => BL('motion_goto', { TO: valueOf(m[2]) })),
  SM(/^ow\.setDirection\((\d+), ([^]*)\)$/, m => BL('motion_pointindirection', { DIRECTION: valueOf(m[2]) })),
  SM(/^ow\.pointTowards\((\d+), ([^]*)\)$/, m => BL('motion_pointtowards', { TOWARDS: valueOf(m[2]) })),
  SM(/^ow\.bounce\((\d+)\)$/, m => BL('motion_ifonedgebounce')),
  SM(/^ow\.setRotationStyle\((\d+), ([^]*)\)$/, m => BL('motion_setrotationstyle', { STYLE: valueOf(m[2]) })),
  SM(/^ow\.setXYZ\((\d+), ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('motion_set_xyz', { X: valueOf(a[0]), Y: valueOf(a[1]), Z: valueOf(a[2]) }); }),
  SM(/^ow\.setZ\((\d+), ow\.getZ\(\1\) \+ ([^]*)\)$/, m => BL('motion_add_z', { VALUE: valueOf(m[2]) })),
  SM(/^ow\.setZ\((\d+), ([^]*)\)$/, m => BL('motion_set_z', { VALUE: valueOf(m[2]) })),
  SM(/^ow\.setPitch\((\d+), ow\.getPitch\(\1\) \+ ([^]*)\)$/, m => BL('motion_change_pitch', { DEG: valueOf(m[2]) })),
  SM(/^ow\.setPitch\((\d+), ([^]*)\)$/, m => BL('motion_set_pitch', { DEG: valueOf(m[2]) })),
  SM(/^ow\.setRoll\((\d+), ow\.getRoll\(\1\) \+ ([^]*)\)$/, m => BL('motion_change_roll', { DEG: valueOf(m[2]) })),
  SM(/^ow\.setRoll\((\d+), ([^]*)\)$/, m => BL('motion_set_roll', { DEG: valueOf(m[2]) })),

  SM(/^ow\.setVisible\((\d+), true\)$/, m => BL('looks_show')),
  SM(/^ow\.setVisible\((\d+), false\)$/, m => BL('looks_hide')),
  SM(/^ow\.say\(([^]*)\)$/, m => {
    const a = splitTop(m[1], ',');
    const think = a[2].trim() === 'true';
    const secs = (a[3] || '0').trim();
    const msg = valueOf(a[1]);
    if (secs === '0') return BL(think ? 'looks_think' : 'looks_say', { MESSAGE: msg });
    return BL(think ? 'looks_thinkforsecs' : 'looks_sayforsecs', { MESSAGE: msg, SECS: valueOf(secs) });
  }),
  SM(/^ow\.setSize\((\d+), ow\.getSize\(\1\) \+ ([^]*)\)$/, m => BL('looks_changesizeby', { CHANGE: valueOf(m[2]) })),
  SM(/^ow\.setSize\((\d+), ([^]*)\)$/, m => BL('looks_set_size', { SIZE: valueOf(m[2]) })),
  SM(/^ow\.setGhost\((\d+), ([^]*)\)$/, m => BL('looks_set_ghost', { GHOST: valueOf(m[2]) })),
  SM(/^ow\.switchCostume\((\d+), ([^]*)\)$/, m => BL('looks_switch_costume', { COSTUME: valueOf(m[2]) })),
  SM(/^ow\.nextCostume\((\d+)\)$/, m => BL('looks_nextcostume')),
  SM(/^ow\.setStretch\((\d+), ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('looks_set_stretch', { X: valueOf(a[0]), Y: valueOf(a[1]) }); }),
  SM(/^ow\.setEffect\((\d+), ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('looks_seteffectto', { VALUE: valueOf(a[1]), EFFECT: menuVal(a[0]) }); }),
  SM(/^ow\.changeEffect\((\d+), ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('looks_changeeffectby', { CHANGE: valueOf(a[1]), EFFECT: menuVal(a[0]) }); }),
  SM(/^ow\.clearEffects\((\d+)\)$/, m => BL('looks_cleargraphiceffects')),
  SM(/^ow\.goLayers\((\d+), ([^]*), 0\)$/, m => BL('looks_gotofrontback', { FRONT_BACK: menuVal(m[2]) })),
  SM(/^ow\.goLayers\((\d+), ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('looks_goforwardbackwardlayers', { NUM: valueOf(a[1]), FORWARD_BACKWARD: menuVal(a[0]) }); }),
  SM(/^ow\.switchBackdrop\(([^]*)\)$/, m => BL('looks_switchbackdropto', { BACKDROP: valueOf(m[1]) })),
  SM(/^ow\.nextBackdrop\(\)$/, m => BL('looks_nextbackdrop')),

  SM(/^ow\.setSoundEffect\((\d+), ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('sound_seteffectto', { VALUE: valueOf(a[1]), EFFECT: menuVal(a[0]) }); }),
  SM(/^ow\.changeSoundEffect\((\d+), ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('sound_changeeffectby', { VALUE: valueOf(a[1]), EFFECT: menuVal(a[0]) }); }),
  SM(/^ow\.clearSoundEffects\((\d+)\)$/, m => BL('sound_cleareffects')),
  SM(/^await ow\.playSound\(([^]*)\)$/, m => { const a = splitTop(m[1], ','); return BL('sound_playuntildone', { SOUND_MENU: menuVal(a[1]) }); }),
  SM(/^ow\.playSound\(([^]*)\)$/, m => { const a = splitTop(m[1], ','); return BL('sound_play', { SOUND_MENU: menuVal(a[1]) }); }),

  SM(/^ow\.cameraMoveTo\(([^]*)\)$/, m => { const a = splitTop(m[1], ','); return BL('camera_move_to', { X: valueOf(a[0]), Y: valueOf(a[1]) }); }),
  SM(/^ow\.cameraSetRotation\(([^]*)\)$/, m => BL('camera_turn', { DEG: valueOf(m[1]) })),
  SM(/^ow\.cameraSetResolution\(([^]*)\)$/, m => { const a = splitTop(m[1], ','); return BL('camera_resolution', { LEN: valueOf(a[0]), WID: valueOf(a[1]) }); }),
  SM(/^ow\.cameraSet\("(\w+)", ([^]*)\)$/, m => BL(m[1] === 'z' ? 'camera_set_z' : m[1] === 'pitch' ? 'camera_set_pitch' : 'camera_set_roll', { VALUE: valueOf(m[2]) })),
  SM(/^ow\.cameraAdd\("(\w+)", ([^]*)\)$/, m => BL(m[1] === 'x' ? 'camera_add_x' : m[1] === 'y' ? 'camera_add_y' : 'camera_add_z', { VALUE: valueOf(m[2]) })),
  SM(/^ow\.cameraBind\((\d+), true\)$/, m => BL('camera_bind')),
  SM(/^ow\.cameraBind\((\d+), false\)$/, m => BL('camera_unbind')),

  SM(/^ow\.mouseLock\(([^]*)\)$/, m => BL('mouse_lock', { ON: menuVal(m[1]) })),
  SM(/^ow\.mouseCursor\(([^]*)\)$/, m => BL('mouse_cursor', { STYLE: menuVal(m[1]) })),
  SM(/^ow\.mouseSetXY\(([^]*)\)$/, m => { const a = splitTop(m[1], ','); return BL('mouse_set_xy', { X: valueOf(a[0]), Y: valueOf(a[1]) }); }),

  SM(/^await ow\.wait\(([^]*)\)$/, m => BL('control_wait', { SEC: valueOf(m[1]) })),
  SM(/^return$/, m => BL('control_stop')),

  SM(/^await ow\.broadcast\(([^]*)\)$/, m => { const a = splitTop(m[1], ','); return BL('event_broadcastandwait', { BROADCAST_INPUT: valueOf(a[0]) }); }),
  SM(/^ow\.broadcast\(([^]*)\)$/, m => { const a = splitTop(m[1], ','); return BL('event_broadcast', { BROADCAST_INPUT: valueOf(a[0]) }); }),

  SM(/^await ow\.ask\(([^]*)\)$/, m => BL('sensing_askandwait', { QUESTION: valueOf(m[1]) })),
  SM(/^ow\.resetTimer\(\)$/, m => BL('sensing_reset_timer')),
  SM(/^ow\.setDragMode\((\d+), ([^]*)\)$/, m => BL('sensing_setdragmode', { DRAG_MODE: menuVal(m[2]) })),

  SM(/^ow\.penClear\(\)$/, m => BL('pen_clear')),
  SM(/^ow\.penDown\((\d+)\)$/, m => BL('pen_pen_down')),
  SM(/^ow\.penUp\((\d+)\)$/, m => BL('pen_pen_up')),
  SM(/^ow\.penColor\((\d+), ([^]*)\)$/, m => BL('pen_set_color', { COLOR: valueOf(m[2]) })),
  SM(/^ow\.penSize\((\d+), ([^]*)\)$/, m => BL('pen_set_size', { SIZE: valueOf(m[2]) })),
  SM(/^ow\.penResize\((\d+), ([^]*)\)$/, m => BL('pen_change_size', { SIZE: valueOf(m[2]) })),
  SM(/^ow\.stamp\((\d+)\)$/, m => BL('pen_stamp')),

  SM(/^ow\.clone\(([^]*)\)$/, m => { const a = splitTop(m[1], ','); return BL('control_create_clone_of', { CLONE_OPTION: menuVal(a[1]) }); }),
  SM(/^ow\.deleteClone\(\)$/, m => BL('control_delete_this_clone')),

  SM(/^ow\.setMonitorVisible\('(var|list)', ([^]*)\)$/, m => {
    const a = splitTop(m[2], ','); const show = a[1].trim() === 'true'; const name = menuVal(a[0]);
    if (m[1] === 'var') return BL(show ? 'data_showvariable' : 'data_hidevariable', { VARIABLE: name });
    return BL(show ? 'data_showlist' : 'data_hidelist', { LIST: name });
  }),

  SM(/^ow\.setRoleImage\((\d+), ([^]*)\)$/, m => BL('res_set_image', { ADDR: valueOf(m[2]) })),
  SM(/^ow\.setRoleTexture\((\d+), ([^]*)\)$/, m => BL('res_set_texture', { ADDR: valueOf(m[2]) })),
  SM(/^ow\.setRoleText\((\d+), ([^]*)\)$/, m => { const a = splitTop(m[2], ','); return BL('res_set_text', { TEXT: valueOf(a[0]), FONT: valueOf(a[1]) }); })
];

const parseStmt = (head, bodySrc, elseBody) => {
  if (bodySrc !== undefined) {
    let m = head.match(/^if \(([^]*)\)$/);
    if (m) {
      if (elseBody !== undefined) return BL('control_if_else', { COND: valueOf(m[1]) }, {}, { SUB: parseBody(bodySrc), SUB2: parseBody(elseBody) });
      return BL('control_if', { COND: valueOf(m[1]) }, {}, { SUB: parseBody(bodySrc) });
    }
    m = head.match(/^for \(let i = 0, n = Math\.round\(([^]*)\); i < n; i\+\+\)$/);
    if (m) return BL('control_repeat', { TIMES: valueOf(m[1]) }, {}, { SUB: parseBody(bodySrc) });
    if (head === 'for (;;)') {
      const b = bodySrc.replace(/\n\s*await ow\.tick\(\);\s*$/, '');
      return BL('control_forever', {}, {}, { SUB: parseBody(b) });
    }
    m = head.match(/^while \(!\(([^]*)\)\)$/);
    if (m) {
      const clean = bodySrc.replace(/\n\s*await ow\.tick\(\);\s*$/, '').trim();
      if (!clean) return BL('control_wait_until', { CONDITION: valueOf(m[1]) });
      return BL('control_repeat_until', { COND: valueOf(m[1]) }, {}, { SUB: parseBody(clean) });
    }
  }
  for (const [re, fn] of STMT) {
    const m = head.match(re);
    if (m) return fn(m, head);
  }
  return null;
};

const parseBody = (src) => {
  const blocks = [];
  let i = 0;
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (i >= src.length) break;
    const start = i;
    let depth = 0, str = false, esc = false, sep = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (str) { if (c === '"') str = false; continue; }
      if (c === '"') { str = true; continue; }
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (depth === 0 && (c === ';' || c === '{')) { sep = i; break; }
    }
    if (sep < 0) break;
    const head = src.slice(start, sep).trim();
    if (src[sep] === ';') {
      i = sep + 1;
      let blk = parseStmt(head);
      if (!blk) continue;
      
      if (blk.opcode === 'motion_set_x') {
        let j = i;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src.slice(j, j + 7) === 'ow.setY(') {
          let end = src.indexOf(';', j);
          if (end !== -1) {
            const head2 = src.slice(j, end).trim();
            const blk2 = parseStmt(head2);
            if (blk2 && blk2.opcode === 'motion_set_y') {
              blk = BL('motion_set_xy', { X: blk.inputs.VALUE, Y: blk2.inputs.VALUE });
              i = end + 1;
            }
          }
        }
      }
      
      const prev = blocks[blocks.length - 1];
      if (prev && (prev.opcode === 'looks_sayforsecs' || prev.opcode === 'looks_thinkforsecs') && blk.opcode === 'control_wait') continue;
      if (prev && prev.opcode === 'control_delete_this_clone' && blk.opcode === 'control_stop') continue;
      blocks.push(blk);
      continue;
    }
    i = sep + 1;
    const bStart = i;
    let d2 = 1, s2 = false, e2 = false;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (e2) { e2 = false; continue; }
      if (ch === '\\') { e2 = true; continue; }
      if (s2) { if (ch === '"') s2 = false; continue; }
      if (ch === '"') { s2 = true; continue; }
      if (ch === '{') d2++;
      else if (ch === '}') { d2--; if (!d2) break; }
    }
    const bodySrc = src.slice(bStart, i);
    i++;
    let j = i;
    while (j < src.length && /\s/.test(src[j])) j++;
    let elseBody;
    if (src.slice(j, j + 4) === 'else') {
      j += 4;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === '{') {
        j++;
        const ebStart = j;
        let d3 = 1, s3 = false, e3 = false;
        for (; j < src.length; j++) {
          const ch = src[j];
          if (e3) { e3 = false; continue; }
          if (ch === '\\') { e3 = true; continue; }
          if (s3) { if (ch === '"') s3 = false; continue; }
          if (ch === '"') { s3 = true; continue; }
          if (ch === '{') d3++;
          else if (ch === '}') { d3--; if (!d3) break; }
        }
        elseBody = src.slice(ebStart, j);
        i = j + 1;
      }
    }
    const blk = parseStmt(head, bodySrc, elseBody);
    if (blk) blocks.push(blk);
  }
  return blocks;
};

const hatsStart = code.indexOf('const hats = [];');
const hatsEnd = code.indexOf('return {META, V, L, hats};');
const hatSrc = code.slice(hatsStart, hatsEnd);
const HAT_RE = /hats\.push\(\{role:\s*(\d+),\s*kind:\s*"([^"]+)",\s*key:\s*"([^"]*)",\s*name:\s*"([^"]*)",\s*run:\s*async \(\) => \{/g;
const hats = [];
let hm;
while ((hm = HAT_RE.exec(hatSrc))) {
  const bodyStart = hm.index + hm[0].length;
  let d = 1, i = bodyStart, str = false, esc = false;
  for (; i < hatSrc.length; i++) {
    const c = hatSrc[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (str) { if (c === '"') str = false; continue; }
    if (c === '"') { str = true; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) break; }
  }
  hats.push({ role: +hm[1], kind: hm[2], key: hm[3], name: hm[4], body: parseBody(hatSrc.slice(bodyStart, i)) });
}

const hatBlock = (kind, key) => {
  switch (kind) {
    case 'run': return BL('event_when_run');
    case 'key': return BL('event_whenkeypressed', { KEY_OPTION: key });
    case 'click': return BL('event_whenthisspriteclicked');
    case 'broadcast': return BL('event_whenbroadcastreceived', { BROADCAST_OPTION: key });
    case 'clone': return BL('control_start_as_clone');
    case 'backdrop': return BL('event_whenbackdropswitchesto', { BACKDROP: key });
    case 'greater': {
      const [w, v] = key.split('>');
      const num = Number(v);
      return BL('event_whengreaterthan', { VALUE: Number.isFinite(num) ? num : v }, { WHENGREATERTHAN: w });
    }
  }
  return null;
};

const scriptsByRole = {};
for (const hat of hats) {
  const blks = [];
  const hb = hatBlock(hat.kind, hat.key);
  if (hb) blks.push(hb);
  blks.push(...hat.body);
  (scriptsByRole[hat.role] = scriptsByRole[hat.role] || []).push({ blocks: blks });
}

fs.writeFileSync(path.join(out, 'project.json'), JSON.stringify({
  meta: { name: meta.name },
  mode: meta.mode,
  stageSize: meta.stage,
  roles: (meta.roles || []).map((r, i) => ({ id: r.id || `role${i}`, name: r.name, isStage: !!r.isStage }))
}, null, 2));

const codeDir = path.join(out, 'Sprite', 'Code');
fs.mkdirSync(codeDir, { recursive: true });
(meta.roles || []).forEach((r, i) => {
  const owner = r.isStage ? null : i;
  const vars = {}, lists = {};
  (meta.vars || []).forEach((v, s) => { if (v.role === owner) vars[v.name] = vInit[s]; });
  (meta.lists || []).forEach((l, s) => { if (l.role === owner) lists[l.name] = lInit[s]; });
  
  const scripts = (scriptsByRole[i] || []).map((s, idx) => ({
    id: 's_' + Math.random().toString(36).substring(2, 10),
    x: -300 + (idx % 3) * 400,
    y: -300 + Math.floor(idx / 3) * 300,
    blocks: s.blocks
  }));

  fs.writeFileSync(path.join(codeDir, `${r.id || `role${i}`}.json`), JSON.stringify({
    isStage: !!r.isStage,
    name: r.name,
    blocks: { scripts },
    variables: vars,
    lists: lists,
    variableTypes: {},
    listTypes: {},
    costumes: r.costumes || [],
    sounds: r.sounds || [],
    transform: { x: r.x, y: r.y, z: r.z },
    direction: r.direction
  }, null, 2));
});

['Images', 'Sounds', 'Models'].forEach(sub => {
  const from = path.join(work, sub);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(out, sub), { recursive: true });
});

if (unzipped) fs.rmSync(work, { recursive: true, force: true });