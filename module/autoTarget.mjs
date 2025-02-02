import { FORCE_TARGET_EFFECTS, TARGET_TYPES } from './rolls.mjs';
import { MODULE } from './settings.mjs';
import { TEMPLATES } from './templates.mjs';



/**
 * An abstract class representing a strategy for selecting targets based on a given Item.
 * @abstract
 */
class TargetStrategy {

  /**
   * Checks whether or not this strategy is valid for a given item.
   * @abstract
   * @param {FUItem} _item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether or not this TargetStrategy is valid for the given item.
   */
  static isValidFor(_item) {
    throw new Error('Not implemented: ', this.isValidFor);
  }
  /**
   * Constructs a new TargetStrategy.
   * @param {FUItem} item An Item document applicable to this TargetStrategy.
   */
  constructor (item) {
    if(typeof item !== 'object' || item.documentName !== 'Item') {
      throw new Error('Not an item: ', item);
    }
    this.item = item;
  }
  /**
   * Gets targets for the given item.
   */
  getTargetCandidates() {
    throw new Error('Not implemented: ', this.getTargetCandidates);
  }

  /**
   * Gets a roller for this strategy, which is a token representing the the item's actor of this strategy.
   * @returns {Token} The roller for this strategy, which either a scene token for the item's owner, or their prototype token.
   */
  getRoller() {
    return this.getRollerFor(this.item);
  }

  /**
   * Gets a roller for a given item, which is a token representing the item's actor.
   * @param {FUItem} item The item for get a roller for.
   * @returns {Token} The roller for this strategy, which either a scene token for the item's owner, or their prototype token.
   */
  getRollerFor(item) {
    return item.actor.token ?? item.actor.prototypeToken;
  }

  /**
   * Get an effective disposition of this strategy's roller.
   * @returns {number} Either CONST.TOKEN_DISPOSITIONS.FRIENDLY or CONST.TOKEN_DISPOSITIONS.HOSTILE.
   * NEUTRAL is treated as FRIENDLY and SECRET is treated as HOSTILE for the sake of rolling.
   */
  getRollerDisposition() {
    return this.getRollerDispositionFor(this.getRoller());
  }
  /**
   * Get an effective disposition of a given roller.
   * @param {Token} roller A token representing the item's roller.
   * @returns {number} Either CONST.TOKEN_DISPOSITIONS.FRIENDLY or CONST.TOKEN_DISPOSITIONS.HOSTILE.
   * NEUTRAL is treated as FRIENDLY and SECRET is treated as HOSTILE for the sake of rolling.
   */
  getRollerDispositionFor(roller) {
    // Treat neutral rolls as friendly and secret rolls as hostile for the sake of targetting.
		return roller.disposition === CONST.TOKEN_DISPOSITIONS.NEUTRAL ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : 
			roller.disposition === CONST.TOKEN_DISPOSITIONS.SECRET ? CONST.TOKEN_DISPOSITIONS.HOSTILE : 
			roller.disposition;
  }
  
}

/**
 * A strategy for getting targets for an item representing an attack.
 */
class AttackTargetStrategy extends TargetStrategy {
  /**
   * Checks whether or not this strategy is valid for a given item.
   * @param {FUItem} item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether or not this TargetStrategy is valid for the given item.
   */
  static isValidFor(item) {
    return item.type === 'basic' || item.type === 'weapon';
  }
  
  getTargetCandidates() {
    if(this.item.system.type.value === 'melee') {
      // TODO
    } else if (this.item.system.type.value == 'ranged') {
      // TODO
    } else return [];
  }
}
/**
 * A strategy for getting targets for an item representing a spell.
 */
class SpellTargetStrategy extends TargetStrategy {
  /**
   * Checks whether or not this strategy is valid for a given item.
   * @param {FUItem} item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether or not this TargetStrategy is valid for the given item.
   */
  static isValidFor(item) {
    return item.type === 'spell';
  }
}

/**
 * A strategy based on custom rules set by a user on an item itself.
 */
class CustomTargetStrategy extends TargetStrategy {
  
  /**
   * Checks whether or not this strategy is valid for a given item
   * @param {FUItem} item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether or not this TargetStrategy is valid for the given item.
   * True if the item has custom autoTarget configuration options set, or false otherwise.
   */
  static isValidFor(item) {
    return Boolean(AutoTarget.getOptionsFor(item));
  }

  /**
   * Gets an array of possible target candidates based on the custom rules set on an item.
   * @returns {Token[]}
   */
  getTargetCandidates() {
    const roller = this.getRoller();
    const rollerDisposition = this.getRollerDispositionFor(roller);
    let targetFilter;
    const options = AutoTarget.getOptionsFor(this.item);
      if (options.targetType === 'ALLIES') {
        targetFilter = t => t.document.disposition === rollerDisposition && t.actor.id !== this.item.actor.id && t.id !== roller.id;
      } else if (options.targetType === 'ALLIES_AND_SELF') {
        targetFilter = t => t.document.disposition === rollerDisposition;
      } else if (options.targetType === 'ALL') {
        targetFilter = t => [CONST.TOKEN_DISPOSITIONS.FRIENDLY, CONST.TOKEN_DISPOSITIONS.HOSTILE].includes(t.document.disposition);
      } else {
        // ENEMIES, ENEMIES_MELEE, ENEMIES_MELEE_FLYING
        targetFilter = t => {
          return !t.document.hidden &&
            t.document.disposition === -rollerDisposition && 
            !actorHasStatus(t.actor, ...UNTARGETABLE_ALL_EFFECTS) && 
            !(
              ('ENEMIES_MELEE' === options.targetType && !actorHasStatus(this.item.actor, 'flying') && actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_EFFECTS))
              || 
              (
                ('ENEMIES_MELEE_FLYING' === options.targetType || ('ENEMIES_MELEE' === options.targetType && actorHasStatus(this.item.actor, 'flying'))) && 
                actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_FLYING_EFFECTS)
              )
            );
        };
    }
    return game.canvas.tokens.placeables.filter(targetFilter);
  }
  
}

/**
 * Checks whether a given actor has one or more of a set of given statuses.
 * @param {FUActor} actor The actor to check for statuses.
 * @param  {...String} statuses One or more status String keys.
 * @returns {boolean} True if the actor has at least one status in the set of given statuses.
 */
function actorHasStatus(actor, ...statuses) {
	return actor.statuses.some(s => statuses.includes(s));
}

const UNTARGETABLE_MELEE_EFFECTS = ['flying', 'cover'];

const UNTARGETABLE_MELEE_FLYING_EFFECTS = ['cover'];

const UNTARGETABLE_ALL_EFFECTS = ['ko', 'untargetable'];

//const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];

export class AutoTarget {
  static #strategies = [CustomTargetStrategy, AttackTargetStrategy, SpellTargetStrategy];
  static #getStrategyFor(item) {
    if(typeof item !== 'object' || item.documentName !== 'Item') {
      throw new Error('Not an item: ', item);
    } 
    for(const strategy of this.#strategies) {
      if(strategy.isValidFor(item)) {
        return new strategy(item);
      }
    }
    throw new Error('No target strategy found for: ', item);
  }
  static async execute(options, item) {
    if (!options || !item) return;
    // Default targetType to 'ENEMIES'
    options = foundry.utils.deepClone(options);
    options.targetType = options.targetType || 'ENEMIES';
    const targetList = new Map();
    if (options.targetType === 'SELF') {
      item.actor.getActiveTokens().forEach(t => targetList.set(t, { count: 1 }));
    } else {
      let targetCandidates = AutoTarget.#getStrategyFor(item).getTargetCandidates();
  
      if (typeof options.maxTargets === 'number' && options.maxTargets > 0) {
  
        const forcedTargetsMap = new Map();
  
        // Force targets only for rolls targeting enemies.
        if (['ENEMIES', 'ENEMIES_MELEE', 'ENEMIES_MELEE_FLYING'].includes(options.targetType)) {
          [...item.actor.appliedEffects].forEach(e => {
            const effectStatuses = [...e.statuses];
            if (e.origin && effectStatuses.some(s => FORCE_TARGET_EFFECTS.includes(s))) {
              const origin = fromUuidSync(e.origin);
              const forcedTargetIndex = targetCandidates.findIndex(t => t.document.actor.uuid === (origin.actor || origin)?.uuid);
              if (forcedTargetIndex >= 0) {
                const forcedTarget = options.repeat ? targetCandidates[forcedTargetIndex] : targetCandidates.splice(forcedTargetIndex, 1)[0];
                forcedTargetsMap.set(forcedTarget, e);
              } else {
                ui.notifications.warn(game.i18n.format(`${MODULE}.autoTarget.errors.forcedTargetInvalid`, { effect: e.name, roller: (item.actor.token || item.actor.prototypeToken).name }));
                return false;
              }
            }
          });
        }
  
        const forcedTargets = [...forcedTargetsMap.keys()];
  
        let i = 0;
        while (i < options.maxTargets && (forcedTargets.length > 0 || targetCandidates.length > 0)) {
          const forced = forcedTargets.length > 0;
          let drawPile = forced ? forcedTargets : targetCandidates;
          var start = Math.floor(Math.random() * (drawPile.length));
          const target = options.repeat && drawPile === targetCandidates ? drawPile[start] : drawPile.splice(start, 1)[0];
          targetList.set(target, (targetList.has(target) ? foundry.utils.mergeObject(targetList.get(target), { count: targetList.get(target).count + 1 }) : { count: 1, forcedBy: forcedTargetsMap.get(target) }));
          i++;
        }
      } else targetCandidates.forEach(t => targetList.set(t, { count: 1 }));
    }
  
    return {
      count: [...targetList.keys()].reduce((count, t) => targetList.get(t).count + count, 0),
      finalize: async () => {
        game.user.updateTokenTargets([...targetList.keys()].map(t => t.id));
  
        const templateData = {
          results: [...targetList.keys()].map(t => foundry.utils.mergeObject(targetList.get(t), { target: t })),
          targetType: game.i18n.localize(TARGET_TYPES[options.targetType])
        };
        ChatMessage.create({
          content: await renderTemplate(TEMPLATES.AUTO_TARGET_RESULTS, templateData),
          speaker: {
            actor: item.actor,
            token: item.actor.token
          },
          flavor: `${item.name}`
        });
      }
    };
  
  }

  /**
   * Gets the AutoTarget options for a given item.
   * @param {FUItem} item The item to get AutoTarget options for.
   * @returns {object|null} The autoTarget options for the item if they exist, or null.
   */
  static getOptionsFor(item) {
    return item.getFlag(MODULE, 'autoTarget');
  }
}

