import { ref } from 'vue';
import { defineStore } from 'pinia';
import configRepository from '../../services/config';

export const useAvatarProtectionSettingsStore = defineStore('AvatarProtectionSettings', () => {
    const enableAvatarProtection = ref(false);
    const protectedAvatarIds = ref([]);
    const fallbackAvatarId = ref('');
    const untrustedRoomTypes = ref(['public', 'groupPublic', 'groupPlus', 'group']);
    const _initialized = ref(false);
    let _initPromise = null;

    async function init() {
        if (_initPromise) return _initPromise;
        _initPromise = (async () => {
            enableAvatarProtection.value = await configRepository.getBool('avatarProtectionEnabled', false);
            protectedAvatarIds.value = await configRepository.getArray('avatarProtectionProtectedIds', []);
            fallbackAvatarId.value = await configRepository.getString('avatarProtectionFallbackId', '');
            const types = await configRepository.getArray('avatarProtectionUntrustedTypes', null);
            if (types) {
                untrustedRoomTypes.value = types;
            }
            _initialized.value = true;
        })();
        return _initPromise;
    }

    init();

    async function setEnableAvatarProtection(value) {
        enableAvatarProtection.value = value;
        await configRepository.setBool('avatarProtectionEnabled', value);
    }

    async function setProtectedAvatarIds(value) {
        protectedAvatarIds.value = value;
        await configRepository.setArray('avatarProtectionProtectedIds', value);
    }

    async function setFallbackAvatarId(value) {
        fallbackAvatarId.value = value;
        await configRepository.setString('avatarProtectionFallbackId', value);
    }

    async function setUntrustedRoomTypes(value) {
        untrustedRoomTypes.value = value;
        await configRepository.setArray('avatarProtectionUntrustedTypes', value);
    }

    return {
        enableAvatarProtection,
        protectedAvatarIds,
        fallbackAvatarId,
        untrustedRoomTypes,
        _initialized,
        init,
        setEnableAvatarProtection,
        setProtectedAvatarIds,
        setFallbackAvatarId,
        setUntrustedRoomTypes
    };
});
