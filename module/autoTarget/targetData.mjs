import {getTokenThumbnail} from '../helpers/media.mjs';

export class TargetData {

    token;
    evaluation;
    thumbnail;

    randomSortWeight = Math.random();

    valid = false;
    invalidReasons = [];

    priority = false;
    priorityReasons = [];

    recommendationCount = 0;
    recommendationOrdering = [];

    finalSelectionCount = 0;

    userModified = false;

    log = [];

    constructor(token, evaluation) {
        this.token = token;
        this.thumbnail = getTokenThumbnail(token);
        this.evaluation = evaluation;
    }

    get id() {
        return this.token.id;
    }

    get actor() {
        return this.token.actor;
    }

    get recommended() {
        return this.recommendationCount > 0;
    }

    get selected() {
        return this.finalSelectionCount > 0;
    }

    get isFriendly() {
        return (
            this.token.document.disposition ===
            this.evaluation.roller.disposition
        );
    }

    get isHostile() {
        return !this.isFriendly;
    }

    get displayTier() {

        if (this.priority) {
            return 0;
        }

        if (this.recommended) {
            return 1;
        }

        if (this.valid) {
            return 2;
        }

        return 3;
    }

    validate() {
        this.valid = true;
    }

    invalidate(reason) {
        this.valid = false;

        if (reason) {
            this.invalidReasons.push(reason);
        }
    }

    markPriority(reason) {
        this.priority = true;

        if (reason) {
            this.priorityReasons.push(reason);
        }
    }

    markRecommended(order) {
        this.recommendationCount++;
        this.recommendationOrdering.push(order);
    }

    setUserModified(modified = true) {
        this.userModified = modified;
    }

    /**
     * @param a TargetData
     * @param b TargetData
     * @returns {number}
     */
    static sort(a, b) {

        // Primary:
        if (a.displayTier !== b.displayTier) {
            return a.displayTier - b.displayTier;
        }

        // Priority/recommended ordering
        if (
            a.recommendationOrdering.length > 0 &&
            b.recommendationOrdering.length > 0
        ) {
            const a_order = Math.min(...a.recommendationOrdering);
            const b_order = Math.min(...b.recommendationOrdering);
            if (a_order !== b_order) return a_order - b_order;
        }

        // Stable randomized fallback
        return a.randomSortWeight - b.randomSortWeight;
    }

}