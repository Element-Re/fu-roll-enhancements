import {MODULE} from './utils.mjs';

/**
 * Gets the numerical weight of a target based on an actor flag, if present.
 */
export function getTargetWeight(token) {

    if (token) {
        const weight = token.actor.getFlag(MODULE, 'targetWeight');

        if (typeof weight === 'number' && weight > 0) {
            return weight;
        }
        else if (weight != null) {
            console.warn(`Invalid target weight for ${ token.name }: ${weight}`);
        }
    }

    return 1;
}