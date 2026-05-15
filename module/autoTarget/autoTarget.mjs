import {TEMPLATES} from '../templates.mjs';
import {MODULE} from '../helpers/utils.mjs';
import {getTargetMode, isAutoTargetEnabled} from '../settings.mjs';
import {TargetContext} from './targetContext.mjs';
import {AttackTargetStrategy} from './strategies/attackTargetStrategy.mjs';
import {TargetRuleTargetStrategy} from './strategies/targetRuleTargetStrategy.mjs';
import {CustomTargetStrategy} from './strategies/customTargetStrategy.mjs';
import {FORCE_TARGET_EFFECTS} from '../constants/autoTarget.mjs';
import {isValidTarget} from '../helpers/target.mjs';
import {TargetGuide} from '../applications/targetGuide.mjs';

function activeEffectHandler(actor, effect) {
  const newValue = String(effect.value);
  if(effect.key === 'flags.fu-roll-enhancements.autoTarget.prioritize' && newValue) {
    const prioritize = actor.getFlag('fu-roll-enhancements', 'autoTarget.prioritize');
    const prioritizeCopy = prioritize ? Array.from(prioritize) : [];
    prioritizeCopy.push(newValue);
    actor.flags = foundry.utils.mergeObject(actor.flags, {'fu-roll-enhancements.autoTarget.prioritize': prioritizeCopy});
  }
}

export function registerAutoTargetHooks() {
  Hooks.on('applyActiveEffect', activeEffectHandler);
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

    const targetCandidates = strategy.getTargetCandidates(targetPool);
    // Bail if our strategy didn't give us a proper Set.
    if (!(targetCandidates instanceof Set)) return;
    for (const candidate of targetCandidates) {
      context.getTargetData(candidate.id);
      context.getTargetData(candidate.id).validate();
    }

    const maxTargets = strategy.maxTargets;

    if (typeof maxTargets === 'number' && maxTargets > 0) {

      // Force targets only for rolls targeting enemies.
      if (strategy.canForceTargets) {
        [...item.actor.appliedEffects].forEach(e => {
          const effectStatuses = [...e.statuses];
          if (e.sourceInfo && effectStatuses.some(s => FORCE_TARGET_EFFECTS.includes(s))) {

            context.info(game.i18n.format(`${MODULE}.autoTarget.context.info.priorityTargetEffectFound`), {name: e.name});
            const origin = fromUuidSync(e.sourceInfo.itemUuid ?? e.sourceInfo.actorUuid);
            const forcedTarget = context.validTargets.find(t => t.actor.uuid === (origin.actor || origin)?.uuid);
            // TODO: I have a gut feeling but no evidence that something was lost in translation here
            //  in the transition to TargetContext. Keep an eye out for possible bugs.
            if (forcedTarget) {
              context.info(game.i18n.format(`${MODULE}.autoTarget.context.info.priorityTargetFound`), {name: forcedTarget.token.name});
              forcedTarget.markPriority({reason: e.name, icon: e.img});
            } else {
              const message = game.i18n.format(`${MODULE}.autoTarget.errors.forcedTargetInvalid`, {
                effect: e.name,
                roller: (item.actor.token || item.actor.prototypeToken).name });
              context.warn(message);
              ui.notifications.warn(message);
              return false;
            }
          }
        });
      }

      const priorityTargetsPool = [...context.priorityTargets];
      const validTargetsPool = [...context.validTargets];


      let i = 0;
      while (i < maxTargets && (priorityTargetsPool.length > 0 || validTargetsPool.length > 0)) {
        const forced = priorityTargetsPool.length > 0;
        const drawPile = forced ? priorityTargetsPool : validTargetsPool;
        const start = Math.floor(Math.random() * (drawPile.length));
        const target = context.canRepeatTargets && drawPile === validTargetsPool ? drawPile[start] : drawPile.splice(start, 1)[0];
        context.getTargetData(target.id).markRecommended(i + 1);
        i++;
      }
    } else targetCandidates.forEach(target => {
      context.getTargetData(target.id).markRecommended(context.recommendedTargets.push(target));
    });

    if (getTargetMode() === 'guided') {
      /*
      const finalTargets = (await this.getGuidedTargets(context)) ??
          context.recommendedTargets;

     */

      const targetGuide = new TargetGuide(context).render(true);

      context.setFinalTargets(context.recommendedTargets);
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
  /**
   * Gets final targets based on guided input from the user. This could be completely different from the initially
   * selected targets, including potentially breaking rules for what constitutes a valid target.
   *
   * @param context TargetContext Context for this round of targeting.
   * @returns Map<Token, number> The final targets after user-guided intervention.
   */
  static async getGuidedTargets(context) {
    const validTargets = {
      enemies: context.enemyTargets,
      allies: context.allyTargets,
      self: context.rollerTargets
    };

    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.GUIDED_TARGET_DIALOG, {
      initialTargets: context.recommendedTargets,
      validTargets,
      maxTargets: context.maxTargets
    });
    const buttons = [
      {
        label: game.i18n.localize('fu-roll-enhancements.guidedTargeting.dialog.useRecommendedTargets.label'),
        action: 'useRecommendedTargets',
        callback: function(_event, _target, _dialog) {
          /*
            TODO: Returning null just results in the dialog returning the action identifier.
                  Some other approach is required.
           */
          return null;
        }
      },
      {
        label: game.i18n.localize('fu-roll-enhancements.guidedTargeting.dialog.finalizeGuidedTargets.label'),
        action: 'finalizeGuidedTargets',
        callback: function(_event, _target, _dialog) {
          return null;
        }
      },
      {
        label: game.i18n.localize('fu-roll-enhancements.guidedTargeting.dialog.skip.label'),
        action: 'skip',
        callback: function(_event, _target, _dialog) {
          return null;
        }
      }
    ];
    const guidedTargets = await foundry.applications.api.DialogV2.wait({
      window: {
        title: `${game.i18n.localize('fu-roll-enhancements.guidedTargeting.dialog.title')}: ${context.item.name}`,
      },
      content,
      buttons,
      classes: ['guided-target-dialog'],
      rejectClose: true,
      render: AutoTarget._onGuidedTargetDialogRender
    });
    return context.recommendedTargets;
  }

  /**
   *
   * @param _event Event
   * @param dialog DialogV2
   * @private
   */
  static _onGuidedTargetDialogRender(_event, dialog) {
    const targetEntries = dialog.element.querySelectorAll('.target[data-token-id]');
    for (const targetEntry of targetEntries) {
      targetEntry.addEventListener('mouseenter', AutoTarget._onTargetHoverIn);
      targetEntry.addEventListener('mouseleave', AutoTarget._onTargetHoverOut);
    }
  }

  /**
   * @param event Event
   * @private
   */
  static _onTargetHoverIn(event) {
    const tokenId = event.target.dataset.tokenId;
    const token = game.canvas.tokens.placeables.find(t => t.id === tokenId);
    if ( token && token._canHover(game.user, event) && token.visible ) {
      token._onHoverIn(event, {hoverOutOthers: true});
    }
  }

  /**
   * @param event Event
   * @private
   */
  static _onTargetHoverOut(event) {
    const tokenId = event.target.dataset.tokenId;
    const token = game.canvas.tokens.placeables.find(t => t.id === tokenId);
    if ( token && token._canHover(game.user, event) && token.visible ) {
      token._onHoverOut(event);
    }
  }
}

