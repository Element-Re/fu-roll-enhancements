# FU Roll Enhancements for Project FU
Improves the experience when rolling items in the Project FU system for Foundry VTT.
## Features
### Intelligent Random Auto Targeting
Available targets are derived from the scene and filtered based on rules such as melee attacks not targeting flying or covered creatures, or create a custom Active Effect with the "force-target" status that forces NPCs to target the source of the effect if possible.
### Auto Spend Resources
Derives cost from the MP Cost field on spells, or manually configure for any item, including the ability to specify "per target" costs.
### Experimental Item Macro Support
Provides experimental but optional support for the Item Macro module.

![ezgif-2-a15b42b47c](https://github.com/user-attachments/assets/0ee4fe34-9008-4dc5-ac03-e38753422e2c)

*Animations are handled by the [Automated Animations](https://github.com/otigon/automated-jb2a-animations) module and used for demonstration purposes.*

## More Info
For an overview of the module and how to use it, check out the [project wiki](https://github.com/Element-Re/fu-roll-enhancements/wiki).

## Installation
### Semi-Automatic Installation
1. Navigate to the **Add-on Modules** Tab and click **Install Module**.
2. Paste a manifest URL for a [version](https://github.com/Element-Re/fu-roll-enhancements/releases) into the **Manifest URL** field. This URL is for the latest release version:

`https://github.com/Element-Re/fu-roll-enhancements/releases/latest/download/module.json`

3. Click **Install**.
### Manual Installation
1. Download the `fu-roll-enhancements.zip` file for a [version](https://github.com/Element-Re/fu-roll-enhancements/releases).
2. Unzip the contents of the downloaded file to `modules\fu-roll-enhancements` within your [Foundry VTT data folder](https://foundryvtt.com/article/configuration/#where-user-data).
3. Restart **FoundryVTT** if it is currently open.
