/**
 * An abstract class representing a strategy for selecting targets based on a given Item.
 * @abstract
 */
export class TargetStrategy {

    /**
     * Checks whether this strategy is valid for a given item.
     * @abstract
     * @param {FUItem} _item The item to check the validity of this TargetStrategy for.
     * @returns {boolean} Whether or not this TargetStrategy is valid for the given item.
     */
    static isValidFor(_item) {
        throw new Error('Not implemented');
    }

    /**
     * Constructs a new TargetStrategy.
     * @param {FUItem} item An Item document applicable to this TargetStrategy.
     */
    constructor(item) {
        if (typeof item !== 'object' || item.documentName !== 'Item') {
            throw new Error(`Not an item: ${item}`);
        }
        this.item = item;
    }

    /**
     * Gets possible targets based on the rules of the target strategy and the item assigned to the strategy.
     * @param targetPool {Set<Token>} The entire pool of targets to find target candidates from.
     * @returns {Set<Token>|null} All possible target candidates identified by the strategy, or null if the strategy
     * failed.
     */
    // eslint-disable-next-line no-unused-vars
    getTargetCandidates(targetPool) {
        throw new Error('Not implemented');
    }

    /**
     * @returns {string} A label describing the kind of adversaries selected by this strategy.
     */
    get label() {
        throw new Error('Not implemented');
    }

    /**
     * @returns {boolean} True if the strategy can force targets for its item, otherwise false;
     */
    get canForceTargets() {
        return false;
    }

    get canRepeatTargets() {
        return false;
    }

    /**
     * @returns {number | null} The maximum number of targets for this strategy's item.
     */
    get maxTargets() {
        throw new Error('Not implemented');
    }

    /**
     * Gets a roller for this strategy, which is a token representing the the item's actor of this strategy.
     * @returns {TokenDocument} The roller for this strategy, which either a scene token for the item's owner, or their prototype token.
     */
    getRoller() {
        return TargetStrategy.getRollerFor(this.item);
    }

    /**
     * Gets a roller for a given item, which is a token representing the item's actor.
     * @param {FUItem} item The item for get a roller for.
     * @returns { TokenDocument | PrototypeTokenData } The roller for this strategy, which either a scene token for the item's owner, or their prototype token.
     */
    static getRollerFor(item) {
        return item.actor.token || item.actor.prototypeToken;
    }

    /**
     * Get an effective disposition of this strategy's roller.
     * @returns {number} Either CONST.TOKEN_DISPOSITIONS.FRIENDLY or CONST.TOKEN_DISPOSITIONS.HOSTILE.
     * NEUTRAL is treated as FRIENDLY and SECRET is treated as HOSTILE for the sake of rolling.
     */
    getRollerDisposition() {
        return TargetStrategy.getRollerDispositionFor(this.getRoller());
    }

    /**
     * Get an effective disposition of a given roller.
     * @param {TokenDocument} roller A token representing the item's roller.
     * @returns {number} Either CONST.TOKEN_DISPOSITIONS.FRIENDLY or CONST.TOKEN_DISPOSITIONS.HOSTILE.
     * NEUTRAL is treated as FRIENDLY and SECRET is treated as HOSTILE for the sake of rolling.
     */
    static getRollerDispositionFor(roller) {
        // Treat neutral rolls as friendly and secret rolls as hostile for the sake of targetting.
        return roller.disposition === CONST.TOKEN_DISPOSITIONS.NEUTRAL ? CONST.TOKEN_DISPOSITIONS.FRIENDLY :
            roller.disposition === CONST.TOKEN_DISPOSITIONS.SECRET ? CONST.TOKEN_DISPOSITIONS.HOSTILE :
                roller.disposition;
    }

}