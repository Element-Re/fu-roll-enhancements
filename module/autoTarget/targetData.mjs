import {getTokenThumbnail} from '../helpers/media.mjs';

export class TargetData {

    uid = foundry.utils.randomID();

    token;
    context;
    thumbnail;

    presentationWeight = Math.random();

    valid = false;
    invalidReason;

    priority = false;
    priorityReason;

    recommended = false;
    recommendationReason;

    userSelected = false;

    log = [];

    constructor(token, context) {
        this.token = token;
        this.context = context;
    }

    get id() {
        return this.token.id;
    }

    get actor() {
        return this.token.actor;
    }

    get isFriendly() {
        return (
            this.token.document.disposition ===
            this.context.roller.disposition
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

    async init() {
        this.thumbnail = await getTokenThumbnail(this.token);
    }

    validate() {
        this.valid = true;
    }

    invalidate(reason) {
        this.valid = false;

        this.invalidReason = reason;
    }

    markPriority(reason) {
        this.priority = true;
        this.priorityReason = reason;
    }

    markRecommended(reason) {
        this.recommended = true;
        this.recommendationReason = reason;
    }

    setUserSelected(modified = true) {
        this.userSelected = modified;
    }

    /**
     * @param a TargetData
     * @param b TargetData
     * @returns {number}
     */
    static sort(a, b) {

        return a.presentationWeight - b.presentationWeight;
    }

    /**
     * @param a TargetData
     * @param b TargetData
     * @returns {number}
     */
    static tierSort(a, b) {

        if (a.displayTier !== b.displayTier) {
            return a.displayTier - b.displayTier;
        }

        return a.presentationWeight - b.presentationWeight;
    }
}