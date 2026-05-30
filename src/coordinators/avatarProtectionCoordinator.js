import { watch } from 'vue';
import { toast } from 'vue-sonner';
import { i18n } from '../plugins/i18n';
import { parseLocation } from '../shared/utils';
import { avatarRequest } from '../api';
import { useAvatarProtectionSettingsStore } from '../stores/settings/avatarProtection';
import { useUserStore } from '../stores/user';
import { useNotificationStore } from '../stores/notification';

import * as workerTimers from 'worker-timers';

let _isProtectionSwitching = false;

export function isProtectionSwitching() {
    return _isProtectionSwitching;
}

function desktopNotification(title, body) {
    try {
        if (typeof WINDOWS !== 'undefined' && WINDOWS) {
            AppApi.DesktopNotification(title, body, '');
        } else if (window.electron?.desktopNotification) {
            window.electron.desktopNotification(title, body, '');
        }
    } catch (err) {
        console.error('Avatar protection: desktop notification failed', err);
    }
}

async function ensureSettings() {
    const settingsStore = useAvatarProtectionSettingsStore();
    if (!settingsStore._initialized) {
        await settingsStore.init();
    }
    return settingsStore;
}

export async function checkAvatarProtection(locationTag) {
    const settingsStore = await ensureSettings();

    if (!settingsStore.enableAvatarProtection) {
        return;
    }
    if (settingsStore.protectedAvatarIds.length === 0) {
        return;
    }

    const L = parseLocation(locationTag);
    if (!L.isRealInstance) {
        return;
    }
    if (!settingsStore.untrustedRoomTypes.includes(L.accessTypeName)) {
        return;
    }

    const userStore = useUserStore();
    const currentAvatarId = userStore.currentUser.currentAvatar;
    if (!currentAvatarId) {
        return;
    }
    if (!settingsStore.protectedAvatarIds.includes(currentAvatarId)) {
        return;
    }

    await triggerProtection();
}

async function triggerProtection() {
    const settingsStore = useAvatarProtectionSettingsStore();
    const userStore = useUserStore();
    const notificationStore = useNotificationStore();
    const t = i18n.global.t;

    const message = t('message.avatar_protection.triggered');

    desktopNotification('Avatar Protection', message);

    const noty = {
        type: 'External',
        created_at: new Date().toJSON(),
        message: message,
        displayName: 'Avatar Protection'
    };
    notificationStore.playNoty(noty);
    toast.warning(message);

    await trySwitchAvatar();
}

function waitForAvatarChange(targetId, timeoutMs) {
    const userStore = useUserStore();
    return new Promise((resolve) => {
        const start = Date.now();
        function check() {
            if (userStore.currentUser.currentAvatar === targetId) {
                resolve(true);
            } else if (Date.now() - start > timeoutMs) {
                resolve(false);
            } else {
                workerTimers.setTimeout(check, 1000);
            }
        }
        check();
    });
}

async function trySwitchAvatar() {
    const settingsStore = useAvatarProtectionSettingsStore();
    const userStore = useUserStore();
    const t = i18n.global.t;

    const targetId = settingsStore.fallbackAvatarId || userStore.currentUser.fallbackAvatar;
    if (!targetId) {
        toast.error(t('message.avatar_protection.failed'));
        return;
    }
    if (settingsStore.protectedAvatarIds.includes(targetId)) {
        toast.error(t('message.avatar_protection.fallback_is_protected'));
        return;
    }

    _isProtectionSwitching = true;
    let switched = false;
    try {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await avatarRequest.selectAvatar({ avatarId: targetId });
                const confirmed = await waitForAvatarChange(targetId, 10000);
                if (confirmed) {
                    switched = true;
                    break;
                }
            } catch (err) {
                console.error(`Avatar protection: switch attempt ${attempt + 1} failed`, err);
            }
        }

        if (!switched && settingsStore.fallbackAvatarId && userStore.currentUser.fallbackAvatar && settingsStore.fallbackAvatarId !== userStore.currentUser.fallbackAvatar) {
            const fallbackTarget = userStore.currentUser.fallbackAvatar;
            if (!settingsStore.protectedAvatarIds.includes(fallbackTarget)) {
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        await avatarRequest.selectAvatar({ avatarId: fallbackTarget });
                        const confirmed = await waitForAvatarChange(fallbackTarget, 10000);
                        if (confirmed) {
                            switched = true;
                            break;
                        }
                    } catch (err) {
                        console.error(`Avatar protection: VRChat fallback attempt ${attempt + 1} failed`, err);
                    }
                }
            }
        }

        if (switched) {
            toast.success(t('message.avatar_protection.switched'));
        } else {
            toast.error(t('message.avatar_protection.failed'));
        }
    } finally {
        _isProtectionSwitching = false;
    }
}

export function initAvatarProtection() {
    const userStore = useUserStore();
    const settingsStore = useAvatarProtectionSettingsStore();

    const currentLocation = userStore.currentUser.$locationTag;
    if (currentLocation) {
        workerTimers.setTimeout(() => {
            checkAvatarProtection(currentLocation);
        }, 5000);
    }

    watch(
        () => userStore.currentUser.currentAvatar,
        (newAvatarId, oldAvatarId) => {
            if (!newAvatarId || newAvatarId === oldAvatarId) {
                return;
            }
            if (_isProtectionSwitching) {
                return;
            }
            if (!settingsStore.enableAvatarProtection) {
                return;
            }
            if (settingsStore.protectedAvatarIds.length === 0) {
                return;
            }
            if (!settingsStore.protectedAvatarIds.includes(newAvatarId)) {
                return;
            }

            const currentLocation = userStore.currentUser.$locationTag;
            if (!currentLocation) {
                return;
            }
            const L = parseLocation(currentLocation);
            if (!settingsStore.untrustedRoomTypes.includes(L.accessTypeName)) {
                return;
            }

            triggerProtection();
        }
    );
}
