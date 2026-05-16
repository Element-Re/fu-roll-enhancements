import {actorHasStatus} from './utils.mjs';
import {UNTARGETABLE_ALL_EFFECTS} from '../constants/autoTarget.mjs';

export function isValidTarget(token) {
    return !token.document.hidden &&
        !actorHasStatus(token.actor, ...UNTARGETABLE_ALL_EFFECTS) &&
        [CONST.TOKEN_DISPOSITIONS.FRIENDLY, CONST.TOKEN_DISPOSITIONS.HOSTILE].includes(token.document.disposition);
}