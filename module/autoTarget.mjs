import {TEMPLATES} from './templates.mjs';
import {MODULE} from './helpers/module-utils.mjs';
import {getTargetMode, isAutoTargetEnabled} from './settings.mjs';
import {getTokenThumbnail} from './helpers/media.mjs';

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

/**
 * An abstract class representing a strategy for selecting targets based on a given Item.
 * @abstract
 */
class TargetStrategy {

  /**
   * Checks whether this strategy is valid for a given item.
   * @abstract
   * @param {FUItem} _item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether or not this TargetStrategy is valid for the given item.
   */
  static isValidFor(_item) {
    throw new Error('Not implemented');
  }
  /**
   * Constructs a new TargetStrategy.
   * @param {FUItem} item An Item document applicable to this TargetStrategy.
   */
  constructor (item) {
    if(typeof item !== 'object' || item.documentName !== 'Item') {
      throw new Error(`Not an item: ${item}`);
    }
    this.item = item;
  }
  /**
   * Gets possible targets based on the rules of the target strategy and the item assigned to the strategy.
   * @param targetPool {Set<Token>} The entire pool of targets to find target candidates from.
   * @returns {Set<Token>|null} All possible target candidates identified by the strategy, or null if the strategy
   * failed.
   */
  // eslint-disable-next-line no-unused-vars
  getTargetCandidates(targetPool) {
    throw new Error('Not implemented');
  }

  /**
   * @returns {string} A label describing the kind of adversaries selected by this strategy.
   */
  get label() {
    throw new Error('Not implemented');
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
   * @returns {number} The maximum number of targets, for this strategy's item.
   */
  get maxTargets() {
    throw new Error('Not implemented');
  }

  /**
   * Gets a roller for this strategy, which is a token representing the the item's actor of this strategy.
   * @returns {TokenDocument} The roller for this strategy, which either a scene token for the item's owner, or their prototype token.
   */
  getRoller() {
    return TargetStrategy.getRollerFor(this.item);
  }

  /**
   * Gets a roller for a given item, which is a token representing the item's actor.
   * @param {FUItem} item The item for get a roller for.
   * @returns { TokenDocument | PrototypeTokenData } The roller for this strategy, which either a scene token for the item's owner, or their prototype token.
   */
  static getRollerFor(item) {
    return item.actor.token || item.actor.prototypeToken;
  }

  /**
   * Get an effective disposition of this strategy's roller.
   * @returns {number} Either CONST.TOKEN_DISPOSITIONS.FRIENDLY or CONST.TOKEN_DISPOSITIONS.HOSTILE.
   * NEUTRAL is treated as FRIENDLY and SECRET is treated as HOSTILE for the sake of rolling.
   */
  getRollerDisposition() {
    return TargetStrategy.getRollerDispositionFor(this.getRoller());
  }
  /**
   * Get an effective disposition of a given roller.
   * @param {TokenDocument} roller A token representing the item's roller.
   * @returns {number} Either CONST.TOKEN_DISPOSITIONS.FRIENDLY or CONST.TOKEN_DISPOSITIONS.HOSTILE.
   * NEUTRAL is treated as FRIENDLY and SECRET is treated as HOSTILE for the sake of rolling.
   */
  static getRollerDispositionFor(roller) {
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
   * Checks whether this strategy is valid for a given item.
   * @param {FUItem} item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether this TargetStrategy is valid for the given item.
   */
  static isValidFor(item) {
    return ['attacksAndSpells', 'all'].includes(game.settings.get(MODULE, 'defaultAutoTargetBehavior')) && 
    (item.type === 'basic' || item.type === 'weapon') &&
    item.parent?.type !== 'character'; // Don't ever perform default behavior for PCs.
  }

  /**
   * @param targetPool {Set<Token>}
   * @returns {Set<Token>}
   */
  getTargetCandidates(targetPool = new Set()) {
    const rollerDisposition = this.getRollerDisposition();

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
    let targetCandidates = new Set(targetPool);
    filters.forEach(f => targetCandidates = targetCandidates.filter(f));
    return new Set(targetCandidates);
  }

  get canForceTargets() {
    return true;
  }

  get maxTargets() {
    // Attacks always default to one target. Anything else needs a custom strategy.
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
   * Checks whether this strategy is valid for a given item.
   * @param {FUItem} item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether this TargetStrategy is valid for the given item.
   */
  static isValidFor(item) {
    const behavior = game.settings.get(MODULE, 'defaultAutoTargetBehavior');
    return (
      typeof item.system.targeting?.rule === 'string' && 
      behavior === 'all' ||
      (behavior === 'attacksAndSpells' && item.type === 'spell')
    ) && 
    item.parent?.type !== 'character'; // Don't ever perform default behavior for PCs;
  }

  /**
   * @param targetPool {Set<Token>}
   * @returns {Set<Token>|null}
   */
  getTargetCandidates(targetPool = new Set()) {

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
      return null;
    }

    const rollerDisposition = this.getRollerDisposition();
    const rule = this.item.system.targeting?.rule;
    let targetCandidates;
    if (rule === 'self') {
       targetCandidates = new Set(this.item.actor.getActiveTokens());
    }
    else {
      targetCandidates = new Set(targetPool.filter(t => isValidTarget(t) &&
        t.document.disposition === -rollerDisposition));
    }
    return targetCandidates;
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
 * A strategy based on custom rules set by a user on an item itself, or passed in explicitly to the strategy.
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
   * Checks whether this strategy is valid for a given item
   * @param {FUItem} item The item to check the validity of this TargetStrategy for.
   * @returns {boolean} Whether this TargetStrategy is valid for the given item.
   * True if the item has custom autoTarget configuration options set and enabled, or false otherwise.
   */
  static isValidFor(item) {
    const options = AutoTarget.getOptionsFor(item);
    return options?.enable;
  }

  /**
   * @param targetPool {Set<Token>}
   * @returns {Set<Token>|null}
   */
  getTargetCandidates(targetPool = new Set()) {
    const roller = this.getRoller();
    const rollerDisposition = this.getRollerDisposition();
    let targetFilter;
    const options = this.options;
    if (options.targetType === 'SELF') {
      return [roller.actor.getActiveTokens()[0]];
    } else if (options.targetType === 'ALLIES') {
      targetFilter = t => t.document.disposition === rollerDisposition && t.actor.id !== this.item.actor.id && t.id !== roller.id;
    } else if (options.targetType === 'ALLIES_AND_SELF') {
      targetFilter = t => t.document.disposition === rollerDisposition;
    } else if (options.targetType === 'ALL') {
      targetFilter = t => [CONST.TOKEN_DISPOSITIONS.FRIENDLY, CONST.TOKEN_DISPOSITIONS.HOSTILE].includes(t.document.disposition);
    } else if (['ENEMIES', 'ENEMIES_MELEE', 'ENEMIES_MELEE_FLYING'].includes(options.targetType)) {
      targetFilter = t => {
        return isValidTarget(t) &&
          t.document.disposition === -rollerDisposition && 
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
    return new Set(targetPool.filter(targetFilter));
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

function isValidTarget(token) {
  return !token.document.hidden &&
      !actorHasStatus(token.actor, ...UNTARGETABLE_ALL_EFFECTS) &&
      [CONST.TOKEN_DISPOSITIONS.FRIENDLY, CONST.TOKEN_DISPOSITIONS.HOSTILE].includes(token.document.disposition);
}

/**
 * Checks whether a given actor has one or more of a set of given statuses.
 * @param {FUActor} actor The actor to check for statuses.
 * @param  {...String} statuses One or more status String keys.
 * @returns {boolean} True if the actor has at least one status in the set of given statuses.
 */
function actorHasStatus(actor, ...statuses) {
	return actor && !actor.statuses.isDisjointFrom(new Set(statuses));
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
    if (!item || !isAutoTargetEnabled()) return;
    // Default targetType to 'ENEMIES'
    if (options) {
      options = foundry.utils.deepClone(options);
      options.targetType = options.targetType || 'ENEMIES';
    }

      const targetPool = new Set(game.canvas.tokens.placeables.filter(isValidTarget));
    const evaluation = new TargetingEvaluation({actor: item.actor, item, targetPool});

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
      const finalTargets = (await this.getGuidedTargets(evaluation.recommendedTargets, strategy.maxTargets, item)) ??
          evaluation.recommendedTargets;
      evaluation.setFinalTargets(finalTargets);
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
   * @param initialTargets Map<string, Object> Tokens to present to the user as the initially selected auto-targets.
   * @param maxTargets number The maximum number of targets the roll should initially have.
   * @param item Item The token performing this roll, if any.
   * @returns Map<Token, number> The final targets after user-guided intervention.
   */
  static async getGuidedTargets(initialTargets, maxTargets, item) {
    const roller = TargetStrategy.getRollerFor(item);
    let validTargets;

    initialTargets.values().forEach(o => foundry.utils.mergeObject(o, {thumbnail: getTokenThumbnail(o.token)}));
    if (TargetStrategy.getRollerDispositionFor(roller) === CONST.TOKEN_DISPOSITIONS.HOSTILE) {
      validTargets = {
        enemies: game.canvas.tokens.placeables
            .filter(isValidTarget)
            .filter(t => t.document.disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY)
            .map(AutoTarget._mergeTokenThumbnail),
        allies: game.canvas.tokens.placeables
            .filter(isValidTarget)
            .filter(t => t.document.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE)
            .map(AutoTarget._mergeTokenThumbnail)
      };

    } else {
      validTargets = {
        enemies: game.canvas.tokens.placeables
            .filter(isValidTarget)
            .filter(t => t.document.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE)
            .map(AutoTarget._mergeTokenThumbnail),
        allies: game.canvas.tokens.placeables
            .filter(isValidTarget)
            .filter(t => t.document.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE)
            .map(AutoTarget._mergeTokenThumbnail)
      };
    }

    if (roller) {
      validTargets.allies = validTargets.allies.filter(t => t.token.document !== roller);
      validTargets.self = [roller.object].map(AutoTarget._mergeTokenThumbnail);
    }

    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.GUIDED_TARGET_DIALOG, {
      initialTargets: Object.fromEntries(initialTargets.map(t => [t.id, t])),
      validTargets,
      maxTargets
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
        title: `${game.i18n.localize('fu-roll-enhancements.guidedTargeting.dialog.title')}: ${item.name}`,
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



  /**
   * @param token Token
   * @private
   */
  static _mergeTokenThumbnail(token) {
    return {token: token, thumbnail: getTokenThumbnail(token) };
  }
}

class TargetingEvaluation {

  actor;
  item;
  strategy;

  targets = new Map();

  finalTargets = [];

  selectionHistory = [];

  log = [];

  /**
   * @param actor FUActor
   * @param item FUItem
   * @param strategy TargetStrategy
   * @param targetPool Set<Target>
   */
  constructor({ actor, item, targetPool }) {
    this.actor = actor;
    this.item = item;

    for(const target of targetPool) {
      this.addTarget(new TargetData(target));
    }
  }

  info(message) {
    this.log.push({message, level:'info'});
  }

  warn(message) {
    this.log.push({message, level:'warning'});
  }

  error(message) {
    this.log.push({message, level:'error'});
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  addTarget(targetState) {
    this.targets.set(targetState.id, targetState);
  }

  getTargetData(id) {
    return this.targets.get(id);
  }

  get allTargets() {
    return [...this.targets.values()];
  }

  get validTargets() {
    return this.allTargets.filter(t => t.valid);
  }

  get invalidTargets() {
    return this.allTargets.filter(t => !t.valid);
  }

  get priorityTargets() {
    return this.allTargets.filter(t => t.priority);
  }

  get priorityTargetsMap() {
    return new Map(this.priorityTargets.map(t => [t.id, t]));
  }

  get maxTargets() {
    return this.strategy.maxTargets;
  }

  get canRepeatTargets() {
    return this.strategy.canRepeatTargets;
  }

  get canForceTargets() {
    return this.strategy.canForceTargets;
  }

  get recommendedTargets() {
    return this.allTargets
        .filter(t => t.recommended)
        .sort((a, b) =>
            a.recommendationOrdering - b.recommendationOrdering
        );
  }

  get finalTargetCount() {
    return this.finalTargets.length;
  }

  addHistoryEntry(entry) {
    this.selectionHistory.push(entry);
  }

  /**
   * @param targets Token[]
   */
  setFinalTargets(targets) {
    this.finalTargets = [...targets];
  }

  async applyFinalTargets() {
    game.canvas.tokens.setTargets(this.finalTargets.map(t => t.id));

    const templateData = {
      results: this.finalTargets,
      label: this.strategy.label
    };
    const messageData = ChatMessage.applyRollMode({
      content: await renderTemplate(TEMPLATES.AUTO_TARGET_RESULTS, templateData),
      speaker: {
        actor: this.actor,
        token: this.actor.token
      },
      flavor: `${this.item.name}`
    }, game.settings.get('core', 'rollMode'));
    await ChatMessage.create(messageData);
  }
}

class TargetData {

  token;

  valid = false;
  invalidReasons = [];

  priority = false;
  priorityReasons = [];

  recommendationCount = 0;
  recommendationOrdering = [];

  finalSelectionCount = 0;

  userModified = false;

  log = [];

  constructor(token) {
    this.token = token;
  }

  get id() {
    return this.token.id;
  }

  get recommended() {
    return this.recommendationCount > 0;
  }

  get selected() {
    return this.finalSelectionCount > 0;
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

}

class SelectionHistoryEntry {
  iteration;

  // "priority" | "standard"
  sourcePool;

  // Snapshot of candidate IDs at selection time
  candidateTargetIds = [];

  // Chosen target
  selectedTargetId = null;

  // Optional metadata
  metadata = {};

  constructor({
                iteration,
                sourcePool,
                candidateTargetIds,
                selectedTargetId,
                metadata = {}
              }) {
    this.iteration = iteration;
    this.sourcePool = sourcePool;
    this.candidateTargetIds = [...candidateTargetIds];
    this.selectedTargetId = selectedTargetId;
    this.metadata = metadata;
  }
}