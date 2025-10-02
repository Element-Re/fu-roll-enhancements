import {MODULE} from './helpers/module-utils.mjs';

export function initializeActiveEffects() {
    CONFIG.statusEffects.push({
        'id': 'untargetable',
        'name': `${MODULE}.effects.untargetable.label`,
        'icon': 'modules/fu-roll-enhancements/assets/images/icons/invisible.svg',
    });
}