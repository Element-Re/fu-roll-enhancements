import { keyBinds, MODULE } from './settings.mjs';
import { TEMPLATES } from './templates.mjs';

export async function rollEnhancements (wrapped, ...args) {
	const item = this;
	// Run auto target workflow before roll
	await autoTargetWorkflow(item);
	console.log("fu-roll-enhancements | done setting targets");
	// Item macro "pre" event
	if (game.settings.get(MODULE, "preRollItemMacro") && item.hasMacro && item.hasMacro())
		await item.executeMacro("pre");
	// Chain wrapped function(s)
	const returnValue = await wrapped(...args);
	// Item macro "post" event
	if (game.settings.get(MODULE, "postRollItemMacro") && item.hasMacro && item.hasMacro())
		await item.executeMacro("post");
	return returnValue;
}

async function autoTargetWorkflow(item) {
	if (!item.actor || (!game.user.isGM && !game.settings.get(MODULE, "allowPlayerAutoTarget"))) return;

	// If keybind is pressed, show dialog
	if (keyBinds.autoTargetDialog) {
		const templateData = {
			item: item,
			options: item.getFlag(MODULE, "autoTarget"),
			targetTypes: TARGET_TYPES,
		};
		const targetDialogContent = await renderTemplate(TEMPLATES.AUTO_TARGET_DIALOG, templateData);
		return Dialog.wait({
			title: game.i18n.localize(`${MODULE}.autoTarget.dialog.title`),
			content: targetDialogContent,
			default: "cancel",
			buttons: {
				target: {
					icon: '<i class="fas fa-crosshairs"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.target`),
					callback: (html) => {
						const options = getFormOptions(html);
						autoTarget(options, item);
					}
				},
				updateAndTarget: {
					icon: '<i class="fas fa-floppy-disk"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.updateAndTarget`),
					callback: (html) => {
						const options = getFormOptions(html)
						autoTarget(options, item);
						item.setFlag(MODULE, "autoTarget", foundry.utils.mergeObject(options, {enable: true}));
					}
				},
				skip: {
					icon: '<i class="fas fa-forward"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.skip`),
				},
				disable: {
					icon: '<i class="fas fa-ban"></i>',
					label: game.i18n.localize(`${MODULE}.autoTarget.dialog.buttons.disable`),
					callback: () => item.setFlag(MODULE, "autoTarget.enable", false)
				},
			},
			close: () => {
				console.log("fu-roll-enhancements | closing dialog");
			}
		}, {id: "auto-target-dialog"}); 
	} else if (item.getFlag(MODULE, "autoTarget")?.enable) {
		const options = item.getFlag(MODULE, "autoTarget");
		autoTarget(options, item);
		return;
	}
}

function actorHasStatus(actor, ...statuses) {
	return [...actor.effects].some(e => !e.disabled && [...e.statuses].some(s => statuses.includes(s)));
}

async function autoTarget(options, item) {
	if (!options || !item) return;
	options.targetType = options.targetType || "ENEMIES"; // Default to enemies
	const targetList = new Map();
	if (options.targetType === "SELF") {
		item.actor.getActiveTokens().forEach(t => targetList.set(t, { count: 1 }));
	} else {
		let targetCandidates = [];
		const rollerTokenOrProtoType = item.actor.token || item.actor.prototypeToken;
		// Treat neutral rolls as friendly and secret rolls as hostile for the sake of targetting.
		const rollerDisposition = rollerTokenOrProtoType.disposition === CONST.TOKEN_DISPOSITIONS.NEUTRAL ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : 
			rollerTokenOrProtoType.disposition === CONST.TOKEN_DISPOSITIONS.SECRET ? CONST.TOKEN_DISPOSITIONS.HOSTILE : 
			rollerTokenOrProtoType.disposition;
		let targetFilter;
		if (options.targetType === "ALLIES") {
			targetFilter = t => t.document.disposition === rollerDisposition && t.actor.id !== item.actor.id && t.id !== rollerTokenOrProtoType.id;
		} else if (options.targetType === "ALLIES_AND_SELF") {
			targetFilter = t => t.document.disposition === rollerDisposition;
		} else if (options.targetType === "ALL") {
			// Due to FU conflicts ultimately being a 
			targetFilter = t => [CONST.TOKEN_DISPOSITIONS.FRIENDLY, CONST.TOKEN_DISPOSITIONS.HOSTILE].includes(t.document.disposition);
		} else {
			// ENEMIES, ENEMIES_MELEE, ENEMIES_MELEE_FLYING
			targetFilter = t => {
				// TODO: Define this in a more general way and/or allow the user to customize somehow
				const effects = [...t.actor.effects];
				return !t.document.hidden &&
					t.document.disposition === -rollerDisposition &&
					!effects.some(e => 
						!e.disabled && [...e.statuses].some(s => !s.disabled && 
							(
								UNTARGETABLE_ALL_EFFECTS.includes(s) || 
								("ENEMIES_MELEE" === options.targetType && !actorHasStatus(item.actor, 'flying') && UNTARGETABLE_MELEE_EFFECTS.includes(s)) ||
								(("ENEMIES_MELEE" === options.targetType && actorHasStatus(item.actor, 'flying') || "ENEMIES_MELEE_FLYING" === options.targetType) && actorHasStatus(item.actor, 'flying') && UNTARGETABLE_MELEE_FLYING_EFFECTS.includes(s))
							)
					));
			};
		}

		targetCandidates.push(...game.canvas.tokens.placeables.filter(targetFilter));

		if (typeof options.maxTargets === "number" && options.maxTargets > 0) {

			const forcedTargetsMap = new Map();

			// Force targets only for rolls targeting enemies.
			if (["ENEMIES", "ENEMIES_MELEE", "ENEMIES_MELEE_FLYING"].includes(options.targetType)) {
				[...item.actor.effects].forEach(e => {
					const effectStatuses = [...e.statuses];
					if (e.origin && effectStatuses.some(s => FORCE_TARGET_EFFECTS.includes(s))) {
						const origin = fromUuidSync(e.origin);
						const forcedTargetIndex = targetCandidates.findIndex(t => t.document.actor.uuid === (origin.actor || origin)?.uuid);
						if (forcedTargetIndex >= 0) {
							const forcedTarget = options.repeat ? targetCandidates[forcedTargetIndex] : targetCandidates.splice(forcedTargetIndex, 1)[0];
							forcedTargetsMap.set(forcedTarget, e);
						} else {
							ui.notifications.warn(game.i18n.format(`${MODULE}.autoTarget.errors.forcedTargetInvalid`, {effect: e.name, roller: (item.actor.token || item.actor.prototypeToken).name}));
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

	game.user.updateTokenTargets([...targetList.keys()].map(t => t.id));

	const templateData = {
		results: [...targetList.keys()].map(t => foundry.utils.mergeObject(targetList.get(t), {target: t})),
		targetType: game.i18n.localize(TARGET_TYPES[options.targetType])
	}
	ChatMessage.create({
		content: await renderTemplate(TEMPLATES.AUTO_TARGET_RESULTS, templateData),
		speaker: {
			actor: item.actor,
			token: item.actor.token
		},
		flavor: `${item.name}`
	});
}

function getFormOptions(html) {
	const formElement = html[0].querySelector('form');
	const formData = new FormDataExtended(formElement);
	return formData.object;
}

export const TARGET_TYPES = Object.freeze ({
	ENEMIES: `${MODULE}.autoTarget.options.targetType.sides.enemies`,
	ENEMIES_MELEE: `${MODULE}.autoTarget.options.targetType.sides.enemiesMelee`,
	ENEMIES_MELEE_FLYING: `${MODULE}.autoTarget.options.targetType.sides.enemiesMeleeFlying`,
	ALLIES: `${MODULE}.autoTarget.options.targetType.sides.allies`,
	SELF: `${MODULE}.autoTarget.options.targetType.sides.self`,
	ALLIES_AND_SELF: `${MODULE}.autoTarget.options.targetType.sides.alliesAndSelf`,
	ALL: `${MODULE}.autoTarget.options.targetType.sides.all`
});

const UNTARGETABLE_MELEE_EFFECTS = ['flying', 'cover'];

const UNTARGETABLE_MELEE_FLYING_EFFECTS = ['cover'];

const UNTARGETABLE_ALL_EFFECTS = ['ko', 'untargetable'];

const FORCE_TARGET_EFFECTS = ['provoked', 'force-target'];