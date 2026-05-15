export const MODULE = 'fu-roll-enhancements';

/**
 * Checks whether a given actor has one or more of a set of given statuses.
 * @param {FUActor} actor The actor to check for statuses.
 * @param  {...String} statuses One or more status String keys.
 * @returns {boolean} True if the actor has at least one status in the set of given statuses.
 */
export function actorHasStatus(actor, ...statuses) {
    return actor && !actor.statuses.isDisjointFrom(new Set(statuses));
}