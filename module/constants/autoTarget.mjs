import {MODULE} from '../helpers/utils.mjs';

export const TARGET_TYPES = Object.freeze({
    ENEMIES: `${MODULE}.autoTarget.options.targetType.types.enemies`,
    ENEMIES_MELEE: `${MODULE}.autoTarget.options.targetType.types.enemiesMelee`,
    ENEMIES_MELEE_FLYING: `${MODULE}.autoTarget.options.targetType.types.enemiesMeleeFlying`,
    ALLIES: `${MODULE}.autoTarget.options.targetType.types.allies`,
    SELF: `${MODULE}.autoTarget.options.targetType.types.self`,
    ALLIES_AND_SELF: `${MODULE}.autoTarget.options.targetType.types.alliesAndSelf`,
    ALL: `${MODULE}.autoTarget.options.targetType.types.all`
});
export const UNTARGETABLE_MELEE_EFFECTS = ['flying', 'cover'];
export const UNTARGETABLE_MELEE_FLYING_EFFECTS = ['cover'];
export const UNTARGETABLE_ALL_EFFECTS = ['ko', 'untargetable'];
export const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];