(function() {
    // Development constants
    const VERSION = "1.1.6";
    const DEV_MODE = false;

    // Add safe logging function
    function log(...args) {
        if (!DEV_MODE) return;
        try {
            console.error(`[ETFI Debug] ${args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ')}`);
        } catch (e) {}
    }

    // Constants
    const HIGH_RES_SCALING = 1.75;
    const FONT_SIZES = {
        LARGE: 18,
        MEDIUM: 16,
        SMALL: 14
    };

    // Cache DOM templates
    const iconTemplate = Object.assign(document.createElement('div'), {
        className: 'flex items-center'
    });
    
    const infoTemplate = Object.assign(document.createElement('div'), {
        className: 'additional-info',
        style: `
            background: rgba(0, 0, 0, 0.5);
            color: white;
            padding: 8px;
            border-radius: 5px;
            margin-top: 5px;
            text-align: left;
            font-size: ${getScaledFontSize(FONT_SIZES.LARGE)};
            max-width: 100%;
            display: block;
        `
    });

    // Optimization: Pre-compile localization keys
    const L10N = {
        ERA_BONUS: Locale.compose("LOC_MOD_ETFI_ERA_BONUS"),
        TOTAL_RESOURCES: Locale.compose("LOC_MOD_ETFI_TOTAL_RESOURCES"),
        HAPPINESS_PER_RESOURCE: Locale.compose("LOC_MOD_ETFI_HAPPINESS_PER_RESOURCE"),
    };

    // State management
    const state = {
        tooltipObserver: null,
        contentObserver: null,
        lastTooltip: null,
        resourceCache: new Map(),
        lastCityID: null
    };
    
    const IMPROVEMENTS = {
        displayNames: {
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
        },
        sets: {
            food: new Set([
                "IMPROVEMENT_FARM",
                "IMPROVEMENT_PASTURE",
                "IMPROVEMENT_PLANTATION",
                "IMPROVEMENT_FISHING_BOAT",
                "IMPROVEMENT_FISHING_BOAT_RESOURCE"
            ]),
            production: new Set([
                "IMPROVEMENT_CAMP",
                "IMPROVEMENT_WOODCUTTER",
                "IMPROVEMENT_WOODCUTTER_RESOURCE",
                "IMPROVEMENT_CLAY_PIT",
                "IMPROVEMENT_MINE",
                "IMPROVEMENT_MINE_RESOURCE",
                "IMPROVEMENT_QUARRY"
            ])
        }
    };

    // Tooltip configuration (moved to separate object)
    const TOOLTIPS = {
        ids: new Set([
            "LOC_PROJECT_TOWN_URBAN_CENTER_NAME",
            "LOC_PROJECT_TOWN_GRANARY_NAME",
            "LOC_PROJECT_TOWN_FISHING_NAME",
            "LOC_PROJECT_TOWN_PRODUCTION_NAME",
            "LOC_PROJECT_TOWN_INN_NAME",
            "LOC_PROJECT_TOWN_TRADE_NAME"
        ]),
        configs: {
            "LOC_PROJECT_TOWN_URBAN_CENTER_NAME": {
                counter: getBuildingCount,
                icons: ["YIELD_SCIENCE", "YIELD_CULTURE"]
            },
            "LOC_PROJECT_TOWN_GRANARY_NAME": {
                counter: (cityID) => getImprovementCount(cityID, Array.from(IMPROVEMENTS.sets.food)),
                icons: ["YIELD_FOOD"]
            },
            "LOC_PROJECT_TOWN_FISHING_NAME": {
                counter: (cityID) => getImprovementCount(cityID, Array.from(IMPROVEMENTS.sets.food)),
                icons: ["YIELD_FOOD"]
            },
            "LOC_PROJECT_TOWN_PRODUCTION_NAME": {
                counter: (cityID) => getImprovementCount(cityID, Array.from(IMPROVEMENTS.sets.production)),
                icons: ["YIELD_PRODUCTION"]
            },
            "LOC_PROJECT_TOWN_INN_NAME": {
                counter: getTradeCount,
                icons: ["YIELD_DIPLOMACY"]
            },
            "LOC_PROJECT_TOWN_TRADE_NAME": {
                counter: getResourceCount,
                icons: ["YIELD_HAPPINESS"]
            }
        }
    };

    // Helper functions (simplified and optimized)
    function getScaledFontSize(baseSize) {
        return `${baseSize * (window.devicePixelRatio > 1 || window.innerWidth > 2560 ? HIGH_RES_SCALING : 1)}px`;
    }

    function clearResourceCache() {
        state.resourceCache.clear();
        state.lastCityID = null;
    }

    function getResourceCount(cityID) {
        if (!cityID) return { total: 0, details: {} };

        const city = Cities.get(cityID);
        if (!city) return { total: 0, details: {} };

        // Check if we have cached data for this city
        const cacheKey = `${city.id.owner}-${city.id.id}`;
        if (state.resourceCache.has(cacheKey)) {
            return state.resourceCache.get(cacheKey);
        }

        const resources = new Map(); // Map to store resource counts by type

        // Get city location and purchased plots
        const cityLocation = city.location;
        const purchasedPlotIndices = city.getPurchasedPlots();

        if (!cityLocation) return { total: 0, details: {} };

        // Start with the city center plot
        const plots = [cityLocation];
        
        // Convert purchased plot indices to coordinates and add them
        if (purchasedPlotIndices?.length) {
            for (const plotIndex of purchasedPlotIndices) {
                const plotCoords = GameplayMap.getLocationFromIndex(plotIndex);
                if (plotCoords) {
                    plots.push(plotCoords);
                }
            }
        }

        // Check each plot for resources
        for (const plot of plots) {
            if (!plot.x || !plot.y) continue;

            const resourceType = GameplayMap.getResourceType(plot.x, plot.y);
            if (resourceType === ResourceTypes.NO_RESOURCE) continue;

            const resourceInfo = GameInfo.Resources.lookup(resourceType);
            if (!resourceInfo) continue;

            const resourceName = Locale.compose(resourceInfo.Name);
            const iconId = resourceInfo.ResourceType; // Get the resource type as icon ID
            resources.set(resourceName, {
                count: (resources.get(resourceName)?.count || 0) + 1,
                iconId
            });
        }

        const total = Array.from(resources.values()).reduce((sum, data) => sum + data.count, 0);
        const happiness = total * 2; // Each resource provides +2 happiness

        const result = {
            total: happiness,
            details: {
                resources: Array.from(resources.entries()).map(([name, data]) => ({
                    name,
                    count: data.count,
                    iconId: data.iconId
                })),
                resourceCount: total
            }
        };

        // Cache the result
        state.resourceCache.set(cacheKey, result);

        return result;
    }

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
                const displayName = Locale.compose(IMPROVEMENTS.displayNames[info.ConstructibleType] || info.ConstructibleType);
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

    function clearTooltipContent(tooltip) {
        if (!tooltip) return;
        const tooltipContent = tooltip.querySelector('.tooltip__content');
        if (tooltipContent) {
            tooltipContent.querySelectorAll('.additional-info').forEach(el => el.remove());
        }
    }

    function observeTooltipContent(tooltip) {
        if (state.contentObserver) {
            state.contentObserver.disconnect();
        }

        const tooltipContent = tooltip.querySelector('.tooltip__content');
        if (!tooltipContent) return;

        state.contentObserver = new MutationObserver(() => {
            // Force immediate recalculation when content changes
            requestAnimationFrame(() => modifyTooltip(tooltip));
        });

        state.contentObserver.observe(tooltipContent, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
    }

    function modifyTooltip(tooltip) {
        if (state.lastTooltip) {
            clearTooltipContent(state.lastTooltip);
        }
        state.lastTooltip = tooltip;

        const cityID = getCityID();
        if (!cityID) {
            log('No city ID found');
            clearTooltipContent(tooltip);
            return;
        }

        const l10nId = tooltip.querySelector("[data-l10n-id]")?.getAttribute("data-l10n-id");
        log('Tooltip ID:', l10nId);

        if (!TOOLTIPS.ids.has(l10nId)) {
            log('Tooltip ID not in tracked set:', l10nId);
            clearTooltipContent(tooltip);
            return;
        }
        
        const config = TOOLTIPS.configs[l10nId];
        log('Found config for tooltip:', l10nId);

        const tooltipContent = tooltip.querySelector('.tooltip__content');
        if (!tooltipContent) {
            log('No tooltip content found');
            return;
        }

        clearTooltipContent(tooltip);

        const totalCount = config.counter(cityID);
        log('Counter result:', totalCount);
        
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
        
        if (l10nId === "LOC_PROJECT_TOWN_TRADE_NAME") {
            // Special handling for Trade focus to show happiness calculation
            const iconDiv = iconTemplate.cloneNode(true);
            iconDiv.innerHTML = `
                <fxs-icon data-icon-id="${config.icons[0]}" class="size-6 mr-1"></fxs-icon>
                <strong>+${totalCount.total}</strong>
            `;
            totalDiv.appendChild(iconDiv);
        } else {
            // Regular handling for other focus types
            config.icons.forEach(iconId => {
                const iconDiv = iconTemplate.cloneNode(true);
                iconDiv.innerHTML = `
                    <fxs-icon data-icon-id="${iconId}" class="size-6 mr-1"></fxs-icon>
                    <strong>+${totalCount.total}</strong>
                `;
                totalDiv.appendChild(iconDiv);
            });
        }
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
            } else if (totalCount.details.resources !== undefined) {
                const resources = totalCount.details.resources
                    .map(({name, count, iconId}) => `
                        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                            <span style="display: flex; align-items: center; gap: 4px;">
                                <fxs-icon data-icon-id="${iconId}" class="size-8" style="min-width: 24px; min-height: 24px;"></fxs-icon>
                            </span>
                            <span style="color: #fff;">+${count}</span>
                        </div>
                    `)
                    .join('');

                breakdownDiv.innerHTML = `
                    <div style="margin-bottom: 8px;">
                        ${Locale.compose("LOC_MOD_ETFI_TOTAL_RESOURCES")}: ${totalCount.details.resourceCount}
                    </div>
                    ${resources}
                    <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                        <span>${Locale.compose("LOC_MOD_ETFI_HAPPINESS_PER_RESOURCE")}</span>
                        <span style="color: #fff;">x2</span>
                    </div>
                `;
            } else {
                // Improvements breakdown
                const parts = Object.entries(totalCount.details)
                    .map(([name, count]) => `
                        <div style="display: flex; justify-content: space-between; margin: 2px 0;">
                            <span>${name}</span>
                            <span style="color: #fff;">+${count}</span>
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
        log('Starting tooltip observer...');
        
        const tooltipContainer = document.querySelector('.tooltip-container') || document.body;
        log('Found tooltip container:', tooltipContainer ? 'yes' : 'no');
        
        if (state.tooltipObserver) {
            state.tooltipObserver.disconnect();
        }
        if (state.contentObserver) {
            state.contentObserver.disconnect();
        }

        state.tooltipObserver = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                for (const node of mutation.removedNodes) {
                    if (node.nodeName === 'FXS-TOOLTIP') {
                        clearTooltipContent(node);
                        if (state.lastTooltip === node) {
                            state.lastTooltip = null;
                            clearResourceCache(); // Clear cache when tooltip is removed
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

        state.tooltipObserver.observe(tooltipContainer, { 
            childList: true, 
            subtree: true
        });
        log('Tooltip observer started');
    }

    function getCityID() {
        // First try getting selected city
        let gcity = UI.Player.getHeadSelectedCity();
        if (gcity?.id) {
            return gcity;
        }

        // If no selected city, try getting city from tooltip
        const tooltip = document.querySelector('fxs-tooltip.plot-tooltip');
        if (!tooltip) return null;

        const plotCoord = {
            x: parseInt(tooltip.getAttribute('data-plot-x')),
            y: parseInt(tooltip.getAttribute('data-plot-y'))
        };

        if (isNaN(plotCoord.x) || isNaN(plotCoord.y)) return null;

        const city = GameplayMap.getCityAt(plotCoord.x, plotCoord.y);
        return city;
    }

    startTooltipObserver();
    log('ETFI Initialization complete');
})();
