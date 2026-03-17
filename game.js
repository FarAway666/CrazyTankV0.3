import * as THREE from 'three';
import {
    MAP_HALF, TANK_RADIUS, MINE_RADIUS, MINE_DAMAGE, MINE_COOLDOWN,
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
    MAP_THEMES, MAP_IDS,
    PLAYER_KEYS, DEFAULT_TANK_NAMES, ACTION_LABELS, DEFAULT_KEYS, WEAPONS, WEAPON_ORDER, BASE_WEAPONS, PREMIUM_WEAPONS,
    SHIELD_RADIUS, SHIELD_OFFSET_FORWARD, SHIELD_OFFSET_Y, SHIELD_HIT_MARGIN,
    SHIELD_OPACITY, SHIELD_OUTLINE_OPACITY, SHIELD_EDGE_OPACITY,
    SHIELD_MAX_HP, SHIELD_REGEN_PER_SEC, SHIELD_LOW_HP_THRESHOLD,
    LAVA_DAMAGE_PER_SEC, LAVA_BURN_COLOR,
    TURRET_SENSITIVITY_LEVELS, TURRET_SENSITIVITY_LABELS
} from './game-const.js';
import { createMobileAdaptationContext, getAdaptiveViewportSize } from './mobile-adaptation.js';
import { createMobileInputController } from './mobile-runtime.js';

        const socket = typeof io !== 'undefined' ? io() : window.io();

        function layoutHudForRole() {
            const ids = { p1: 'hud-p1', p2: 'hud-p2', p3: 'hud-p3', p4: 'hud-p4' };
            const allEls = ['hud-p1', 'hud-p2', 'hud-p3', 'hud-p4']
                .map(id => document.getElementById(id))
                .filter(Boolean);
            allEls.forEach(el => {
                el.classList.remove('hud-self', 'hud-other-1', 'hud-other-2', 'hud-other-3');
            });
            const selfId = ids[myRole];
            const others = PLAYER_KEYS.filter(r => r !== myRole);
            const selfEl = document.getElementById(selfId);
            const other1El = others[0] ? document.getElementById(ids[others[0]]) : null;
            const other2El = others[1] ? document.getElementById(ids[others[1]]) : null;
            const other3El = others[2] ? document.getElementById(ids[others[2]]) : null;
            if (selfEl) selfEl.classList.add('hud-self');
            if (other1El) other1El.classList.add('hud-other-1');
            if (other2El) other2El.classList.add('hud-other-2');
            if (other3El) other3El.classList.add('hud-other-3');

            // 体力条：只显示在自己的 HUD 下方
            if (staminaWrapEl) {
                if (selfEl) {
                    selfEl.appendChild(staminaWrapEl);
                    staminaWrapEl.style.display = 'block';
                } else {
                    staminaWrapEl.style.display = 'none';
                }
            }
            updateTankNameDisplays();
            updateScoreboardUI();
            updatePlayerStatusUI();
        }

        // 服务器分配本机身份（p1 / p2 / p3 / p4），用于确定自己控制哪一方、摄像机视角以及 UI 显示
        socket.on('assign_role', (role) => {
            myRole = role;
            console.log('assigned role:', myRole);

            const roleAssignModal = document.getElementById('role-assign-modal');
            const roleAssignTitle = document.getElementById('role-assign-title');
            const roleAssignName = document.getElementById('role-assign-name');
            if (roleAssignModal && roleAssignTitle && roleAssignName) {
                const roleName = DEFAULT_TANK_NAMES[role] || role.toUpperCase();
                roleAssignTitle.innerHTML = `你被分配至 <span class="${role}-color">${roleName}</span>`;
                roleAssignName.value = (serverNames[role] || customTankNames[role] || '').trim();
                roleAssignName.placeholder = '输入名称';
                roleAssignModal.classList.add('open');
                roleAssignName.focus();
            }

            // 所有游戏规则开关仅由主机（P1）生效；
            // 非主机仍然可以“准备/打开设置/打开键位”，但不能改动具体规则开关。
            if (myRole !== 'p1') {
                // 主菜单按钮保持可用
                const allowIds = new Set(['ready-btn', 'start-game-btn', 'open-settings', 'open-keybind']);
                document.querySelectorAll('.toggle-btn').forEach(btn => {
                    if (allowIds.has(btn.id)) return;
                    btn.disabled = true;
                });
                // 设置面板内的规则开关禁用（输入框也禁用）
                document.querySelectorAll('#settings-modal .toggle-btn').forEach(btn => {
                    btn.disabled = true;
                });
                const buildingCountInput = document.getElementById('building-count');
                if (buildingCountInput) buildingCountInput.disabled = true;
                const mapSelect = document.getElementById('map-select');
                if (mapSelect) mapSelect.disabled = true;
            }

            layoutHudForRole();
        });

        socket.on('player_names_update', (data) => {
            if (!data) return;
            if (data.names && typeof data.names === 'object') {
                for (const role of PLAYER_KEYS) {
                    const n = (data.names[role] && String(data.names[role]).trim()) || '';
                    if (n) serverNames[role] = n;
                    else delete serverNames[role];
                }
            } else if (data.role) {
                const name = (data.name && String(data.name).trim()) || '';
                if (name) serverNames[data.role] = name;
                else delete serverNames[data.role];
            }
            updateTankNameDisplays();
            updateScoreboardUI();
            updatePlayerStatusUI();
        });

        socket.on('player_names_sync', (data) => {
            if (!data || !data.names || typeof data.names !== 'object') return;
            for (const role of PLAYER_KEYS) {
                const n = (data.names[role] && String(data.names[role]).trim()) || '';
                if (n) serverNames[role] = n;
                else delete serverNames[role];
            }
            updateTankNameDisplays();
            updateScoreboardUI();
            updatePlayerStatusUI();
        });

        // 告知当前房间已有的在线角色，用于初始化 HUD 可见性
        socket.on('current_players', (data) => {
            if (!data || !Array.isArray(data.roles)) return;
            activeRoles = data.roles.filter(r => PLAYER_KEYS.includes(r));
            for (const role of PLAYER_KEYS) {
                const hud = document.getElementById(`hud-${role}`);
                if (hud) {
                    hud.style.display = activeRoles.includes(role) ? 'block' : 'none';
                }
            }
            updatePlayerStatusUI();
            updateScoreboardUI();
        });

        // 进草状态由对方广播，保证任意玩家进草时其他所有视角都半透明（不依赖各端草地布局一致）
        socket.on('grass_state', (data) => {
            if (!data || !data.role || data.role === myRole) return;
            const role = data.role;
            if (!players[role] || !players[role].mesh) return;
            players[role].inGrass = !!data.inGrass;
            setTankVisibilityForOpponent(role, !data.inGrass);
        });

        socket.on('enemy_stunned', (data) => {
            if (!data || !data.role || data.durationMs == null) return;
            players[data.role].stunEndTime = Date.now() + data.durationMs;
        });

        socket.on('poison_add', (data) => {
            if (!data || !data.role || data.poisonEndAt == null) return;
            if (!WEAPONS.toxic) return;
            const p = players[data.role];
            if (!p) return;
            // 兼容不同设备时钟偏差，避免收到已过期时间导致中毒不掉血
            const now = Date.now();
            const minPoisonMs = WEAPONS.toxic.dotDurationPerHit ?? 2000;
            p.poisonEndTime = Math.max(Number(data.poisonEndAt) || 0, now + minPoisonMs);
        });

        let keyBindings = {
            p1: { ...DEFAULT_KEYS },
            p2: { ...DEFAULT_KEYS },
            p3: { ...DEFAULT_KEYS },
            p4: { ...DEFAULT_KEYS }
        };

        // 炮台灵敏度（仅本机生效，5 档：0.2/0.5/1.0/1.5/2.0）
        let localTurretSensitivityLevel = 2;
        // 炮台锁定车身（仅本机生效）
        let localTurretLocked = false;

        const scene = new THREE.Scene();
        let SKY_BG_COLOR = new THREE.Color(0x87CEEB);
        const BLIND_BG_COLOR = new THREE.Color(0x000000);
        scene.background = SKY_BG_COLOR;

        const mobileCtx = createMobileAdaptationContext();
        const { getRenderPixelRatio, shouldSkipMinimapDraw, isTouchDevice, shouldMuteFireSfx } = mobileCtx;
        if (isTouchDevice) {
            document.body.classList.add('touch-device');
            document.documentElement.classList.add('touch-device');
        }
        let lastMinimapDrawAt = 0;

        const renderer = new THREE.WebGLRenderer({
            antialias: !isTouchDevice,
            powerPreference: isTouchDevice ? 'low-power' : 'default'
        });
        const vp = getAdaptiveViewportSize();
        renderer.setSize(vp.width, vp.height);
        renderer.setPixelRatio(getRenderPixelRatio());
        renderer.setScissorTest(true);
        renderer.shadowMap.enabled = true;
        if (isTouchDevice) {
            renderer.shadowMap.type = THREE.BasicShadowMap;
        }
        const gameCanvas = renderer.domElement;
        gameCanvas.id = 'game-canvas';
        gameCanvas.style.cursor = 'pointer';
        document.body.appendChild(gameCanvas);

        const minimapCanvas = document.getElementById('minimap-canvas');
        const minimapCtx = minimapCanvas.getContext('2d');
        const scopeCanvas = document.getElementById('scope-canvas');
        const scopeCtx = scopeCanvas.getContext('2d');
        const blindOverlayCanvas = document.getElementById('blind-overlay');
        const blindOverlayCtx = blindOverlayCanvas ? blindOverlayCanvas.getContext('2d') : null;
        const AUDIO_FILES = {
            sniperFire: '狙击炮.mp3',
            mgFire: '机枪.mp3',
            shotgunFire: '霰弹炮.mp3',
            cannonCooldown: '狙击炮冷却时.mp3',
            freezeFire: '冰冻炮.mp3',
            toxicFire: '剧毒炮.mp3',
            blindFire: '致盲弹.mp3',
            blindStatus: '致盲音效.mp3',
            satelliteExplosion: '卫星轨道炮爆炸.mp3',
            pickupSatellite: '拾取卫星轨道炮.mp3',
            pickupHealth: '拾取血包.mp3',
            hit: '被击中.mp3',
            lowHp: '低血量.mp3',
            deathExplosion: '死亡爆炸.mp3',
            nearMiss: '子弹距离自己很近但未命中.mp3',
            shieldHit: '护盾被击中.mp3',
            shieldBreak: '护盾被击破.mp3',
            shieldSwitch: '切换至护盾.mp3',
            balllightningFire: '球状闪电.mp3',
            balllightningHit: '被球状闪电击中.mp3'
        };
        const sfxPool = {};
        const sfxLastPlayAt = {};
        const sfxStopTimers = {};
        let audioUnlocked = false;
        let lowHpLooping = false;
        let blindStatusLooping = false;

        function initAudioPool() {
            if (isTouchDevice) return;
            for (const [key, filename] of Object.entries(AUDIO_FILES)) {
                const audio = new Audio(`/.radio/${encodeURIComponent(filename)}`);
                audio.preload = 'auto';
                if (key === 'lowHp') audio.loop = true;
                if (key === 'blindStatus') audio.loop = true;
                sfxPool[key] = audio;
            }
        }

        function unlockAudioOnce() {
            if (audioUnlocked) return;
            audioUnlocked = true;
            for (const audio of Object.values(sfxPool)) {
                audio.muted = true;
                const p = audio.play();
                if (p && typeof p.then === 'function') {
                    p.then(() => {
                        audio.pause();
                        audio.currentTime = 0;
                        audio.muted = false;
                    }).catch(() => {
                        audio.muted = false;
                    });
                } else {
                    audio.muted = false;
                }
            }
            window.removeEventListener('pointerdown', unlockAudioOnce);
            window.removeEventListener('keydown', unlockAudioOnce);
            window.removeEventListener('touchstart', unlockAudioOnce);
        }

        function playSfx(key, { volume = 0.8, cooldownMs = 0 } = {}) {
            if (shouldMuteFireSfx && shouldMuteFireSfx(key)) return;
            const audio = sfxPool[key];
            if (!audio) return;
            if (isLocalBlinded() && key !== 'blindStatus') return;
            const now = Date.now();
            const lastAt = sfxLastPlayAt[key] || 0;
            if (cooldownMs > 0 && now - lastAt < cooldownMs) return;
            sfxLastPlayAt[key] = now;
            audio.volume = Math.max(0, Math.min(1, volume));
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }

        function playSfxFixedWindow(key, { volume = 0.8, cooldownMs = 0, durationMs = 1000 } = {}) {
            if (shouldMuteFireSfx && shouldMuteFireSfx(key)) return;
            const audio = sfxPool[key];
            if (!audio) return;
            if (isLocalBlinded() && key !== 'blindStatus') return;
            const now = Date.now();
            const lastAt = sfxLastPlayAt[key] || 0;
            if (cooldownMs > 0 && now - lastAt < cooldownMs) return;
            sfxLastPlayAt[key] = now;
            audio.volume = Math.max(0, Math.min(1, volume));
            audio.currentTime = 0;
            audio.play().catch(() => {});
            if (sfxStopTimers[key]) {
                clearTimeout(sfxStopTimers[key]);
                sfxStopTimers[key] = null;
            }
            sfxStopTimers[key] = setTimeout(() => {
                audio.pause();
                audio.currentTime = 0;
                sfxStopTimers[key] = null;
            }, Math.max(50, durationMs));
        }

        function isLocalBlinded() {
            const me = players && players[myRole];
            return !!(me && me.alive && me.blindEndTime && Date.now() < me.blindEndTime);
        }

        function startLowHpLoop() {
            const audio = sfxPool.lowHp;
            if (!audio || lowHpLooping || isLocalBlinded()) return;
            lowHpLooping = true;
            audio.volume = 0.1;
            audio.currentTime = 0;
            audio.play().catch(() => {
                lowHpLooping = false;
            });
        }

        function stopLowHpLoop() {
            const audio = sfxPool.lowHp;
            if (!audio) return;
            lowHpLooping = false;
            audio.pause();
            audio.currentTime = 0;
        }

        function updateLocalLowHpLoop() {
            const me = players[myRole];
            if (!me || !me.alive || me.hp <= 0) {
                stopLowHpLoop();
                return;
            }
            if (isLocalBlinded()) {
                stopLowHpLoop();
                return;
            }
            if (me.hp <= 25) {
                startLowHpLoop();
            } else {
                stopLowHpLoop();
            }
        }

        function startBlindStatusLoop() {
            const audio = sfxPool.blindStatus;
            if (!audio || blindStatusLooping) return;
            blindStatusLooping = true;
            audio.volume = 0.9;
            audio.currentTime = 0;
            audio.play().catch(() => {
                blindStatusLooping = false;
            });
        }

        function stopBlindStatusLoop() {
            const audio = sfxPool.blindStatus;
            if (!audio) return;
            blindStatusLooping = false;
            audio.pause();
            audio.currentTime = 0;
        }

        function updateBlindAudioLoop() {
            if (isLocalBlinded()) {
                stopLowHpLoop();
                startBlindStatusLoop();
            } else {
                stopBlindStatusLoop();
            }
        }

        function playPositionalSfx(key, sourcePos, { minDist = 4, maxDist = 55, baseVolume = 1, cooldownMs = 120 } = {}) {
            const me = players[myRole];
            if (!me || !me.mesh || !sourcePos) return;
            const dx = me.mesh.position.x - sourcePos.x;
            const dz = me.mesh.position.z - sourcePos.z;
            const dist = Math.hypot(dx, dz);
            if (dist > maxDist) return;
            let factor = 1;
            if (dist > minDist) {
                factor = 1 - (dist - minDist) / Math.max(1, maxDist - minDist);
            }
            const volume = Math.max(0, Math.min(1, baseVolume * factor));
            if (volume <= 0.01) return;
            playSfx(key, { volume, cooldownMs });
        }

        initAudioPool();
        if (!isTouchDevice) {
            window.addEventListener('pointerdown', unlockAudioOnce, { once: true });
            window.addEventListener('keydown', unlockAudioOnce, { once: true });
            window.addEventListener('touchstart', unlockAudioOnce, { once: true });
        }

        function getBlindVisionRadiusWorld() {
            if (!WEAPONS.blindgun) return 24;
            const raw = Number(WEAPONS.blindgun.blindVisionRadius);
            return Number.isFinite(raw) ? Math.min(120, Math.max(6, raw)) : 24;
        }

        function restoreBlindWorldState() {
            scene.background = SKY_BG_COLOR;
            floor.visible = true;
            grid.visible = true;
            blindGround.visible = false;
            for (const o of obstacles) o.visible = true;
            for (const p of ponds) p.visible = true;
            for (const b of buildings) b.visible = true;
            for (const g of grassPatches) {
                if (g && g.mesh) g.mesh.visible = true;
            }
            for (const pack of healthPacks) {
                if (pack && pack.mesh) pack.mesh.visible = true;
            }
            for (const box of weaponBoxes) {
                if (box && box.mesh) box.mesh.visible = box.active;
            }
            for (const m of mines) {
                if (m && m.mesh) m.mesh.visible = true;
            }
            for (const b of bullets) {
                if (b && b.mesh) b.mesh.visible = true;
            }
            // 关键修复：致盲结束后恢复各玩家可见性，避免其他坦克偶发保持隐藏
            for (const role of PLAYER_KEYS) {
                const p = players[role];
                if (!p || !p.mesh) continue;
                if (role === myRole) {
                    p.mesh.visible = true;
                    continue;
                }
                p.mesh.visible = !p.inGrass && p.alive && p.hp > 0;
            }
            if (poisonCircle) poisonCircle.visible = true;
            if (satellitePickup && satellitePickup.mesh) satellitePickup.mesh.visible = true;
            for (const box of weaponBoxes) {
                if (box && box.mesh) box.mesh.visible = box.active;
            }
        }

        function updateBlindWorldVisibility(nowMs) {
            const me = players[myRole];
            const blinded = !!(me && me.alive && me.blindEndTime && nowMs < me.blindEndTime);
            if (!blinded || !me || !me.mesh) {
                if (blindWorldApplied) {
                    restoreBlindWorldState();
                    blindWorldApplied = false;
                }
                return;
            }
            blindWorldApplied = true;

            const radius = getBlindVisionRadiusWorld();
            const radiusSq = radius * radius;
            const mx = me.mesh.position.x;
            const mz = me.mesh.position.z;
            const near = (pos) => {
                if (!pos) return false;
                const dx = pos.x - mx;
                const dz = pos.z - mz;
                return (dx * dx + dz * dz) <= radiusSq;
            };

            scene.background = BLIND_BG_COLOR;
            floor.visible = false;
            grid.visible = false;
            blindGround.visible = true;
            blindGround.position.set(mx, 0.03, mz);
            blindGround.scale.set(radius, radius, 1);

            let nearStaticCount = 0;
            for (const o of obstacles) {
                const v = near(o.position);
                o.visible = v;
                if (v) nearStaticCount += 1;
            }
            for (const p of ponds) {
                const v = near(p.position);
                p.visible = v;
                if (v) nearStaticCount += 1;
            }
            for (const b of buildings) {
                const v = near(b.position);
                b.visible = v;
                if (v) nearStaticCount += 1;
            }
            for (const g of grassPatches) {
                if (!g || !g.mesh) continue;
                g.mesh.visible = near(g.mesh.position);
            }
            for (const pack of healthPacks) {
                if (!pack || !pack.mesh) continue;
                pack.mesh.visible = near(pack.mesh.position);
            }
            for (const box of weaponBoxes) {
                if (!box || !box.mesh || !box.active) continue;
                box.mesh.visible = near(box.mesh.position);
            }
            for (const m of mines) {
                if (!m || !m.mesh) continue;
                m.mesh.visible = near(m.mesh.position);
            }
            for (const b of bullets) {
                if (!b || !b.mesh) continue;
                b.mesh.visible = near(b.mesh.position);
            }
            for (const role of PLAYER_KEYS) {
                const p = players[role];
                if (!p || !p.mesh) continue;
                if (role === myRole) {
                    p.mesh.visible = true;
                    continue;
                }
                // 存活：近处可见；死亡尸体：仅近处可见，远处隐藏
                const baseVisible = !p.inGrass && p.alive && p.hp > 0;
                p.mesh.visible = (baseVisible || !p.alive) ? near(p.mesh.position) : false;
            }
            if (poisonCircle) poisonCircle.visible = false;
            if (satellitePickup && satellitePickup.mesh) satellitePickup.mesh.visible = near(satellitePickup.mesh.position);

        }

        const hpFillEls = {
            p1: document.getElementById('p1-hp'),
            p2: document.getElementById('p2-hp'),
            p3: document.getElementById('p3-hp'),
            p4: document.getElementById('p4-hp')
        };
        const hpTextEls = {
            p1: document.getElementById('p1-hp-text'),
            p2: document.getElementById('p2-hp-text'),
            p3: document.getElementById('p3-hp-text'),
            p4: document.getElementById('p4-hp-text')
        };
        const weaponTextEls = {
            p1: document.getElementById('p1-weapon-text'),
            p2: document.getElementById('p2-weapon-text'),
            p3: document.getElementById('p3-weapon-text'),
            p4: document.getElementById('p4-weapon-text')
        };
        const staminaWrapEl = document.getElementById('stamina-wrap');
        const staminaFillEl = document.getElementById('stamina-fill');
        const staminaTextEl = document.getElementById('stamina-text');
        const poisonTimerEl = document.getElementById('poison-timer');
        const readyBtn = document.getElementById('ready-btn');
        const startGameBtn = document.getElementById('start-game-btn');

        const keys = {};
        const prevKeys = {};
        let mouseButton0 = false;  // 鼠标左键按下状态（用于开火）
        const bullets = [];
        const mines = [];
        const explosions = [];
        const damagePopups = [];
        let bulletSeq = 1;
        const SCORE_STORAGE_KEY = 'battle_tank_score_state_v1';
        const TANK_NAMES_STORAGE_KEY = 'battle_tank_names_v1';
        function loadTankNames() {
            try {
                const raw = localStorage.getItem(TANK_NAMES_STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') return parsed;
                }
            } catch {}
            return {};
        }
        function saveTankNames() {
            try {
                localStorage.setItem(TANK_NAMES_STORAGE_KEY, JSON.stringify(customTankNames));
            } catch {}
        }
        let customTankNames = loadTankNames();
        let serverNames = {};

        function loadScoreState() {
            // 计分板每次页面加载都从 0 开始，避免沿用历史缓存
            return { rounds: 0, scores: { p1: 0, p2: 0, p3: 0, p4: 0 } };
        }
        function saveScoreState() {
            try {
                localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(scoreState));
            } catch {}
        }

        let scoreState = loadScoreState();
        let deathOrder = [];
        const playerStatus = {
            p1: { ready: false },
            p2: { ready: false },
            p3: { ready: false },
            p4: { ready: false }
        };
        let lastReadyUpdateSeq = 0;
        const obstacles = [];
        const ponds = [];
        const buildings = [];
        const healthPacks = [];
        const weaponBoxes = [];
        const grassPatches = [];
        let gameStarted = false;
        let collisionDamageEnabled = false;
        let poisonCircleEnabled = false;
        let bulletSpreadEnabled = true;
        let minesEnabled = true;
        let satelliteLaserEnabled = false;
        let unlockAllWeapons = false;
        let poisonCircle = null;
        let satellitePickup = null;
        let poisonStartTime = 0;
        let safeRadius = MAX_RADIUS;
        let lastFrameTime = performance.now();
        let lastNetUpdateTime = 0;
        let rebindingTarget = null;
        let activeRoles = [];
        let mobileBoostHeld = false;
        // 本机玩家身份，由服务器通过 assign_role 事件下发（p1 / p2 / p3）
        let myRole = 'p1';
        // 双方准备状态 & 游戏配置（以主机为准）
        let localReady = false;
        let remoteReady = false;
        let currentConfig = null;
        let currentMapId = 'grassland';
        let blindWorldApplied = false;
        let spectateTargetRole = null;
        let enemyPosHandler = null;
        let enemyFireHandler = null;
        let enemyWeaponSwitchHandler = null;
        let scopeStateHandler = null;
        let enemyHpHandler = null;
        let shieldHitHandler = null;
        let hitSyncHandler = null;
        let satelliteFireHandler = null;
        let satelliteStrikeStartHandler = null;
        let satellitePickupHandler = null;
        let weaponUnlockHandler = null;

        const cam1 = new THREE.PerspectiveCamera(60, (window.innerWidth / 2) / window.innerHeight, 0.1, 500);
        const cam2 = new THREE.PerspectiveCamera(60, (window.innerWidth / 2) / window.innerHeight, 0.1, 500);

        // P1 = 蓝色坦克，P2 = 红色坦克，P3 = 绿色坦克，P4 = 黄色坦克
        const players = {
            p1: createPlayerState(0x00c6ff),
            p2: createPlayerState(0xff512f),
            p3: createPlayerState(0x00ff7f),
            p4: createPlayerState(0xfff000)
        };

        function isLocalRole(role) {
            return role === myRole;
        }

        function isHostRole() {
            return myRole === 'p1';
        }

        function getSpectateCandidates() {
            const roles = (activeRoles && activeRoles.length > 0)
                ? activeRoles.filter(r => PLAYER_KEYS.includes(r))
                : PLAYER_KEYS;
            return roles.filter(role => {
                if (role === myRole) return false;
                const p = players[role];
                return !!(p && p.mesh && p.alive && p.hp > 0);
            });
        }

        function ensureSpectateTargetRole() {
            const candidates = getSpectateCandidates();
            if (candidates.length === 0) {
                spectateTargetRole = null;
                return null;
            }
            if (!spectateTargetRole || !candidates.includes(spectateTargetRole)) {
                spectateTargetRole = candidates[0];
            }
            return spectateTargetRole;
        }

        function cycleSpectateTarget(step) {
            const candidates = getSpectateCandidates();
            if (candidates.length === 0) {
                spectateTargetRole = null;
                return null;
            }
            const current = ensureSpectateTargetRole();
            let idx = candidates.indexOf(current);
            if (idx < 0) idx = 0;
            idx = (idx + step + candidates.length) % candidates.length;
            spectateTargetRole = candidates[idx];
            return spectateTargetRole;
        }


        function createPlayerState(color) {
            return {
                hp: 100,
                alive: true,
                regenRemaining: 0,
                regenPerSecond: 0,
                viewYaw: 0,
                weapon: 'mg',
                color,
                turretMesh: null,
                shieldMesh: null,
                shieldHp: SHIELD_MAX_HP,
                shieldHitT: 0,
                turretYaw: 0, // 炮台相对车身的旋转角度
                mesh: null,
                muzzle: null,
                hitT: 0,
                shake: 0,
                speed: 16,
                stamina: STAMINA_MAX,
                staminaMax: STAMINA_MAX,
                boosting: false,
                boostEndTime: 0,
                boostStartTime: 0,
                boostCooldownUntil: 0,
                lastTapKey: '',
                lastTapTime: 0,
                lastShot: 0,
                lastMineTime: 0,
                lastCollisionDmgTime: 0,
                mgBurstStartAt: 0,
                mgLastShotAt: 0,
                mgOverheatUntil: 0,
                stunEndTime: 0,
                poisonEndTime: 0,
                blindEndTime: 0,
                balllightningSlowEndTime: 0,
                apcannonSlowEndTime: 0,
                inGrass: false,
                scoping: false,
                usingSatellite: false,
                satelliteTarget: { x: 0, z: 0 },
                satelliteFiring: false,
                satelliteFireTime: 0,
                satelliteBeam: null,
                satelliteDamageApplied: false,
                unlockedWeapons: new Set(BASE_WEAPONS)
            };
        }

        function getRoleDisplayName(role) {
            const name = (serverNames[role]?.trim() || customTankNames[role]?.trim() || DEFAULT_TANK_NAMES[role]);
            return name || role.toUpperCase();
        }

        function updateTankNameDisplays() {
            for (const role of PLAYER_KEYS) {
                const el = document.getElementById(`${role}-name`);
                if (el) el.textContent = `${getRoleDisplayName(role)} (${role.toUpperCase()})`;
            }
            const g1 = document.getElementById('guide-p1');
            const g2 = document.getElementById('guide-p2');
            if (g1) g1.textContent = `${getRoleDisplayName('p1')} (P1) 操作`;
            if (g2) g2.textContent = `${getRoleDisplayName('p2')} (P2) 操作`;
        }

        function getMoveKeyCodes(playerKey) {
            const bindings = keyBindings[playerKey];
            return [bindings.forward, bindings.backward, bindings.left, bindings.right];
        }

        function getAllBoundCodes() {
            const all = [];
            PLAYER_KEYS.forEach(playerKey => {
                Object.keys(keyBindings[playerKey]).forEach(action => {
                    all.push(keyBindings[playerKey][action]);
                });
            });
            return all;
        }

        function getReadableKeyName(code) {
            const map = {
                Space: 'Space',
                Enter: 'Enter',
                Quote: '\'',
                Backslash: '\\',
                BracketRight: ']',
                BracketLeft: '[',
                Semicolon: ';',
                Comma: ',',
                Period: '.',
                Slash: '/',
                Minus: '-',
                Equal: '=',
                Backquote: '`',
                Escape: 'Esc',
                ArrowUp: '↑',
                ArrowDown: '↓',
                ArrowLeft: '←',
                ArrowRight: '→'
            };
            if (map[code]) return map[code];
            if (code.startsWith('Key')) return code.slice(3);
            if (code.startsWith('Digit')) return code.slice(5);
            if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
            return code;
        }

        // 查找同一玩家下被占用的按键（不同玩家之间允许使用相同按键）
        function findBindingByCode(code, playerKey) {
            for (const action of Object.keys(keyBindings[playerKey])) {
                if (keyBindings[playerKey][action] === code) {
                    return { playerKey, action };
                }
            }
            return null;
        }

        function setKeybindWarning(message = '') {
            document.getElementById('keybind-warning').textContent = message;
        }

        function renderKeybindUI() {
            const grid = document.getElementById('keybind-grid');
            const rows = ['forward', 'backward', 'left', 'right', 'turretLeft', 'turretRight', 'turretSensitivityUp', 'turretSensitivityDown', 'turretLock', 'fire', 'weaponSwitch', 'weapon1', 'weapon2', 'weapon3', 'weapon4', 'weapon5', 'weapon6', 'weapon7', 'weapon8', 'weapon9', 'scope', 'mine'];
            grid.innerHTML = '';

            const headAction = document.createElement('div');
            headAction.className = 'keybind-head';
            headAction.textContent = '动作';
            grid.appendChild(headAction);

            const headMine = document.createElement('div');
            headMine.className = 'keybind-head';
            const roleLabel = `我的键位（${getRoleDisplayName(myRole)}）`;
            headMine.textContent = roleLabel;
            grid.appendChild(headMine);

            for (const action of rows) {
                const label = document.createElement('div');
                label.className = 'keybind-label';
                label.textContent = ACTION_LABELS[action];
                grid.appendChild(label);

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'keybind-btn';
                btn.dataset.action = action;
                const listening = rebindingTarget && rebindingTarget.action === action;
                if (listening) btn.classList.add('rebinding');
                btn.textContent = listening ? '按下按键...' : getReadableKeyName(keyBindings[myRole][action]);
                btn.addEventListener('click', () => {
                    rebindingTarget = { playerKey: myRole, action };
                    setKeybindWarning(`正在修改 ${getRoleDisplayName(myRole)} 的“${ACTION_LABELS[action]}”键位（只影响自己）...`);
                    renderKeybindUI();
                });
                grid.appendChild(btn);
            }
        }

        function updateControlGuide() {
            const guide = document.getElementById('control-guide');
            guide.innerHTML = `
                <div class="guide-column">
                    <h3 class="p1-color">通用操作说明（所有坦克）</h3>
                    <p>${getReadableKeyName(keyBindings.p1.forward)}/${getReadableKeyName(keyBindings.p1.backward)} - 前进/后退</p>
                    <p>${getReadableKeyName(keyBindings.p1.left)}/${getReadableKeyName(keyBindings.p1.right)} - 左右转向</p>
                    <p>${getReadableKeyName(keyBindings.p1.turretLeft)}/${getReadableKeyName(keyBindings.p1.turretRight)} 或 鼠标 - 炮台转向</p>
                    <p>${getReadableKeyName(keyBindings.p1.turretSensitivityUp)}/${getReadableKeyName(keyBindings.p1.turretSensitivityDown)} - 炮台灵敏度+/-（5档，仅自己）</p>
                    <p>${getReadableKeyName(keyBindings.p1.turretLock)} - 炮台锁定车身（仅自己）</p>
                    <p>${getReadableKeyName(keyBindings.p1.fire)} 或 鼠标左键 - 开火</p>
                    <p>${getReadableKeyName(keyBindings.p1.weaponSwitch)} 或 滚轮 - 循环切换武器</p>
                    <p>1-9 - 直接切换武器（机枪/狙击/霰弹/冰冻/剧毒/致盲/护盾/穿甲炮/球状闪电）</p>
                    <p>${getReadableKeyName(keyBindings.p1.scope)} 或 鼠标右键 - 开关瞄准镜</p>
                    <p>${getReadableKeyName(keyBindings.p1.mine)} - 放置地雷</p>
                    <p>双击方向键 - 加速移动</p>
                </div>
            `;
        }

        function assignBinding(playerKey, action, newCode) {
            const currentCode = keyBindings[playerKey][action];
            if (currentCode === newCode) {
                setKeybindWarning(`“${ACTION_LABELS[action]}”保持为 ${getReadableKeyName(newCode)}。`);
                return;
            }

            const existing = findBindingByCode(newCode, playerKey);
            if (existing) {
                keyBindings[playerKey][existing.action] = currentCode;
                setKeybindWarning(`${getReadableKeyName(newCode)} 已被占用：已与 ${ACTION_LABELS[existing.action]} 自动互换。`);
            } else {
                setKeybindWarning(`已将 ${ACTION_LABELS[action]} 设为 ${getReadableKeyName(newCode)}。`);
            }

            // 只修改当前玩家在本机上的键位，不影响其他玩家
            keyBindings[playerKey][action] = newCode;
            updateControlGuide();
        }

        function isKeyJustPressed(code) {
            return !!keys[code] && !prevKeys[code];
        }

        function clampToMap(value) {
            return THREE.MathUtils.clamp(value, -MAP_HALF, MAP_HALF);
        }

        function shouldPreventDefaultForCode(code) {
            return getAllBoundCodes().includes(code) || code === 'Escape' || code === 'ArrowLeft' || code === 'ArrowRight';
        }

        function isInputFocused() {
            const el = document.activeElement;
            if (!el) return false;
            const tag = el.tagName && el.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return true;
            if (el.isContentEditable) return true;
            return false;
        }

        const floorSize = MAP_HALF * 2;
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(floorSize, floorSize),
            new THREE.MeshStandardMaterial({ color: 0x5e8c4f })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        let grid = new THREE.GridHelper(floorSize, 40, 0x446644, 0x446644);
        scene.add(grid);
        const blindGround = new THREE.Mesh(
            new THREE.CircleGeometry(1, 64),
            new THREE.MeshStandardMaterial({ color: 0x5e8c4f })
        );
        blindGround.rotation.x = -Math.PI / 2;
        blindGround.position.y = 0.03;
        blindGround.receiveShadow = true;
        blindGround.visible = false;
        scene.add(blindGround);

        const ambient = new THREE.AmbientLight(0xffffff, 0.85);
        ambient.layers.enableAll();
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 1.1);
        sun.position.set(30, 50, 30);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.layers.enableAll();
        scene.add(sun);

        function createTank(color) {
            const group = new THREE.Group();
            const turretGroup = new THREE.Group();
            const bodyMat = new THREE.MeshStandardMaterial({ color, emissive: 0x000000 });
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 });
            const gunMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000 });

            const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 2.8), bodyMat);
            body.position.y = 0.4;
            body.castShadow = true;
            body.receiveShadow = true;

            const turret = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.4), darkMat);
            turret.position.y = 1.1;
            turret.castShadow = true;

            const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 12), gunMat);
            gun.rotation.x = Math.PI / 2;
            gun.position.set(0, 1.1, -1.2);
            gun.castShadow = true;

            const muzzle = new THREE.Object3D();
            muzzle.position.set(0, 0.0, -1.2);
            gun.add(muzzle);

            const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 16), darkMat);
            hatch.position.set(0, 1.45, 0.1);
            hatch.castShadow = true;

            // 护盾模型：半透明半球 + 描边，置于炮台前方
            const shieldColor = WEAPONS.shield ? WEAPONS.shield.color : 0x88ccff;
            const shieldMat = new THREE.MeshBasicMaterial({
                color: shieldColor,
                transparent: true,
                opacity: SHIELD_OPACITY,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const shieldGeo = new THREE.SphereGeometry(SHIELD_RADIUS, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
            const shieldGroup = new THREE.Group();
            shieldGroup.rotation.x = -Math.PI / 2;
            shieldGroup.rotation.y = Math.PI;
            // 【修改护盾位置】在此修改护盾视觉位置，需与 game-const.js 中 SHIELD_OFFSET_FORWARD、SHIELD_OFFSET_Y 保持一致
            shieldGroup.position.set(0, SHIELD_OFFSET_Y, -SHIELD_OFFSET_FORWARD);
            shieldGroup.visible = false;
            const shieldOutlineMat = new THREE.MeshBasicMaterial({
                color: 0x2266aa,
                transparent: true,
                opacity: SHIELD_OUTLINE_OPACITY,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const shieldOutline = new THREE.Mesh(shieldGeo.clone(), shieldOutlineMat);
            shieldOutline.scale.setScalar(1.04);
            shieldOutline.renderOrder = -1;
            shieldGroup.add(shieldOutline);
            const shieldMain = new THREE.Mesh(shieldGeo, shieldMat);
            shieldGroup.add(shieldMain);
            shieldGroup.userData.mainMesh = shieldMain;
            const shieldEdges = new THREE.LineSegments(
                new THREE.EdgesGeometry(shieldGeo, 20),
                new THREE.LineBasicMaterial({ color: 0x66aaff, transparent: true, opacity: SHIELD_EDGE_OPACITY })
            );
            shieldEdges.renderOrder = 1;
            shieldGroup.add(shieldEdges);
            turretGroup.add(shieldGroup);

            turretGroup.add(turret, gun, hatch);

            // 坦克后方小旗子
            const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8), darkMat);
            flagPole.position.set(0.7, 1, 1);
            flagPole.castShadow = true;
            const flagMat = new THREE.MeshBasicMaterial({ color: 0xff4444, side: THREE.DoubleSide });
            const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), flagMat);
            flag.position.set(0, 0.4, 0.21);//（x,z,y)
            flag.rotation.y = Math.PI / 2;
            flagPole.add(flag);
            group.add(flagPole);
            group.add(body, turretGroup);
            scene.add(group);
            return { group, muzzle, turretGroup, shieldMesh: shieldGroup };
        }

        // 坦克层分配（保留为空函数，隐身改用透明度方式）
        function assignTankLayers(playerKey) {}

        function setTankVisibilityForOpponent(playerKey, visibleToOpponent) {
            const mesh = players[playerKey] && players[playerKey].mesh;
            if (!mesh) return;
            mesh.traverse(obj => {
                if (obj.material) {
                    if (!obj.userData.originalMaterial) obj.userData.originalMaterial = obj.material;
                    obj.userData.stealthed = !visibleToOpponent;
                }
            });
        }

        // 进草隐身：用 MeshBasicMaterial 半透明替代原材质，保证各端都能看到半透明
        function applyStealthForCamera(viewerKey) {
            for (const role of PLAYER_KEYS) {
                const player = players[role];
                if (!player || !player.mesh) continue;
                const isSelf = role === viewerKey;
                player.mesh.traverse(obj => {
                    const orig = obj.userData.originalMaterial;
                    if (!orig) {
                        if (obj.material) obj.userData.originalMaterial = obj.material;
                        return;
                    }
                    if (isSelf) {
                        if (obj.material !== orig) {
                            if (obj.userData.stealthMaterial) obj.userData.stealthMaterial.dispose();
                            obj.material = orig;
                        }
                        obj.renderOrder = 0;
                        return;
                    }
                    if (obj.userData.stealthed) {
                        if (!obj.userData.stealthMaterial) {
                            const c = orig.color ? orig.color.getHex() : 0x888888;
                            obj.userData.stealthMaterial = new THREE.MeshBasicMaterial({
                                color: c,
                                transparent: true,
                                opacity: 0.35,
                                depthWrite: false,
                                depthTest: true
                            });
                        }
                        if (obj.material !== obj.userData.stealthMaterial) obj.material = obj.userData.stealthMaterial;
                        obj.renderOrder = 10;
                    } else {
                        if (obj.material !== orig) obj.material = orig;
                        obj.renderOrder = 0;
                    }
                });
            }
        }

        // 简单固定种子的伪随机数，用于双方生成完全一致的地图元素
        let worldSeed = 123456;
        function rand() {
            // 线性同余生成器
            worldSeed = (worldSeed * 1664525 + 1013904223) >>> 0;
            return worldSeed / 0xffffffff;
        }

        function createRock(geometry, material) {
            const rock = new THREE.Mesh(geometry, material);
            rock.position.set((rand() - 0.5) * (MAP_HALF * 1.5), 1.2, (rand() - 0.5) * (MAP_HALF * 1.5));
            rock.rotation.set(rand(), rand(), rand());
            rock.scale.set(1 + rand(), 0.5 + rand(), 1 + rand());
            rock.castShadow = true;
            rock.receiveShadow = true;
            rock.userData.isObstacle = true;
            rock.userData.collisionRadius = rock.scale.x * 2;
            return rock;
        }

        function isTooCloseToExistingRock(x, z, extra = 0) {
            return obstacles.some(rock => {
                const dx = x - rock.position.x;
                const dz = z - rock.position.z;
                return Math.hypot(dx, dz) < rock.userData.collisionRadius + extra;
            });
        }

        function isTooCloseToExistingPond(x, z, extra = 0) {
            return ponds.some(pond => {
                const dx = x - pond.position.x;
                const dz = z - pond.position.z;
                return Math.hypot(dx, dz) < pond.userData.collisionRadius + extra;
            });
        }

        function isPlayerInLava(playerKey) {
            if (currentMapId !== 'volcano') return false;
            const player = players[playerKey];
            if (!player?.mesh) return false;
            const x = player.mesh.position.x, z = player.mesh.position.z;
            return ponds.some(pond => {
                const dx = x - pond.position.x;
                const dz = z - pond.position.z;
                return Math.hypot(dx, dz) < (pond.userData.collisionRadius || 0);
            });
        }

        function isTooCloseToExistingBuilding(x, z, extra = 0) {
            return buildings.some(b => {
                const dx = x - b.position.x;
                const dz = z - b.position.z;
                return Math.hypot(dx, dz) < b.userData.collisionRadius + extra;
            });
        }

        function createPond(radius, theme) {
            const t = theme || MAP_THEMES.grassland;
            const group = new THREE.Group();
            const water = new THREE.Mesh(
                new THREE.CircleGeometry(radius, 48),
                new THREE.MeshStandardMaterial({
                    color: t.water,
                    roughness: 0.25,
                    metalness: 0.05,
                    transparent: true,
                    opacity: 0.75
                })
            );
            water.rotation.x = -Math.PI / 2;
            water.position.y = 0.06;
            water.receiveShadow = true;
            group.add(water);

            const rim = new THREE.Mesh(
                new THREE.RingGeometry(radius * 0.92, radius * 1.06, 52),
                new THREE.MeshStandardMaterial({ color: t.waterRim, roughness: 0.9, metalness: 0 })
            );
            rim.rotation.x = -Math.PI / 2;
            rim.position.y = 0.08;
            rim.receiveShadow = true;
            group.add(rim);

            group.userData.isObstacle = true;
            group.userData.collisionRadius = radius;
            return group;
        }

        function spawnPonds(theme) {
            const targetCount = 2 + Math.floor(rand() * 2); // 2~3 个池塘
            let created = 0;
            let attempts = 0;
            while (created < targetCount && attempts < 200) {
                attempts++;
                const radius = 10 + rand() * 8; // 10~18
                const pos = randomGroundPosition(35);
                if (Math.abs(pos.x) > MAP_HALF * 0.82 || Math.abs(pos.z) > MAP_HALF * 0.82) continue;
                if (Math.hypot(pos.x, pos.z) < 40) continue;
                if (isTooCloseToExistingRock(pos.x, pos.z, radius + 8)) continue;
                if (isTooCloseToExistingPond(pos.x, pos.z, radius + 18)) continue;
                if (grassPatches.some(patch => Math.hypot(pos.x - patch.position.x, pos.z - patch.position.z) < patch.radius + radius + 6)) continue;

                const pond = createPond(radius, theme);
                pond.position.set(pos.x, 0, pos.z);
                scene.add(pond);
                ponds.push(pond);
                created++;
            }
        }

        function createBuilding(sizeX, sizeZ, height, theme) {
            const t = theme || MAP_THEMES.grassland;
            const group = new THREE.Group();
            const base = new THREE.Mesh(
                new THREE.BoxGeometry(sizeX, height, sizeZ),
                new THREE.MeshStandardMaterial({ color: t.building, roughness: 0.85, metalness: 0.05 })
            );
            base.position.y = height / 2;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);

            const top = new THREE.Mesh(
                new THREE.BoxGeometry(sizeX * 0.85, height * 0.18, sizeZ * 0.85),
                new THREE.MeshStandardMaterial({ color: t.buildingTop, roughness: 0.9, metalness: 0.02 })
            );
            top.position.y = height + (height * 0.09);
            top.castShadow = true;
            group.add(top);

            const radius = Math.max(sizeX, sizeZ) * 0.55;
            group.userData.isObstacle = true;
            group.userData.collisionRadius = radius;
            return group;
        }

        function spawnBuildings(countOverride = null, theme) {
            const targetCount = (typeof countOverride === 'number')
                ? Math.max(0, Math.floor(countOverride))
                : (4 + Math.floor(rand() * 4)); // 4~7
            let created = 0;
            let attempts = 0;
            while (created < targetCount && attempts < 400) {
                attempts++;
                const sizeX = 6 + rand() * 6;
                const sizeZ = 6 + rand() * 8;
                const height = 5 + rand() * 6;
                const pos = randomGroundPosition(28);
                if (Math.abs(pos.x) > MAP_HALF * 0.86 || Math.abs(pos.z) > MAP_HALF * 0.86) continue;
                if (Math.hypot(pos.x, pos.z) < 32) continue;
                const radius = Math.max(sizeX, sizeZ) * 0.55;
                if (isTooCloseToExistingRock(pos.x, pos.z, radius + 8)) continue;
                if (isTooCloseToExistingPond(pos.x, pos.z, radius + 10)) continue;
                if (isTooCloseToExistingBuilding(pos.x, pos.z, radius + 10)) continue;

                const b = createBuilding(sizeX, sizeZ, height, theme);
                b.position.set(pos.x, 0, pos.z);
                b.rotation.y = rand() * Math.PI * 2;
                scene.add(b);
                buildings.push(b);
                created++;
            }
        }

        function createTree(scale, x, z, theme) {
            const t = theme || MAP_THEMES.grassland;
            const trunkColor = t.treeTrunk ?? 0x4a3728;
            const foliageColor = t.treeFoliage ?? 0x2d5a27;
            const foliageLight = t.treeFoliageLight ?? 0x3d7a35;
            const group = new THREE.Group();
            const trunkHeight = 4 * scale;
            const trunkRadius = 0.4 * scale;
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(trunkRadius * 1.1, trunkRadius * 1.3, trunkHeight, 8),
                new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9, metalness: 0 })
            );
            trunk.position.y = trunkHeight / 2;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);
            const foliageRadius = 2.2 * scale;
            const foliageHeight = 2.8 * scale;
            const foliage = new THREE.Mesh(
                new THREE.ConeGeometry(foliageRadius, foliageHeight, 10),
                new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.85, metalness: 0 })
            );
            foliage.position.y = trunkHeight;
            foliage.castShadow = true;
            foliage.receiveShadow = true;
            group.add(foliage);
            if (scale > 1.2) {
                const topFoliage = new THREE.Mesh(
                    new THREE.SphereGeometry(foliageRadius * 0.6, 8, 6),
                    new THREE.MeshStandardMaterial({ color: foliageLight, roughness: 0.8, metalness: 0 })
                );
                topFoliage.position.y = trunkHeight + foliageHeight * 0.4;
                topFoliage.castShadow = true;
                group.add(topFoliage);
            }
            group.position.set(x, 0, z);
            group.rotation.y = rand() * Math.PI * 2;
            group.traverse(obj => { obj.castShadow = true; obj.receiveShadow = true; });
            // 树的碰撞/子弹阻挡按树干底部半径，避免地面判定比模型大一圈
            const collisionRadius = trunkRadius * 1.3;
            group.userData.isObstacle = true;
            group.userData.isTree = true;
            group.userData.collisionRadius = collisionRadius;
            return group;
        }

        function spawnTrees(theme) {
            const t = theme || MAP_THEMES.grassland;
            if (!t.treeTrunk) return;
            const count = 35 + Math.floor(rand() * 25);
            let created = 0;
            let attempts = 0;
            while (created < count && attempts < 500) {
                attempts++;
                const scale = 1 + rand() * 4.15;
                const pos = randomGroundPosition(28);
                if (Math.abs(pos.x) > MAP_HALF * 0.88 || Math.abs(pos.z) > MAP_HALF * 0.88) continue;
                if (Math.hypot(pos.x, pos.z) < 30) continue;
                const collisionRadius = 0.4 * scale * 1.3;
                if (isTooCloseToExistingRock(pos.x, pos.z, collisionRadius + 5)) continue;
                if (isTooCloseToExistingPond(pos.x, pos.z, collisionRadius + 8)) continue;
                if (isTooCloseToExistingBuilding(pos.x, pos.z, collisionRadius + 6)) continue;
                const tree = createTree(scale, pos.x, pos.z, theme);
                scene.add(tree);
                obstacles.push(tree);
                created++;
            }
        }

        function spawnRocks(theme) {
            const t = theme || MAP_THEMES.grassland;
            const rockGeo = new THREE.DodecahedronGeometry(2, 0);
            const rockMat = new THREE.MeshStandardMaterial({ color: t.rock });
            let created = 0;
            let attempts = 0;
            while (created < 20 && attempts < 200) {
                attempts++;
                const rock = createRock(rockGeo, rockMat);
                if (Math.hypot(rock.position.x, rock.position.z) < 25) continue;
                if (Math.abs(rock.position.x) > MAP_HALF * 0.88 || Math.abs(rock.position.z) > MAP_HALF * 0.88) continue;
                if (isTooCloseToExistingRock(rock.position.x, rock.position.z, rock.userData.collisionRadius + 4)) continue;
                scene.add(rock);
                obstacles.push(rock);
                created++;
            }
        }

        function randomGroundPosition(minFromCenter = 0) {
            for (let i = 0; i < 400; i++) {
                const x = (rand() - 0.5) * (MAP_HALF * 1.2);
                const z = (rand() - 0.5) * (MAP_HALF * 1.2);
                if (Math.hypot(x, z) < minFromCenter) continue;
                if (Math.abs(x) > MAP_HALF * 0.92 || Math.abs(z) > MAP_HALF * 0.92) continue;
                return { x, z };
            }
            return { x: 0, z: 0 };
        }

        function findSafeSpawnPosition(options = {}) {
            const {
                minFromCenter = 0,
                minRockDistance = 0,
                minGrassDistance = 0,
                minPackDistance = 0,
                minWeaponBoxDistance = 0,
                minTankDistance = 0
            } = options;

            outer: for (let i = 0; i < 600; i++) {
                const pos = randomGroundPosition(minFromCenter);
                if (obstacles.some(rock => Math.hypot(pos.x - rock.position.x, pos.z - rock.position.z) < rock.userData.collisionRadius + minRockDistance)) continue;
                if (ponds.some(obj => Math.hypot(pos.x - obj.position.x, pos.z - obj.position.z) < obj.userData.collisionRadius + minRockDistance)) continue;
                if (buildings.some(obj => Math.hypot(pos.x - obj.position.x, pos.z - obj.position.z) < obj.userData.collisionRadius + minRockDistance)) continue;
                if (grassPatches.some(patch => Math.hypot(pos.x - patch.position.x, pos.z - patch.position.z) < patch.radius + minGrassDistance)) continue;
                if (healthPacks.some(pack => pack.active && Math.hypot(pos.x - pack.mesh.position.x, pos.z - pack.mesh.position.z) < minPackDistance)) continue;
                if (minWeaponBoxDistance > 0 && weaponBoxes.some(box => box.active && Math.hypot(pos.x - box.mesh.position.x, pos.z - box.mesh.position.z) < minWeaponBoxDistance)) continue;
                for (const key of PLAYER_KEYS) {
                    const pl = players[key];
                    if (pl.mesh && Math.hypot(pos.x - pl.mesh.position.x, pos.z - pl.mesh.position.z) < minTankDistance) {
                        continue outer;
                    }
                }
                return pos;
            }
            return randomGroundPosition(minFromCenter);
        }

        function createPoisonCircle() {
            const geometry = new THREE.RingGeometry(0, MAX_RADIUS, 64);
            const material = new THREE.MeshBasicMaterial({
                color: 0x9900ff,
                opacity: 0.2,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            poisonCircle = new THREE.Mesh(geometry, material);
            poisonCircle.position.y = 0.1;
            poisonCircle.rotation.x = -Math.PI / 2;
            scene.add(poisonCircle);
        }

        function updatePoisonCircleGeometry(innerRadius) {
            if (!poisonCircle) return;
            const oldGeometry = poisonCircle.geometry;
            poisonCircle.geometry = new THREE.RingGeometry(innerRadius, MAX_RADIUS, 64);
            oldGeometry.dispose();
        }

        function createHealthPack() {
            const group = new THREE.Group();
            const baseMat = new THREE.MeshStandardMaterial({
                color: 0x3cff6c,
                emissive: 0x1c8f30,
                emissiveIntensity: 1.2
            });
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x85ff9a, transparent: true, opacity: 0.25 });

            const core = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), baseMat);
            core.castShadow = true;
            group.add(core);

            const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, 0.45), baseMat);
            const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.45), baseMat);
            group.add(crossV, crossH);

            const glow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.1, 2.1), glowMat);
            group.add(glow);

            group.position.y = 1.5;
            group.traverse(obj => {
                obj.castShadow = true;
                obj.receiveShadow = true;
            });
            scene.add(group);
            return group;
        }

        function spawnHealthPacks() {
            for (let i = 0; i < 3; i++) {
                const mesh = createHealthPack();
                const pos = findSafeSpawnPosition({ minFromCenter: 20, minRockDistance: 5, minPackDistance: 10, minWeaponBoxDistance: 10, minGrassDistance: 4 });
                mesh.position.set(pos.x, 1.5, pos.z);
                healthPacks.push({ mesh, active: true, respawnTime: 0 });
            }
        }

        function createWeaponBox() {
            const group = new THREE.Group();
            const crateMat = new THREE.MeshStandardMaterial({
                color: 0x8844ff,
                emissive: 0x4422aa,
                emissiveIntensity: 0.8
            });
            const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), crateMat);
            crate.castShadow = true;
            group.add(crate);
            const glowMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.2 });
            const glow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), glowMat);
            group.add(glow);
            group.position.y = 1.5;
            group.traverse(obj => { obj.castShadow = true; obj.receiveShadow = true; });
            scene.add(group);
            return group;
        }

        function spawnWeaponBoxes() {
            for (let i = 0; i < 2; i++) {
                const mesh = createWeaponBox();
                const pos = findSafeSpawnPosition({ minFromCenter: 25, minRockDistance: 5, minPackDistance: 12, minWeaponBoxDistance: 12, minGrassDistance: 4 });
                mesh.position.set(pos.x, 1.5, pos.z);
                weaponBoxes.push({ mesh, active: true, respawnTime: 0 });
            }
        }

        function createGrassPatch(radius, theme) {
            const t = theme || MAP_THEMES.grassland;
            const group = new THREE.Group();
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius, 0.16, 24),
                new THREE.MeshStandardMaterial({ color: t.grassBase })
            );
            base.position.y = 0.08;
            base.receiveShadow = true;
            group.add(base);

            const bladeMat = new THREE.MeshStandardMaterial({ color: t.grassBlade });
            const bladeCount = Math.floor((50 + rand() * 30) * (t.grassCount ?? 1)); // 更茂盛
            for (let i = 0; i < bladeCount; i++) {
                const blade = new THREE.Mesh(
                    new THREE.ConeGeometry(0.8 + rand() * 0.6, 8 + rand() * 8, 6),
                    bladeMat
                );
                const angle = rand() * Math.PI * 2;
                const dist = rand() * (radius - 0.8);
                blade.position.set(Math.cos(angle) * dist, 1.2, Math.sin(angle) * dist);
                blade.rotation.z = (rand() - 0.5) * 0.25;
                blade.rotation.x = (rand() - 0.5) * 0.25;
                blade.castShadow = true;
                group.add(blade);
            }
            scene.add(group);
            return group;
        }

        function spawnGrassPatches(theme) {
            const t = theme || MAP_THEMES.grassland;
            const count = Math.max(0, Math.floor((14 + rand() * 8) * (t.grassCount ?? 1)));
            for (let i = 0; i < count; i++) {
                const radius = 7.5 + rand() * 4.5;
                const pos = findSafeSpawnPosition({ minFromCenter: 24, minRockDistance: 8, minGrassDistance: 16, minPackDistance: 10 });
                const mesh = createGrassPatch(radius, theme);
                mesh.position.set(pos.x, 0, pos.z);
                grassPatches.push({ mesh, position: { x: pos.x, z: pos.z }, radius });
            }
        }

        function showWeaponSwitchToast(weaponName) {
            const el = document.getElementById('weapon-switch-toast');
            if (!el) return;
            el.textContent = weaponName;
            el.classList.remove('show');
            el.offsetHeight;
            el.classList.add('show');
            clearTimeout(showWeaponSwitchToast._tid);
            showWeaponSwitchToast._tid = setTimeout(() => el.classList.remove('show'), 1800);
        }

        function updatePlayerHud(playerKey) {
            const player = players[playerKey];
            const el = hpFillEls[playerKey];
            const isShield = player.weapon === 'shield';
            const isSelf = playerKey === myRole;
            if (isShield && !isSelf) {
                const shp = Math.max(0, player.shieldHp ?? SHIELD_MAX_HP);
                el.style.width = `${(shp / SHIELD_MAX_HP) * 100}%`;
                hpTextEls[playerKey].textContent = `护盾 ${Math.ceil(shp)}`;
                el.classList.add('hp-fill-shield');
            } else {
                el.style.width = `${Math.max(0, player.hp)}%`;
                hpTextEls[playerKey].textContent = `HP ${Math.ceil(player.hp)}`;
                el.classList.remove('hp-fill-shield');
            }
            weaponTextEls[playerKey].textContent = `武器：${WEAPONS[player.weapon].name}`;
            if (playerKey === myRole) updateLocalLowHpLoop();
        }

        function updateAllHud() {
            for (const role of PLAYER_KEYS) {
                if (hpFillEls[role]) {
                    updatePlayerHud(role);
                }
            }
        }

        function spawnDamagePopup(playerKey, dmg) {
            const player = players[playerKey];
            if (!player || !player.mesh || !Number.isFinite(dmg) || dmg <= 0) return;
            // 低于 1 的持续性小数伤害（如毒伤逐帧）不弹字，避免刷屏
            if (dmg < 1) return;
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.9 + Math.random() * 1.3;
            damagePopups.push({
                role: playerKey,
                text: `-${Math.max(1, Math.round(dmg))}`,
                start: performance.now(),
                lifeMs: 850,
                offsetX: Math.cos(angle) * radius,
                offsetZ: Math.sin(angle) * radius,
                offsetY: 1.1 + Math.random() * 0.7
            });
        }

        function updateDamagePopups(now, cam) {
            if (!cam || !scopeCtx || damagePopups.length === 0) return;
            for (let i = damagePopups.length - 1; i >= 0; i--) {
                const p = damagePopups[i];
                const player = players[p.role];
                const t = (now - p.start) / p.lifeMs;
                if (!player || !player.mesh || t >= 1) {
                    damagePopups.splice(i, 1);
                    continue;
                }

                const worldPos = new THREE.Vector3(
                    player.mesh.position.x + p.offsetX,
                    player.mesh.position.y + p.offsetY + t * 1.8,
                    player.mesh.position.z + p.offsetZ
                );
                const ndc = worldPos.project(cam);
                if (ndc.z < -1 || ndc.z > 1) continue;
                if (ndc.x < -1.1 || ndc.x > 1.1 || ndc.y < -1.1 || ndc.y > 1.1) continue;

                const sx = ((ndc.x + 1) * 0.5) * scopeCanvas.width;
                const sy = ((1 - ndc.y) * 0.5) * scopeCanvas.height;
                const alpha = 1 - t;

                scopeCtx.save();
                scopeCtx.globalAlpha = alpha;
                scopeCtx.font = 'bold 28px Microsoft YaHei';
                scopeCtx.textAlign = 'center';
                scopeCtx.textBaseline = 'middle';
                scopeCtx.lineWidth = 4;
                scopeCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                scopeCtx.strokeText(p.text, sx, sy);
                scopeCtx.fillStyle = 'rgba(255,80,80,1)';
                scopeCtx.fillText(p.text, sx, sy);
                scopeCtx.restore();
            }
        }

        function getAvailableWeapons(player) {
            const unlocked = player.unlockedWeapons || new Set(BASE_WEAPONS);
            return WEAPON_ORDER.filter(w => unlocked.has(w));
        }

        function toggleWeapon(playerKey, direction = 1) {
            const player = players[playerKey];
            if (!player.alive || player.hp <= 0) return false;
            const available = getAvailableWeapons(player);
            if (available.length === 0) return false;
            let idx = available.indexOf(player.weapon);
            if (idx < 0) idx = 0;
            let nextIdx = direction > 0
                ? (idx >= available.length - 1 ? 0 : idx + 1)
                : (idx <= 0 ? available.length - 1 : idx - 1);
            const nextWeapon = available[nextIdx];
            if (nextWeapon === 'shield' && (player.shieldHp ?? SHIELD_MAX_HP) < SHIELD_LOW_HP_THRESHOLD) {
                if (playerKey === myRole) showWeaponSwitchToast('护盾生命值低');
                return false;
            }
            player.weapon = nextWeapon;
            updatePlayerHud(playerKey);
            if (playerKey === myRole) {
                showWeaponSwitchToast(WEAPONS[player.weapon].name);
                if (nextWeapon === 'shield') playSfx('shieldSwitch', { volume: 0.85, cooldownMs: 200 });
            }
            return true;
        }

        function applyDamage(playerKey, dmg) {
            const player = players[playerKey];
            spawnDamagePopup(playerKey, dmg);

            // 只有本机所属角色才真正修改血量并向网络同步；
            // 对于非本机角色，只做受击特效，数值完全由对方通过 enemy_hp 同步过来。
            if (!isLocalRole(playerKey)) {
                player.hitT = 4;
                player.shake = 0.25;
                return;
            }

            if (!player.alive || player.hp <= 0) return;

            player.hp = Math.max(0, player.hp - dmg);
            player.hitT = 4;
            player.shake = 0.25;
            updatePlayerHud(playerKey);
            // 自己受到伤害时，把最新血量同步给对方
            socket.emit('hp_update', { role: myRole, hp: player.hp });

            if (player.hp <= 0 && gameStarted) {
                // 告知服务器这个角色已被摧毁，由统一死亡处理逻辑决定是否结束游戏
                socket.emit('player_dead', { role: playerKey });
            }
        }

        function applyHealing(playerKey, amount) {
            const player = players[playerKey];

            // 补血同理，只允许本机所属角色调整自己的血量，另一端只通过同步结果更新显示
            if (!isLocalRole(playerKey)) {
                return;
            }

            if (!player.alive || player.hp <= 0) return;

            player.hp = Math.min(100, player.hp + amount);
            updatePlayerHud(playerKey);
            // 自己吃血包回血，同样要同步给对方
            socket.emit('hp_update', { role: myRole, hp: player.hp });
        }

        // 第二个参数控制是否向服务器广播开火事件；第三个参数可强制指定本次是否允许散射
        function fire(playerKey, notifyServer = true, allowSpreadOverride = null) {
            const player = players[playerKey];
            if (!player.alive || player.hp <= 0) return;
            if (playerKey === myRole && player.stunEndTime && Date.now() < player.stunEndTime) return;
            // 只有本机控制的坦克，且允许上报时，才向服务器发送“开火”事件
            if (notifyServer && playerKey === myRole) {
                // 只有打开瞄准镜的玩家自己失去随机散布，队友开镜不影响
                const baseCanSpread = bulletSpreadEnabled && !player.scoping;
                socket.emit('fire', { role: myRole, canSpread: baseCanSpread });
                allowSpreadOverride = baseCanSpread;
            }
            const cfg = WEAPONS[player.weapon];
            const now = Date.now();

            // 护盾为纯防御武器，不发射子弹
            if (player.weapon === 'shield') return;

            // 机枪过热：持续开火 1 秒后强制冷却 0.5 秒
            if (player.weapon === 'mg') {
                const MG_BURST_MS = 600;
                const MG_OVERHEAT_MS = 300;
                const MG_GAP_RESET_MS = 180;
                if (player.mgOverheatUntil && now < player.mgOverheatUntil) return;
                if (!player.mgBurstStartAt || (player.mgLastShotAt && now - player.mgLastShotAt > MG_GAP_RESET_MS)) {
                    player.mgBurstStartAt = now;
                }
                if (now - player.mgBurstStartAt >= MG_BURST_MS) {
                    player.mgOverheatUntil = now + MG_OVERHEAT_MS;
                    player.mgBurstStartAt = 0;
                    return;
                }
            }

            if (now - player.lastShot < cfg.cd) {
                if (playerKey === myRole && (player.weapon === 'cannon' || player.weapon === 'apcannon') && now - player.lastShot >= 500) {
                    playSfx('cannonCooldown', { volume: 0.85, cooldownMs: 250 });
                }
                return;
            }

            const muzzlePos = new THREE.Vector3();
            player.muzzle.getWorldPosition(muzzlePos);
            muzzlePos.y -= 1.25;
            // 获取炮台在世界中的绝对旋转
            const turretWorldQuat = new THREE.Quaternion();
            if (player.turretMesh) {
                player.turretMesh.getWorldQuaternion(turretWorldQuat);
            } else {
                turretWorldQuat.copy(player.mesh.quaternion);
            }
            // 基于炮台朝向计算前方
            const forwardBase = new THREE.Vector3(0, 0, -1).applyQuaternion(turretWorldQuat).normalize();

            const spawnBullet = (dir, extra = {}) => {
                const isBL = extra.isBallLightning || extra.weapon === 'balllightning';
                const mat = isBL
                    ? new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.92 })
                    : new THREE.MeshBasicMaterial({ color: cfg.color });
                const bulletMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(cfg.size, 16, 12),
                    mat
                );
                bulletMesh.position.copy(muzzlePos);
                bulletMesh.layers.set(0);
                scene.add(bulletMesh);
                bullets.push({
                    mesh: bulletMesh,
                    dir,
                    speed: cfg.speed,
                    dmg: cfg.dmg,
                    owner: playerKey,
                    radius: cfg.size,
                    ...extra
                });
            };

            if (player.weapon === 'shotgun') {
                const pelletCount = Math.max(1, Math.floor(WEAPONS.shotgun.pelletCount ?? 10));
                for (let i = 0; i < pelletCount; i++) {
                    const dir = forwardBase.clone();
                    const spreadAngle = (Math.random() - 0.5) * 2 * SHOTGUN_SPREAD_ANGLE;
                    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
                    // 记录起始位置与武器类型用于后续距离衰减
                    spawnBullet(dir, { weapon: 'shotgun', origin: muzzlePos.clone() });
                }
            } else {
                let dir = forwardBase.clone();
                // 弹道偏移：开启且允许散射，且非瞄准镜状态时随机偏移（机枪±10°，加农±5°）
                const canSpread = (allowSpreadOverride !== null)
                    ? allowSpreadOverride
                    : (bulletSpreadEnabled && !player.scoping);
                if (canSpread) {
                    const maxSpread = (player.weapon === 'cannon' || player.weapon === 'toxic' || player.weapon === 'apcannon')
                        ? CANNON_SPREAD_ANGLE
                        : (player.weapon === 'emgun' || player.weapon === 'blindgun' || player.weapon === 'balllightning')
                            ? 0
                            : MG_SPREAD_ANGLE;
                    const spreadAngle = (Math.random() - 0.5) * 2 * maxSpread;
                    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
                }
                const extra = { weapon: player.weapon };
                if (player.weapon === 'balllightning') {
                    const bl = WEAPONS.balllightning;
                    extra.isBallLightning = true;
                    extra.spawnTime = Date.now();
                    extra.lastDamageByTarget = {};
                    extra.durationMs = bl?.durationMs ?? BALL_LIGHTNING_DURATION_MS;
                    extra.damageRadius = bl?.damageRadius ?? BALL_LIGHTNING_DAMAGE_RADIUS;
                    extra.damageTickMs = bl?.damageTickMs ?? BALL_LIGHTNING_DAMAGE_TICK_MS;
                }
                spawnBullet(dir, extra);
            }

            player.lastShot = now;
            if (player.weapon === 'mg') {
                player.mgLastShotAt = now;
            }
            if (playerKey === myRole) {
                if (player.weapon === 'mg') {
                    // 机枪音效：按住开火键时触发
                    playSfxFixedWindow('mgFire', { volume: 0.8, cooldownMs: 800, durationMs: 1000 });
                } else if (player.weapon === 'shotgun') {
                    playSfx('shotgunFire', { volume: 0.9, cooldownMs: 80 });
                } else if (player.weapon === 'cannon' || player.weapon === 'apcannon') {
                    playSfx('sniperFire', { volume: 0.95, cooldownMs: 40 });
                } else if (player.weapon === 'balllightning') {
                    playSfx('balllightningFire', { volume: 0.85, cooldownMs: 80 });
                } else if (player.weapon === 'emgun') {
                    playSfx('freezeFire', { volume: 0.85, cooldownMs: 40 });
                } else if (player.weapon === 'toxic') {
                    playSfx('toxicFire', { volume: 0.85, cooldownMs: 40 });
                } else if (player.weapon === 'blindgun') {
                    playSfx('blindFire', { volume: 0.85, cooldownMs: 40 });
                }
            }
        }

        function disposeBullet(bullet) {
            if (bullet.connectionLines) {
                scene.remove(bullet.connectionLines);
                bullet.connectionLines.geometry.dispose();
                bullet.connectionLines.material.dispose();
            }
            scene.remove(bullet.mesh);
            bullet.mesh.geometry.dispose();
            bullet.mesh.material.dispose();
        }

        function checkBulletObstacleCollision(bullet, index) {
            const bulletPos = bullet.mesh.position;
            for (const obstacle of obstacles) {
                const dx = bulletPos.x - obstacle.position.x;
                const dz = bulletPos.z - obstacle.position.z;
                const distXZ = Math.hypot(dx, dz);
                if (distXZ < obstacle.userData.collisionRadius + bullet.radius) {
                    disposeBullet(bullet);
                    bullets.splice(index, 1);
                    return true;
                }
            }
            for (const building of buildings) {
                const dx = bulletPos.x - building.position.x;
                const dz = bulletPos.z - building.position.z;
                const distXZ = Math.hypot(dx, dz);
                if (distXZ < (building.userData.collisionRadius || 0) + bullet.radius) {
                    disposeBullet(bullet);
                    bullets.splice(index, 1);
                    return true;
                }
            }
            // 子弹可以穿过池塘
            return false;
        }

        // 护盾碰撞：子弹路径或当前位置与护盾相交则立刻阻挡，优先于坦克受击判定
        function checkBulletShieldCollision(bullet, index, prevX, prevZ) {
            const curX = bullet.mesh.position.x;
            const curZ = bullet.mesh.position.z;
            const bulletR = bullet.radius || 0;
            const effectiveRadius = SHIELD_RADIUS + bulletR + SHIELD_HIT_MARGIN;
            for (const key of PLAYER_KEYS) {
                if (key === bullet.owner) continue;
                const target = players[key];
                if (!target?.mesh || !target.alive || target.hp <= 0) continue;
                if (target.weapon !== 'shield' || !target.turretMesh || (target.shieldHp ?? SHIELD_MAX_HP) <= 0) continue;
                const totalYaw = target.mesh.rotation.y + target.turretYaw;
                const shieldCenterX = target.mesh.position.x + SHIELD_OFFSET_FORWARD * Math.sin(totalYaw);
                const shieldCenterZ = target.mesh.position.z - SHIELD_OFFSET_FORWARD * Math.cos(totalYaw);
                const distToSegment = pointToSegmentDistance2D(shieldCenterX, shieldCenterZ, prevX, prevZ, curX, curZ);
                const distToCur = Math.hypot(curX - shieldCenterX, curZ - shieldCenterZ);
                if (distToSegment < effectiveRadius || distToCur < effectiveRadius) {
                    if (isHostRole()) {
                        let dmg = bullet.dmg;
                        if (bullet.weapon === 'shotgun' && bullet.origin) {
                            const odx = curX - bullet.origin.x;
                            const odz = curZ - bullet.origin.z;
                            const factor = Math.max(0.5, 1 - Math.hypot(odx, odz) / 60);
                            dmg *= factor;
                        }
                        const curShield = target.shieldHp ?? SHIELD_MAX_HP;
                        const newShieldHp = Math.max(0, curShield - dmg);
                        target.shieldHp = newShieldHp;
                        target.shieldHitT = 4;
                        const shieldPos = new THREE.Vector3(shieldCenterX, target.mesh.position.y + SHIELD_OFFSET_Y, shieldCenterZ);
                        playPositionalSfx(newShieldHp <= 0 ? 'shieldBreak' : 'shieldHit', shieldPos, { minDist: 4, maxDist: 52, baseVolume: 0.95, cooldownMs: 100 });
                        socket.emit('shield_hit', { targetRole: key, shieldHp: newShieldHp });
                        if (newShieldHp <= 0) {
                            target.weapon = 'mg';
                            socket.emit('weapon_switch', { role: key, weapon: 'mg' });
                            updatePlayerHud(key);
                        }
                    }
                    disposeBullet(bullet);
                    bullets.splice(index, 1);
                    return true;
                }
            }
            return false;
        }

        // 计算二维点到线段最短距离，用于防止高速子弹“隧穿”目标
        function pointToSegmentDistance2D(px, pz, ax, az, bx, bz) {
            const abx = bx - ax;
            const abz = bz - az;
            const apx = px - ax;
            const apz = pz - az;
            const abLen2 = abx * abx + abz * abz;
            if (abLen2 <= 1e-9) return Math.hypot(apx, apz);
            let t = (apx * abx + apz * abz) / abLen2;
            t = Math.max(0, Math.min(1, t));
            const qx = ax + abx * t;
            const qz = az + abz * t;
            return Math.hypot(px - qx, pz - qz);
        }

        function detectDoubleTap(playerKey, code, now, isRepeat) {
            // 仅“双击前进键”触发持续加速；忽略按键连发，防止长按被误判为双击
            if (isRepeat) return;
            const bindings = keyBindings[playerKey];
            if (code !== bindings.forward) return;
            const player = players[playerKey];
            if (player.lastTapKey === code && now - player.lastTapTime <= DOUBLE_TAP_MS) {
                // 若处于冷却中，则不允许再次加速
                if (now >= (player.boostCooldownUntil || 0) && player.stamina >= STAMINA_MIN_TO_START_BOOST) {
                    player.boosting = true;
                    player.boostStartTime = now;
                    player.boostEndTime = 0;
                }
            }
            player.lastTapKey = code;
            player.lastTapTime = now;
        }

        function updateStamina(deltaSeconds) {
            const me = players[myRole];
            if (!me) return;
            if (!me.alive || me.hp <= 0) return;

            const forwardHeld = keys[keyBindings[myRole].forward];
            const draining = me.boosting && (forwardHeld || (isTouchDevice && mobileBoostHeld));
            const regen = draining ? 0 : STAMINA_REGEN_PER_SEC * deltaSeconds;
            const drain = draining ? STAMINA_DRAIN_PER_SEC * deltaSeconds : 0;

            me.stamina = Math.max(0, Math.min(me.staminaMax, me.stamina + regen - drain));

            // 体力耗尽：立即结束加速并进入冷却
            if (me.boosting && me.stamina <= 0) {
                me.boosting = false;
                me.boostCooldownUntil = Date.now() + STAMINA_BOOST_COOLDOWN_MS;
                if (isTouchDevice) mobileBoostHeld = false;
            }

            if (staminaFillEl && staminaTextEl) {
                const pct = (me.staminaMax > 0) ? (me.stamina / me.staminaMax) : 0;
                staminaFillEl.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
                staminaTextEl.textContent = `${Math.ceil(me.stamina)}`;
            }
        }

        function processKeyDown(code, isRepeat = false) {
            keys[code] = true;
            if (!isRepeat) prevKeys[code] = false;
            const now = Date.now();
            if (gameStarted) {
                const me = players[myRole];
                const isDead = !!(me && (!me.alive || me.hp <= 0));
                if (isDead && (code === 'ArrowLeft' || code === 'ArrowRight')) {
                    cycleSpectateTarget(code === 'ArrowLeft' ? -1 : 1);
                }
                const playerKey = myRole;
                const player = players[playerKey];
                const bindings = keyBindings[playerKey];
                if (bindings && code === bindings.weaponSwitch && !player.usingSatellite && !player.satelliteFiring) {
                    if (toggleWeapon(playerKey)) socket.emit('weapon_switch', { role: playerKey, weapon: player.weapon });
                }
                for (let i = 1; i <= 9; i++) {
                    const wkey = 'weapon' + i;
                    if (bindings && bindings[wkey] && code === bindings[wkey] && !player.usingSatellite && !player.satelliteFiring) {
                        const weaponId = WEAPON_ORDER[i - 1];
                        const unlocked = player.unlockedWeapons || new Set(BASE_WEAPONS);
                        if (weaponId && player.weapon !== weaponId) {
                            if (!unlocked.has(weaponId)) {
                                if (playerKey === myRole) showWeaponSwitchToast('未解锁，拾取武器箱');
                                break;
                            }
                            if (weaponId === 'shield' && (player.shieldHp ?? SHIELD_MAX_HP) < SHIELD_LOW_HP_THRESHOLD) {
                                showWeaponSwitchToast('护盾生命值低');
                                break;
                            }
                            player.weapon = weaponId;
                            updatePlayerHud(playerKey);
                            showWeaponSwitchToast(WEAPONS[player.weapon].name);
                            if (playerKey === myRole && weaponId === 'shield') playSfx('shieldSwitch', { volume: 0.85, cooldownMs: 200 });
                            socket.emit('weapon_switch', { role: playerKey, weapon: player.weapon });
                        }
                        break;
                    }
                }
                if (bindings && code === bindings.scope && !player.usingSatellite && !player.satelliteFiring) {
                    player.scoping = !player.scoping;
                    socket.emit('scope_state', { role: playerKey, scoping: player.scoping });
                }
                if (bindings && code === bindings.turretLock && !prevKeys[bindings.turretLock]) {
                    localTurretLocked = !localTurretLocked;
                }
                if (bindings && code === bindings.fire && player.usingSatellite && !player.satelliteFiring) fireSatelliteLaser(playerKey);
            }
            for (const key of PLAYER_KEYS) {
                detectDoubleTap(key, code, now, isRepeat);
            }
        }

        function handleVirtualKeyDown(code, isRepeat = false) {
            processKeyDown(code, isRepeat);
        }

        function handleVirtualKeyUp(code) {
            keys[code] = false;
            prevKeys[code] = false;
        }

        function handleKeyDown(event) {
            if (isInputFocused()) return;
            if (shouldPreventDefaultForCode(event.code)) event.preventDefault();
            if (rebindingTarget) {
                if (event.code === 'Escape') {
                    setKeybindWarning('已取消按键修改。');
                } else {
                    assignBinding(rebindingTarget.playerKey, rebindingTarget.action, event.code);
                }
                rebindingTarget = null;
                renderKeybindUI();
                return;
            }
            if (event.repeat) {
                processKeyDown(event.code, true);
                return;
            }
            processKeyDown(event.code, false);
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', function handleKeyUp(event) {
            if (isInputFocused()) {
                keys[event.code] = false;
                prevKeys[event.code] = false;
                return;
            }
            keys[event.code] = false;
            prevKeys[event.code] = false;
            if (shouldPreventDefaultForCode(event.code)) event.preventDefault();
        });

        const mobileControlsEl = document.getElementById('mobile-controls');
        let mobileInputUpdateVisibility = null;
        if (isTouchDevice && mobileControlsEl) {
            const mc = createMobileInputController({
                isTouchDevice,
                mobileControlsEl,
                unlockAudioOnce,
                handleVirtualKeyDown,
                handleVirtualKeyUp,
                getGameStarted: () => gameStarted,
                getMyRole: () => myRole,
                getKeyBindings: () => keyBindings,
                getCurrentPlayer: () => players[myRole],
                getTurretLocked: () => localTurretLocked,
                onBoostChange: (forceOff) => {
                    const me = players[myRole];
                    if (!me) return;
                    if (forceOff === false) {
                        mobileBoostHeld = false;
                        me.boosting = false;
                        return;
                    }
                    mobileBoostHeld = !mobileBoostHeld;
                    const now = Date.now();
                    if (mobileBoostHeld) {
                        if (now >= (me.boostCooldownUntil || 0) && me.stamina >= STAMINA_MIN_TO_START_BOOST && me.alive && me.hp > 0) {
                            me.boosting = true;
                            me.boostStartTime = now;
                            me.boostEndTime = 0;
                        } else {
                            mobileBoostHeld = false;
                        }
                    } else {
                        me.boosting = false;
                    }
                }
            });
            mobileInputUpdateVisibility = mc.updateVisibility;
        }

        function enterFullscreenWithPointerLock() {
            const keybindOpen = document.getElementById('keybind-modal')?.classList.contains('open');
            const settingsOpen = document.getElementById('settings-modal')?.classList.contains('open');
            if (keybindOpen || settingsOpen) return;
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.()?.catch(() => {});
            }
            if (!document.pointerLockElement) {
                gameCanvas.requestPointerLock?.();
            }
        }

        function exitFullscreenAndPointerLock() {
            if (document.fullscreenElement) {
                document.exitFullscreen?.();
            }
            if (document.pointerLockElement) {
                document.exitPointerLock?.();
            }
        }

        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement) {
                mouseButton0 = false;
                const winnerVisible = document.getElementById('winner-msg')?.style.display === 'block';
                if (document.fullscreenElement && !winnerVisible) document.exitFullscreen?.();
            }
        });
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && document.pointerLockElement) {
                document.exitPointerLock?.();
            }
        });

        gameCanvas.addEventListener('click', () => {
            if (!gameStarted) return;
            if (!isTouchDevice) enterFullscreenWithPointerLock();
        });

        document.addEventListener('pointerdown', (e) => {
            if (e.button === 0 && document.pointerLockElement) mouseButton0 = true;
            if (e.button === 2 && gameStarted && !rebindingTarget) {
                const keybindOpen = document.getElementById('keybind-modal')?.classList.contains('open');
                const settingsOpen = document.getElementById('settings-modal')?.classList.contains('open');
                if (keybindOpen || settingsOpen) return;
                const player = players[myRole];
                if (player && player.alive && player.hp > 0 && !player.usingSatellite && !player.satelliteFiring) {
                    player.scoping = !player.scoping;
                    socket.emit('scope_state', { role: myRole, scoping: player.scoping });
                }
            }
        });
        document.addEventListener('pointerup', (e) => {
            if (e.button === 0) mouseButton0 = false;
        });
        document.addEventListener('contextmenu', (e) => {
            if (gameStarted) e.preventDefault();
        });
        document.addEventListener('wheel', (e) => {
            if (!gameStarted || rebindingTarget) return;
            const keybindOpen = document.getElementById('keybind-modal')?.classList.contains('open');
            const settingsOpen = document.getElementById('settings-modal')?.classList.contains('open');
            if (keybindOpen || settingsOpen) return;
            const player = players[myRole];
            if (!player || !player.alive || player.hp <= 0 || player.usingSatellite || player.satelliteFiring) return;
            if (Math.abs(e.deltaY) < 1) return;
            e.preventDefault();
            if (toggleWeapon(myRole, e.deltaY > 0 ? -1 : 1)) socket.emit('weapon_switch', { role: myRole, weapon: player.weapon });
        }, { passive: false });

        window.addEventListener('mousemove', function handleMouseMove(event) {
            if (!gameStarted || rebindingTarget) return;
            const keybindOpen = document.getElementById('keybind-modal')?.classList.contains('open');
            const settingsOpen = document.getElementById('settings-modal')?.classList.contains('open');
            if (keybindOpen || settingsOpen) return;
            const me = players[myRole];
            if (!me || !me.alive || me.hp <= 0) return;
            const dx = event.movementX ?? 0;
            if (Math.abs(dx) > 0) {
                const scopeMult = me.scoping ? SCOPE_TURN_MULT : 1;
                const sens = TURRET_SENSITIVITY_LEVELS[localTurretSensitivityLevel] * MOUSE_TURRET_SENSITIVITY * scopeMult;
                if (localTurretLocked) {
                    me.mesh.rotation.y -= dx * sens;
                    me.viewYaw = me.mesh.rotation.y;
                } else {
                    me.turretYaw -= dx * sens;
                    if (me.turretMesh) me.turretMesh.rotation.y = me.turretYaw;
                }
            }
        });

        function createMine(ownerKey, position) {
            const mineGroup = new THREE.Group();

            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(MINE_RADIUS, MINE_RADIUS, 0.15, 24),
                new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.35, roughness: 0.72 })
            );
            base.position.y = 0.08;
            base.castShadow = true;
            base.receiveShadow = true;
            mineGroup.add(base);

            const indicator = new THREE.Mesh(
                new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16),
                new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xaa1208, emissiveIntensity: 1.1 })
            );
            indicator.position.y = 0.2;
            indicator.castShadow = true;
            mineGroup.add(indicator);
            
            mineGroup.position.set(position.x, 0, position.z);
            scene.add(mineGroup);
            // 刚放置的地雷在 1 秒内不生效，避免误伤自己
            mines.push({ mesh: mineGroup, owner: ownerKey, radius: MINE_RADIUS, armedAt: Date.now() + 1000 });
        }

        function disposeMine(mine) {
            scene.remove(mine.mesh);
            mine.mesh.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
        }

        function tryPlaceMine(playerKey) {
            if (!minesEnabled) return;
            const player = players[playerKey];
            if (!player.alive || player.hp <= 0) return;
            const now = Date.now();
            if (now - player.lastMineTime < MINE_COOLDOWN) return;
            player.lastMineTime = now;
            createMine(playerKey, { x: player.mesh.position.x, z: player.mesh.position.z });
        }

        function createSatellitePickup() {
            const group = new THREE.Group();
            const crystalMat = new THREE.MeshStandardMaterial({
                color: 0xf8d86e,
                emissive: 0x7d35ff,
                emissiveIntensity: 1.35,
                metalness: 0.55,
                roughness: 0.2
            });
            const glowMat = new THREE.MeshBasicMaterial({ color: 0xc55cff, transparent: true, opacity: 0.22 });

            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), crystalMat);
            crystal.castShadow = true;
            group.add(crystal);

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(1.9, 0.12, 10, 36),
                new THREE.MeshStandardMaterial({ color: 0xffd86b, emissive: 0x5f1eff, emissiveIntensity: 0.9 })
            );
            ring.rotation.x = Math.PI / 2;
            group.add(ring);

            const glow = new THREE.Mesh(new THREE.SphereGeometry(2.4, 18, 18), glowMat);
            group.add(glow);

            group.position.y = 2.6;
            group.traverse(obj => {
                obj.castShadow = true;
                obj.receiveShadow = true;
            });
            scene.add(group);
            return group;
        }

        function spawnSatellitePickup() {
            if (!satellitePickup) {
                satellitePickup = { mesh: createSatellitePickup(), active: false, respawnTime: 0 };
            }
            const pos = findSafeSpawnPosition({ minFromCenter: 24, minRockDistance: 7, minPackDistance: 10, minGrassDistance: 5, minTankDistance: 12 });
            satellitePickup.mesh.position.set(pos.x, 2.6, pos.z);
            satellitePickup.mesh.visible = true;
            satellitePickup.active = true;
            satellitePickup.respawnTime = 0;
        }

        function createSatelliteBeam(target) {
            const group = new THREE.Group();
            const beam = new THREE.Mesh(
                new THREE.CylinderGeometry(1.8, 1.8, 150, 20),
                new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.55 })
            );
            beam.position.y = 75;
            group.add(beam);

            const core = new THREE.Mesh(
                new THREE.CylinderGeometry(0.55, 0.55, 150, 16),
                new THREE.MeshBasicMaterial({ color: 0xff53ff, transparent: true, opacity: 0.9 })
            );
            core.position.y = 75;
            group.add(core);

            const impact = new THREE.Mesh(
                new THREE.RingGeometry(SATELLITE_RADIUS * 0.65, SATELLITE_RADIUS, 48),
                new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
            );
            impact.rotation.x = -Math.PI / 2;
            impact.position.y = 0.18;
            group.add(impact);

            const warnDisk = new THREE.Mesh(
                new THREE.CircleGeometry(SATELLITE_RADIUS * 0.95, 48),
                new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
            );
            warnDisk.rotation.x = -Math.PI / 2;
            warnDisk.position.y = 0.12;
            group.add(warnDisk);

            group.position.set(target.x, 0, target.z);
            scene.add(group);
            return group;
        }

        function createExplosionAt(position) {
            const group = new THREE.Group();
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.9 });

            const core = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), coreMat);
            group.add(core);

            const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 2.5, 24), ringMat);
            ring.rotation.x = -Math.PI / 2;
            group.add(ring);

            group.position.copy(position);
            scene.add(group);
            explosions.push({ mesh: group, start: performance.now(), type: 'normal' });
        }

        function createSatelliteExplosionAt(position) {
            const group = new THREE.Group();
            const core = new THREE.Mesh(
                new THREE.SphereGeometry(2.8, 18, 18),
                new THREE.MeshBasicMaterial({ color: 0xfff4b2 })
            );
            group.add(core);

            const shockwave = new THREE.Mesh(
                new THREE.RingGeometry(1.4, SATELLITE_RADIUS * 1.35, 56),
                new THREE.MeshBasicMaterial({ color: 0xff6b2d, transparent: true, opacity: 0.88, side: THREE.DoubleSide })
            );
            shockwave.rotation.x = -Math.PI / 2;
            shockwave.position.y = 0.2;
            group.add(shockwave);

            const outerWave = new THREE.Mesh(
                new THREE.RingGeometry(SATELLITE_RADIUS * 0.9, SATELLITE_RADIUS * 1.8, 64),
                new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.62, side: THREE.DoubleSide })
            );
            outerWave.rotation.x = -Math.PI / 2;
            outerWave.position.y = 0.24;
            group.add(outerWave);

            const flash = new THREE.Mesh(
                new THREE.CylinderGeometry(3.2, 3.2, 55, 18),
                new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.5 })
            );
            flash.position.y = 27;
            group.add(flash);

            group.position.copy(position);
            scene.add(group);
            explosions.push({ mesh: group, start: performance.now(), type: 'satellite' });
        }

        function updateExplosions(now) {
            for (let i = explosions.length - 1; i >= 0; i--) {
                const exp = explosions[i];
                const lifeMs = exp.type === 'satellite' ? 1100 : 600;
                const t = (now - exp.start) / lifeMs;
                if (t >= 1) {
                    scene.remove(exp.mesh);
                    exp.mesh.traverse(obj => {
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) obj.material.dispose();
                    });
                    explosions.splice(i, 1);
                    continue;
                }
                const scale = exp.type === 'satellite' ? (1 + t * 6.8) : (1 + t * 3);
                exp.mesh.scale.set(scale, scale, scale);
                exp.mesh.position.y = exp.type === 'satellite' ? (0.3 + t * 2.2) : (0.5 + t * 1.5);
                exp.mesh.traverse(obj => {
                    if (obj.material && obj.material.transparent) {
                        obj.material.opacity = (exp.type === 'satellite' ? 0.95 : 0.9) * (1 - t);
                    }
                });
            }
        }

        function disposeSatelliteBeam(beam) {
            if (!beam) return;
            scene.remove(beam);
            beam.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
        }

        function fireSatelliteLaser(playerKey) {
            const player = players[playerKey];
            if (!player.usingSatellite || player.satelliteFiring || !player.alive || player.hp <= 0) return;
            player.satelliteFiring = true;
            player.satelliteFireTime = Date.now();
            player.satelliteDamageApplied = false;
            player.satelliteBeam = createSatelliteBeam(player.satelliteTarget);
            socket.emit('satellite_strike_start', {
                shooterRole: playerKey,
                targetX: player.satelliteTarget.x,
                targetZ: player.satelliteTarget.z,
                startAt: player.satelliteFireTime
            });
        }

        function startSatelliteStrikeVisual(shooterRole, targetX, targetZ, startAt) {
            const shooter = players[shooterRole];
            if (!shooter) return;
            if (shooter.satelliteBeam) {
                disposeSatelliteBeam(shooter.satelliteBeam);
                shooter.satelliteBeam = null;
            }
            shooter.satelliteTarget.x = targetX;
            shooter.satelliteTarget.z = targetZ;
            shooter.satelliteFiring = true;
            // 不依赖远端时间戳，避免不同机器时钟偏差导致预警/爆炸严重延后
            shooter.satelliteFireTime = Date.now();
            shooter.satelliteDamageApplied = false;
            shooter.satelliteBeam = createSatelliteBeam(shooter.satelliteTarget);
        }

        function triggerSatelliteImpact(playerKey) {
            const player = players[playerKey];
            if (!player || player.satelliteDamageApplied) return;
            const targetX = player.satelliteTarget.x;
            const targetZ = player.satelliteTarget.z;

            if (isHostRole()) {
                for (const targetKey of PLAYER_KEYS) {
                    const target = players[targetKey];
                    if (!target || !target.mesh || !target.alive || target.hp <= 0) continue;
                    const dx = target.mesh.position.x - targetX;
                    const dz = target.mesh.position.z - targetZ;
                    if (Math.hypot(dx, dz) <= SATELLITE_RADIUS) {
                        socket.emit('hit_report', {
                            targetRole: targetKey,
                            dmg: SATELLITE_DAMAGE,
                            weapon: 'satellite',
                            shooterRole: playerKey
                        });
                    }
                }
            } else if (playerKey === myRole) {
                socket.emit('satellite_fire', {
                    shooterRole: playerKey,
                    targetX,
                    targetZ,
                    dmg: SATELLITE_DAMAGE
                });
            }

            createSatelliteExplosionAt(new THREE.Vector3(targetX, 0.2, targetZ));
            if (playerKey === myRole) {
                playSfx('satelliteExplosion', { volume: 0.95, cooldownMs: 250 });
            }
            player.satelliteDamageApplied = true;
        }

        function keepTankInBounds(player) {
            const margin = 4;
            player.mesh.position.x = THREE.MathUtils.clamp(player.mesh.position.x, -MAP_HALF + margin, MAP_HALF - margin);
            player.mesh.position.z = THREE.MathUtils.clamp(player.mesh.position.z, -MAP_HALF + margin, MAP_HALF - margin);
        }

        function resolveRockCollisions(playerKey) {
            const player = players[playerKey];
            const now = Date.now();
            for (const rock of obstacles) {
                const dx = player.mesh.position.x - rock.position.x;
                const dz = player.mesh.position.z - rock.position.z;
                let distXZ = Math.hypot(dx, dz);
                const minDist = rock.userData.collisionRadius + TANK_RADIUS;
                if (distXZ < minDist) {
                    let normalX = 1;
                    let normalZ = 0;
                    if (distXZ >= 0.0001) {
                        normalX = dx / distXZ;
                        normalZ = dz / distXZ;
                    } else {
                        distXZ = 0.0001;
                    }
                    const overlap = minDist - distXZ;
                    player.mesh.position.x += normalX * overlap;
                    player.mesh.position.z += normalZ * overlap;
                    keepTankInBounds(player);
                    if (collisionDamageEnabled && now - player.lastCollisionDmgTime > COLLISION_DAMAGE_CD) {
                        player.lastCollisionDmgTime = now;
                        applyDamage(playerKey, COLLISION_DAMAGE);
                    }
                }
            }
        }

        function resolveExtraObstacleCollisions(playerKey) {
            const player = players[playerKey];
            const now = Date.now();
            // 火山地图：岩浆可进入，不做阻挡；其他地图池塘阻挡
            if (currentMapId !== 'volcano') {
                for (const obj of ponds) {
                const dx = player.mesh.position.x - obj.position.x;
                const dz = player.mesh.position.z - obj.position.z;
                let distXZ = Math.hypot(dx, dz);
                const minDist = (obj.userData.collisionRadius || 0) + TANK_RADIUS;
                if (distXZ < minDist) {
                    let normalX = 1;
                    let normalZ = 0;
                    if (distXZ >= 0.0001) {
                        normalX = dx / distXZ;
                        normalZ = dz / distXZ;
                    } else {
                        distXZ = 0.0001;
                    }
                    const overlap = minDist - distXZ;
                    player.mesh.position.x += normalX * overlap;
                    player.mesh.position.z += normalZ * overlap;
                    keepTankInBounds(player);
                }
            }
            }

            for (const obj of buildings) {
                const dx = player.mesh.position.x - obj.position.x;
                const dz = player.mesh.position.z - obj.position.z;
                let distXZ = Math.hypot(dx, dz);
                const minDist = (obj.userData.collisionRadius || 0) + TANK_RADIUS;
                if (distXZ < minDist) {
                    let normalX = 1;
                    let normalZ = 0;
                    if (distXZ >= 0.0001) {
                        normalX = dx / distXZ;
                        normalZ = dz / distXZ;
                    } else {
                        distXZ = 0.0001;
                    }
                    const overlap = minDist - distXZ;
                    player.mesh.position.x += normalX * overlap;
                    player.mesh.position.z += normalZ * overlap;
                    keepTankInBounds(player);
                    if (collisionDamageEnabled && now - player.lastCollisionDmgTime > COLLISION_DAMAGE_CD) {
                        player.lastCollisionDmgTime = now;
                        applyDamage(playerKey, COLLISION_DAMAGE);
                    }
                }
            }
        }

        function updateRegeneration(deltaSeconds) {
            if (!deltaSeconds) return;
            for (const key of PLAYER_KEYS) {
                const player = players[key];
                if (!player.alive || player.hp <= 0) continue;
                // 只有本机所属角色才真正执行回血与网络同步
                if (!isLocalRole(key)) continue;
                if (player.regenRemaining > 0 && player.regenPerSecond > 0) {
                    const amount = Math.min(player.regenRemaining, player.regenPerSecond * deltaSeconds);
                    if (amount > 0) {
                        applyHealing(key, amount);
                        player.regenRemaining -= amount;
                        if (player.regenRemaining <= 0) {
                            player.regenRemaining = 0;
                            player.regenPerSecond = 0;
                        }
                    }
                }
            }
        }

        function updateGrassStealth() {
            // 只计算自己的进草状态并广播；其他玩家的 inGrass 由对方发来的 grass_state 设置
            const player = players[myRole];
            if (!player || !player.mesh) return;
            let insideGrass = false;
            for (const patch of grassPatches) {
                const dx = player.mesh.position.x - patch.position.x;
                const dz = player.mesh.position.z - patch.position.z;
                if (Math.hypot(dx, dz) < patch.radius) {
                    insideGrass = true;
                    break;
                }
            }
            if (insideGrass !== player.inGrass) {
                player.inGrass = insideGrass;
                setTankVisibilityForOpponent(myRole, !insideGrass);
                socket.emit('grass_state', { role: myRole, inGrass: insideGrass });
            }
        }

        function updateHealthPacks(now) {
            for (const pack of healthPacks) {
                if (pack.active) {
                    pack.mesh.position.y = 1.5 + Math.sin(now * 0.003) * 0.3;
                    pack.mesh.rotation.y += 0.02;
                } else if (now > pack.respawnTime) {
                    const pos = findSafeSpawnPosition({ minFromCenter: 20, minRockDistance: 5, minPackDistance: 10, minGrassDistance: 4, minTankDistance: 8 });
                    pack.mesh.position.set(pos.x, 1.5, pos.z);
                    pack.mesh.visible = true;
                    pack.active = true;
                }
            }

            for (const pack of healthPacks) {
                if (!pack.active) continue;
                let pickedUp = false;
                for (const playerKey of PLAYER_KEYS) {
                    if (pickedUp) break;
                    const player = players[playerKey];
                    if (!player.alive || player.hp <= 0) continue;
                    const dx = player.mesh.position.x - pack.mesh.position.x;
                    const dz = player.mesh.position.z - pack.mesh.position.z;
                    if (Math.hypot(dx, dz) < 3) {
                        // 吃到血包后，开启持续回血（仅在本机所属角色上真正加血并做网络同步）
                        if (isLocalRole(playerKey)) {
                            player.regenRemaining = HEALTH_PACK_REGEN_TOTAL;
                            player.regenPerSecond = HEALTH_PACK_REGEN_RATE;
                            playSfx('pickupHealth', { volume: 0.85, cooldownMs: 120 });
                        }
                        pack.active = false;
                        pack.mesh.visible = false;
                        pack.respawnTime = now + HEALTH_PACK_RESPAWN;
                        pickedUp = true;
                    }
                }
            }
        }

        function updateWeaponBoxes(now) {
            for (const box of weaponBoxes) {
                if (box.active) {
                    box.mesh.position.y = 1.5 + Math.sin(now * 0.0025) * 0.25;
                    box.mesh.rotation.y += 0.015;
                } else if (now > box.respawnTime) {
                    const pos = findSafeSpawnPosition({ minFromCenter: 25, minRockDistance: 5, minPackDistance: 12, minWeaponBoxDistance: 12, minGrassDistance: 4, minTankDistance: 8 });
                    box.mesh.position.set(pos.x, 1.5, pos.z);
                    box.mesh.visible = true;
                    box.active = true;
                }
            }
            // 武器箱拾取与解锁以主机为准，避免各端重复判定造成不同步
            if (!isHostRole()) return;
            for (const box of weaponBoxes) {
                if (!box.active) continue;
                for (const playerKey of PLAYER_KEYS) {
                    const player = players[playerKey];
                    if (!player.alive || player.hp <= 0) continue;
                    const dx = player.mesh.position.x - box.mesh.position.x;
                    const dz = player.mesh.position.z - box.mesh.position.z;
                    if (Math.hypot(dx, dz) < 3) {
                        if (isHostRole()) {
                            const unlocked = player.unlockedWeapons || new Set(BASE_WEAPONS);
                            const stillLocked = PREMIUM_WEAPONS.filter(w => !unlocked.has(w));
                            if (stillLocked.length > 0) {
                                const weapon = stillLocked[Math.floor(rand() * stillLocked.length)];
                                unlocked.add(weapon);
                                player.unlockedWeapons = unlocked;
                                socket.emit('weapon_unlock', { role: playerKey, weapon });
                                if (isLocalRole(playerKey)) {
                                    playSfx('pickupSatellite', { volume: 0.85, cooldownMs: 150 });
                                    showWeaponSwitchToast(`解锁：${WEAPONS[weapon].name}`);
                                }
                                box.active = false;
                                box.mesh.visible = false;
                                box.respawnTime = now + WEAPON_BOX_RESPAWN;
                                break;
                            }
                        }
                    }
                }
            }
        }

        function updateMines(now) {
            for (const mine of mines) {
                mine.mesh.rotation.y += 0.02;
                mine.mesh.position.y = Math.sin(now * 0.006 + mine.mesh.position.x) * 0.02;
            }

            for (let i = mines.length - 1; i >= 0; i--) {
                const mine = mines[i];
                if (now < mine.armedAt) continue;
                for (const playerKey of PLAYER_KEYS) {
                    const player = players[playerKey];
                    if (!player.alive || player.hp <= 0) continue;
                    const dx = player.mesh.position.x - mine.mesh.position.x;
                    const dz = player.mesh.position.z - mine.mesh.position.z;
                    if (Math.hypot(dx, dz) < TANK_RADIUS + mine.radius) {
                        applyDamage(playerKey, MINE_DAMAGE);
                        disposeMine(mine);
                        mines.splice(i, 1);
                        break;
                    }
                }
            }
        }

        function updateSatellitePickup(now) {
            if (!satelliteLaserEnabled) return;
            if (!satellitePickup) spawnSatellitePickup();

            if (satellitePickup.active) {
                satellitePickup.mesh.rotation.y += 0.025;
                satellitePickup.mesh.position.y = 2.6 + Math.sin(now * 0.0035) * 0.45;

                const playerKey = myRole;
                const player = players[playerKey];
                if (!player || !player.mesh || !player.alive || player.hp <= 0) {
                    // 本机玩家不可拾取时跳过本帧检测
                } else {
                    const dx = player.mesh.position.x - satellitePickup.mesh.position.x;
                    const dz = player.mesh.position.z - satellitePickup.mesh.position.z;
                    const localDist = Math.hypot(dx, dz);
                    if (localDist < 3) {
                        satellitePickup.active = false;
                        satellitePickup.mesh.visible = false;
                        satellitePickup.respawnTime = now + SATELLITE_RESPAWN;
                        player.usingSatellite = true;
                        player.satelliteFiring = false;
                        player.satelliteDamageApplied = false;
                        player.satelliteTarget.x = 0;
                        player.satelliteTarget.z = 0;
                        player.scoping = false;
                        socket.emit('satellite_pickup', { role: playerKey, at: now });
                        playSfx('pickupSatellite', { volume: 0.9, cooldownMs: 180 });
                    }
                }
            } else if (now > satellitePickup.respawnTime) {
                spawnSatellitePickup();
            }
        }

        function updateSatellitePlayers(now, deltaSeconds) {
            for (const playerKey of PLAYER_KEYS) {
                const player = players[playerKey];
                const canControlSatellite = !!(player.alive && player.hp > 0);
                if (playerKey === myRole && canControlSatellite && player.usingSatellite && !player.satelliteFiring) {
                    const bindings = keyBindings[playerKey];
                    const targetSpeed = SATELLITE_TARGET_SPEED * deltaSeconds;
                    if (keys[bindings.forward]) player.satelliteTarget.z -= targetSpeed;
                    if (keys[bindings.backward]) player.satelliteTarget.z += targetSpeed;
                    if (keys[bindings.left]) player.satelliteTarget.x -= targetSpeed;
                    if (keys[bindings.right]) player.satelliteTarget.x += targetSpeed;
                    player.satelliteTarget.x = clampToMap(player.satelliteTarget.x);
                    player.satelliteTarget.z = clampToMap(player.satelliteTarget.z);
                }

                if (player.satelliteFiring && player.satelliteBeam) {
                    const elapsed = now - player.satelliteFireTime;
                    const remain = Math.max(0, SATELLITE_WARNING_MS - elapsed);
                    const beam = player.satelliteBeam.children[0];
                    const core = player.satelliteBeam.children[1];
                    const ring = player.satelliteBeam.children[2];
                    const warnDisk = player.satelliteBeam.children[3];
                    const pulse = 0.5 + 0.5 * Math.sin(now * 0.035);
                    if (beam && beam.material) beam.material.opacity = 0.35 + pulse * 0.25;
                    if (core && core.material) core.material.opacity = 0.58 + pulse * 0.35;
                    if (ring && ring.material) ring.material.opacity = 0.45 + pulse * 0.5;
                    if (warnDisk && warnDisk.material) warnDisk.material.opacity = 0.2 + pulse * 0.45;

                    if (!player.satelliteDamageApplied && remain <= 0) {
                        triggerSatelliteImpact(playerKey);
                    }
                }

                if (player.satelliteFiring && now - player.satelliteFireTime >= SATELLITE_EFFECT_MS) {
                    disposeSatelliteBeam(player.satelliteBeam);
                    player.satelliteBeam = null;
                    player.usingSatellite = false;
                    player.satelliteFiring = false;
                    player.satelliteDamageApplied = false;
                }
            }
        }

        function updatePoison(now, deltaSeconds) {
            if (!poisonCircleEnabled) return;
            const elapsed = (now - poisonStartTime) / 1000;
            safeRadius = MAX_RADIUS * Math.max(0, 1 - elapsed / POISON_DURATION);
            updatePoisonCircleGeometry(safeRadius);
            poisonTimerEl.style.display = 'block';
            poisonTimerEl.textContent = `毒圈: ${Math.max(0, Math.ceil(POISON_DURATION - elapsed))}s`;

            // 毒圈伤害随时间递增：越到后期越疼
            const baseDps = 3;
            const extraDps = Math.max(0, elapsed - 30) / 10; // 每多 10 秒多 1 点
            const shrinkFactor = 1 - safeRadius / MAX_RADIUS;
            const circleBonus = shrinkFactor * 6; // 圈越小额外伤害越高
            const dmgPerSecond = baseDps + extraDps + circleBonus;

            for (const playerKey of PLAYER_KEYS) {
                const player = players[playerKey];
                if (!player.mesh || !player.alive || player.hp <= 0) continue;
                const dist = Math.hypot(player.mesh.position.x, player.mesh.position.z);
                if (dist > safeRadius) {
                    applyDamage(playerKey, dmgPerSecond * deltaSeconds);
                }
            }
        }

        function updateBullets(deltaSeconds) {
            for (let i = bullets.length - 1; i >= 0; i--) {
                const bullet = bullets[i];
                const prevX = bullet.mesh.position.x;
                const prevZ = bullet.mesh.position.z;
                bullet.mesh.position.addScaledVector(bullet.dir, bullet.speed * deltaSeconds);
                if (checkBulletObstacleCollision(bullet, i)) continue;
                if (checkBulletShieldCollision(bullet, i, prevX, prevZ)) continue;

                // 球状闪电：缓慢移动、范围伤害、连接电弧
                if (bullet.isBallLightning) {
                    const now = Date.now();
                    if (now - bullet.spawnTime > (bullet.durationMs ?? BALL_LIGHTNING_DURATION_MS)) {
                        disposeBullet(bullet);
                        bullets.splice(i, 1);
                        continue;
                    }
                    const inRange = [];
                    for (const key of PLAYER_KEYS) {
                        if (key === bullet.owner) continue;
                        const p = players[key];
                        if (!p.mesh || !p.alive || p.hp <= 0) continue;
                        const dx = bullet.mesh.position.x - p.mesh.position.x;
                        const dz = bullet.mesh.position.z - p.mesh.position.z;
                        const visualLineRadius = (bullet.damageRadius ?? BALL_LIGHTNING_DAMAGE_RADIUS) + 4;
                        if (Math.hypot(dx, dz) <= visualLineRadius) inRange.push(key);
                    }
                    if (isHostRole()) {
                        for (const key of inRange) {
                            const last = bullet.lastDamageByTarget[key] ?? 0;
                            if (now - last >= (bullet.damageTickMs ?? BALL_LIGHTNING_DAMAGE_TICK_MS)) {
                                bullet.lastDamageByTarget[key] = now;
                                const bl = WEAPONS.balllightning;
                                socket.emit('hit_report', {
                                    targetRole: key, dmg: bullet.dmg, weapon: 'balllightning',
                                    slowEndAt: Date.now() + (bl?.slowDurationMs ?? 1200)
                                });
                            }
                        }
                    }
                    const maxConn = 4;
                    if (!bullet.connectionLines) {
                        const geo = new THREE.BufferGeometry();
                        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxConn * 2 * 3), 3));
                        bullet.connectionLines = new THREE.LineSegments(
                            geo,
                            new THREE.LineBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.75 })
                        );
                        scene.add(bullet.connectionLines);
                    }
                    const arr = bullet.connectionLines.geometry.attributes.position.array;
                    const bx = bullet.mesh.position.x, by = bullet.mesh.position.y, bz = bullet.mesh.position.z;
                    let count = 0;
                    for (let j = 0; j < Math.min(maxConn, inRange.length); j++) {
                        const p = players[inRange[j]];
                        if (!p?.mesh) {
                            arr[j * 6 + 0] = bx; arr[j * 6 + 1] = by; arr[j * 6 + 2] = bz;
                            arr[j * 6 + 3] = bx; arr[j * 6 + 4] = by; arr[j * 6 + 5] = bz;
                            continue;
                        }
                        arr[j * 6 + 0] = bx; arr[j * 6 + 1] = by; arr[j * 6 + 2] = bz;
                        arr[j * 6 + 3] = p.mesh.position.x; arr[j * 6 + 4] = p.mesh.position.y + 1.2; arr[j * 6 + 5] = p.mesh.position.z;
                        count++;
                    }
                    for (let j = count; j < maxConn; j++) {
                        arr[j * 6 + 0] = bx; arr[j * 6 + 1] = by; arr[j * 6 + 2] = bz;
                        arr[j * 6 + 3] = bx; arr[j * 6 + 4] = by; arr[j * 6 + 5] = bz;
                    }
                    bullet.connectionLines.geometry.attributes.position.needsUpdate = true;
                    bullet.connectionLines.geometry.setDrawRange(0, count * 2);
                    if (Math.abs(bullet.mesh.position.x) > MAP_HALF * 1.5 || Math.abs(bullet.mesh.position.z) > MAP_HALF * 1.5) {
                        disposeBullet(bullet);
                        bullets.splice(i, 1);
                    }
                    continue;
                }

                // 穿甲弹：已在敌人体内时，持续伤害直到飞出
                if (bullet.insideTarget) {
                    const targetKey = bullet.insideTarget;
                    const target = players[targetKey];
                    const insideRadius = 3.2 + (bullet.radius || 0);
                    const dist = target?.mesh
                        ? Math.hypot(bullet.mesh.position.x - target.mesh.position.x, bullet.mesh.position.z - target.mesh.position.z)
                        : Infinity;
                    const now = Date.now();
                    const holdUntil = bullet.piercingHoldUntil || 0;
                    if (!target?.mesh || !target.alive || target.hp <= 0 || (dist > insideRadius && now > holdUntil)) {
                        bullet.insideTarget = null;
                        bullet.speed = WEAPONS.apcannon?.speed ?? 950; // 穿透后恢复原速
                    } else if (isHostRole()) {
                        const cfg = WEAPONS.apcannon;
                        const tickMs = cfg?.piercingDamageTickMs ?? 100;
                        if (now - (bullet.piercingLastDamage ?? 0) >= tickMs) {
                            bullet.piercingLastDamage = now;
                            const dmg = cfg?.piercingDmgPerTick ?? 6;
                            socket.emit('hit_report', {
                                targetRole: targetKey,
                                dmg,
                                weapon: 'apcannon',
                                slowEndAt: now + (cfg?.slowDurationMs ?? 700),
                                slowMult: cfg?.slowMult ?? 0.05
                            });
                        }
                    }
                }

                let hit = false;
                // 命中判定权威化：仅主机进行坦克受击判定并上报，其他客户端只做弹道表现
                if (isHostRole()) {
                    for (const key of PLAYER_KEYS) {
                        if (key === bullet.owner) continue;
                        if (key === bullet.insideTarget) continue; // 穿甲弹已在体内，跳过避免重复判定
                        const target = players[key];
                        if (!target.mesh || !target.alive || target.hp <= 0) continue;
                        // 护盾已在 checkBulletShieldCollision 中优先判定并阻挡
                        const sweepDist = pointToSegmentDistance2D(
                            target.mesh.position.x,
                            target.mesh.position.z,
                            prevX,
                            prevZ,
                            bullet.mesh.position.x,
                            bullet.mesh.position.z
                        );
                        if (sweepDist < (2.2 + (bullet.radius || 0))) {
                            // 穿甲弹：命中后减速穿透，不销毁，体内持续伤害
                            if (bullet.weapon === 'apcannon' && !bullet.insideTarget) {
                                const cfg = WEAPONS.apcannon;
                                bullet.insideTarget = key;
                                bullet.speed = cfg?.piercingSpeed ?? 75;
                                bullet.piercingLastDamage = Date.now();
                                bullet.piercingHoldUntil = Date.now() + 450;
                                socket.emit('hit_report', {
                                    targetRole: key,
                                    dmg: bullet.dmg,
                                    weapon: 'apcannon',
                                    slowEndAt: Date.now() + (cfg?.slowDurationMs ?? 700),
                                    slowMult: cfg?.slowMult ?? 0.05
                                });
                                hit = true;
                                break;
                            }
                            let dmg = bullet.dmg;
                            // 霰弹枪：根据飞行距离线性衰减伤害，最低保留 50%
                            if (bullet.weapon === 'shotgun' && bullet.origin) {
                                const odx = bullet.mesh.position.x - bullet.origin.x;
                                const odz = bullet.mesh.position.z - bullet.origin.z;
                                const travelDist = Math.hypot(odx, odz);
                                const maxEffectiveDist = 60; // 有效距离，超出后衰减到 50%
                                const factor = Math.max(0.5, 1 - travelDist / maxEffectiveDist);
                                dmg *= factor;
                            }
                            const hitPayload = {
                                sourceRole: bullet.owner,
                                targetRole: key,
                                dmg,
                                weapon: bullet.weapon
                            };
                            if (bullet.weapon === 'emgun') {
                                hitPayload.stunMs = WEAPONS.emgun.stunDuration ?? 100;
                            }
                            if (bullet.weapon === 'toxic' && WEAPONS.toxic) {
                                const cfg = WEAPONS.toxic;
                                const now = Date.now();
                                const p = players[key];
                                const currentEnd = Math.max(p.poisonEndTime || 0, now);
                                hitPayload.poisonEndAt = Math.min(
                                    now + (cfg.dotMaxDuration ?? 10000),
                                    currentEnd + (cfg.dotDurationPerHit ?? 2000)
                                );
                                // 主机本地先更新一次，避免连续命中在网络回包前丢失叠加
                                p.poisonEndTime = hitPayload.poisonEndAt;
                            }
                            if (bullet.weapon === 'blindgun' && WEAPONS.blindgun) {
                                hitPayload.blindMs = WEAPONS.blindgun.blindDuration ?? 2500;
                            }
                            socket.emit('hit_report', hitPayload);
                            disposeBullet(bullet);
                            bullets.splice(i, 1);
                            hit = true;
                            break;
                        }
                    }
                }
                // 非主机只做“视觉命中销毁”，避免看到子弹穿过敌人；真实伤害仍由主机同步
                if (!isHostRole()) {
                    for (const key of PLAYER_KEYS) {
                        if (key === bullet.owner) continue;
                        if (key === bullet.insideTarget) continue; // 穿甲弹已在体内，跳过
                        const target = players[key];
                        if (!target.mesh || !target.alive || target.hp <= 0) continue;
                        // 护盾已在 checkBulletShieldCollision 中优先判定并阻挡
                        const sweepDist = pointToSegmentDistance2D(
                            target.mesh.position.x,
                            target.mesh.position.z,
                            prevX,
                            prevZ,
                            bullet.mesh.position.x,
                            bullet.mesh.position.z
                        );
                        if (sweepDist < (2.2 + (bullet.radius || 0))) {
                            // 穿甲弹：非主机也减速穿透，不销毁
                            if (bullet.weapon === 'apcannon' && !bullet.insideTarget) {
                                const cfg = WEAPONS.apcannon;
                                bullet.insideTarget = key;
                                bullet.speed = cfg?.piercingSpeed ?? 75;
                                hit = true;
                                break;
                            }
                            disposeBullet(bullet);
                            bullets.splice(i, 1);
                            hit = true;
                            break;
                        }
                    }
                }
                if (hit) continue;

                // 子弹近距离掠过本机坦克但未命中时，由“被掠过者”本地播放近失音效
                const me = players[myRole];
                if (me && me.mesh && me.alive && bullet.owner !== myRole) {
                    const mdx = bullet.mesh.position.x - me.mesh.position.x;
                    const mdz = bullet.mesh.position.z - me.mesh.position.z;
                    const nearDist = Math.hypot(mdx, mdz);
                    if (nearDist >= 2.2 && nearDist <= 4.6) {
                        playSfx('nearMiss', { volume: 0.7, cooldownMs: 220 });
                    }
                }

                const outLimit = MAP_HALF * 1.5;
                if (Math.abs(bullet.mesh.position.x) > outLimit || Math.abs(bullet.mesh.position.z) > outLimit) {
                    disposeBullet(bullet);
                    bullets.splice(i, 1);
                }
            }
        }

        const STUN_BLUE = 0x87ceeb; // 电磁炮瘫痪时全身变蓝的颜色
        const BALL_LIGHTNING_YELLOW = 0xffdd44; // 球状闪电击中时全身变黄

        function updateStunVisual() {
            const now = Date.now();
            for (const key of PLAYER_KEYS) {
                const player = players[key];
                if (!player.mesh) continue;
                const stunned = player.stunEndTime && now < player.stunEndTime;
                const ballLightningSlow = !stunned && (player.balllightningSlowEndTime && now < player.balllightningSlowEndTime);
                if (!stunned && player.balllightningSlowEndTime && now >= player.balllightningSlowEndTime) {
                    player.balllightningSlowEndTime = 0;
                }
                player.mesh.traverse(obj => {
                    if (!obj.material) return;
                    const mat = obj.material;
                    const effect = stunned ? 'stun' : (ballLightningSlow ? 'balllightning' : null);
                    if (effect === 'stun') {
                        if (mat.userData.stunOriginalColor === undefined) {
                            mat.userData.stunOriginalColor = mat.color.getHex();
                            if (mat.emissive) {
                                mat.userData.stunOriginalEmissive = mat.emissive.getHex();
                                mat.userData.stunOriginalEmissiveIntensity = mat.emissiveIntensity;
                            }
                        }
                        mat.color.setHex(STUN_BLUE);
                        if (mat.emissive) {
                            mat.emissive.setHex(STUN_BLUE);
                            mat.emissiveIntensity = 0.25;
                        }
                    } else if (effect === 'balllightning') {
                        if (mat.userData.ballLightningOriginalColor === undefined) {
                            mat.userData.ballLightningOriginalColor = mat.color.getHex();
                            if (mat.emissive) {
                                mat.userData.ballLightningOriginalEmissive = mat.emissive.getHex();
                                mat.userData.ballLightningOriginalEmissiveIntensity = mat.emissiveIntensity;
                            }
                        }
                        mat.color.setHex(BALL_LIGHTNING_YELLOW);
                        if (mat.emissive) {
                            mat.emissive.setHex(BALL_LIGHTNING_YELLOW);
                            mat.emissiveIntensity = 0.3;
                        }
                    } else {
                        if (mat.userData.stunOriginalColor !== undefined) {
                            mat.color.setHex(mat.userData.stunOriginalColor);
                            delete mat.userData.stunOriginalColor;
                        }
                        if (mat.userData.stunOriginalEmissive !== undefined && mat.emissive) {
                            mat.emissive.setHex(mat.userData.stunOriginalEmissive);
                            mat.emissiveIntensity = mat.userData.stunOriginalEmissiveIntensity ?? 0;
                            delete mat.userData.stunOriginalEmissive;
                            delete mat.userData.stunOriginalEmissiveIntensity;
                        }
                        if (mat.userData.ballLightningOriginalColor !== undefined) {
                            mat.color.setHex(mat.userData.ballLightningOriginalColor);
                            delete mat.userData.ballLightningOriginalColor;
                        }
                        if (mat.userData.ballLightningOriginalEmissive !== undefined && mat.emissive) {
                            mat.emissive.setHex(mat.userData.ballLightningOriginalEmissive);
                            mat.emissiveIntensity = mat.userData.ballLightningOriginalEmissiveIntensity ?? 0;
                            delete mat.userData.ballLightningOriginalEmissive;
                            delete mat.userData.ballLightningOriginalEmissiveIntensity;
                        }
                    }
                });
            }
        }

        function updatePoisonDamage(deltaSeconds) {
            if (!deltaSeconds || !WEAPONS.toxic || WEAPONS.toxic.dotDps == null) return;
            const now = Date.now();
            for (const key of PLAYER_KEYS) {
                const player = players[key];
                // 中毒已过期时显式清除，避免主机等情况下状态残留导致“中毒不消失”
                if (player.poisonEndTime && now >= player.poisonEndTime) {
                    player.poisonEndTime = 0;
                }
                if (!player.alive || player.hp <= 0) continue;
                if (!(player.poisonEndTime && now < player.poisonEndTime)) continue;
                if (!isLocalRole(key)) continue;
                const dmg = WEAPONS.toxic.dotDps * deltaSeconds;
                applyDamage(key, dmg);
            }
        }

        function updatePoisonVisual() {
            if (!WEAPONS.toxic || WEAPONS.toxic.poisonVisualColor == null) return;
            const purple = WEAPONS.toxic.poisonVisualColor;
            for (const key of PLAYER_KEYS) {
                const player = players[key];
                if (!player.mesh) continue;
                const poisoned = player.poisonEndTime && Date.now() < player.poisonEndTime;
                player.mesh.traverse(obj => {
                    if (!obj.material) return;
                    const mat = obj.material;
                    if (poisoned) {
                        if (mat.userData.poisonOriginalColor === undefined) {
                            mat.userData.poisonOriginalColor = mat.color.getHex();
                            if (mat.emissive) {
                                mat.userData.poisonOriginalEmissive = mat.emissive.getHex();
                                mat.userData.poisonOriginalEmissiveIntensity = mat.emissiveIntensity;
                            }
                        }
                        mat.color.setHex(purple);
                        if (mat.emissive) {
                            mat.emissive.setHex(purple);
                            mat.emissiveIntensity = 0.25;
                        }
                    } else {
                        if (mat.userData.poisonOriginalColor !== undefined) {
                            mat.color.setHex(mat.userData.poisonOriginalColor);
                            delete mat.userData.poisonOriginalColor;
                        }
                        if (mat.userData.poisonOriginalEmissive !== undefined && mat.emissive) {
                            mat.emissive.setHex(mat.userData.poisonOriginalEmissive);
                            mat.emissiveIntensity = mat.userData.poisonOriginalEmissiveIntensity ?? 0;
                            delete mat.userData.poisonOriginalEmissive;
                            delete mat.userData.poisonOriginalEmissiveIntensity;
                        }
                    }
                });
            }
        }

        function updateLavaDamage(deltaSeconds) {
            if (!deltaSeconds || currentMapId !== 'volcano') return;
            for (const key of PLAYER_KEYS) {
                const player = players[key];
                if (!player?.alive || player.hp <= 0) continue;
                if (!isPlayerInLava(key)) continue;
                if (!isLocalRole(key)) continue;
                const dmg = LAVA_DAMAGE_PER_SEC * deltaSeconds;
                applyDamage(key, dmg);
            }
        }

        function updateBurnVisual() {
            if (currentMapId !== 'volcano' || !LAVA_BURN_COLOR) return;
            const burnColor = LAVA_BURN_COLOR;
            for (const key of PLAYER_KEYS) {
                const player = players[key];
                if (!player.mesh) continue;
                const burning = isPlayerInLava(key);
                player.mesh.traverse(obj => {
                    if (!obj.material) return;
                    const mat = obj.material;
                    if (burning) {
                        if (mat.userData.burnOriginalColor === undefined) {
                            mat.userData.burnOriginalColor = mat.color.getHex();
                            if (mat.emissive) {
                                mat.userData.burnOriginalEmissive = mat.emissive.getHex();
                                mat.userData.burnOriginalEmissiveIntensity = mat.emissiveIntensity;
                            }
                        }
                        mat.color.setHex(burnColor);
                        if (mat.emissive) {
                            mat.emissive.setHex(burnColor);
                            mat.emissiveIntensity = 0.25;
                        }
                    } else {
                        if (mat.userData.burnOriginalColor !== undefined) {
                            mat.color.setHex(mat.userData.burnOriginalColor);
                            delete mat.userData.burnOriginalColor;
                        }
                        if (mat.userData.burnOriginalEmissive !== undefined && mat.emissive) {
                            mat.emissive.setHex(mat.userData.burnOriginalEmissive);
                            mat.emissiveIntensity = mat.userData.burnOriginalEmissiveIntensity ?? 0;
                            delete mat.userData.burnOriginalEmissive;
                            delete mat.userData.burnOriginalEmissiveIntensity;
                        }
                    }
                });
            }
        }

        function updateBlindOverlay(nowMs, cam) {
            if (!blindOverlayCanvas || !blindOverlayCtx) return;
            const me = players[myRole];
            const blinded = !!(me && me.alive && me.blindEndTime && nowMs < me.blindEndTime);
            blindOverlayCanvas.style.display = 'none';
            if (!blinded || !cam || !me.mesh) return;
        }

        function updateHitFlash() {
            for (const key of PLAYER_KEYS) {
                const player = players[key];
                if (!player.mesh) continue;
                player.mesh.traverse(obj => {
                    if (obj.material && obj.material.emissive) {
                        obj.material.emissive.setHex(player.hitT > 0 ? 0xffffff : 0x000000);
                    }
                });
                if (player.hitT > 0) player.hitT -= 1;
            }
        }

        function updateShieldHpUI() {
            const wrap = document.getElementById('shield-hp-wrap');
            const textEl = document.getElementById('shield-hp-text');
            const fillEl = document.getElementById('shield-hp-fill');
            if (!wrap || !textEl || !fillEl) return;
            const me = players[myRole];
            const show = me && me.weapon === 'shield' && gameStarted;
            wrap.style.display = show ? 'flex' : 'none';
            if (!show) return;
            const hp = Math.max(0, me.shieldHp ?? SHIELD_MAX_HP);
            textEl.textContent = `${Math.ceil(hp)} / ${SHIELD_MAX_HP}`;
            fillEl.style.width = `${Math.min(100, (hp / SHIELD_MAX_HP) * 100)}%`;
        }

        function updateShieldRegen(deltaSeconds) {
            if (!deltaSeconds) return;
            for (const key of PLAYER_KEYS) {
                const player = players[key];
                if (!player.alive || player.hp <= 0) continue;
                const cur = player.shieldHp ?? SHIELD_MAX_HP;
                if (cur >= SHIELD_MAX_HP) continue;
                player.shieldHp = Math.min(SHIELD_MAX_HP, cur + SHIELD_REGEN_PER_SEC * deltaSeconds);
                if (player.weapon === 'shield') updatePlayerHud(key);
            }
        }

        function updateShieldVisibility() {
            for (const key of PLAYER_KEYS) {
                const player = players[key];
                if (player.shieldMesh) {
                    player.shieldMesh.visible = (player.weapon === 'shield');
                    const main = player.shieldMesh.userData?.mainMesh || player.shieldMesh;
                    const mat = main.material;
                    if (mat && player.shieldHitT > 0) {
                        mat.color.setHex(0xffffff);
                    } else if (mat && WEAPONS.shield) {
                        mat.color.setHex(WEAPONS.shield.color);
                    }
                }
                if (player.shieldHitT > 0) player.shieldHitT -= 1;
            }
        }

        function updateScoreboardUI() {
            const body = document.getElementById('scoreboard-body');
            if (!body) return;
            const effectiveRoles = (activeRoles && activeRoles.length > 0)
                ? activeRoles
                : (myRole ? [myRole] : []);
            const makeLine = (role) => {
                const colorClass =
                    role === 'p1' ? 'p1-color' :
                    role === 'p2' ? 'p2-color' :
                    role === 'p3' ? 'p3-color' :
                    'p4-color';
                const score = scoreState.scores[role] ?? 0;
                return `<div><span class="${colorClass}">${getRoleDisplayName(role)}</span>：${score} 分</div>`;
            };
            const parts = [];
            parts.push(`<div>回合数：${scoreState.rounds}</div>`);
            effectiveRoles.forEach(role => {
                parts.push(makeLine(role));
            });
            body.innerHTML = parts.join('');
        }

        function updatePlayerStatusUI() {
            const body = document.getElementById('player-status-body');
            if (!body) return;
            const lines = [];
            const rolesToShow = (activeRoles && activeRoles.length > 0)
                ? activeRoles
                : (myRole ? [myRole] : []);
            for (const role of rolesToShow) {
                const st = playerStatus[role];
                if (!st) continue;
                const ready = st.ready ? '已准备' : '未准备';
                const colorClass =
                    role === 'p1' ? 'p1-color' :
                    role === 'p2' ? 'p2-color' :
                    role === 'p3' ? 'p3-color' :
                    'p4-color';
                const selfTag = (role === myRole) ? '（自己）' : '';
                lines.push(
                    `<div><span class="${colorClass}">${getRoleDisplayName(role)}${selfTag}</span>：${ready}</div>`
                );
            }
            body.innerHTML = lines.join('');
        }

        function movePlayer(playerKey, controls, fireKey, deltaSeconds) {
            const player = players[playerKey];
            if (player.usingSatellite || player.satelliteFiring) return;
            const now = Date.now();
            // 双击前进后进入持续加速：按住前进一直加速；松开前进或倒车则取消；手机端加速按钮可独立控制
            if (player.boosting) {
                // 满最大时长进入冷却
                if ((now - (player.boostStartTime || now)) >= STAMINA_BOOST_MAX_DURATION_MS) {
                    player.boosting = false;
                    player.boostCooldownUntil = now + STAMINA_BOOST_COOLDOWN_MS;
                    if (isTouchDevice) mobileBoostHeld = false;
                } else if (isTouchDevice && mobileBoostHeld) {
                    // 手机端：加速按钮切换开启时保持加速
                } else if (!keys[controls.forward] || keys[controls.backward]) {
                    // 主动中断不进入冷却（仅满 5 秒才进入 CD）
                    player.boosting = false;
                }
            }
            const scopeMult = player.scoping ? SCOPE_SPEED_MULT : 1;
            const boostMult = player.boosting ? BOOST_MULTIPLIER : 1;
            const ballLightningSlow = player.balllightningSlowEndTime && now < player.balllightningSlowEndTime;
            const apcannonSlow = player.apcannonSlowEndTime && now < player.apcannonSlowEndTime;
            let slowMult = 1;
            if (ballLightningSlow) slowMult = Math.min(slowMult, WEAPONS.balllightning?.slowMult ?? 0.45);
            if (apcannonSlow) slowMult = Math.min(slowMult, WEAPONS.apcannon?.slowMult ?? 0.05);
            // 瞄准镜时移动速度为1/3；双击加速时恢复原速；球状闪电击中时减速
            const effectiveSpeedMult = (player.boosting ? boostMult : scopeMult * boostMult) * slowMult;
            const moveSpeed = player.speed * effectiveSpeedMult * deltaSeconds;
            const backSpeed = moveSpeed * 0.75;
            const bodyTurnMult = isTouchDevice ? 0.5 : 1;
            const turnSpeed = 2.7 * bodyTurnMult * (player.scoping ? SCOPE_TURN_MULT : 1) * deltaSeconds;

            // 死亡或眩晕时禁止位移与攻击；眩晕由电磁炮命中造成 0.1 秒无法移动和开火
            const stunned = player.stunEndTime && Date.now() < player.stunEndTime;
            const canMove = player.alive && player.hp > 0 && !stunned;
            const localTurretSensitivity = TURRET_SENSITIVITY_LEVELS[localTurretSensitivityLevel];
            const scopeTurnMult = player.scoping ? SCOPE_TURN_MULT : 1; // 瞄准镜时炮台/车身转向同步减速
            const turretTurnSpeed = 3.5 * (localTurretLocked && isTouchDevice ? 0.5 : 1) * localTurretSensitivity * scopeTurnMult * deltaSeconds; // 炮台转速（锁定模式下控制车身时手机端降速）

            // 上下键调整炮台灵敏度（仅本机生效，5 档，切换时提示）
            if (isKeyJustPressed(keyBindings[playerKey].turretSensitivityUp)) {
                if (localTurretSensitivityLevel < TURRET_SENSITIVITY_LEVELS.length - 1) {
                    localTurretSensitivityLevel++;
                    showWeaponSwitchToast(`炮台灵敏度：${TURRET_SENSITIVITY_LABELS[localTurretSensitivityLevel]}`);
                }
            }
            if (isKeyJustPressed(keyBindings[playerKey].turretSensitivityDown)) {
                if (localTurretSensitivityLevel > 0) {
                    localTurretSensitivityLevel--;
                    showWeaponSwitchToast(`炮台灵敏度：${TURRET_SENSITIVITY_LABELS[localTurretSensitivityLevel]}`);
                }
            }

            if (canMove) {
                if (keys[controls.forward]) player.mesh.translateZ(-moveSpeed);
                if (keys[controls.backward]) player.mesh.translateZ(backSpeed);
                if (keys[controls.left]) {
                    player.mesh.rotation.y += turnSpeed;
                    player.viewYaw = player.mesh.rotation.y;
                }
                if (keys[controls.right]) {
                    player.mesh.rotation.y -= turnSpeed;
                    player.viewYaw = player.mesh.rotation.y;
                }
                // 炮台独立转向逻辑（锁定模式下炮台/车身键和鼠标都控制整车转向）
                if (localTurretLocked) {
                    player.turretYaw = 0;
                    if (keys[keyBindings[playerKey].turretLeft]) {
                        player.mesh.rotation.y += turretTurnSpeed;
                        player.viewYaw = player.mesh.rotation.y;
                    }
                    if (keys[keyBindings[playerKey].turretRight]) {
                        player.mesh.rotation.y -= turretTurnSpeed;
                        player.viewYaw = player.mesh.rotation.y;
                    }
                } else {
                    if (keys[keyBindings[playerKey].turretLeft]) player.turretYaw += turretTurnSpeed;
                    if (keys[keyBindings[playerKey].turretRight]) player.turretYaw -= turretTurnSpeed;
                }
                if (player.turretMesh) {
                    player.turretMesh.rotation.y = player.turretYaw;
                }
            } else {
                // 死亡后只旋转视角，不再旋转实体模型
                if (keys[controls.left]) player.viewYaw += turnSpeed;
                if (keys[controls.right]) player.viewYaw -= turnSpeed;
            }
            // 长按持续开火，由武器冷却时间控制射速
            if (canMove && (keys[fireKey] || mouseButton0)) fire(playerKey);

            if (canMove) {
                keepTankInBounds(player);
                resolveRockCollisions(playerKey);
                resolveExtraObstacleCollisions(playerKey);
            }
        }

        function renderView(cam, player, viewerRole, x, y, w, h) {
            const isSatelliteView = player.usingSatellite || player.satelliteFiring;
            const isScoping = !isSatelliteView && player.scoping;
            const fov = isSatelliteView ? 70 : (isScoping ? SCOPE_FOV : NORMAL_FOV);
            const shake = new THREE.Vector3((Math.random() - 0.5) * player.shake, (Math.random() - 0.5) * player.shake, 0);
            const yaw = (player.alive && player.hp > 0) ? player.mesh.rotation.y : player.viewYaw;
            const hullYaw = (player.alive && player.hp > 0) ? player.mesh.rotation.y : player.viewYaw;
            // 瞄准镜使用的总角度 = 车身角度 + 炮台相对角度
            const totalYaw = hullYaw + player.turretYaw; 

            const scopeYawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), totalYaw);
            const hullYawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hullYaw);

            if (isSatelliteView) {
                // 卫星模式：真正切到俯视地图视角，以卫星目标点为中心
                const targetX = player.satelliteTarget.x;
                const targetZ = player.satelliteTarget.z;
                cam.position.set(targetX, 150, targetZ + 0.01);
                cam.lookAt(targetX, 0, targetZ);
            } else if (isScoping) {
            const eyePos = player.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                cam.position.copy(eyePos).add(shake);
                 // 瞄准镜使用炮台角度 (scopeYawQuat)
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(scopeYawQuat);
                const lookTarget = eyePos.clone().add(forward.multiplyScalar(100));
                cam.lookAt(lookTarget);
            } else {
                // 第三人称跟随炮台角度 (scopeYawQuat)
                const camOffset = new THREE.Vector3(0, 5, 12).applyQuaternion(scopeYawQuat);
                const camPos = player.mesh.position.clone().add(camOffset);
                        cam.position.copy(camPos).add(shake);
                        cam.lookAt(player.mesh.position.x, player.mesh.position.y + 1.2, player.mesh.position.z);
            }
            cam.fov = fov;
            cam.aspect = w / h;
            cam.updateProjectionMatrix();
            renderer.setViewport(x, y, w, h);
            renderer.setScissor(x, y, w, h);
            applyStealthForCamera(viewerRole);
            renderer.render(scene, cam);
            if (isScoping) drawScopeOverlay(x, y, w, h);
            if (isSatelliteView) drawSatelliteOverlay(player, cam, x, y, w, h);
            if (player.shake > 0) player.shake *= 0.9;
        }

        function drawSatelliteOverlay(player, viewCam, x, y, w, h) {
            const canvasH = scopeCanvas.height;
            const cy = canvasH - y - h;
            const projected = new THREE.Vector3(player.satelliteTarget.x, 0, player.satelliteTarget.z).project(viewCam);
            const projPx = x + ((projected.x + 1) * 0.5) * w;
            const projPy = cy + ((1 - (projected.y + 1) * 0.5)) * h;
            const projectedEdge = new THREE.Vector3(player.satelliteTarget.x + SATELLITE_RADIUS, 0, player.satelliteTarget.z).project(viewCam);
            const projEdgePx = x + ((projectedEdge.x + 1) * 0.5) * w;
            const projRadiusPx = Math.abs(projEdgePx - projPx);
            // 使用相机投影半径，保证显示圈与真实世界伤害半径一致
            const radiusPx = projRadiusPx;
            const px = projPx;
            const py = projPy;

            scopeCtx.save();
            scopeCtx.beginPath();
            scopeCtx.rect(x, cy, w, h);
            scopeCtx.clip();

            scopeCtx.fillStyle = 'rgba(12, 10, 24, 0.22)';
            scopeCtx.fillRect(x, cy, w, h);

            scopeCtx.strokeStyle = 'rgba(255, 229, 128, 0.95)';
            scopeCtx.lineWidth = 2.5;
            scopeCtx.beginPath();
            scopeCtx.arc(px, py, radiusPx, 0, Math.PI * 2);
            scopeCtx.stroke();

            scopeCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
            scopeCtx.lineWidth = 1.5;
            scopeCtx.beginPath();
            scopeCtx.moveTo(x + 28, cy + 28);
            scopeCtx.lineTo(px, py);
            scopeCtx.stroke();

            scopeCtx.strokeStyle = 'rgba(255, 245, 188, 0.9)';
            scopeCtx.beginPath();
            scopeCtx.moveTo(px - 14, py);
            scopeCtx.lineTo(px + 14, py);
            scopeCtx.moveTo(px, py - 14);
            scopeCtx.lineTo(px, py + 14);
            scopeCtx.stroke();

            scopeCtx.fillStyle = 'rgba(255,255,255,0.9)';
            scopeCtx.font = 'bold 18px Microsoft YaHei';
            if (player.satelliteFiring) {
                const remainMs = Math.max(0, SATELLITE_WARNING_MS - (Date.now() - player.satelliteFireTime));
                const remainSec = (remainMs / 1000).toFixed(1);
                scopeCtx.fillText(`轨道炮锁定中，${remainSec}s 后爆炸`, x + 18, cy + 30);
            } else {
                scopeCtx.fillText('卫星瞄准：方向键移动，开火键发射', x + 18, cy + 30);
            }
            scopeCtx.restore();
        }

        function drawScopeOverlay(x, y, w, h) {
            // 坐标系转换：renderer viewport y=0在底部，canvas y=0在顶部
            const canvasH = scopeCanvas.height;
            const cy = canvasH - y - h; // 翻转Y
            const cx = x + w / 2;
            const ccY = cy + h / 2;
            const radius = Math.min(w, h) * 0.42;

            scopeCtx.save();
            // 限制绘制区域到该玩家的视口
            scopeCtx.beginPath();
            scopeCtx.rect(x, cy, w, h);
            scopeCtx.clip();

            // 黑色蒙版
            scopeCtx.fillStyle = '#000';
            scopeCtx.fillRect(x, cy, w, h);

            // 圆形镂空
            scopeCtx.globalCompositeOperation = 'destination-out';
            scopeCtx.beginPath();
            scopeCtx.arc(cx, ccY, radius, 0, Math.PI * 2);
            scopeCtx.fill();

            // 切回正常模式画准星
            scopeCtx.globalCompositeOperation = 'source-over';

            // 圆形边框
            scopeCtx.strokeStyle = 'rgba(200,200,200,0.6)';
            scopeCtx.lineWidth = 2;
            scopeCtx.beginPath();
            scopeCtx.arc(cx, ccY, radius, 0, Math.PI * 2);
            scopeCtx.stroke();

            // 外圈装饰环
            scopeCtx.strokeStyle = 'rgba(200,200,200,0.3)';
            scopeCtx.lineWidth = 1;
            scopeCtx.beginPath();
            scopeCtx.arc(cx, ccY, radius + 4, 0, Math.PI * 2);
            scopeCtx.stroke();

            // 十字准星线
            const crossLen = radius * 0.85;
            const gap = radius * 0.06; // 中心留空
            scopeCtx.strokeStyle = 'rgba(255,255,255,0.7)';
            scopeCtx.lineWidth = 1.5;
            scopeCtx.beginPath();
            // 上
            scopeCtx.moveTo(cx, ccY - gap);
            scopeCtx.lineTo(cx, ccY - crossLen);
            // 下
            scopeCtx.moveTo(cx, ccY + gap);
            scopeCtx.lineTo(cx, ccY + crossLen);
            // 左
            scopeCtx.moveTo(cx - gap, ccY);
            scopeCtx.lineTo(cx - crossLen, ccY);
            // 右
            scopeCtx.moveTo(cx + gap, ccY);
            scopeCtx.lineTo(cx + crossLen, ccY);
            scopeCtx.stroke();

            // 刻度线（每条准星线上的短横）
            scopeCtx.strokeStyle = 'rgba(255,255,255,0.4)';
            scopeCtx.lineWidth = 1;
            scopeCtx.beginPath();
            for (let i = 1; i <= 3; i++) {
                const d = crossLen * i / 4;
                const tick = radius * 0.03;
                // 垂直线上的水平刻度
                scopeCtx.moveTo(cx - tick, ccY - d); scopeCtx.lineTo(cx + tick, ccY - d);
                scopeCtx.moveTo(cx - tick, ccY + d); scopeCtx.lineTo(cx + tick, ccY + d);
                // 水平线上的垂直刻度
                scopeCtx.moveTo(cx - d, ccY - tick); scopeCtx.lineTo(cx - d, ccY + tick);
                scopeCtx.moveTo(cx + d, ccY - tick); scopeCtx.lineTo(cx + d, ccY + tick);
            }
            scopeCtx.stroke();

            // 中心小圆点
            scopeCtx.fillStyle = 'rgba(255,50,50,0.8)';
            scopeCtx.beginPath();
            scopeCtx.arc(cx, ccY, 2, 0, Math.PI * 2);
            scopeCtx.fill();

            scopeCtx.restore();
        }

        // 在小地图上画圆点（用于敌方坦克）
        function drawTankDot(centerX, centerY, player, color) {
            minimapCtx.fillStyle = color;
            minimapCtx.beginPath();
            minimapCtx.arc(
                centerX + (player.mesh.position.x / MAP_HALF) * MINIMAP_RADIUS,
                centerY + (player.mesh.position.z / MAP_HALF) * MINIMAP_RADIUS,
                4, 0, Math.PI * 2
            );
            minimapCtx.fill();
        }

        // 在小地图上画箭头指针（用于自己的坦克）
        function drawTankArrow(centerX, centerY, player, color) {
            const px = centerX + (player.mesh.position.x / MAP_HALF) * MINIMAP_RADIUS;
            const py = centerY + (player.mesh.position.z / MAP_HALF) * MINIMAP_RADIUS;
            const angle = player.mesh.rotation.y;
            const size = 7;
            minimapCtx.save();
            minimapCtx.translate(px, py);
            minimapCtx.rotate(-angle);
            minimapCtx.fillStyle = color;
            minimapCtx.beginPath();
            minimapCtx.moveTo(0, -size);
            minimapCtx.lineTo(-size * 0.6, size * 0.5);
            minimapCtx.lineTo(0, size * 0.15);
            minimapCtx.lineTo(size * 0.6, size * 0.5);
            minimapCtx.closePath();
            minimapCtx.fill();
            minimapCtx.strokeStyle = 'rgba(255,255,255,0.7)';
            minimapCtx.lineWidth = 1;
            minimapCtx.stroke();
            minimapCtx.restore();
        }

        function getUiColor(playerKey) {
            if (playerKey === 'p1') return '#00f2ff';
            if (playerKey === 'p2') return '#ff512f';
            if (playerKey === 'p3') return '#00ff7f';
            return '#ffeb3b'; // p4 黄色
        }

        function drawMinimapCircle(centerX, centerY, selfKey) {
            minimapCtx.save();
            minimapCtx.beginPath();
            minimapCtx.arc(centerX, centerY, MINIMAP_RADIUS, 0, Math.PI * 2);
            minimapCtx.closePath();
            minimapCtx.fillStyle = '#2e5d30';
            minimapCtx.fill();
            minimapCtx.clip();

            if (poisonCircleEnabled) {
                minimapCtx.fillStyle = 'rgba(153, 0, 255, 0.28)';
                minimapCtx.beginPath();
                minimapCtx.arc(centerX, centerY, MINIMAP_RADIUS, 0, Math.PI * 2);
                minimapCtx.arc(centerX, centerY, (safeRadius / MAP_HALF) * MINIMAP_RADIUS, 0, Math.PI * 2, true);
                minimapCtx.fill();
            }

            for (const patch of grassPatches) {
                minimapCtx.fillStyle = '#21461e';
                minimapCtx.beginPath();
                minimapCtx.arc(
                    centerX + (patch.position.x / MAP_HALF) * MINIMAP_RADIUS,
                    centerY + (patch.position.z / MAP_HALF) * MINIMAP_RADIUS,
                    (patch.radius / MAP_HALF) * MINIMAP_RADIUS,
                    0,
                    Math.PI * 2
                );
                minimapCtx.fill();
            }

            for (const obj of obstacles) {
                minimapCtx.fillStyle = obj.userData.isTree ? '#2d5a27' : '#878787';
                const r = obj.userData.isTree ? Math.max(2, (obj.userData.collisionRadius / MAP_HALF) * MINIMAP_RADIUS * 0.5) : 3;
                minimapCtx.beginPath();
                minimapCtx.arc(
                    centerX + (obj.position.x / MAP_HALF) * MINIMAP_RADIUS,
                    centerY + (obj.position.z / MAP_HALF) * MINIMAP_RADIUS,
                    r,
                    0,
                    Math.PI * 2
                );
                minimapCtx.fill();
            }

            // 池塘（火山地图为岩浆，显示橙红色）
            const pondColor = currentMapId === 'volcano' ? 'rgba(255, 68, 0, 0.85)' : 'rgba(60, 140, 255, 0.85)';
            for (const pond of ponds) {
                minimapCtx.fillStyle = pondColor;
                minimapCtx.beginPath();
                minimapCtx.arc(
                    centerX + (pond.position.x / MAP_HALF) * MINIMAP_RADIUS,
                    centerY + (pond.position.z / MAP_HALF) * MINIMAP_RADIUS,
                    (pond.userData.collisionRadius / MAP_HALF) * MINIMAP_RADIUS,
                    0,
                    Math.PI * 2
                );
                minimapCtx.fill();
            }

            // 建筑物（用小方块表示）
            minimapCtx.fillStyle = 'rgba(220, 220, 220, 0.85)';
            for (const b of buildings) {
                const x = centerX + (b.position.x / MAP_HALF) * MINIMAP_RADIUS;
                const y = centerY + (b.position.z / MAP_HALF) * MINIMAP_RADIUS;
                minimapCtx.fillRect(x - 2, y - 2, 4, 4);
            }

            minimapCtx.strokeStyle = '#5bff76';
            minimapCtx.lineWidth = 2;
            for (const pack of healthPacks) {
                if (!pack.active) continue;
                const x = centerX + (pack.mesh.position.x / MAP_HALF) * MINIMAP_RADIUS;
                const y = centerY + (pack.mesh.position.z / MAP_HALF) * MINIMAP_RADIUS;
                minimapCtx.beginPath();
                minimapCtx.moveTo(x - 4, y);
                minimapCtx.lineTo(x + 4, y);
                minimapCtx.moveTo(x, y - 4);
                minimapCtx.lineTo(x, y + 4);
                minimapCtx.stroke();
            }

            if (!unlockAllWeapons) {
                minimapCtx.fillStyle = '#aa66ff';
                for (const box of weaponBoxes) {
                    if (!box.active) continue;
                    const x = centerX + (box.mesh.position.x / MAP_HALF) * MINIMAP_RADIUS;
                    const y = centerY + (box.mesh.position.z / MAP_HALF) * MINIMAP_RADIUS;
                    minimapCtx.fillRect(x - 3, y - 3, 6, 6);
                }
            }

            if (satelliteLaserEnabled && satellitePickup && satellitePickup.active) {
                const x = centerX + (satellitePickup.mesh.position.x / MAP_HALF) * MINIMAP_RADIUS;
                const y = centerY + (satellitePickup.mesh.position.z / MAP_HALF) * MINIMAP_RADIUS;
                minimapCtx.fillStyle = '#d97cff';
                minimapCtx.beginPath();
                minimapCtx.moveTo(x, y - 5);
                minimapCtx.lineTo(x + 5, y);
                minimapCtx.lineTo(x, y + 5);
                minimapCtx.lineTo(x - 5, y);
                minimapCtx.closePath();
                minimapCtx.fill();
                minimapCtx.strokeStyle = '#ffe89b';
                minimapCtx.lineWidth = 1;
                minimapCtx.stroke();
            }

            for (const mine of mines) {
                if (mine.owner !== selfKey) continue;
                minimapCtx.fillStyle = getUiColor(selfKey);
                minimapCtx.beginPath();
                minimapCtx.arc(
                    centerX + (mine.mesh.position.x / MAP_HALF) * MINIMAP_RADIUS,
                    centerY + (mine.mesh.position.z / MAP_HALF) * MINIMAP_RADIUS,
                    2.5,
                    0,
                    Math.PI * 2
                );
                minimapCtx.fill();
            }

            // 自己显示箭头，其余玩家显示圆点
            if (players[selfKey].mesh) {
                drawTankArrow(centerX, centerY, players[selfKey], getUiColor(selfKey));
            }
            for (const key of PLAYER_KEYS) {
                if (key === selfKey) continue;
                const enemy = players[key];
                if (!enemy.mesh || enemy.inGrass || !enemy.alive || enemy.hp <= 0) continue;
                drawTankDot(centerX, centerY, enemy, getUiColor(key));
            }
            minimapCtx.restore();

            minimapCtx.strokeStyle = '#ffffff';
            minimapCtx.lineWidth = 2;
            minimapCtx.beginPath();
            minimapCtx.arc(centerX, centerY, MINIMAP_RADIUS, 0, Math.PI * 2);
            minimapCtx.stroke();
        }

        function drawMinimaps() {
            scopeCtx.clearRect(0, 0, scopeCanvas.width, scopeCanvas.height);
            if (!gameStarted) return;
            const now = performance.now();
            if (shouldSkipMinimapDraw(now, lastMinimapDrawAt)) return;
            lastMinimapDrawAt = now;
            minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
            const vp = getAdaptiveViewportSize();
            const selfKey = myRole;
            drawMinimapCircle(MINIMAP_RADIUS + 15, vp.height - MINIMAP_RADIUS - 15, selfKey);
        }

        function resize() {
            const vp = getAdaptiveViewportSize();
            renderer.setSize(vp.width, vp.height);
            renderer.setPixelRatio(getRenderPixelRatio());
            minimapCanvas.width = vp.width;
            minimapCanvas.height = vp.height;
            scopeCanvas.width = vp.width;
            scopeCanvas.height = vp.height;
            if (blindOverlayCanvas) {
                blindOverlayCanvas.width = vp.width;
                blindOverlayCanvas.height = vp.height;
            }
        }

        window.addEventListener('resize', resize);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', resize);
        }

        // 从主机 UI 读取当前游戏配置
        function readConfigFromUi() {
            const mapEl = document.getElementById('map-select');
            return {
                collisionDamageEnabled: document.getElementById('collision-damage').classList.contains('active'),
                poisonCircleEnabled: document.getElementById('poison-circle').classList.contains('active'),
                mapId: (mapEl && MAP_IDS.includes(mapEl.value)) ? mapEl.value : 'grassland',
                bulletSpreadEnabled: document.getElementById('bullet-spread').classList.contains('active'),
                minesEnabled: document.getElementById('mine-system').classList.contains('active'),
                satelliteLaserEnabled: document.getElementById('satellite-laser').classList.contains('active'),
                unlockAllWeapons: document.getElementById('unlock-all-weapons')?.classList.contains('active') ?? false,
                buildingCount: Math.max(0, Math.min(20, parseInt(document.getElementById('building-count').value || '6', 10) || 6))
            };
        }

        // 真正开始战斗：只由服务器广播的配置触发
        function startGame(config) {
            // 每局强制重置统一 seed，避免对局中本地随机消耗导致下一局地图不一致
            const roundSeed = Number(config && config.mapSeed);
            worldSeed = Number.isFinite(roundSeed) ? (roundSeed >>> 0) : 123456;
            spectateTargetRole = null;
            damagePopups.length = 0;
            // 战斗事件监听只注册一次，避免多局后叠加导致重复伤害/重复开火
            if (!enemyPosHandler) {
                enemyPosHandler = (data) => {
                    if (!data || !data.role) return;
                    const role = data.role;
                    if (role === myRole) return;
                    if (players[role] && players[role].mesh) {
                        players[role].mesh.position.set(data.x, 0, data.z);
                        players[role].mesh.rotation.y = data.rot;
                        if (data.turretRot !== undefined && players[role].turretMesh) {
                            players[role].turretYaw = data.turretRot;
                            players[role].turretMesh.rotation.y = data.turretRot;
                        }
                    }
                };
                socket.on('enemy_pos', enemyPosHandler);
            }

            if (!enemyFireHandler) {
                enemyFireHandler = (data) => {
                    if (!data || !data.role) return;
                    const shooterRole = data.role;
                    const canSpread = typeof data.canSpread === 'boolean' ? data.canSpread : null;
                    fire(shooterRole, false, canSpread);
                };
                socket.on('enemy_fire', enemyFireHandler);
            }

            if (!enemyWeaponSwitchHandler) {
                enemyWeaponSwitchHandler = (data) => {
                    if (!data || !data.role || !data.weapon) return;
                    const role = data.role;
                    if (!players[role]) return;
                    players[role].weapon = data.weapon;
                    updatePlayerHud(role);
                };
                socket.on('enemy_weapon_switch', enemyWeaponSwitchHandler);
            }

            if (!weaponUnlockHandler) {
                weaponUnlockHandler = (data) => {
                    if (!data || !data.role || !data.weapon) return;
                    const role = data.role;
                    if (!players[role]) return;
                    const unlocked = players[role].unlockedWeapons || new Set(BASE_WEAPONS);
                    unlocked.add(data.weapon);
                    players[role].unlockedWeapons = unlocked;
                    if (role === myRole) {
                        playSfx('pickupSatellite', { volume: 0.85, cooldownMs: 150 });
                        showWeaponSwitchToast(`解锁：${WEAPONS[data.weapon].name}`);
                    }
                    updatePlayerHud(role);
                    // 非主机：收到解锁广播后，消耗离该玩家最近的武器箱以保持同步
                    if (!isHostRole() && players[role].mesh) {
                        const px = players[role].mesh.position.x;
                        const pz = players[role].mesh.position.z;
                        let nearest = null;
                        let nearestDist = 5;
                        for (const box of weaponBoxes) {
                            if (!box.active) continue;
                            const d = Math.hypot(box.mesh.position.x - px, box.mesh.position.z - pz);
                            if (d < nearestDist) {
                                nearestDist = d;
                                nearest = box;
                            }
                        }
                        if (nearest) {
                            nearest.active = false;
                            nearest.mesh.visible = false;
                            nearest.respawnTime = Date.now() + WEAPON_BOX_RESPAWN;
                        }
                    }
                };
                socket.on('weapon_unlock', weaponUnlockHandler);
            }

            if (!scopeStateHandler) {
                scopeStateHandler = (data) => {
                    if (!data || !data.role || typeof data.scoping !== 'boolean') return;
                    const role = data.role;
                    if (!players[role]) return;
                    players[role].scoping = data.scoping;
                };
                socket.on('scope_state', scopeStateHandler);
            }

            if (!enemyHpHandler) {
                enemyHpHandler = (data) => {
                    const role = data.role;
                    if (!players[role]) return;
                    players[role].hp = data.hp;
                    updatePlayerHud(role);
                };
                socket.on('enemy_hp', enemyHpHandler);
            }

            if (!shieldHitHandler) {
                shieldHitHandler = (data) => {
                    if (!data || !data.targetRole || typeof data.shieldHp !== 'number') return;
                    const target = players[data.targetRole];
                    if (!target) return;
                    target.shieldHp = data.shieldHp;
                    target.shieldHitT = 4;
                    if (!isHostRole()) {
                        if (data.shieldHp <= 0) {
                            playSfx('shieldBreak', { volume: 0.9, cooldownMs: 300 });
                        } else if (target.mesh) {
                            playPositionalSfx('shieldHit', target.mesh.position, { minDist: 4, maxDist: 52, baseVolume: 0.95, cooldownMs: 400 });
                        }
                    }
                    if (data.shieldHp <= 0) target.weapon = 'mg';
                    updatePlayerHud(data.targetRole);
                    updateShieldHpUI();
                };
                socket.on('shield_hit', shieldHitHandler);
            }

            if (!hitSyncHandler) {
                hitSyncHandler = (data) => {
                    if (!data || !data.targetRole || typeof data.dmg !== 'number') return;
                    const role = data.targetRole;
                    if (!players[role]) return;
                    const target = players[role];
                    if (target.mesh) {
                        const hitSfx = data.weapon === 'balllightning' ? 'balllightningHit' : 'hit';
                        playPositionalSfx(hitSfx, target.mesh.position, { minDist: 4, maxDist: 52, baseVolume: 0.95, cooldownMs: 400 });
                    }
                    applyDamage(role, data.dmg);
                    if (data.weapon === 'emgun' && typeof data.stunMs === 'number') {
                        players[role].stunEndTime = Date.now() + data.stunMs;
                    }
                    if (data.weapon === 'toxic' && typeof data.poisonEndAt === 'number') {
                        const now = Date.now();
                        const minPoisonMs = WEAPONS.toxic?.dotDurationPerHit ?? 2000;
                        players[role].poisonEndTime = Math.max(data.poisonEndAt, now + minPoisonMs);
                    }
                    if (data.weapon === 'blindgun' && typeof data.blindMs === 'number') {
                        players[role].blindEndTime = Date.now() + data.blindMs;
                    }
                    if (data.weapon === 'balllightning' && typeof data.slowEndAt === 'number') {
                        const cur = players[role].balllightningSlowEndTime || 0;
                        players[role].balllightningSlowEndTime = Math.max(cur, data.slowEndAt);
                    }
                    if (data.weapon === 'apcannon' && typeof data.slowEndAt === 'number') {
                        const cur = players[role].apcannonSlowEndTime || 0;
                        players[role].apcannonSlowEndTime = Math.max(cur, data.slowEndAt);
                    }
                };
                socket.on('hit_sync', hitSyncHandler);
            }

            if (!satelliteFireHandler) {
                satelliteFireHandler = (data) => {
                    if (!data || myRole !== 'p1') return;
                    if (!data.shooterRole || typeof data.targetX !== 'number' || typeof data.targetZ !== 'number') return;
                    for (const targetKey of PLAYER_KEYS) {
                        const target = players[targetKey];
                        if (!target || !target.mesh || !target.alive || target.hp <= 0) continue;
                        const dx = target.mesh.position.x - data.targetX;
                        const dz = target.mesh.position.z - data.targetZ;
                        const dist = Math.hypot(dx, dz);
                        if (dist <= SATELLITE_RADIUS) {
                            socket.emit('hit_report', {
                                targetRole: targetKey,
                                dmg: typeof data.dmg === 'number' ? data.dmg : SATELLITE_DAMAGE,
                                weapon: 'satellite',
                                shooterRole: data.shooterRole
                            });
                        }
                    }
                };
                socket.on('satellite_fire', satelliteFireHandler);
            }

            if (!satelliteStrikeStartHandler) {
                satelliteStrikeStartHandler = (data) => {
                    if (!data || !data.shooterRole) return;
                    if (typeof data.targetX !== 'number' || typeof data.targetZ !== 'number') return;
                    // 本机发射已在本地创建预警，避免重复创建
                    if (data.shooterRole === myRole) return;
                    startSatelliteStrikeVisual(data.shooterRole, data.targetX, data.targetZ, data.startAt);
                };
                socket.on('satellite_strike_start', satelliteStrikeStartHandler);
            }

            if (!satellitePickupHandler) {
                satellitePickupHandler = (data) => {
                    if (!data || !data.role || !players[data.role]) return;
                    const eventAt = typeof data.at === 'number' ? data.at : Date.now();
                    if (satellitePickup && satellitePickup.mesh) {
                        satellitePickup.active = false;
                        satellitePickup.mesh.visible = false;
                        satellitePickup.respawnTime = eventAt + SATELLITE_RESPAWN;
                    }
                    const picker = players[data.role];
                    picker.usingSatellite = true;
                    picker.satelliteFiring = false;
                    picker.satelliteDamageApplied = false;
                    picker.satelliteTarget.x = 0;
                    picker.satelliteTarget.z = 0;
                    picker.scoping = false;
                };
                socket.on('satellite_pickup', satellitePickupHandler);
            }

            document.getElementById('keybind-modal').classList.remove('open');

            // 使用主机下发的配置，而不是各自本地 UI
            collisionDamageEnabled = !!config.collisionDamageEnabled;
            unlockAllWeapons = !!config.unlockAllWeapons;
            poisonCircleEnabled = !!config.poisonCircleEnabled;
            bulletSpreadEnabled = !!config.bulletSpreadEnabled;
            const mapId = (config.mapId && MAP_IDS.includes(config.mapId)) ? config.mapId : 'grassland';
            currentMapId = mapId;
            const mapTheme = MAP_THEMES[mapId];
            SKY_BG_COLOR.setHex(mapTheme.sky);
            scene.background = SKY_BG_COLOR;
            floor.material.color.setHex(mapTheme.floor);
            blindGround.material.color.setHex(mapTheme.floor);
            scene.remove(grid);
            grid = new THREE.GridHelper(floorSize, 40, mapTheme.grid, mapTheme.grid);
            scene.add(grid);
            minesEnabled = !!config.minesEnabled;
            satelliteLaserEnabled = !!config.satelliteLaserEnabled;

            // 新一局开始前，清空上一局的死亡顺序
            deathOrder = [];

            // 下一局场景刷新：只移除上局存活者（冠军）的坦克并清光束，上局死亡玩家的黑块保留在场景中；其余子弹/地雷/血包等清空
            for (const role of PLAYER_KEYS) {
                const p = players[role];
                if (p && p.mesh && p.alive) {
                    scene.remove(p.mesh);
                    p.mesh = null;
                }
                if (p && p.satelliteBeam) {
                    disposeSatelliteBeam(p.satelliteBeam);
                    p.satelliteBeam = null;
                }
            }
            while (bullets.length) {
                const b = bullets.pop();
                if (b && b.mesh) { try { disposeBullet(b); } catch (_) {} }
            }
            while (mines.length) {
                const m = mines.pop();
                if (m && m.mesh) { try { disposeMine(m); } catch (_) {} }
            }
            while (healthPacks.length) {
                const pack = healthPacks.pop();
                if (pack && pack.mesh) scene.remove(pack.mesh);
            }
            while (weaponBoxes.length) {
                const box = weaponBoxes.pop();
                if (box && box.mesh) scene.remove(box.mesh);
            }
            while (grassPatches.length) {
                const patch = grassPatches.pop();
                if (patch && patch.mesh) scene.remove(patch.mesh);
            }
            while (obstacles.length) {
                const rock = obstacles.pop();
                if (rock) scene.remove(rock);
            }
            while (ponds.length) {
                const pond = ponds.pop();
                if (pond) scene.remove(pond);
            }
            if (poisonCircle) {
                scene.remove(poisonCircle);
                if (poisonCircle.geometry) poisonCircle.geometry.dispose();
                if (poisonCircle.material) poisonCircle.material.dispose();
                poisonCircle = null;
            }
            if (satellitePickup && satellitePickup.mesh) {
                scene.remove(satellitePickup.mesh);
                satellitePickup = null;
            }

            // 按统一 seed 与主机配置重建地图，确保各端草丛/建筑/池塘/岩石一致
            for (const b of buildings) {
                scene.remove(b);
            }
            buildings.length = 0;
            spawnRocks(mapTheme);
            spawnPonds(mapTheme);
            spawnBuildings(typeof config.buildingCount === 'number' ? config.buildingCount : null, mapTheme);
            spawnTrees(mapTheme);

            const rolesToSpawn = (activeRoles && activeRoles.length > 0)
                ? activeRoles.filter(r => PLAYER_KEYS.includes(r))
                : [...PLAYER_KEYS];
            const spawnMap = {
                p1: { x: -40, z: -40, rot: 0 },
                p2: { x: 40, z: 40, rot: Math.PI },
                p3: { x: -40, z: 40, rot: 0 },
                p4: { x: 40, z: -40, rot: Math.PI }
            };
            for (const role of PLAYER_KEYS) {
                const p = players[role];
                if (!rolesToSpawn.includes(role)) {
                    p.mesh = null;
                    p.turretMesh = null;
                    p.shieldMesh = null;
                    p.muzzle = null;
                    p.hp = 0;
                    p.alive = false;
                    p.stunEndTime = 0;
                    p.poisonEndTime = 0;
                    p.blindEndTime = 0;
                    p.balllightningSlowEndTime = 0;
                    p.apcannonSlowEndTime = 0;
                    continue;
                }
                const tank = createTank(p.color);
                p.mesh = tank.group;
                p.turretMesh = tank.turretGroup;
                p.shieldMesh = tank.shieldMesh;
                p.muzzle = tank.muzzle;
                p.turretYaw = 0;
                p.weapon = 'mg';
                p.hp = 100;
                p.shieldHp = SHIELD_MAX_HP;
                p.unlockedWeapons = unlockAllWeapons ? new Set(WEAPON_ORDER) : new Set(BASE_WEAPONS);
                p.shieldHitT = 0;
                p.alive = true;
                p.stamina = p.staminaMax || STAMINA_MAX;
                p.scoping = false;
                p.lastShot = 0;
                p.lastMineTime = 0;
                p.mgBurstStartAt = 0;
                p.mgLastShotAt = 0;
                p.mgOverheatUntil = 0;
                p.stunEndTime = 0;
                p.poisonEndTime = 0;
                p.blindEndTime = 0;
                p.balllightningSlowEndTime = 0;
                p.apcannonSlowEndTime = 0;
                p.usingSatellite = false;
                p.satelliteFiring = false;
                p.satelliteBeam = null;
                p.satelliteTarget.x = 0;
                p.satelliteTarget.z = 0;
                const sp = spawnMap[role];
                p.mesh.position.set(sp.x, 0, sp.z);
                p.mesh.rotation.y = sp.rot;
                assignTankLayers(role);
            }
            for (const k of PLAYER_KEYS) players[k].inGrass = false;
            rolesToSpawn.forEach((role) => setTankVisibilityForOpponent(role, true));

            spawnGrassPatches(mapTheme);
            spawnHealthPacks();
            if (satelliteLaserEnabled) spawnSatellitePickup();
            if (!unlockAllWeapons) spawnWeaponBoxes();

            if (poisonCircleEnabled) {
                poisonStartTime = Date.now();
                safeRadius = MAX_RADIUS;
                createPoisonCircle();
                poisonTimerEl.style.display = 'block';
            } else {
                poisonTimerEl.style.display = 'none';
            }

            updateAllHud();
            stopLowHpLoop();
            updateControlGuide();
            document.getElementById('setup-ui').style.display = 'none';
            document.getElementById('ui').style.display = 'block';
            document.getElementById('control-guide').style.display = isTouchDevice ? 'none' : 'grid';
            minimapCanvas.style.display = 'block';
            scopeCanvas.style.display = 'block';
            gameStarted = true;
            if (mobileInputUpdateVisibility) mobileInputUpdateVisibility();
            lastFrameTime = performance.now();
        }

        // 点击“准备”时，只发送“已准备”给服务器；真正开始由主机点击“开始游戏”触发
        readyBtn.addEventListener('click', () => {
            if (localReady) return;
            localReady = true;
            readyBtn.textContent = '已准备';
            readyBtn.disabled = true;

            // 本机在本轮中标记为“已准备”
            if (playerStatus[myRole]) {
                playerStatus[myRole].ready = true;
                updatePlayerStatusUI();
            }

            if (myRole === 'p1') {
                // 主机读取 UI 配置并上报
                currentConfig = readConfigFromUi();
                socket.emit('host_ready', { role: 'p1', config: currentConfig });
            } else {
                // 客户端只上报自己已准备
                socket.emit('client_ready', { role: myRole });
            }
        });

        // 主机在三人都准备后，点击开始游戏
        startGameBtn.addEventListener('click', () => {
            if (myRole !== 'p1') return;
            socket.emit('start_request', { role: 'p1' });
        });

        // Toggle buttons（实际生效配置只看主机 P1 的）
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                btn.classList.toggle('active');
            });
        });

        // Keybind modal open/close
        document.getElementById('open-keybind').addEventListener('click', () => {
            document.getElementById('keybind-modal').classList.add('open');
        });
        document.querySelector('#keybind-modal .keybind-close-btn').addEventListener('click', () => {
            document.getElementById('keybind-modal').classList.remove('open');
            rebindingTarget = null;
        });
        document.getElementById('keybind-modal').addEventListener('click', (e) => {
            const isBackdrop = e.target === e.currentTarget;
            const isKeybindConfirm = e.target.closest('#keybind-modal') && e.target.classList && e.target.classList.contains('keybind-close-btn');
            if (isBackdrop || isKeybindConfirm) {
                document.getElementById('keybind-modal').classList.remove('open');
                rebindingTarget = null;
            }
        });

        // Settings modal open/close
        function syncConfigFromSettings() {
            if (myRole !== 'p1') return;
            currentConfig = readConfigFromUi();
            if (localReady) {
                socket.emit('host_ready', { role: 'p1', config: currentConfig });
            }
        }
        document.getElementById('open-settings').addEventListener('click', () => {
            document.getElementById('settings-modal').classList.add('open');
        });
        document.getElementById('close-settings').addEventListener('click', (e) => {
            e.stopPropagation();
            document.activeElement?.blur?.(); // 确保 select 等控件先提交值
            syncConfigFromSettings();
            document.getElementById('settings-modal').classList.remove('open');
        });

        document.getElementById('role-assign-confirm').addEventListener('click', () => {
            const modal = document.getElementById('role-assign-modal');
            const input = document.getElementById('role-assign-name');
            if (!modal || !input) return;
            const name = input.value.trim().slice(0, 12);
            socket.emit('set_my_name', { role: myRole, name });
            if (name) serverNames[myRole] = name;
            else delete serverNames[myRole];
            updateTankNameDisplays();
            updateScoreboardUI();
            updatePlayerStatusUI();
            modal.classList.remove('open');
        });
        document.getElementById('role-assign-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('role-assign-confirm').click();
        });
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                syncConfigFromSettings();
                document.getElementById('settings-modal').classList.remove('open');
            }
        });

        function sendMyPosition() {
    const myTank = players[myRole];
    if (myTank && myTank.mesh) {
        socket.emit('update_pos', {
            role: myRole,
            x: myTank.mesh.position.x,
            z: myTank.mesh.position.z,
            rot: myTank.mesh.rotation.y,
            turretRot: myTank.turretYaw // 新增：广播炮台角度
        });
    }
}

        function animate(now) {
            requestAnimationFrame(animate);

            const deltaSeconds = Math.min(0.05, (now - lastFrameTime) / 1000 || 0);
            lastFrameTime = now;
            const tickNow = Date.now();

            if (!gameStarted) {
                updateBlindWorldVisibility(tickNow);
                updateBlindOverlay(tickNow, null);
                const sh = document.getElementById('shield-hp-wrap');
                if (sh) sh.style.display = 'none';
                return;
            }

            // 约每秒发送 30 次“自己”的位置，节省带宽
            if (tickNow - lastNetUpdateTime > 33) {
                sendMyPosition();
                lastNetUpdateTime = tickNow;
            }

            // 联机时本机只控制自己的坦克，敌方坦克完全依赖网络同步
            const myBindings = keyBindings[myRole];
            movePlayer(
                myRole,
                { forward: myBindings.forward, backward: myBindings.backward, left: myBindings.left, right: myBindings.right },
                myBindings.fire,
                deltaSeconds
            );
            if (isKeyJustPressed(myBindings.mine)) tryPlaceMine(myRole);
            updateGrassStealth();
            updateHealthPacks(tickNow);
            if (!unlockAllWeapons) updateWeaponBoxes(tickNow);
            updateMines(tickNow);
            updateSatellitePickup(tickNow);
            updateSatellitePlayers(tickNow, deltaSeconds);
            updateRegeneration(deltaSeconds);
            updateStamina(deltaSeconds);
            updatePoison(tickNow, deltaSeconds);
            updateBullets(deltaSeconds);
            updatePoisonDamage(deltaSeconds);
            updateLavaDamage(deltaSeconds);
            updateHitFlash();
            updateShieldRegen(deltaSeconds);
            updateShieldVisibility();
            updateShieldHpUI();
            updateStunVisual();
            updatePoisonVisual();
            updateBurnVisual();
            updateBlindWorldVisibility(tickNow);
            updateBlindAudioLoop();
            updateExplosions(now);
            drawMinimaps();

            // 联机时只展示一个视角；本机死亡后进入观战并可左右切换目标
            const activeCamera = myRole === 'p1' ? cam1 : cam2;
            const me = players[myRole];
            let viewRole = myRole;
            let viewerRole = myRole;
            if (me && (!me.alive || me.hp <= 0)) {
                const targetRole = ensureSpectateTargetRole();
                if (targetRole) {
                    viewRole = targetRole;
                    viewerRole = targetRole;
                }
            } else {
                spectateTargetRole = null;
            }
            const viewPlayer = players[viewRole] || players[myRole];
            renderView(activeCamera, viewPlayer, viewerRole, 0, 0, window.innerWidth, window.innerHeight);
            updateDamagePopups(now, activeCamera);
            updateBlindOverlay(tickNow, activeCamera);

            Object.keys(keys).forEach(code => {
                prevKeys[code] = keys[code];
            });
        }

        // 服务器广播：某个角色已准备（仅用于 UI 提示）
        socket.on('role_ready', (data) => {
            if (!data || !data.role) return;
            const role = data.role;
            if (playerStatus[role]) {
                playerStatus[role].ready = true;
                updatePlayerStatusUI();
            }
            if (role !== myRole) {
                remoteReady = true;
            }
        });

        // 服务器广播：准备状态更新（用于启用“开始游戏”按钮）
        socket.on('ready_update', (data) => {
            if (!data || !data.readyState) return;
            if (data._seq != null && data._seq < lastReadyUpdateSeq) return;
            if (data._seq != null) lastReadyUpdateSeq = data._seq;
            activeRoles = Array.isArray(data.activeRoles) ? data.activeRoles.filter(r => PLAYER_KEYS.includes(r)) : [];
            for (const role of PLAYER_KEYS) {
                const ready = !!data.readyState[role];
                if (playerStatus[role]) {
                    playerStatus[role].ready = ready;
                }
                const hud = document.getElementById(`hud-${role}`);
                if (hud) {
                    hud.style.display = activeRoles.includes(role) ? 'block' : 'none';
                }
            }
            updatePlayerStatusUI();
            updateScoreboardUI();

            // 若服务器将本机角色标为未准备（如另一同角色玩家断线），同步重置本机准备按钮，避免按钮仍显示“已准备”且不可点
            if (data.readyState[myRole] === false) {
                localReady = false;
                readyBtn.textContent = '准备';
                readyBtn.disabled = false;
            }

            const allReady = activeRoles.length >= 2 && activeRoles.every(r => data.readyState[r]);
            // 只有主机可点击开始游戏，且需所有在线玩家都准备好（至少 2 人）
            startGameBtn.disabled = !(myRole === 'p1' && allReady);
        });

        // 服务器广播：玩家退出时，清除其准备状态
        socket.on('player_left', (data) => {
            if (!data || !data.role) return;
            const role = data.role;
            activeRoles = activeRoles.filter(r => r !== role);
            const hud = document.getElementById(`hud-${role}`);
            if (hud) hud.style.display = 'none';
            if (playerStatus[role]) {
                playerStatus[role].ready = false;
                updatePlayerStatusUI();
            }
            updateScoreboardUI();
            // 若退出的是与本机同角色的玩家（如重复分配导致两蓝一红），服务器会将该角色标为未准备，本机需同步重置准备按钮
            if (role === myRole) {
                localReady = false;
                readyBtn.textContent = '准备';
                readyBtn.disabled = false;
            }
        });

        // 服务器广播：双方都已准备好，并带来主机配置，正式开始战斗
        socket.on('start_game', (config) => {
            if (!config || typeof config !== 'object') return;
            currentConfig = config;
            // 清空按键状态，避免主菜单时按住的开火键在开局瞬间触发音效
            for (const k of Object.keys(keys)) { keys[k] = false; }
            for (const k of Object.keys(prevKeys)) { prevKeys[k] = false; }
            mouseButton0 = false;
            startGameBtn.textContent = '战斗进行中';
            startGameBtn.disabled = true;

             // 新一局开始时，重置本轮的“已准备”标记
             for (const role of PLAYER_KEYS) {
                 if (playerStatus[role]) {
                     playerStatus[role].ready = false;
                 }
             }
             updatePlayerStatusUI();

            // 重置准备按钮状态（下一局可再次准备）
            localReady = false;
            readyBtn.textContent = '准备';
            readyBtn.disabled = false;

            startGame(config);
        });

        function handleDeath(role) {
            const player = players[role];
            if (!player || !player.mesh || !player.alive) return;
            player.alive = false;
            player.hp = 0;
            if (role === myRole) stopLowHpLoop();
            if (role === myRole) ensureSpectateTargetRole();
            player.blindEndTime = 0;
            player.balllightningSlowEndTime = 0;
            player.apcannonSlowEndTime = 0;
            updatePlayerHud(role);

            // 将坦克外观替换为黑色方块
            const pos = player.mesh.position.clone();
            const rotY = player.mesh.rotation.y;
            scene.remove(player.mesh);

            const box = new THREE.Mesh(
                new THREE.BoxGeometry(2.2, 0.8, 2.8),
                new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.4, roughness: 0.6 })
            );
            box.position.copy(pos);
            box.position.y = 0.4;
            box.rotation.y = rotY;
            box.castShadow = true;
            box.receiveShadow = true;

            const group = new THREE.Group();
            group.add(box);
            scene.add(group);
            player.mesh = group;

            // 记录死亡顺序（用于回合计分）
            deathOrder.push(role);

            // 在死亡位置触发一次爆炸动画
            createExplosionAt(pos);
            // 死亡爆炸按距离衰减，避免全图都听到
            playPositionalSfx('deathExplosion', pos, { minDist: 6, maxDist: 58, baseVolume: 0.95, cooldownMs: 120 });

            // 检查是否只剩最后一名存活者
            const playingRoles = (activeRoles && activeRoles.length > 0)
                ? activeRoles.filter(k => PLAYER_KEYS.includes(k))
                : PLAYER_KEYS;
            const aliveKeys = playingRoles.filter(k => players[k].alive);
            if (aliveKeys.length === 1 && gameStarted) {

                const winner = aliveKeys[0];
                // 计算本回合积分：第一名 3 分，第二名 1 分，其余 0 分
                const order = [...deathOrder];
                scoreState.rounds += 1;
                if (order.length >= 1) {
                    const second = order[0];     // 第一个死亡
                    const first = winner;        // 最后存活
                    scoreState.scores[first] = (scoreState.scores[first] ?? 0) + 3;
                    scoreState.scores[second] = (scoreState.scores[second] ?? 0) + 1;
                    // 其余角色默认加 0 分
                } else {
                    // 只有一名玩家或异常情况：只给存活者 3 分
                    scoreState.scores[winner] = (scoreState.scores[winner] ?? 0) + 3;
                }
                updateScoreboardUI();
                saveScoreState();
                deathOrder = [];

                setTimeout(() => {
                gameStarted = false;
                if (mobileInputUpdateVisibility) mobileInputUpdateVisibility();
                const text = getRoleDisplayName(winner) + ' 胜利！';
                    document.getElementById('win-text').innerText = text;
                    document.getElementById('winner-msg').style.display = 'block';
                    document.getElementById('control-guide').style.display = 'none';
                    if (!isTouchDevice) {
                        if (document.pointerLockElement) document.exitPointerLock?.();
                        if (document.fullscreenElement) document.exitFullscreen?.();
                        document.body.style.cursor = 'default';
                        document.documentElement.style.cursor = 'default';
                    }
                }, 3000);
            }
        }

        // 服务器广播：某个角色被摧毁（所有客户端统一处理死亡与胜利判定）
        socket.on('player_dead', (data) => {
            if (!data || !data.role) return;
            const role = data.role;
            if (!players[role]) return;
            handleDeath(role);
        });

        // 战斗结束后返回主菜单（计分板由服务端广播 clear_scoreboard 统一清零）
        function goToLobby() {
            gameStarted = false;
            if (mobileInputUpdateVisibility) mobileInputUpdateVisibility();
            spectateTargetRole = null;
            damagePopups.length = 0;
            document.getElementById('winner-msg').style.display = 'none';
            document.getElementById('setup-ui').style.display = 'flex';
            document.getElementById('ui').style.display = 'none';
            document.getElementById('control-guide').style.display = 'none';
            if (minimapCanvas) minimapCanvas.style.display = 'none';
            if (scopeCanvas) scopeCanvas.style.display = 'none';
            if (blindOverlayCanvas) blindOverlayCanvas.style.display = 'none';
            restoreBlindWorldState();
            blindWorldApplied = false;
            stopBlindStatusLoop();
            stopLowHpLoop();
            startGameBtn.textContent = '开始游戏';
            startGameBtn.disabled = true;
        }

        // 服务端广播：所有人计分板清零（任一人点击“回到主菜单”时触发）
        socket.on('clear_scoreboard', () => {
            scoreState = { rounds: 0, scores: { p1: 0, p2: 0, p3: 0, p4: 0 } };
            saveScoreState();
            updateScoreboardUI();
        });

        document.getElementById('btn-back-menu').addEventListener('click', () => {
            socket.emit('back_to_menu');
            goToLobby();
        });

        document.getElementById('btn-next-round').addEventListener('click', () => {
            document.getElementById('winner-msg').style.display = 'none';
            document.getElementById('control-guide').style.display = isTouchDevice ? 'none' : 'grid';
            localReady = true;
            readyBtn.textContent = '已准备';
            readyBtn.disabled = true;
            if (playerStatus[myRole]) {
                playerStatus[myRole].ready = true;
                updatePlayerStatusUI();
            }
            // 下一局走独立事件，三人都发完后服务端自动开局，不经过“开始游戏”按钮
            if (myRole === 'p1') {
                const configToSend = (currentConfig && typeof currentConfig === 'object') ? currentConfig : readConfigFromUi();
                socket.emit('next_round_ready', { config: configToSend });
            } else {
                socket.emit('next_round_ready', {});
            }
        });

        // 浏览器标签页关闭/刷新时主动断开，减少短时“幽灵连接”占用角色槽位
        window.addEventListener('beforeunload', () => {
            try {
                socket.disconnect();
            } catch {}
        });
        window.addEventListener('pagehide', () => {
            try {
                socket.disconnect();
            } catch {}
        });

        spawnRocks();
        spawnPonds();
        spawnBuildings();
        renderKeybindUI();
        updateControlGuide();
        updateTankNameDisplays();
        updateScoreboardUI();
        updatePlayerStatusUI();
        resize();
        animate(performance.now());

