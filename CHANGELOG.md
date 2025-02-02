# Change Log
All notable changes to this project will be documented in this file.
 
The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.1.3]

### New
* FR localization courtesy of [Zakarik](https://github.com/Zakarik). Merci!

### Fixed
* Resolved an issue which caused the "Enable" checkbox to not appear for Auto Target fields.
* Resolved an issue which caused Auto Target to not consider Active Effects from items when it should have and to consider Active Effects that were disabled due to a crisis dependency when it shouldn't have.
* Resolved issue with Auto Spend dialog not respecting the "Enable" checkbox when clicking "Spend" only.

### Changed

* Improved the info displayed on the rolled item in the Auto Target and Auto Spend dialogs.
* Auto Spend will now use the default system IP cost on consumables unless overridden.
* Auto Spend configuration "enable/override" field will now behave the same way in both item sheets and the Auto Spend dialog when rolling. Specifically, the field is never hidden, and the label will indicate that it enables Auto Spend on items without a default system cost, whereas it overrides the default system cost in cases where there is one.
* Slightly changed the behavior of the "Disable" button in the Auto Spend dialog. Specifically, it unsets the "Enable" field for items without a default system cost, whereas it sets the "Override Default Cost" field and sets the cost to 0 for items with a default system cost. In either case, the result is that the item will not cost anything for this roll and others in the future.
* Verified for Foundry V12.
* General improvements to Auto Target dialog to reduce clicks needed while providing better information about the item's current configuration. The "Enable" checkbox is display only, but has a tooltip explaining how it can be toggled on or off by the dialog options.
* The above improvement also applies to the Auto Spend dialog for items without a default cost (i.e. not a spell, ritual, or consumable). For items with a default cost, you will still need to explicitly specify whether or not to override the default cost.

## [0.1.2]

### Fixed

* Made spell MP Cost parsing a bit more robust.
* Resolved Auto Spend error on rituals without an overridden cost.
* Corrected steps of the Roll Enhancements Workflow to the intended order.

### Changed

* Adjusted default keybinds to reduce conflicts.
  * Show Auto Target Dialog: **[T]**
  * Show Auto Spend Dialog: **[R]**
* Adjusted size of Resource Type dropdown in Auto Spend fields.
* Updated README to include links to the latest release manifest and the project wiki.

## [0.1.1]
 
### Fixed
 
* Resolved broken localization strings for keybinds.
 
## [0.1.0]

* Initial release.