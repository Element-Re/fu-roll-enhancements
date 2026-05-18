import {MODULE} from '../helpers/utils.mjs';
import {getTargetMode, isAutoTargetEnabled} from '../settings.mjs';
import {TargetContext} from './targetContext.mjs';
import {AttackTargetStrategy} from './strategies/attackTargetStrategy.mjs';
import {TargetRuleTargetStrategy} from './strategies/targetRuleTargetStrategy.mjs';
import {CustomTargetStrategy} from './strategies/customTargetStrategy.mjs';
import {FORCE_TARGET_EFFECTS} from '../constants/autoTarget.mjs';
import {isValidTarget} from '../helpers/target.mjs';
import {TargetGuide} from '../applications/targetGuide.mjs';

export function _activeEffectHandler(actor, effect) {
  const newValue = String(effect.value);
  if(effect.key === 'flags.fu-roll-enhancements.autoTarget.prioritize' && newValue) {
    const prioritize = actor.getFlag('fu-roll-enhancements', 'autoTarget.prioritize');
    const prioritizeCopy = prioritize ? Array.from(prioritize) : [];
    prioritizeCopy.push(newValue);
    actor.flags = foundry.utils.mergeObject(actor.flags, {'fu-roll-enhancements.autoTarget.prioritize': prioritizeCopy});
  }
}

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
    if (!item || !isAutoTargetEnabled()) return;
    // Default targetType to 'ENEMIES'
    if (options) {
      options = foundry.utils.deepClone(options);
      options.targetType = options.targetType || 'ENEMIES';
    }

    const targetPool = new Set(game.canvas.tokens.placeables.filter(isValidTarget));
    const context = new TargetContext({item, targetPool});

    let strategy;

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

    context.info(game.i18n.format(`${MODULE}.autoTarget.context.info.usingStrategy`), {name: strategy.label});
    context.setStrategy(strategy);

    if (getTargetMode() === 'guided') {

      const finalTargets = await TargetGuide.wait(context);
      if (!finalTargets) return null;

      context.setFinalTargets(finalTargets);
    } else {
      context.setFinalTargets(context.recommendedTargets);
    }
    return context;
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

