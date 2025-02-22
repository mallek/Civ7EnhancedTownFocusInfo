(function() {
    // Development constants (comment out in production)
    const VERSION = "1.1.1";
    const DEV_MODE = false;  // Enable to show version number and extra logging

    // Constants
    const HIGH_RES_SCALING = 1.75;
    const FONT_SIZES = {
        LARGE: 18,
        MEDIUM: 16,
        SMALL: 14
    };

    // State
    let tooltipObserver = null;
    let contentObserver = null;
    let lastTooltip = null;  // Track the last tooltip we modified
    
    // Add safe logging function
    function log(...args) {
        try {
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg);
                }
                return String(arg);
            }).join(' ');

            if (console?.error) {
                console.error(`[ETFI Debug] ${message}`);
            }
        } catch (e) {
            // Silently fail if logging isn't available
        }
    }

    // Function to calculate scaled font size
    function getScaledFontSize(baseSize) {
        const isHighRes = window.devicePixelRatio > 1 || window.innerWidth > 2560;
        return isHighRes ? `${baseSize * HIGH_RES_SCALING}px` : `${baseSize}px`;
    }

    // Cache DOM queries
    const iconTemplate = document.createElement('div');
    iconTemplate.className = 'flex items-center';
    
    const infoTemplate = document.createElement('div');
    infoTemplate.className = 'additional-info';
    infoTemplate.style.cssText = `
        background: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 8px;
        border-radius: 5px;
        margin-top: 5px;
        text-align: left;
        font-size: ${getScaledFontSize(FONT_SIZES.LARGE)};
        max-width: 100%;
        display: block;
    `;

    // Create a mapping for improvement type display names
    const IMPROVEMENT_DISPLAY_NAMES = {
        "IMPROVEMENT_WOODCUTTER": "LOC_MOD_ETFI_IMPROVEMENT_WOODCUTTER",
        "IMPROVEMENT_WOODCUTTER_RESOURCE": "LOC_MOD_ETFI_IMPROVEMENT_WOODCUTTER",
        "IMPROVEMENT_MINE": "LOC_MOD_ETFI_IMPROVEMENT_MINE",
        "IMPROVEMENT_MINE_RESOURCE": "LOC_MOD_ETFI_IMPROVEMENT_MINE",
        "IMPROVEMENT_FISHING_BOAT": "LOC_MOD_ETFI_IMPROVEMENT_FISHING_BOAT",
        "IMPROVEMENT_FISHING_BOAT_RESOURCE": "LOC_MOD_ETFI_IMPROVEMENT_FISHING_BOAT",
        "IMPROVEMENT_FARM": "LOC_MOD_ETFI_IMPROVEMENT_FARM",
        "IMPROVEMENT_PASTURE": "LOC_MOD_ETFI_IMPROVEMENT_PASTURE",
        "IMPROVEMENT_PLANTATION": "LOC_MOD_ETFI_IMPROVEMENT_PLANTATION",
        "IMPROVEMENT_CAMP": "LOC_MOD_ETFI_IMPROVEMENT_CAMP",
        "IMPROVEMENT_CLAY_PIT": "LOC_MOD_ETFI_IMPROVEMENT_CLAY_PIT",
        "IMPROVEMENT_QUARRY": "LOC_MOD_ETFI_IMPROVEMENT_QUARRY"
    };

    // Keep all improvement types in the sets
    const IMPROVEMENT_SETS = {
        food: new Set([
            "IMPROVEMENT_FARM", "IMPROVEMENT_PASTURE", "IMPROVEMENT_PLANTATION",
            "IMPROVEMENT_FISHING_BOAT", "IMPROVEMENT_FISHING_BOAT_RESOURCE"
        ]),
        production: new Set([
            "IMPROVEMENT_CAMP", "IMPROVEMENT_WOODCUTTER", "IMPROVEMENT_WOODCUTTER_RESOURCE",
            "IMPROVEMENT_CLAY_PIT", "IMPROVEMENT_MINE", "IMPROVEMENT_MINE_RESOURCE", "IMPROVEMENT_QUARRY"
        ])
    };

    // Optimize Set lookups
    const TOOLTIP_IDS = new Set([
        "LOC_PROJECT_TOWN_URBAN_CENTER_NAME",
        "LOC_PROJECT_TOWN_GRANARY_NAME",
        "LOC_PROJECT_TOWN_FISHING_NAME",
        "LOC_PROJECT_TOWN_PRODUCTION_NAME",
        "LOC_PROJECT_TOWN_INN_NAME"
    ]);

	function getImprovementCount(cityID, targetImprovements) {
        if (!cityID) return { total: 0, details: {} };

        const city = Cities.get(cityID);
        if (!city?.Constructibles) return { total: 0, details: {} };

        let detailedCounts = {};
        const improvements = city.Constructibles.getIdsOfClass("IMPROVEMENT");
        const targetSet = new Set(targetImprovements);

        for (const instanceId of improvements) {
	        const instance = Constructibles.get(instanceId);
	        if (!instance) continue;

	        const info = GameInfo.Constructibles.lookup(instance.type);
            if (info && targetSet.has(info.ConstructibleType)) {
                const displayName = Locale.compose(IMPROVEMENT_DISPLAY_NAMES[info.ConstructibleType] || info.ConstructibleType);
                detailedCounts[displayName] = (detailedCounts[displayName] || 0) + 1;
            }
        }

        let total = Object.values(detailedCounts).reduce((sum, count) => sum + count, 0);

        // Multiply based on era
	    const ageData = GameInfo.Ages.lookup(Game.age);
        let multiplier = 1;
        if (ageData) {
		    const currentAge = ageData.AgeType?.trim();
		    if (currentAge === "AGE_EXPLORATION") {
                multiplier = 2;
		    } else if (currentAge === "AGE_MODERN") {
                multiplier = 3;
            }
        }
        
        return { 
            total: total * multiplier, 
            details: detailedCounts,
            multiplier
        };
	}

    function getBuildingCount(cityID) {
        if (!cityID) return { total: 0, details: {} };

        const city = Cities.get(cityID);
        if (!city?.Constructibles) return { total: 0, details: {} };

        const SPECIAL_BUILDINGS = new Set(["BUILDING_RAIL_STATION"]);
        const tileStacks = new Map();  // Map of tile coordinates to array of buildings
        const quarters = [];  // Store all quarters (special and stacked)

        // First pass: collect all buildings by tile
        for (const instanceId of city.Constructibles.getIdsOfClass("BUILDING")) {
            const instance = Constructibles.get(instanceId);
            if (!instance?.location) continue;

            const buildingInfo = GameInfo.Constructibles.lookup(instance.type);
            if (!buildingInfo) continue;

            const buildingType = buildingInfo.ConstructibleType;
            if (!buildingType) continue;

            if (SPECIAL_BUILDINGS.has(buildingType)) {
                // Add special buildings as quarters
                quarters.push({
                    isSpecial: true,
                    buildings: [buildingInfo.Name], // Use the Name field from GameInfo
                    contribution: 1
                });
            } else {
                const key = `${instance.location.x},${instance.location.y}`;
                if (!tileStacks.has(key)) {
                    tileStacks.set(key, []);
                }
                tileStacks.get(key).push(buildingInfo.Name); // Store the Name instead of ConstructibleType
            }
        }

        // Process tile stacks
        tileStacks.forEach((buildings) => {
            if (buildings.length >= 2) {
                quarters.push({
                    isSpecial: false,
                    buildings: buildings, // Names are already localization keys
                    contribution: 1
                });
            }
        });

        const total = quarters.length;

        return { 
            total, 
            details: {
                quarters: quarters.sort((a, b) => b.isSpecial - a.isSpecial)  // Special buildings first
            }
        };
    }

    function getTradeCount(cityID) {
        if (!cityID) {
            return { total: 0, details: {} };
        }

        const city = Cities.get(cityID);
        if (!city) {
            return { total: 0, details: {} };
        }

        // Get all connected settlements
        const connectedIds = city.getConnectedCities();
        if (!connectedIds?.length) {
            return { total: 0, details: {} };
        }

        // Group settlements by type with their names
        const towns = [];
        const cities = [];
        
        connectedIds.forEach(id => {
            const settlement = Cities.get(id);
            if (!settlement) return;
            
            const name = Locale.compose(settlement.name);
            if (settlement.isTown) {
                towns.push(name);
            } else {
                cities.push(name);
            }
        });

        // Each connection provides +2 to the Hub Town bonus
        return { 
            total: (towns.length + cities.length) * 2,
            details: {
                label: Locale.compose('LOC_MOD_ETFI_TRADE_CONNECTIONS'),
                breakdown: [
                    {
                        label: Locale.compose('LOC_MOD_ETFI_CONNECTED_CITIES'),
                        count: cities.length,
                        names: cities
                    },
                    {
                        label: Locale.compose('LOC_MOD_ETFI_CONNECTED_TOWNS'),
                        count: towns.length,
                        names: towns
                    }
                ]
            }
        };
    }

    const TOOLTIP_CONFIGS = {
        "LOC_PROJECT_TOWN_URBAN_CENTER_NAME": {
            counter: getBuildingCount,
            icons: ["YIELD_SCIENCE", "YIELD_CULTURE"]
        },
        "LOC_PROJECT_TOWN_GRANARY_NAME": {
            counter: (cityID) => getImprovementCount(cityID, Array.from(IMPROVEMENT_SETS.food)),
            icons: ["YIELD_FOOD"]
        },
        "LOC_PROJECT_TOWN_FISHING_NAME": {
            counter: (cityID) => getImprovementCount(cityID, Array.from(IMPROVEMENT_SETS.food)),
            icons: ["YIELD_FOOD"]
        },
        "LOC_PROJECT_TOWN_PRODUCTION_NAME": {
            counter: (cityID) => getImprovementCount(cityID, Array.from(IMPROVEMENT_SETS.production)),
            icons: ["YIELD_PRODUCTION"]
        },
        "LOC_PROJECT_TOWN_INN_NAME": {
            counter: getTradeCount,
            icons: ["YIELD_DIPLOMACY"]
        }
    };

    function clearTooltipContent(tooltip) {
        if (!tooltip) return;
        const tooltipContent = tooltip.querySelector('.tooltip__content');
        if (tooltipContent) {
            tooltipContent.querySelectorAll('.additional-info').forEach(el => el.remove());
        }
    }

    function observeTooltipContent(tooltip) {
        if (contentObserver) {
            contentObserver.disconnect();
        }

        const tooltipContent = tooltip.querySelector('.tooltip__content');
        if (!tooltipContent) return;

        contentObserver = new MutationObserver(() => {
            // Force immediate recalculation when content changes
            requestAnimationFrame(() => modifyTooltip(tooltip));
        });

        contentObserver.observe(tooltipContent, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
    }

	function modifyTooltip(tooltip) {
        if (lastTooltip) {
            clearTooltipContent(lastTooltip);
        }
        lastTooltip = tooltip;

        const cityID = getCityID();
        if (!cityID) {
            clearTooltipContent(tooltip);
	        return;
	    }

        const l10nId = tooltip.querySelector("[data-l10n-id]")?.getAttribute("data-l10n-id");
        if (!TOOLTIP_IDS.has(l10nId)) {
            clearTooltipContent(tooltip);
	            return;
	    }
	    
        const config = TOOLTIP_CONFIGS[l10nId];
        const tooltipContent = tooltip.querySelector('.tooltip__content');
        if (!tooltipContent) return;

        clearTooltipContent(tooltip);

        const totalCount = config.counter(cityID);
        
        const newInfo = infoTemplate.cloneNode(true);
        newInfo.style.display = 'flex';
        newInfo.style.flexDirection = 'column';
        newInfo.style.gap = '8px';
        newInfo.style.padding = '8px';

        // Development version display 
        if (DEV_MODE) {
            const versionDiv = document.createElement('div');
            versionDiv.style.cssText = `
                color: #888;
                font-size: ${getScaledFontSize(FONT_SIZES.SMALL)};
                text-align: right;
                margin-bottom: 4px;
            `;
            versionDiv.textContent = `v${VERSION}`;
            newInfo.appendChild(versionDiv);
        }
        

        // Style the total section
        const totalDiv = document.createElement('div');
        totalDiv.style.cssText = `
            display: flex;
            gap: 8px;
            padding-bottom: 12px;
            margin-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            font-size: ${getScaledFontSize(FONT_SIZES.LARGE)};
        `;
        
        config.icons.forEach(iconId => {
            const iconDiv = iconTemplate.cloneNode(true);
            iconDiv.innerHTML = `
                <fxs-icon data-icon-id="${iconId}" class="size-6 mr-1"></fxs-icon>
                <strong>+${totalCount.total}</strong>
            `;
            totalDiv.appendChild(iconDiv);
        });
        newInfo.appendChild(totalDiv);

        // Style the breakdown section
        const breakdownDiv = document.createElement('div');
        breakdownDiv.style.cssText = `
            font-size: ${getScaledFontSize(FONT_SIZES.MEDIUM)};
            color: #bbb;
            margin-left: 4px;
            padding-top: 4px;
            line-height: 1.8;
        `;

        if (totalCount.details) {
            if (totalCount.details.breakdown !== undefined) {
                const parts = totalCount.details.breakdown
                    .map(({ label, count, names }) => `
                        <div style="margin: 4px 0;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>${label}</span>
                                <span style="color: #fff;">${count}</span>
                            </div>
                            ${names ? `
                                <div style="padding-left: 12px; font-size: ${getScaledFontSize(FONT_SIZES.SMALL)}; color: #aaa;">
                                    ${names.join(', ')}
                                </div>
                            ` : ''}
                        </div>
                    `)
                    .join('');

                breakdownDiv.innerHTML = `
                    <div style="margin-bottom: 4px;">${totalCount.details.label}:</div>
                    ${parts}
                    <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                        <span>${Locale.compose("LOC_MOD_ETFI_BONUS_PER_CONNECTION")}</span>
                        <span style="color: #fff;">x2</span>
                    </div>
                `;
            } else if (totalCount.details.quarters !== undefined) {
                // Group quarters by type
                const specialQuarters = totalCount.details.quarters.filter(q => q.isSpecial);
                const buildingQuarters = totalCount.details.quarters.filter(q => !q.isSpecial);

                let content = '';

                // Show special quarters if any exist
                if (specialQuarters.length > 0) {
                    content += `
                        <div style="margin-bottom: 8px;">
                            <div style="color: #fff; margin-bottom: 4px;">${Locale.compose("LOC_MOD_ETFI_SPECIAL_QUARTERS")}:</div>
                            ${specialQuarters.map(quarter => {
                                // Get localized building name
                                const buildingName = Locale.compose(quarter.buildings[0]);
                                return `
                                    <div style="padding-left: 8px;">
                                        <div style="display: flex; justify-content: space-between;">
                                            <span>${buildingName}</span>
                                            <span style="color: #fff;">+1</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }

                // Show building quarters if any exist
                if (buildingQuarters.length > 0) {
                    content += `
                        <div style="margin-top: ${specialQuarters.length ? '8px' : '0'};">
                            <div style="color: #fff; margin-bottom: 4px; font-size: ${getScaledFontSize(FONT_SIZES.MEDIUM)};">${Locale.compose("LOC_MOD_ETFI_BUILDING_QUARTERS")}:</div>
                            ${buildingQuarters.map(quarter => {
                                // Get localized building names
                                const buildingNames = quarter.buildings.map(b => Locale.compose(b));
                                return `
                                    <div style="padding-left: 8px;">
                                        <div style="display: flex; justify-content: space-between;">
                                            <div style="font-size: ${getScaledFontSize(FONT_SIZES.SMALL)}; color: #bbb;">
                                                ${buildingNames.join(' + ')}
                                            </div>
                                            <span style="color: #fff;">+1</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }

                breakdownDiv.innerHTML = content;
            } else if (totalCount.details.text !== undefined || totalCount.details.label !== undefined) {
                breakdownDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between;">
                        <span>${totalCount.details.label || totalCount.details.text}</span>
                        <span style="color: #fff;">${totalCount.details.count}</span>
                    </div>
                `;
            } else {
                // Improvements breakdown
                const parts = Object.entries(totalCount.details)
                    .map(([name, count]) => `
                        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                            <span>${name}</span>
                            <span style="color: #fff;">${count}</span>
                        </div>
                    `)
                    .join('');

                let content = parts;
                if (totalCount.multiplier > 1) {
                    content += `
                        <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                            <span>${Locale.compose("LOC_MOD_ETFI_ERA_BONUS")}</span>
                            <span style="color: #fff;">x${totalCount.multiplier}</span>
                        </div>
                    `;
                }
                breakdownDiv.innerHTML = content;
            }
            newInfo.appendChild(breakdownDiv);
        }

        tooltipContent.appendChild(newInfo);
    }

    function startTooltipObserver() {
        const tooltipContainer = document.querySelector('.tooltip-container') || document.body;
        
        if (tooltipObserver) {
            tooltipObserver.disconnect();
        }
        if (contentObserver) {
            contentObserver.disconnect();
        }

        tooltipObserver = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                for (const node of mutation.removedNodes) {
                    if (node.nodeName === 'FXS-TOOLTIP') {
                        clearTooltipContent(node);
                        if (lastTooltip === node) {
                            lastTooltip = null;
                        }
                    }
                }
                for (const node of mutation.addedNodes) {
                    if (node.nodeName === 'FXS-TOOLTIP') {
                        // Wait for next frame to check visibility
                        requestAnimationFrame(() => {
                            if (node.offsetParent !== null) {  // Check if actually visible in DOM
                                observeTooltipContent(node);
                                modifyTooltip(node);
                            }
                        });
                    }
                }
            }
        });

        tooltipObserver.observe(tooltipContainer, { 
            childList: true, 
            subtree: true
        });
    }

    function getCityID() {
        let gcity = UI.Player.getHeadSelectedCity();
        if (!gcity || !gcity.id) {
            return null;
        }
        return gcity;
    }

    startTooltipObserver();
})();
