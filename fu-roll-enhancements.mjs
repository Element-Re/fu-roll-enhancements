import { module, registerSettings } from "./module/settings.js";

Hooks.once('init', () => {
	registerSettings();
	loadTemplates([
		"modules/fu-roll-enhancements/templates/auto-target-dialog.hbs",
		"modules/fu-roll-enhancements/templates/auto-target-item-extension.hbs",
	]);
});

Hooks.once('ready', () => {
		enableRollEnhancements();
});

Hooks.on('renderFUItemSheet', async (item, $content, data) => {
	const templateData = {
		item: item.object,
		targetSides: TARGET_SIDES,
	};
	const itemExtensionContent = await renderTemplate("modules/fu-roll-enhancements/templates/auto-target-item-extension.hbs", templateData);
	const attributesTab = $content.find(".tab.attributes[data-tab=attributes]").first();
	if(!attributesTab.length) return;
	if (attributesTab.find("section.grid").length) {
		attributesTab.find("section.grid").last().append(itemExtensionContent);
	} else
		attributesTab.append($(`<section class="grid grid-2col gap-5"></section>`).append(itemExtensionContent));
	
})

const enableRollEnhancements = () => {
  // Add on-roll support for item macro
	libWrapper.register('fu-roll-enhancements', 'CONFIG.Item.documentClass.prototype.roll', async function (wrapped, ...args) {
		const item = this;
		await autoTargetDialog(item);
		console.log("fu-roll-enhancements | done setting targets");
		if (game.settings.get(module, "preRollItemMacro") && item.hasMacro && item.hasMacro())
			await item.executeMacro("pre");
		const returnValue = await wrapped(...args);
		if (game.settings.get(module, "postRollItemMacro") && item.hasMacro && item.hasMacro())
			await item.executeMacro("post");
		return returnValue;
	});
}

const autoTarget = (options, item) => {
	if (!options || !item) return;
	const targetList = new Map();
	if (options.targetSide === "SELF") {
		item.actor.getActiveTokens().forEach(t => targetList.set(t, 1));
	} else {
		let targetCandidates = [];
		const rollerTokenOrProtoType = item.actor.token ? item.actor.token : item.actor.prototypeToken;
		// Treat neutral and secret rolls as friendly for the sake of targetting.
		const rollerDisposition = [CONST.TOKEN_DISPOSITIONS.NEUTRAL, CONST.TOKEN_DISPOSITIONS.SECRET].includes(rollerTokenOrProtoType.disposition) ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : rollerTokenOrProtoType.disposition;
		if (options.targetSide === "ALLIES") {
			targetCandidates.push(...game.canvas.tokens.placeables.filter(t => t.document.disposition === rollerDisposition));
		} else if (options.targetSide === "ENEMIES") {
			targetCandidates.push(...game.canvas.tokens.placeables.filter(t => t.document.disposition === -rollerDisposition));
		} else {
			targetCandidates.push(...game.canvas.tokens.placeables.filter(t => Math.abs(t.document.disposition) === Math.abs(rollerDisposition)));
		}

		if (typeof options.maxTargets === "number" && options.maxTargets > 0) {
			var i = 0;
			while (i < options.maxTargets && targetCandidates.length > 0) {
				var start = Math.floor(Math.random() * (targetCandidates.length));
				const target = options.repeat ? targetCandidates[start] : targetCandidates.splice(start, 1)[0];
				targetList.set(target, (targetList.has(target) ? targetList.get(target) : 0) + 1)
				i++;
			}
		} else targetCandidates.forEach(t => targetList.set(t, 1));
	}
	
	game.user.updateTokenTargets([...targetList.keys()].map(t => t.id));
	ChatMessage.create({
		content: `<div class="projectfu auto-target"><fieldset class="title-fieldset"><legend class="resource-text-sm">Auto Target</legend><ol>${ [...targetList.keys()].map(t => `<li class="target">${t.document.actor.link}${targetList.get(t) > 1 ? ` x${targetList.get(t)}` : '' }</li>`).join('\n') }</ol></fieldset></div>`,
		speaker: {
			actor: item.actor,
			token: item.actor.token
		},
		flavor: item.name
	});
}

const autoTargetDialog = async (item) => {
	
	// Only for GMs controlling NPCs, for items not marked as specifically not auto-targetable
	if (!game.user.isGM || !item.actor || item.actor.type !== "npc" || !item.getFlag(module, "autoTarget")?.enable) return;
	const templateData = {
		item: item,
		targetSides: TARGET_SIDES,
	}
	const targetDialogContent = await renderTemplate("modules/fu-roll-enhancements/templates/auto-target-dialog.hbs", templateData);
	return Dialog.wait({
		title: game.i18n.localize(`${module}.autoTarget.title`),
		content: targetDialogContent,
	  default: "cancel",
		buttons: {
			autoTarget: {
				icon: '<i class="fas fa-bullseye"></i>',
				label: game.i18n.localize(`${module}.autoTarget.title`),
   			callback: (html) => {
						const formElement = html[0].querySelector('form');
						const formData = new FormDataExtended(formElement);
						const formDataObject = formData.toObject();
						autoTarget(formDataObject, item);
				}
			},
			skip: {
				icon: '<i class="fas fa-forward"></i>',
				label: game.i18n.localize(`${module}.autoTarget.skip`),
   			callback: () => console.log(`${module} | skipping autotarget`)
			},
		},
		close: () => {
			console.log("fu-roll-enhancements | closing dialog");
		}
	});
}

const TARGET_SIDES = Object.freeze ({
	SELF: `${module}.autoTarget.targetType.types.self`,
	ENEMIES: `${module}.autoTarget.targetSide.sides.enemies`,
	ALLIES: `${module}.autoTarget.targetSide.sides.allies`,
	ALL: `${module}.autoTarget.targetSide.sides.all`
});