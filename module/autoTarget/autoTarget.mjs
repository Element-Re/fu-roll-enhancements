import {TEMPLATES} from '../templates.mjs';
import {MODULE} from '../helpers/utils.mjs';
import {getTargetMode, isAutoTargetEnabled} from '../settings.mjs';
import {getTokenThumbnail} from '../helpers/media.mjs';
import {TargetingEvaluation} from './targetingEvaluation.mjs';
import {AttackTargetStrategy} from './strategies/attackTargetStrategy.mjs';
import {TargetRuleTargetStrategy} from './strategies/targetRuleTargetStrategy.mjs';
import {CustomTargetStrategy} from './strategies/customTargetStrategy.mjs';
import {FORCE_TARGET_EFFECTS} from '../constants/autoTarget.mjs';
import {isValidTarget} from '../helpers/target.mjs';

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
    const evaluation = new TargetingEvaluation({item, targetPool});

    let strategy;
    // Special case, self only, don't use a strategy.
    if (options?.targetType === 'SELF') {
      // TODO: Needs a real strategy now (Self Target Strategy? Target Rule Target strategy?)
      item.actor.getActiveTokens().forEach(t => targetList.set(t.id, { count: 1, token: t }));
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

      evaluation.info(game.i18n.format(`${MODULE}.autoTarget.evaluation.info.usingStrategy`), {name: strategy.label});
      evaluation.setStrategy(strategy);

      // TODO: Use TargetEvaluation
      const targetCandidates = strategy.getTargetCandidates(targetPool);
      // Bail if our strategy didn't give us a proper Set.
      if (!(targetCandidates instanceof Set)) return;
      for (const candidate of targetCandidates) {
        evaluation.getTargetData(candidate.id);
        evaluation.getTargetData(candidate.id).validate();
      }

      const maxTargets = strategy.maxTargets;

      if (typeof maxTargets === 'number' && maxTargets > 0) {

        // Force targets only for rolls targeting enemies.
        if (strategy.canForceTargets) {
          [...item.actor.appliedEffects].forEach(e => {
            const effectStatuses = [...e.statuses];
            if (e.sourceInfo && effectStatuses.some(s => FORCE_TARGET_EFFECTS.includes(s))) {

              evaluation.info(game.i18n.format(`${MODULE}.autoTarget.evaluation.info.priorityTargetEffectFound`), {name: e.name});
              const origin = fromUuidSync(e.sourceInfo.itemUuid ?? e.sourceInfo.actorUuid);
              const forcedTargetIndex = targetCandidates.findIndex(t => t.document.actor.uuid === (origin.actor || origin)?.uuid);
              if (forcedTargetIndex >= 0) {
                const forcedTarget = strategy.repeat ? targetCandidates[forcedTargetIndex] : targetCandidates.splice(forcedTargetIndex, 1)[0];
                evaluation.info(game.i18n.format(`${MODULE}.autoTarget.evaluation.info.priorityTargetFound`));
                evaluation.getTargetData(forcedTarget.id).markPriority(e.name);
              } else {
                const message = game.i18n.format(`${MODULE}.autoTarget.errors.forcedTargetInvalid`, {
                  effect: e.name,
                  roller: (item.actor.token || item.actor.prototypeToken).name });
                evaluation.warn(message);
                ui.notifications.warn(message);
                return false;
              }
            }
          });
        }
  
        const priorityTargetsPool = [...evaluation.priorityTargets];
        const validTargetsPool = [...evaluation.validTargets];


        let i = 0;
        while (i < maxTargets && (priorityTargetsPool.length > 0 || validTargetsPool.length > 0)) {
          const forced = priorityTargetsPool.length > 0;
          // TODO: Use TargetEvaluation
          const drawPile = forced ? priorityTargetsPool : validTargetsPool;
          const start = Math.floor(Math.random() * (drawPile.length));
          const target = strategy.canRepeatTargets && drawPile === validTargetsPool ? drawPile[start] : drawPile.splice(start, 1)[0];
          evaluation.getTargetData(target.id).markRecommended(i + 1);
          i++;
        }
      } else targetCandidates.forEach(target => {
        evaluation.getTargetData(target.id).markRecommended(evaluation.recommendedTargets.push(target));
      });
    }

    if (getTargetMode() === 'guided') {
      const finalTargets = (await this.getGuidedTargets(evaluation)) ??
          evaluation.recommendedTargets;
      evaluation.setFinalTargets(finalTargets);
    } else {
      evaluation.setFinalTargets(evaluation.recommendedTargets);
    }
    return evaluation;
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
   * @param evaluation TargetingEvaluation Evaluation for this round of targeting.
   * @returns Map<Token, number> The final targets after user-guided intervention.
   */
  static async getGuidedTargets(evaluation) {
    const validTargets = {
      enemies: evaluation.enemyTargets,
      allies: evaluation.allyTargets,
      self: evaluation.rollerTargets
    };

    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.GUIDED_TARGET_DIALOG, {
      initialTargets: evaluation.recommendedTargets,
      validTargets,
      maxTargets: evaluation.maxTargets
    });
    const buttons = [
      {
        label: 'Auto Target',
        action: 'autoTarget',
        callback: function(_event, _target, _dialog) {
          /*
            TODO: Returning null just results in the dialog returning the action identifier.
                  Some other approach is required.
           */
          return null;
        }
      },
      {
        label: 'Guided Targets',
        action: 'guidedTargets',
        callback: function(_event, _target, _dialog) {
          return null;
        }
      },
      {
        label: 'Skip',
        action: 'skip',
        callback: function(_event, _target, _dialog) {
          return null;
        }
      }
    ];
    const guidedTargets = await foundry.applications.api.DialogV2.wait({
      window: {
        title: `${game.i18n.localize('fu-roll-enhancements.guidedTargeting.dialog.title')}: ${evaluation.item.name}`,
      },
      content,
      buttons,
      classes: ['guided-target-dialog'],
      rejectClose: true,
      render: AutoTarget._onGuidedTargetDialogRender
    });
    return initialTargets;
  }

  /**
   *
   * @param _event Event
   * @param dialog DialogV2
   * @private
   */
  static _onGuidedTargetDialogRender(_event, dialog) {
    const targetInputs = dialog.element.querySelectorAll('label[data-token-id]');
    for (const targetInput of targetInputs) {
      targetInput.addEventListener('mouseover', AutoTarget._onTargetFormGroupHoverIn);
      targetInput.addEventListener('mouseout', AutoTarget._onTargetFormGroupHoverOut);
    }
  }

  /**
   * @param event Event
   * @private
   */
  static _onTargetFormGroupHoverIn(event) {
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
  static _onTargetFormGroupHoverOut(event) {
    const tokenId = event.target.dataset.tokenId;
    const token = game.canvas.tokens.placeables.find(t => t.id === tokenId);
    if ( token && token._canHover(game.user, event) && token.visible ) {
      token._onHoverOut(event);
    }
  }
}

