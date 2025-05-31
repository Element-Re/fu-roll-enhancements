import { MODULE } from './settings.mjs';

export function initializeActiveEffects() {
    CONFIG.statusEffects.push({
        "id": "untargetable",
        "name": `${MODULE}.effects.untargetable.label`,
        "icon": "modules/fu-roll-enhancements/assets/images/icons/invisible.svg",
    })
}