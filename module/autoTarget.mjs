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
   * Gets possible targets based on the rules of the target strategy and the item assigned to the strategy.
   * @returns {Target[]} All possible target candidates identified by the strategy.
   */
  getTargetCandidates() {
    throw new Error('Not implemented: getTargetCandidates');
  }

  
  get label() {
    throw new Error('Not implemented: get label');
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
   * @returns {boolean} The maximum number of targets, for this strategy's item.
   */
  get maxTargets() {
    return null;
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
 * A strategy for getting targets for an item representing an attack or weapon.
 */
class AttackTargetStrategy extends TargetStrategy {
  /**
   * Checks whether or not this strategy is valid for a given item.
   * @param {FUItem} item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether or not this TargetStrategy is valid for the given item.
   */
  static isValidFor(item) {
    return ['attacksAndSpells', 'all'].includes(game.settings.get(MODULE, 'defaultAutoTargetBehavior')) && 
    (item.type === 'basic' || item.type === 'weapon');
  }
  
  getTargetCandidates() {
    const roller = this.getRoller();
    const rollerDisposition = this.getRollerDispositionFor(roller);

    const basicFilter = (t) => !t.document.hidden &&
          t.document.disposition === -rollerDisposition && 
          !actorHasStatus(t.actor, ...UNTARGETABLE_ALL_EFFECTS);
    const filters = [basicFilter];
    if(this.item.system.type.value === 'melee') {
      if (actorHasStatus(this.item.actor, 'flying')) {
        filters.push((t) => !actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_FLYING_EFFECTS));
      }
      else {
        filters.push((t) => !actorHasStatus(t.actor, ...UNTARGETABLE_MELEE_EFFECTS));
      } 
    }
    let targetCandidates = [...game.canvas.tokens.placeables];
    filters.forEach(f => targetCandidates = targetCandidates.filter(f));
    return targetCandidates;
  }

  get maxTargets() {
    // Attacks always default to one target. Anything needs a custom strategy.
    return 1;
  }

  get label() {
    if(this.item.system.type.value === 'melee') {
      if (actorHasStatus(this.item.actor, 'flying')) {
        return game.i18n.localize(TARGET_TYPES.ENEMIES_MELEE_FLYING);
      }
      else {
        return game.i18n.localize(TARGET_TYPES.ENEMIES_MELEE);
      } 

    } else {
      return game.i18n.localize(TARGET_TYPES.ENEMIES);
    }
  }
}
/**
 * A strategy for getting targets for an item representing an item with a target rule.
 */
class TargetRuleTargetStrategy extends TargetStrategy {
  /**
   * Checks whether or not this strategy is valid for a given item.
   * @param {FUItem} item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether or not this TargetStrategy is valid for the given item.
   */
  static isValidFor(item) {
    const behavior = game.settings.get(MODULE, 'defaultAutoTargetBehavior');
    return typeof item.system.targeting?.rule === 'string' && 
      behavior === 'all' ||
      (behavior === 'attacksAndSpells' && item.type === 'spell');
  }

  getTargetCandidates() {

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
      return;
    }

    const roller = this.getRoller();
    const rollerDisposition = this.getRollerDispositionFor(roller);
    const rule = this.item.system.targeting?.rule;
    if (rule === 'self') {
      return this.item.actor.getActiveTokens();
    }
    else return game.canvas.tokens.placeables.filter(t => !t.document.hidden &&
      t.document.disposition === -rollerDisposition && 
      !actorHasStatus(t.actor, ...UNTARGETABLE_ALL_EFFECTS));
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

/**
 * A strategy based on custom rules set by a user on an item itself, or passed in explictly to the strategy.
 */
class CustomTargetStrategy extends TargetStrategy {
  
  constructor (item, options) {
    super(item);
    this._options = options;
  }

  get options() {
    return this._options || AutoTarget.getOptionsFor(this.item);
  }

  /**
   * Checks whether or not this strategy is valid for a given item
   * @param {FUItem} item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether or not this TargetStrategy is valid for the given item.
   * True if the item has custom autoTarget configuration options set and enabled, or false otherwise.
   */
  static isValidFor(item) {
    const options = AutoTarget.getOptionsFor(item);
    return options?.enable;
  }

  /**
   * Gets an array of possible target candidates based on the custom rules set on an item.
   * @returns {Token[]}
   */
  getTargetCandidates() {
    const roller = this.getRoller();
    const rollerDisposition = this.getRollerDispositionFor(roller);
    let targetFilter;
    const options = this.options;
    if (options.targetType === 'ALLIES') {
      targetFilter = t => t.document.disposition === rollerDisposition && t.actor.id !== this.item.actor.id && t.id !== roller.id;
    } else if (options.targetType === 'ALLIES_AND_SELF') {
      targetFilter = t => t.document.disposition === rollerDisposition;
    } else if (options.targetType === 'ALL') {
      targetFilter = t => [CONST.TOKEN_DISPOSITIONS.FRIENDLY, CONST.TOKEN_DISPOSITIONS.HOSTILE].includes(t.document.disposition);
    } else if (['ENEMIES', 'ENEMIES_MELEE', 'ENEMIES_MELEE_FLYING'].includes(options.targetType)) {
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
    } else return null;
    return game.canvas.tokens.placeables.filter(targetFilter);
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

/**
 * Checks whether a given actor has one or more of a set of given statuses.
 * @param {FUActor} actor The actor to check for statuses.
 * @param  {...String} statuses One or more status String keys.
 * @returns {boolean} True if the actor has at least one status in the set of given statuses.
 */
function actorHasStatus(actor, ...statuses) {
	return actor.statuses.some(s => statuses.includes(s));
}

const TARGET_TYPES = Object.freeze ({
	ENEMIES: `${MODULE}.autoTarget.options.targetType.types.enemies`,
	ENEMIES_MELEE: `${MODULE}.autoTarget.options.targetType.types.enemiesMelee`,
	ENEMIES_MELEE_FLYING: `${MODULE}.autoTarget.options.targetType.types.enemiesMeleeFlying`,
	ALLIES: `${MODULE}.autoTarget.options.targetType.types.allies`,
	SELF: `${MODULE}.autoTarget.options.targetType.types.self`,
	ALLIES_AND_SELF: `${MODULE}.autoTarget.options.targetType.types.alliesAndSelf`,
	ALL: `${MODULE}.autoTarget.options.targetType.types.all`
});

const UNTARGETABLE_MELEE_EFFECTS = ['flying', 'cover'];

const UNTARGETABLE_MELEE_FLYING_EFFECTS = ['cover'];

const UNTARGETABLE_ALL_EFFECTS = ['ko', 'untargetable'];

const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];

export class AutoTarget {
  static #strategies = [CustomTargetStrategy, AttackTargetStrategy, TargetRuleTargetStrategy];
  static #getStrategyFor(item) {
    if(typeof item !== 'object' || item.documentName !== 'Item') {
      console.warn('Not an item: ', item);
    } 
    for(const strategy of this.#strategies) {
      if(strategy.isValidFor(item)) {
        return new strategy(item);
      }
    }
  }
  static async execute(item, options) {
    if (!item || !game.settings.get(MODULE, 'enableAutoTarget')) return;
    // Default targetType to 'ENEMIES'
    if (options) {
      options = foundry.utils.deepClone(options);
      options.targetType = options.targetType || 'ENEMIES';
    }
    const targetList = new Map();
    let strategy;
    // Special case, self only, don't use a strategy.
    if (options?.targetType === 'SELF') {
      item.actor.getActiveTokens().forEach(t => targetList.set(t, { count: 1 }));
    } else {

      if (options) {
        // Use a unique CustomTargetStrategy if we have specific options to use
        // i.e. passed in from the AutoTarget dialog.
        strategy = new CustomTargetStrategy(item, options);
      } 
      else {
        strategy = AutoTarget.#getStrategyFor(item);
      }
      // No strategy was found. Exit without making a fuss.
      if (!strategy) return;
      let targetCandidates = strategy.getTargetCandidates();
      if (!Array.isArray(targetCandidates)) {
        // Bail if our strategy didn't give us a proper array.
        return;
      }
      const maxTargets = strategy.maxTargets;

      if (typeof maxTargets === 'number' && maxTargets > 0) {
  
        const forcedTargetsMap = new Map();
  
        // Force targets only for rolls targeting enemies.
        if (strategy.canForceTargets) {
          [...item.actor.appliedEffects].forEach(e => {
            const effectStatuses = [...e.statuses];
            if (e.origin && effectStatuses.some(s => FORCE_TARGET_EFFECTS.includes(s))) {
              const origin = fromUuidSync(e.origin);
              const forcedTargetIndex = targetCandidates.findIndex(t => t.document.actor.uuid === (origin.actor || origin)?.uuid);
              if (forcedTargetIndex >= 0) {
                const forcedTarget = strategy.repeat ? targetCandidates[forcedTargetIndex] : targetCandidates.splice(forcedTargetIndex, 1)[0];
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
        while (i < strategy.maxTargets && (forcedTargets.length > 0 || targetCandidates.length > 0)) {
          const forced = forcedTargets.length > 0;
          let drawPile = forced ? forcedTargets : targetCandidates;
          var start = Math.floor(Math.random() * (drawPile.length));
          const target = strategy.canRepeatTargets && drawPile === targetCandidates ? drawPile[start] : drawPile.splice(start, 1)[0];
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
          label: strategy.label
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

  static hasDefaultStrategyFor(item) {
    for(const strategy of this.#strategies.filter(s => !(s instanceof CustomTargetStrategy))) {
      if(strategy.isValidFor(item)) {
        return true;
      }
    }
    return false;
  }
}

