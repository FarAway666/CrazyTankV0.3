export function detectMobilePlatform() {
    const ua = navigator.userAgent || '';
    const isLikelyMobileUa = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser|UCBrowser|MQQBrowser/i.test(ua);
    const hasTouchInput = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const noHover = window.matchMedia('(hover: none)').matches;
    const isTouchDevice = hasTouchInput && (coarsePointer || noHover || isLikelyMobileUa);
    const isMobilePerfMode = isTouchDevice || isLikelyMobileUa;
    return { isTouchDevice, isMobilePerfMode, ua };
}

export function createMobileInputController({
    isTouchDevice,
    mobileControlsEl,
    unlockAudioOnce,
    handleVirtualKeyDown,
    handleVirtualKeyUp,
    getGameStarted,
    getMyRole,
    getKeyBindings,
    getCurrentPlayer,
    getTurretLocked,
    onBoostChange
}) {
    const joystickEl = document.getElementById('mc-joystick');
    const joystickKnobEl = document.getElementById('mc-joystick-knob');
    const virtualPressedActions = Object.create(null);
    const joystickState = {
        pointerId: null,
        active: false,
        centerX: 0,
        centerY: 0,
        dx: 0,
        dy: 0,
        maxRadius: 44
    };
    const lookSwipeState = {
        pointerId: null,
        active: false,
        lastX: 0
    };

    function getMyBindingCode(action) {
        const role = getMyRole();
        const bindings = getKeyBindings();
        const binding = bindings[role];
        return binding ? binding[action] : null;
    }

    function setVirtualActionState(action, pressed) {
        const code = getMyBindingCode(action);
        if (!code) return;
        const wasPressed = !!virtualPressedActions[action];
        if (pressed === wasPressed) return;
        virtualPressedActions[action] = pressed;
        if (pressed) handleVirtualKeyDown(code);
        else handleVirtualKeyUp(code);
    }

    function tapVirtualAction(action) {
        const code = getMyBindingCode(action);
        if (!code) return;
        handleVirtualKeyDown(code, false);
        requestAnimationFrame(() => handleVirtualKeyUp(code));
    }

    function releaseAllVirtualActions() {
        for (const action of Object.keys(virtualPressedActions)) {
            if (virtualPressedActions[action]) setVirtualActionState(action, false);
        }
    }

    function setLookSwipeActive(pointerId, clientX) {
        lookSwipeState.active = true;
        lookSwipeState.pointerId = pointerId;
        lookSwipeState.lastX = clientX;
    }

    function clearLookSwipe() {
        lookSwipeState.active = false;
        lookSwipeState.pointerId = null;
        lookSwipeState.lastX = 0;
    }

    function updateLookBySwipe(clientX) {
        if (!lookSwipeState.active) return;
        const player = getCurrentPlayer();
        if (!player || !player.mesh || !player.alive || player.hp <= 0) return;
        if (player.usingSatellite || player.satelliteFiring) return;
        const deltaX = clientX - lookSwipeState.lastX;
        lookSwipeState.lastX = clientX;
        const swipeSensitivity = 0.0015;
        const locked = getTurretLocked && getTurretLocked();
        if (locked) {
            player.mesh.rotation.y -= deltaX * swipeSensitivity;
            player.viewYaw = player.mesh.rotation.y;
        } else {
            player.turretYaw -= deltaX * swipeSensitivity;
            if (player.turretMesh) player.turretMesh.rotation.y = player.turretYaw;
        }
    }

    function applyJoystickVisual(dx, dy) {
        if (!joystickKnobEl) return;
        joystickKnobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    function showJoystickAt(x, y) {
        if (!joystickEl) return;
        joystickEl.style.display = 'block';
        joystickEl.style.left = `${x}px`;
        joystickEl.style.top = `${y}px`;
        joystickEl.style.transform = 'translate(-50%, -50%)';
    }

    function hideJoystick() {
        if (!joystickEl) return;
        joystickEl.style.display = 'none';
    }

    function applyJoystickActions(dx, dy) {
        const deadZone = 0.24;
        const nx = joystickState.maxRadius > 0 ? dx / joystickState.maxRadius : 0;
        const ny = joystickState.maxRadius > 0 ? dy / joystickState.maxRadius : 0;
        setVirtualActionState('left', nx < -deadZone);
        setVirtualActionState('right', nx > deadZone);
        setVirtualActionState('forward', ny < -deadZone);
        setVirtualActionState('backward', ny > deadZone);
    }

    function resetJoystick() {
        joystickState.active = false;
        joystickState.pointerId = null;
        joystickState.centerX = 0;
        joystickState.centerY = 0;
        joystickState.dx = 0;
        joystickState.dy = 0;
        applyJoystickVisual(0, 0);
        applyJoystickActions(0, 0);
        hideJoystick();
    }

    function startJoystick(pointerId, clientX, clientY) {
        const safeMargin = joystickState.maxRadius + 20;
        const centerX = Math.max(safeMargin, Math.min(window.innerWidth * 0.5 - safeMargin, clientX));
        const centerY = Math.max(safeMargin, Math.min(window.innerHeight - safeMargin, clientY));
        joystickState.active = true;
        joystickState.pointerId = pointerId;
        joystickState.centerX = centerX;
        joystickState.centerY = centerY;
        showJoystickAt(centerX, centerY);
        updateJoystickByPoint(clientX, clientY);
    }

    function updateJoystickByPoint(clientX, clientY) {
        if (!joystickState.active) return;
        let dx = clientX - joystickState.centerX;
        let dy = clientY - joystickState.centerY;
        const dist = Math.hypot(dx, dy);
        const r = joystickState.maxRadius;
        if (dist > r && dist > 0.0001) {
            const scale = r / dist;
            dx *= scale;
            dy *= scale;
        }
        joystickState.dx = dx;
        joystickState.dy = dy;
        applyJoystickVisual(dx, dy);
        applyJoystickActions(dx, dy);
    }

    function bindMobileHold(buttonId, action) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            unlockAudioOnce();
            setVirtualActionState(action, true);
        });
        const endHold = (e) => {
            e.preventDefault();
            setVirtualActionState(action, false);
        };
        btn.addEventListener('pointerup', endHold);
        btn.addEventListener('pointercancel', endHold);
        btn.addEventListener('pointerleave', endHold);
    }

    function bindMobileTap(buttonId, action) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            unlockAudioOnce();
            tapVirtualAction(action);
        });
    }

    function updateVisibility() {
        if (!mobileControlsEl) return;
        const visible = isTouchDevice && getGameStarted();
        mobileControlsEl.style.display = visible ? 'block' : 'none';
        if (!visible) resetJoystick();
    }

    function releaseAll() {
        releaseAllVirtualActions();
        resetJoystick();
        clearLookSwipe();
        if (onBoostChange) onBoostChange(false); // 页面失焦时关闭加速
    }

    bindMobileHold('mc-fire', 'fire');
    bindMobileTap('mc-weapon', 'weaponSwitch');
    bindMobileTap('mc-scope', 'scope');
    bindMobileTap('mc-mine', 'mine');

    if (onBoostChange) {
        const boostBtn = document.getElementById('mc-boost');
        if (boostBtn) {
            boostBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                unlockAudioOnce();
                onBoostChange();
            });
        }
    }

    window.addEventListener('pointerdown', (e) => {
        if (!isTouchDevice || !getGameStarted()) return;
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (target.closest('#mobile-controls, #setup-ui, #winner-msg, #keybind-modal, #settings-modal, #scoreboard, #player-status')) return;
        unlockAudioOnce();
        if (e.clientX <= window.innerWidth * 0.5) {
            startJoystick(e.pointerId, e.clientX, e.clientY);
            return;
        }
        setLookSwipeActive(e.pointerId, e.clientX);
    });

    window.addEventListener('pointermove', (e) => {
        if (!isTouchDevice) return;
        if (joystickState.active && e.pointerId === joystickState.pointerId) {
            e.preventDefault();
            updateJoystickByPoint(e.clientX, e.clientY);
            return;
        }
        if (!lookSwipeState.active || e.pointerId !== lookSwipeState.pointerId) return;
        e.preventDefault();
        updateLookBySwipe(e.clientX);
    }, { passive: false });

    const endLookSwipe = (e) => {
        if (!lookSwipeState.active || e.pointerId !== lookSwipeState.pointerId) return;
        clearLookSwipe();
    };
    const endJoystick = (e) => {
        if (!joystickState.active || e.pointerId !== joystickState.pointerId) return;
        resetJoystick();
    };
    window.addEventListener('pointerup', endJoystick);
    window.addEventListener('pointercancel', endJoystick);
    window.addEventListener('pointerup', endLookSwipe);
    window.addEventListener('pointercancel', endLookSwipe);
    window.addEventListener('blur', releaseAll);
    window.addEventListener('pagehide', releaseAll);

    return { updateVisibility, releaseAll };
}
