import { watch } from 'vue';
import { toast } from 'vue-sonner';
import { i18n } from '../plugins/i18n';
import { parseLocation } from '../shared/utils';
import { avatarRequest } from '../api';
import { useAvatarProtectionSettingsStore } from '../stores/settings/avatarProtection';
import { useUserStore } from '../stores/user';
import { useNotificationStore } from '../stores/notification';

let _isProtectionSwitching = false;

export function isProtectionSwitching() {
    return _isProtectionSwitching;
}

export function checkAvatarProtection(locationTag) {
    const settingsStore = useAvatarProtectionSettingsStore();
    const userStore = useUserStore();

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

    const currentAvatarId = userStore.currentUser.currentAvatar;
    if (!currentAvatarId) {
        return;
    }
    if (!settingsStore.protectedAvatarIds.includes(currentAvatarId)) {
        return;
    }

    triggerProtection();
}

async function triggerProtection() {
    const settingsStore = useAvatarProtectionSettingsStore();
    const userStore = useUserStore();
    const notificationStore = useNotificationStore();
    const t = i18n.global.t;

    const noty = {
        type: 'External',
        created_at: new Date().toJSON(),
        message: t('message.avatar_protection.triggered', {
            avatarName: userStore.currentUser.displayName || ''
        })
    };
    notificationStore.playNoty(noty);
    toast.warning(t('message.avatar_protection.triggered'));

    await trySwitchAvatar();
}

async function trySwitchAvatar() {
    const settingsStore = useAvatarProtectionSettingsStore();
    const userStore = useUserStore();
    const t = i18n.global.t;

    if (settingsStore.fallbackAvatarId) {
        if (settingsStore.protectedAvatarIds.includes(settingsStore.fallbackAvatarId)) {
            toast.error(t('message.avatar_protection.fallback_is_protected'));
            return;
        }

        _isProtectionSwitching = true;
        try {
            await avatarRequest.selectAvatar({ avatarId: settingsStore.fallbackAvatarId });
            toast.success(t('message.avatar_protection.switched'));
            return;
        } catch (err) {
            console.error('Avatar protection: fallback switch failed', err);
        } finally {
            _isProtectionSwitching = false;
        }
    }

    if (userStore.currentUser.fallbackAvatar) {
        _isProtectionSwitching = true;
        try {
            await avatarRequest.selectAvatar({ avatarId: userStore.currentUser.fallbackAvatar });
            toast.success(t('message.avatar_protection.switched'));
            return;
        } catch (err) {
            console.error('Avatar protection: VRChat fallback switch failed', err);
        } finally {
            _isProtectionSwitching = false;
        }
    }

    toast.error(t('message.avatar_protection.failed'));
}

export function initAvatarProtection() {
    const userStore = useUserStore();
    const settingsStore = useAvatarProtectionSettingsStore();

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
