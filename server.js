const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

let players = {};
// 支持 p1 / p2 / p3 / p4 四个角色，按顺序轮流分配
const ROLE_CYCLE = ['p1', 'p2', 'p3', 'p4'];
let nextRoleIndex = 0;
// 房间状态：谁已经点了开始、主机配置
let readyState = { p1: false, p2: false, p3: false, p4: false };
let hostConfig = null;
// 下一局：所有在线玩家都点“下一局”后自动开局，用独立状态，避免与主菜单“准备”混淆
let nextRoundReady = { p1: false, p2: false, p3: false, p4: false };

function getDefaultConfig() {
    return {
        collisionDamageEnabled: true,
        poisonCircleEnabled: true,
        bulletSpreadEnabled: true,
        minesEnabled: true,
        satelliteLaserEnabled: false,
        buildingCount: 6
    };
}

function allActiveReady() {
    if (!hostConfig) return false;
    const activeRoles = new Set(Object.values(players));
    for (const role of activeRoles) {
        if (!readyState[role]) return false;
    }
    return activeRoles.size > 0;
}

function allNextRoundReady() {
    const activeRoles = new Set(Object.values(players));
    if (activeRoles.size === 0) return false;
    for (const role of activeRoles) {
        if (!nextRoundReady[role]) return false;
    }
    return true;
}

let readyUpdateSeq = 0;
function emitReadyUpdate() {
    readyUpdateSeq += 1;
    const activeRoles = Array.from(new Set(Object.values(players)));
    const readyStatePayload = {};
    for (const role of ROLE_CYCLE) {
        readyStatePayload[role] = !!readyState[role];
    }
    io.emit('ready_update', { readyState: readyStatePayload, activeRoles, hasHostConfig: !!hostConfig, _seq: readyUpdateSeq });
}

io.on('connection', (socket) => {
    // 优先分配当前空闲的角色槽（如有人断线重连则拿回该槽位），避免“重新战斗”后出现重复角色
    const usedRoles = new Set(Object.values(players));
    let role = null;
    for (const r of ROLE_CYCLE) {
        if (!usedRoles.has(r)) {
            role = r;
            break;
        }
    }
    if (role === null) {
        role = ROLE_CYCLE[nextRoleIndex];
        nextRoleIndex = (nextRoleIndex + 1) % ROLE_CYCLE.length;
    }
    players[socket.id] = role;
    console.log(`玩家连接: ${socket.id} 角色: ${role}`);
    socket.emit('assign_role', role);
    io.emit('player_joined', { role });

    // 告诉新加入的玩家当前已经在线的所有角色，用于刷新“已加入”状态
    const activeRoles = Array.from(new Set(Object.values(players)));
    socket.emit('current_players', { roles: activeRoles });
    // 新连接也同步一次准备状态（带 _seq:0，避免与首轮 emitReadyUpdate 的 seq:1 冲突导致主机漏应用“全部准备”）
    const readyInit = {};
    for (const r of ROLE_CYCLE) readyInit[r] = !!readyState[r];
    socket.emit('ready_update', { readyState: readyInit, activeRoles, hasHostConfig: !!hostConfig, _seq: 0 });

    // 转发位置同步信息（携带角色标识）
    socket.on('update_pos', (data) => {
        socket.broadcast.emit('enemy_pos', data);
    });

    // 转发进草状态，保证任意玩家进草时其他视角都能正确显示半透明
    socket.on('grass_state', (data) => {
        socket.broadcast.emit('grass_state', data);
    });

    // 转发开火指令（携带发射方角色）
    socket.on('fire', (data) => {
        // data 中应至少包含 { role: 'p1' | 'p2' | 'p3' }
        socket.broadcast.emit('enemy_fire', data);
    });

    // 电磁炮命中：广播被眩晕目标与时长，供各端同步显示
    socket.on('stun_hit', (data) => {
        if (data && data.targetRole != null && data.durationMs != null) {
            io.emit('enemy_stunned', { role: data.targetRole, durationMs: data.durationMs });
        }
    });

    // 剧毒炮命中：广播命中端计算好的中毒结束时间给其他客户端（命中者已在本地更新）
    socket.on('poison_add', (data) => {
        if (data && data.role != null && data.poisonEndAt != null) {
            socket.broadcast.emit('poison_add', data);
        }
    });

    // 主机权威受击同步：仅接受主机(p1)上报的命中结果，再统一广播给所有客户端
    socket.on('hit_report', (data) => {
        const reporterRole = players[socket.id];
        if (reporterRole !== 'p1') return;
        if (!data || !data.targetRole || typeof data.dmg !== 'number') return;
        io.emit('hit_sync', data);
    });

    // 转发武器切换，同步多方武器状态
    socket.on('weapon_switch', (data) => {
        // data: { role: 'p1' | 'p2' | 'p3', weapon: 'mg' | 'cannon' }
        socket.broadcast.emit('enemy_weapon_switch', data);
    });

    // 转发血量同步信息（每个客户端只负责同步自己的血量）
    socket.on('hp_update', (data) => {
        // 直接广播给其他客户端，由它们更新对应角色的血量显示
        socket.broadcast.emit('enemy_hp', data);
    });

    // 转发瞄准镜开关状态，用于严格同步瞄准镜数值效果
    socket.on('scope_state', (data) => {
        // data: { role: 'p1' | 'p2' | 'p3', scoping: boolean }
        socket.broadcast.emit('scope_state', data);
    });

    // 转发玩家被摧毁事件，用于所有客户端显示结算
    socket.on('player_dead', (data) => {
        // data: { role: 'p1' | 'p2' | 'p3' }
        io.emit('player_dead', data);
    });

    // 主菜单“准备”：只更新 readyState，不自动开局；开局由主机点击“开始游戏”(start_request) 触发
    socket.on('host_ready', (data) => {
        if (data.config && typeof data.config === 'object') hostConfig = data.config;
        readyState.p1 = true;
        io.emit('role_ready', { role: 'p1' });
        emitReadyUpdate();
    });

    socket.on('client_ready', (data) => {
        const role = data && data.role;
        if (!role || !readyState.hasOwnProperty(role)) return;
        readyState[role] = true;
        io.emit('role_ready', { role });
        emitReadyUpdate();
    });

    // 主机点击“开始游戏”：主菜单下只有此时才发 start_game
    socket.on('start_request', (data) => {
        if (data && data.role !== 'p1') return;
        if (!allActiveReady()) return;
        const configToEmit = (hostConfig && typeof hostConfig === 'object') ? hostConfig : getDefaultConfig();
        io.emit('start_game', configToEmit);
        readyState = { p1: false, p2: false, p3: false, p4: false };
        emitReadyUpdate();
    });

    // 战斗结束后点“下一局”：三人都发 next_round_ready 后自动开局，不依赖“开始游戏”按钮
    socket.on('next_round_ready', (data) => {
        const role = players[socket.id];
        if (!role || !nextRoundReady.hasOwnProperty(role)) return;
        if (data && data.config && typeof data.config === 'object') hostConfig = data.config;
        nextRoundReady[role] = true;
        if (!allNextRoundReady()) return;
        const configToEmit = (hostConfig && typeof hostConfig === 'object') ? hostConfig : getDefaultConfig();
        io.emit('start_game', configToEmit);
        nextRoundReady = { p1: false, p2: false, p3: false, p4: false };
        emitReadyUpdate();
    });

    // 任意玩家点击“回到主菜单”时，广播让所有玩家计分板清零
    socket.on('back_to_menu', () => {
        io.emit('clear_scoreboard');
    });

    socket.on('disconnect', () => {
        const role = players[socket.id];
        delete players[socket.id];
        console.log('玩家断开');
        if (role) {
            io.emit('player_left', { role });
        }
        // 断线的角色标记为未准备
        if (role && readyState.hasOwnProperty(role)) {
            readyState[role] = false;
        }
        emitReadyUpdate();
        // 当场上无人时，重置为从 p1 重新开始，并清空准备状态和配置
        if (Object.keys(players).length === 0) {
            nextRoleIndex = 0;
            readyState = { p1: false, p2: false, p3: false, p4: false };
            hostConfig = null;
        }
    });
});

// 监听端口 3000
const PORT = 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`服务器已启动！`);
    console.log(`主机请访问: http://localhost:${PORT}`);
    console.log(`队友请访问: http://你的内网IP:${PORT}`);
});