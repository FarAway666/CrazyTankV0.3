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
const STAMINA_MAX = 100;
const STAMINA_REGEN_PER_SEC = 3;
const STAMINA_DRAIN_PER_SEC = 20;
const STAMINA_MIN_TO_START_BOOST = 15;
const COLLISION_DAMAGE = 5;
const COLLISION_DAMAGE_CD = 1000;
const POISON_DURATION = 150;
const MAX_RADIUS = Math.sqrt(MAP_HALF * MAP_HALF + MAP_HALF * MAP_HALF);
const HEALTH_PACK_REGEN_TOTAL = 30;
const HEALTH_PACK_REGEN_DURATION = 6;
const HEALTH_PACK_REGEN_RATE = HEALTH_PACK_REGEN_TOTAL / HEALTH_PACK_REGEN_DURATION;
const HEALTH_PACK_RESPAWN = 15000;
const MINIMAP_RADIUS = 92;
const MG_SPREAD_ANGLE = 10 * Math.PI / 180;
const CANNON_SPREAD_ANGLE = 5 * Math.PI / 180;
const SHOTGUN_SPREAD_ANGLE = 20 * Math.PI / 180;
const SCOPE_FOV = 30;
const NORMAL_FOV = 60;
const SCOPE_SPEED_MULT = 0.3;
const SCOPE_TURN_MULT = 0.2;
const SATELLITE_TARGET_SPEED = 40;
const SATELLITE_RADIUS = 10;
const SATELLITE_DAMAGE = 75;
const SATELLITE_WARNING_MS = 1000;
const SATELLITE_EFFECT_MS = 1500;
const SATELLITE_RESPAWN = 30000;
// 支持 2–4 人联机时的角色键列表
const PLAYER_KEYS = ['p1', 'p2', 'p3', 'p4'];

const ACTION_LABELS = {
    forward: '前进',
    backward: '后退',
    left: '左转',
    right: '右转',
    turretLeft: '炮台左转',
    turretRight: '炮台右转',
    fire: '开火',
    weaponSwitch: '切换武器',
    scope: '瞄准镜',
    mine: '地雷'
};

const DEFAULT_KEYS = {
    forward: 'KeyW',
    backward: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    turretLeft: 'ArrowLeft',
    turretRight: 'ArrowRight',
    fire: 'Space',
    weaponSwitch: 'KeyQ',
    scope: 'KeyE',
    mine: 'KeyZ'
};

const WEAPONS = {
    mg:      { name: '机枪',   dmg: 1.2, cd: 35,   speed: 120, color: 0xff4400, size: 0.15 },
    cannon:  { name: '狙击炮', dmg: 35,  cd: 2000,  speed: 550,  color: 0xffaa00, size: 0.1  },
    shotgun: { name: '霰弹炮', dmg: 2.5,   cd: 1000, speed: 200,  color: 0x00ff88, size: 0.05, pelletCount: 15 },
    emgun:   { name: '冰冻炮', dmg: 4.5,   cd: 500,  speed: 200, color: 0x0088ff, size: 0.3, stunDuration: 300 },
    toxic:   { name: '剧毒炮', dmg: 2,   cd: 400,  speed: 120, color: 0x6600aa, size: 0.3, dotDurationPerHit: 2000, dotMaxDuration: 10000, dotDps: 4, poisonVisualColor: 0x8800ff },
    blindgun:{ name: '致盲弹', dmg: 3,   cd: 2000,  speed: 200, color: 0xf2f2f2, size: 0.12, blindDuration: 4000, blindVisionRadius: 35 }
};

export {
    MAP_HALF, TANK_RADIUS, MINE_RADIUS, MINE_DAMAGE, MINE_COOLDOWN,
    DOUBLE_TAP_MS, BOOST_DURATION, BOOST_MULTIPLIER,
    STAMINA_MAX, STAMINA_REGEN_PER_SEC, STAMINA_DRAIN_PER_SEC, STAMINA_MIN_TO_START_BOOST,
    COLLISION_DAMAGE, COLLISION_DAMAGE_CD, POISON_DURATION, MAX_RADIUS,
    HEALTH_PACK_REGEN_TOTAL, HEALTH_PACK_REGEN_DURATION, HEALTH_PACK_REGEN_RATE, HEALTH_PACK_RESPAWN,
    MINIMAP_RADIUS,
    MG_SPREAD_ANGLE, CANNON_SPREAD_ANGLE, SHOTGUN_SPREAD_ANGLE,
    SCOPE_FOV, NORMAL_FOV, SCOPE_SPEED_MULT, SCOPE_TURN_MULT,
    SATELLITE_TARGET_SPEED, SATELLITE_RADIUS, SATELLITE_DAMAGE, SATELLITE_WARNING_MS, SATELLITE_EFFECT_MS, SATELLITE_RESPAWN,
    PLAYER_KEYS, ACTION_LABELS, DEFAULT_KEYS, WEAPONS
};
