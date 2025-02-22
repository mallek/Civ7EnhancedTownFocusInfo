# Enhanced Town Focus Info Mod for Civilization VII

## Overview
Enhanced Town Focus Info is a quality-of-life mod for Civilization VII that provides detailed breakdowns of yield bonuses when selecting town specializations. This mod enhances the tooltip display to show exactly how many buildings, improvements, and trade routes contribute to each specialization's bonuses.

*Based on the original Town Focus Boost Info mod by Yamada, enhanced and maintained by Mallek*

## Features

### Urban Center Focus
Shows detailed breakdown of Science and Culture bonuses from:
- Special Quarters (like Rail Stations)
- Building Quarters (stacked buildings)
- Individual contribution of each quarter

![Urban Center Focus Screenshot](screenshots/urban_center.png)

### Farming Town Focus
Shows Food yield bonuses from:
- Farms
- Pastures
- Plantations
- Era multiplier bonuses (2x in Exploration Age, 3x in Modern Age)

![Farming Town Focus Screenshot](screenshots/farming_town.png)

### Mining Town Focus
Details Production bonuses from:
- Mines
- Woodcutters
- Quarries
- Clay Pits
- Camps
- Era multiplier effects (2x in Exploration Age, 3x in Modern Age)

![Mining Town Focus Screenshot](screenshots/mining_town.png)

### Hub Town Focus
Shows Diplomacy bonuses from:
- Domestic trade routes (+2 per route)
- Detailed route count and breakdown

![Hub Town Focus Screenshot](screenshots/hub_town.png)

## Installation

### Method 1: Steam Workshop (Recommended)
1. Subscribe to the mod through the Official Civilization VII Mod Browser
2. Enable the mod in the Additional Content menu
3. Start or load a game
4. Hover over any town focus option to see the enhanced tooltips

### Method 2: Manual Installation
1. Download the mod files
2. Navigate to your Civilization VII mods folder:
   - Press `Windows Key + R`
   - Type `%localappdata%` and press Enter
   - Navigate to `Firaxis Games\Sid Meier's Civilization VII\Mods`
3. Copy all mod files into this folder
4. Launch Civilization VII
5. Enable the mod in the Additional Content menu
6. Start or load a game

Note: The full path should look like:
```
C:\Users\[YourUsername]\AppData\Local\Firaxis Games\Sid Meier's Civilization VII\Mods\EnhancedTownFocusInfo
```

## Compatibility
- Works with Civilization VII base game
- Compatible with most other UI mods
- Does not affect save games

## Known Issues
- Font scaling may be too small on 4K/high-resolution displays

## Contributing
Feel free to contribute to this project by:
- Reporting bugs
- Suggesting improvements
- Submitting pull requests
- Helping with translations (see Localization section below)

## Localization
The mod now supports multiple languages! All text strings are stored in localization files under the `modules/text` directory.

To contribute a new translation:

1. Create a new directory under `modules/text` with your language code (e.g., `fr_FR` for French)
2. Copy `ModuleText.xml` from the `en_us` directory to your new language directory
3. Translate the strings in your new file
4. Add the SQL translations to `ETFI_Text.sql`
5. Update the modinfo file to include your new language file
6. Submit a pull request or send the files to the mod maintainers

Current language support:
- English (en_US)
- Japanese (ja_JP)
- *More coming soon with community help!*

## Credits
- Original mod concept by Yamada
- Enhanced and maintained by Mallek
- Thanks to the Civilization VII modding community

## License
This project is licensed under the MIT License - see the LICENSE file for details

## Version History
- 1.1.0: Localization Update
  - Added Japanese language support
  - Reorganized file structure for better localization support
  - Fixed building name translations in tooltips
  - Improved era multiplier display
- 1.0.5: Initial Release
  - Complete rewrite of tooltip system
  - Added detailed breakdowns for all focus types
  - Improved visual presentation
  - Added era multiplier display
