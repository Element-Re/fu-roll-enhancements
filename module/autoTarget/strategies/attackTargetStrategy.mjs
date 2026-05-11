import {TargetStrategy} from '../targetStrategy.mjs';
import {actorHasStatus, MODULE} from '../../helpers/utils.mjs';
import {
    TARGET_TYPES,
    UNTARGETABLE_ALL_EFFECTS,
    UNTARGETABLE_MELEE_EFFECTS,
    UNTARGETABLE_MELEE_FLYING_EFFECTS
} from '../../constants/autoTarget.mjs';

/**
 * A strategy for getting targets for an item representing an attack or weapon.
 */
export class AttackTargetStrategy extends TargetStrategy {
    /**
     * Checks whether this strategy is valid for a given item.
     * @param {FUItem} item The item to check the validity of this TargetStrategy for.
     * @returns {boolean} Whether this TargetStrategy is valid for the given item.
     */
    static isValidFor(item) {
        return ['attacksAndSpells', 'all'].includes(game.settings.get(MODULE, 'defaultAutoTargetBehavior')) &&
            (item.type === 'basic' || item.type === 'weapon') &&
            item.parent?.type !== 'character'; // Don't ever perform default behavior for PCs.
    }

    /**
     * @param targetPool {Set<Token>}
     * @returns {Set<Token>}
     */
    getTargetCandidates(targetPool = new Set()) {
        const rollerDisposition = this.getRollerDisposition();

        const basicFilter = (t) => !t.document.hidden &&
            t.document.disposition === -rollerDisposition &&
            !actorHasStatus(t.actor, ...UNTARGETABLE_ALL_EFFECTS);
        const filters = [basicFilter];
        if (this.item.system.type.value === 'melee') {
            if (actorHasStatus(this.item.actor, 'flying')) {
                filters.push((t) => !actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_FLYING_EFFECTS));
            } else {
                filters.push((t) => !actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_EFFECTS));
            }
        }
        let targetCandidates = new Set(targetPool);
        filters.forEach(f => targetCandidates = targetCandidates.filter(f));
        return new Set(targetCandidates);
    }

    get canForceTargets() {
        return true;
    }

    get maxTargets() {
        // Attacks always default to one target. Anything else needs a custom strategy.
        return 1;
    }

    get label() {
        if (this.item.system.type.value === 'melee') {
            if (actorHasStatus(this.item.actor, 'flying')) {
                return game.i18n.localize(TARGET_TYPES.ENEMIES_MELEE_FLYING);
            } else {
                return game.i18n.localize(TARGET_TYPES.ENEMIES_MELEE);
            }

        } else {
            return game.i18n.localize(TARGET_TYPES.ENEMIES);
        }
    }
}