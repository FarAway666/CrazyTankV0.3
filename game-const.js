/**
 * 游戏常量与配置，单独模块以降低主文件 context 占用
 */
const MAP_HALF = 220;
const TANK_RADIUS = 1.4;
const MINE_RADIUS = 0.8;
const MINE_DAMAGE = 80;
const MINE_COOLDOWN = 5000;
const DOUBLE_TAP_MS = 250;
const BOOST_DURATION = 500;
const BOOST_MULTIPLIER = 2.7;
// 体力相关
const STAMINA_MAX = 100;
const STAMINA_REGEN_PER_SEC = 5;
const STAMINA_DRAIN_PER_SEC = 20;
const STAMINA_MIN_TO_START_BOOST = 15;
const STAMINA_BOOST_MAX_DURATION_MS = 5000;  // 加速最大持续时间（满 5 秒进入冷却）
const STAMINA_BOOST_COOLDOWN_MS = 5000;      // 体力耗尽或满时长后的冷却时间
const COLLISION_DAMAGE = 5;
const COLLISION_DAMAGE_CD = 1000;
const POISON_DURATION = 150;
const MAX_RADIUS = Math.sqrt(MAP_HALF * MAP_HALF + MAP_HALF * MAP_HALF);
const HEALTH_PACK_REGEN_TOTAL = 30;
const HEALTH_PACK_REGEN_DURATION = 6;
const HEALTH_PACK_REGEN_RATE = HEALTH_PACK_REGEN_TOTAL / HEALTH_PACK_REGEN_DURATION;
const HEALTH_PACK_RESPAWN = 15000;
const WEAPON_BOX_RESPAWN = 15000;
const MINIMAP_RADIUS = 92;
const MG_SPREAD_ANGLE = 10 * Math.PI / 180;
const CANNON_SPREAD_ANGLE = 5 * Math.PI / 180;
const SHOTGUN_SPREAD_ANGLE = 20 * Math.PI / 180;
const SCOPE_FOV = 30;
const NORMAL_FOV = 60;
const SCOPE_SPEED_MULT = 0.3;
const SCOPE_TURN_MULT = 0.2;
const MOUSE_TURRET_SENSITIVITY = 0.001;  
const SATELLITE_TARGET_SPEED = 40;
const SATELLITE_RADIUS = 10;
const SATELLITE_DAMAGE = 75;
const SATELLITE_WARNING_MS = 1000;
const SATELLITE_EFFECT_MS = 1500;
const SATELLITE_RESPAWN = 30000;
const SHIELD_RADIUS = 3.5;  // 护盾半径，在此修改护盾大小
const SHIELD_OFFSET_FORWARD = 2.2;  // 【修改护盾位置】护盾中心相对炮台的前向偏移（单位），视觉与碰撞共用
const SHIELD_OFFSET_Y = 1.1;  // 【修改护盾位置】护盾中心相对地面的高度
const SHIELD_HIT_MARGIN = 0.8;  // 护盾碰撞判定余量，避免高速子弹穿透
const SHIELD_OPACITY = 0.2;  // 护盾主体透明度（0=全透明，1=不透明）
const SHIELD_OUTLINE_OPACITY = 0.5;  // 护盾描边层透明度
const SHIELD_EDGE_OPACITY = 0.85;  // 护盾边缘线透明度
const SHIELD_MAX_HP = 100;  // 护盾最大生命值
const SHIELD_REGEN_PER_SEC = 2;  // 护盾每秒恢复血量
const SHIELD_LOW_HP_THRESHOLD = 50;  // 护盾低于此值无法切换至护盾武器
// 地图主题：房主在主菜单选择
const MAP_THEMES = {
    grassland: { name: '草原', floor: 0x5e8c4f, grid: 0x446644, sky: 0x87ceeb, grassBase: 0x2f5f2a, grassBlade: 0x4b9f40, water: 0x1c4bd6, waterRim: 0x2b6d2f, rock: 0x777777, building: 0x5c636f, buildingTop: 0x3a4049, grassCount: 1 },
    desert: { name: '沙漠', floor: 0xd4a574, grid: 0xb8956a, sky: 0xffd4a3, grassBase: 0x8b7355, grassBlade: 0xa08060, water: 0x2a7dd4, waterRim: 0x6b8e6b, rock: 0x9a7b5a, building: 0xc4a574, buildingTop: 0xa08050, grassCount: 0.3 },
    jungle: { name: '丛林', floor: 0x2d5a27, grid: 0x1e4a1a, sky: 0x4a7c59, grassBase: 0x1e4a1a, grassBlade: 0x3d7a35, water: 0x1a3d5c, waterRim: 0x2d5a27, rock: 0x4a4a4a, building: 0x3d4a3d, buildingTop: 0x2d3a2d, grassCount: 1.5, treeTrunk: 0x4a3728, treeFoliage: 0x2d5a27, treeFoliageLight: 0x3d7a35 },
    volcano: { name: '火山', floor: 0x3d3535, grid: 0x2a2222, sky: 0x4a3030, grassBase: 0x2a2020, grassBlade: 0x3d2828, water: 0xff4400, waterRim: 0x8b2500, rock: 0x2a2a2a, building: 0x3d3535, buildingTop: 0x2a2222, grassCount: 0 }
};
const MAP_IDS = Object.keys(MAP_THEMES);

// 火山地图岩浆：可进入，每秒伤害与灼烧视觉效果
const LAVA_DAMAGE_PER_SEC = 10;
const LAVA_BURN_COLOR = 0xff4400;

// 炮台灵敏度：5 档，最低 0.2 最高 2.0
const TURRET_SENSITIVITY_LEVELS = [0.2, 0.5, 1.0, 1.5, 2.0];
const TURRET_SENSITIVITY_LABELS = ['极低', '低', '中', '高', '极高'];

// 支持 2–4 人联机时的角色键列表
const PLAYER_KEYS = ['p1', 'p2', 'p3', 'p4'];

// 默认坦克名称（可自定义覆盖）
const DEFAULT_TANK_NAMES = { p1: '蓝色坦克', p2: '红色坦克', p3: '绿色坦克', p4: '黄色坦克' };

const ACTION_LABELS = {
    forward: '前进',
    backward: '后退',
    left: '左转',
    right: '右转',
    turretLeft: '炮台左转',
    turretRight: '炮台右转',
    turretSensitivityUp: '炮台灵敏度+',
    turretSensitivityDown: '炮台灵敏度-',
    fire: '开火',
    weaponSwitch: '切换武器',
    weapon1: '武器1-机枪',
    weapon2: '武器2-狙击炮',
    weapon3: '武器3-霰弹炮',
    weapon4: '武器4-冰冻炮',
    weapon5: '武器5-剧毒炮',
    weapon6: '武器6-致盲弹',
    weapon7: '武器7-护盾',
    weapon8: '武器8-穿甲炮',
    weapon9: '武器9-球状闪电',
    scope: '瞄准镜',
    mine: '地雷',
    turretLock: '炮台锁定车身'
};

const DEFAULT_KEYS = {
    forward: 'KeyW',
    backward: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    turretLeft: 'ArrowLeft',
    turretRight: 'ArrowRight',
    turretSensitivityUp: 'ArrowUp',
    turretSensitivityDown: 'ArrowDown',
    fire: 'Space',
    weaponSwitch: 'KeyQ',
    weapon1: 'Digit1',
    weapon2: 'Digit2',
    weapon3: 'Digit3',
    weapon4: 'Digit4',
    weapon5: 'Digit5',
    weapon6: 'Digit6',
    weapon7: 'Digit7',
    weapon8: 'Digit8',
    weapon9: 'Digit9',
    scope: 'KeyE',
    mine: 'KeyZ',
    turretLock: 'KeyB'
};

// 武器顺序，对应数字键 1-9
const WEAPON_ORDER = ['mg', 'cannon', 'shotgun', 'emgun', 'toxic', 'blindgun', 'shield', 'apcannon', 'balllightning'];
// 基础武器：所有人开局可用
const BASE_WEAPONS = ['mg', 'cannon', 'shotgun'];
// 高级武器：需拾取武器箱随机解锁
const PREMIUM_WEAPONS = ['emgun', 'toxic', 'blindgun', 'shield', 'apcannon', 'balllightning'];

const WEAPONS = {
    mg:      { name: '机枪',   dmg: 1.2, cd: 35,   speed: 120, color: 0xff4400, size: 0.15 },
    cannon:  { name: '狙击炮', dmg: 33,  cd: 2000,  speed: 550,  color: 0xffaa00, size: 0.1  },
    shotgun: { name: '霰弹炮', dmg: 2.5,   cd: 1000, speed: 200,  color: 0x00ff88, size: 0.05, pelletCount: 15 },
    emgun:   { name: '冰冻炮', dmg: 4.5,   cd: 500,  speed: 200, color: 0x0088ff, size: 0.3, stunDuration: 300 },
    toxic:   { name: '剧毒炮', dmg: 2,   cd: 400,  speed: 120, color: 0x6600aa, size: 0.3, dotDurationPerHit: 2000, dotMaxDuration: 10000, dotDps: 4, poisonVisualColor: 0x8800ff },
    blindgun:{ name: '致盲弹', dmg: 3,   cd: 2000,  speed: 200, color: 0xf2f2f2, size: 0.12, blindDuration: 6000, blindVisionRadius: 35 },
    shield:   { name: '护盾',   dmg: 0,   cd: 99999, speed: 0,   color: 0x88ccff, size: 0.5 },
    apcannon: { name: '穿甲炮', dmg: 5, cd: 2500, speed: 950, color: 0xcccc00, size: 0.2,
        piercingSpeed: 1, piercingDmgPerTick: 1, piercingDamageTickMs: 100,
        slowDurationMs: 700, slowMult: 0.05 },
    balllightning: { name: '球状闪电', dmg: 1.2, cd: 3500, speed: 20, color: 0xffff88, size: 0.8,
        durationMs: 5500, damageRadius: 20, damageTickMs: 150,
        slowDurationMs: 2000, slowMult: 0.25 }
};

export {
    MAP_HALF, TANK_RADIUS, MINE_RADIUS, MINE_DAMAGE, MINE_COOLDOWN,
    MAP_THEMES, MAP_IDS,
    WEAPON_ORDER, BASE_WEAPONS, PREMIUM_WEAPONS,
    DOUBLE_TAP_MS, BOOST_DURATION, BOOST_MULTIPLIER,
    STAMINA_MAX, STAMINA_REGEN_PER_SEC, STAMINA_DRAIN_PER_SEC, STAMINA_MIN_TO_START_BOOST,
    STAMINA_BOOST_MAX_DURATION_MS, STAMINA_BOOST_COOLDOWN_MS,
    COLLISION_DAMAGE, COLLISION_DAMAGE_CD, POISON_DURATION, MAX_RADIUS,
    HEALTH_PACK_REGEN_TOTAL, HEALTH_PACK_REGEN_DURATION, HEALTH_PACK_REGEN_RATE, HEALTH_PACK_RESPAWN,
    WEAPON_BOX_RESPAWN,
    MINIMAP_RADIUS,
    MG_SPREAD_ANGLE, CANNON_SPREAD_ANGLE, SHOTGUN_SPREAD_ANGLE,
    SCOPE_FOV, NORMAL_FOV, SCOPE_SPEED_MULT, SCOPE_TURN_MULT, MOUSE_TURRET_SENSITIVITY,
    SATELLITE_TARGET_SPEED, SATELLITE_RADIUS, SATELLITE_DAMAGE, SATELLITE_WARNING_MS, SATELLITE_EFFECT_MS, SATELLITE_RESPAWN,
    SHIELD_RADIUS, SHIELD_OFFSET_FORWARD, SHIELD_OFFSET_Y, SHIELD_HIT_MARGIN, SHIELD_OPACITY, SHIELD_OUTLINE_OPACITY, SHIELD_EDGE_OPACITY,
    SHIELD_MAX_HP, SHIELD_REGEN_PER_SEC, SHIELD_LOW_HP_THRESHOLD,
    LAVA_DAMAGE_PER_SEC, LAVA_BURN_COLOR,
    TURRET_SENSITIVITY_LEVELS, TURRET_SENSITIVITY_LABELS,
    PLAYER_KEYS, DEFAULT_TANK_NAMES, ACTION_LABELS, DEFAULT_KEYS, WEAPONS
};
