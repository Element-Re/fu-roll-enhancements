import {TargetStrategy} from '../targetStrategy.mjs';
import {AutoTarget} from '../autoTarget.mjs';
import {
    TARGET_TYPES,
    UNTARGETABLE_MELEE_EFFECTS,
    UNTARGETABLE_MELEE_FLYING_EFFECTS
} from '../../constants/autoTarget.mjs';
import {actorHasStatus} from '../../helpers/utils.mjs';
import {isValidTarget} from '../../helpers/target.mjs';

/**
 * A strategy based on custom rules set by a user on an item itself, or passed in explicitly to the strategy.
 */
export class CustomTargetStrategy extends TargetStrategy {

    constructor(item, options) {
        super(item);
        this._options = options;
    }

    get options() {
        return this._options || AutoTarget.getOptionsFor(this.item);
    }

    /**
     * Checks whether this strategy is valid for a given item
     * @param {FUItem} item The item to check the validity of this TargetStrategy for.
     * @returns {boolean} Whether this TargetStrategy is valid for the given item.
     * True if the item has custom autoTarget configuration options set and enabled, or false otherwise.
     */
    static isValidFor(item) {
        const options = AutoTarget.getOptionsFor(item);
        return options?.enable;
    }

    /**
     * @param targetPool {Set<Token>}
     * @returns {Set<Token>|null}
     */
    getTargetCandidates(targetPool = new Set()) {
        const roller = this.getRoller();
        const rollerDisposition = this.getRollerDisposition();
        let targetFilter;
        const options = this.options;
        if (options.targetType === 'SELF') {
            return [roller.actor.getActiveTokens()[0]];
        } else if (options.targetType === 'ALLIES') {
            targetFilter = t => t.document.disposition === rollerDisposition && t.actor.id !== this.item.actor.id && t.id !== roller.id;
        } else if (options.targetType === 'ALLIES_AND_SELF') {
            targetFilter = t => t.document.disposition === rollerDisposition;
        } else if (options.targetType === 'ALL') {
            targetFilter = t => [CONST.TOKEN_DISPOSITIONS.FRIENDLY, CONST.TOKEN_DISPOSITIONS.HOSTILE].includes(t.document.disposition);
        } else if (['ENEMIES', 'ENEMIES_MELEE', 'ENEMIES_MELEE_FLYING'].includes(options.targetType)) {
            targetFilter = t => {
                return isValidTarget(t) &&
                    t.document.disposition === -rollerDisposition &&
                    !(
                        ('ENEMIES_MELEE' === options.targetType && !actorHasStatus(this.item.actor, 'flying') && actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_EFFECTS))
                        ||
                        (
                            ('ENEMIES_MELEE_FLYING' === options.targetType || ('ENEMIES_MELEE' === options.targetType && actorHasStatus(this.item.actor, 'flying'))) &&
                            actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_FLYING_EFFECTS)
                        )
                    );
            };
        } else return null;
        return new Set(targetPool.filter(targetFilter));
    }

    get canForceTargets() {
        return ['ENEMIES', 'ENEMIES_MELEE', 'ENEMIES_MELEE_FLYING'].includes(this.options.targetType);
    }

    get canRepeatTargets() {
        return Boolean(this.options.repeat);
    }

    get maxTargets() {
        return this.options.maxTargets;
    }

    get label() {
        return game.i18n.localize(TARGET_TYPES[this.options.targetType]);
    }
}