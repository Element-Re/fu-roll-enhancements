# Change Log
All notable changes to this project will be documented in this file.
 
The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [unreleased]

### Changed

* Improved the info displayed on the rolled item in the Auto Target and Auto Spend dialogs.
* Auto Spend will now use the default system IP cost on consumables unless overridden.
* Auto Spend configuration "enable/override" field will now behave the same way in both item sheets and the Auto Spend dialog when rolling. Specifically, the field is never hidden, and the label will indicate that it enables Auto Spend on items without a default system cost, whereas it overrides the default system cost in cases where there is one.
* Slightly changed the behavior of the "Disable" button in the Auto Spend dialog. Specifically, it unsets the "Enable" field for items with a default system cost, whereas it sets the "Override Default Cost" field and sets the cost to 0 for items with a default system cost. In either case, the result is that the item will not cost anything for this roll and others in the future.

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