import {TargetStrategy} from '../targetStrategy.mjs';
import {MODULE} from '../../helpers/utils.mjs';
import {TARGET_TYPES} from '../../constants/autoTarget.mjs';
import {isValidTarget} from '../../helpers/target.mjs';

/**
 * A strategy for getting targets for an item representing an item with a target rule.
 */
export class TargetRuleTargetStrategy extends TargetStrategy {
    /**
     * Checks whether this strategy is valid for a given item.
     * @param {FUItem} item The item to check the validity of this TargetStrategy for.
     * @returns {boolean} Whether this TargetStrategy is valid for the given item.
     */
    static isValidFor(item) {
        const behavior = game.settings.get(MODULE, 'defaultAutoTargetBehavior');
        return (
                typeof item.system.targeting?.rule === 'string' &&
                behavior === 'all' ||
                (behavior === 'attacksAndSpells' && item.type === 'spell')
            ) &&
            item.parent?.type !== 'character'; // Don't ever perform default behavior for PCs;
    }

    /**
     * @param targetPool {Set<Token>}
     * @returns {Set<Token>|null}
     */
    getTargetCandidates(targetPool = new Set()) {

        // Only proceed for single/multiple offensive spells or misc abilities, or items marked 'self'
        if (
            !(
                // Offensive spells or items without an isOffensive property marked as single/multiple
                (
                    ['single', 'multiple'].includes(this.item.system.targeting.rule) &&
                    (!this.item.system.isOffensive || this.item.system.isOffensive?.value)
                ) ||
                // Items marked 'self'
                this.item.system.targeting.rule === 'self'
            )
        ) {
            return null;
        }

        const rollerDisposition = this.getRollerDisposition();
        const rule = this.item.system.targeting?.rule;
        let targetCandidates;
        if (rule === 'self') {
            targetCandidates = new Set(this.item.actor.getActiveTokens());
        } else {
            targetCandidates = new Set(targetPool.filter(t => isValidTarget(t) &&
                t.document.disposition === -rollerDisposition));
        }
        return targetCandidates;
    }

    get maxTargets() {
        return ['self', 'single'].includes(this.item.system.targeting?.rule) ? 1 : this.item.system.targeting?.max;
    }

    get canForceTargets() {
        return this.item.system.targeting?.rule !== 'self';
    }

    get label() {
        return this.item.system.targeting?.rule !== 'self' ?
            game.i18n.localize(TARGET_TYPES.ENEMIES) :
            game.i18n.localize(TARGET_TYPES.SELF);
    }
}