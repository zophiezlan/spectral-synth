/**
 * Filter Manager Module
 *
 * Purpose: Manages substance filtering (search, category, favorites)
 *
 * Dependencies:
 * - Favorites (for favorites functionality)
 * - DOM elements (substanceSelect, searchInput, categorySelect, resultsCount)
 *
 * Exports:
 * - FilterManager singleton
 *
 * This module extracts filter-related functionality from app.js:
 * - Search filtering with debouncing
 * - Category filtering
 * - Favorites filtering
 * - Filter status bar management
 * - Clear filter functionality
 *
 * Usage:
 * ```javascript
 * // Initialize
 * FilterManager.init(libraryData);
 *
 * // Apply filters
 * FilterManager.setSearch('caffeine');
 * FilterManager.setCategory('stimulants');
 * FilterManager.setShowFavoritesOnly(true);
 *
 * // Clear filters
 * FilterManager.clearAll();
 *
 * // Get filtered results
 * const filtered = FilterManager.getFilteredLibrary();
 * ```
 */


import { CONFIG } from '../core/config.js';
import { Favorites } from '../core/favorites.js';
import { categorizeSubstance, matchesSearch } from '../data/substance-utilities.js';
import { isCommonSubstance } from '../data/common-substances.js';
import { Toast } from './ui-utilities.js';

export const FilterManager = (function() {
    'use strict';

    // Private state
    let libraryData = null;
    let searchDebounceTimer = null;
    let lastSelectedId = null; // substance id chosen before the last repopulate
    let onSelectionInvalid = null; // called when the selected substance is filtered out

    // Filter state
    let currentSearchTerm = '';
    let currentCategory = 'all';
    let showFavoritesOnly = false;
    let showCommonOnly = true; // default view: the substances people recognise

    // DOM element references (cached for performance)
    let elements = null;

    /**
     * Cache DOM element references
     * @private
     */
    function cacheElements() {
        elements = {
            substanceSelect: document.getElementById('substance'),
            searchInput: document.getElementById('search'),
            categorySelect: document.getElementById('category'),
            resultsCount: document.getElementById('results-count'),
            activeFiltersContainer: document.getElementById('active-filters'),
            searchFilterTag: document.getElementById('search-filter-tag'),
            categoryFilterTag: document.getElementById('category-filter-tag'),
            favoritesFilterTag: document.getElementById('favorites-filter-tag'),
            searchTermDisplay: document.getElementById('search-term-display'),
            categoryNameDisplay: document.getElementById('category-name-display'),
            noResultsDiv: document.getElementById('no-results'),
            substanceSelector: document.querySelector('.substance-selector'),
            showAllButton: document.getElementById('show-all'),
            showFavoritesButton: document.getElementById('show-favorites'),
            showCommonButton: document.getElementById('show-common'),
            categoryChips: Array.from(document.querySelectorAll('.chip[data-category]')),
        };
    }

    /**
     * Get filtered library based on current filter state
     * @returns {Array} Filtered library data
     */
    function getFilteredLibrary() {
        if (!libraryData) return [];

        const favoritesList = typeof Favorites !== 'undefined' ? Favorites.getAll() : [];

        // Typing a search bypasses the Common filter so a search can't hit a wall
        const applyCommon = showCommonOnly && !currentSearchTerm;

        return libraryData.filter(item => {
            // Favorites filter
            if (showFavoritesOnly && !favoritesList.includes(item.name)) {
                return false;
            }

            // Common filter
            if (applyCommon && !isCommonSubstance(item)) {
                return false;
            }

            // Category filter
            const itemCategory = typeof categorizeSubstance === 'function'
                ? categorizeSubstance(item)
                : 'other';
            const categoryMatch = currentCategory === 'all' || itemCategory === currentCategory;

            // Search filter (name, aliases, formula)
            const searchMatch = matchesSearch(item, currentSearchTerm);

            return categoryMatch && searchMatch;
        });
    }

    /**
     * Populate substance selector dropdown
     * @private
     */
    function populateSubstanceSelector() {
        if (!elements.substanceSelect) return;

        const filteredData = getFilteredLibrary();

        // Rebuilding the options resets the select's value, so remember what
        // was chosen and put it back if it survived the filter.
        const previousId = elements.substanceSelect.value;
        if (previousId) lastSelectedId = previousId;

        // Clear existing options except the first one
        elements.substanceSelect.innerHTML = '<option value="">-- Select a Substance --</option>';

        // Add filtered substances
        filteredData.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            elements.substanceSelect.appendChild(option);
        });

        if (previousId && filteredData.some(item => item.id === previousId)) {
            elements.substanceSelect.value = previousId;
        }

        // Update results count
        if (elements.resultsCount) {
            elements.resultsCount.textContent = `${filteredData.length} substance${filteredData.length !== 1 ? 's' : ''}`;
        }

        // Update filter status display
        updateFilterStatus(filteredData.length);
        syncCategoryChips();
        updateFavoritesButtons();
    }

    /**
     * Update filter status bar display
     * @param {number} resultCount - Number of results after filtering
     * @private
     */
    function updateFilterStatus(resultCount) {
        if (!elements.activeFiltersContainer) return;

        let hasActiveFilters = false;

        // Update search filter tag
        if (currentSearchTerm && elements.searchFilterTag) {
            if (elements.searchTermDisplay) {
                elements.searchTermDisplay.textContent = currentSearchTerm;
            }
            elements.searchFilterTag.classList.remove('hidden');
            hasActiveFilters = true;
        } else if (elements.searchFilterTag) {
            elements.searchFilterTag.classList.add('hidden');
        }

        // Update category filter tag
        if (currentCategory && currentCategory !== 'all' && elements.categoryFilterTag) {
            if (elements.categoryNameDisplay && elements.categorySelect) {
                const selectedOption = elements.categorySelect.options[elements.categorySelect.selectedIndex];
                elements.categoryNameDisplay.textContent = selectedOption ? selectedOption.text : currentCategory;
            }
            elements.categoryFilterTag.classList.remove('hidden');
            hasActiveFilters = true;
        } else if (elements.categoryFilterTag) {
            elements.categoryFilterTag.classList.add('hidden');
        }

        // Update favorites filter tag
        if (showFavoritesOnly && elements.favoritesFilterTag) {
            elements.favoritesFilterTag.classList.remove('hidden');
            hasActiveFilters = true;
        } else if (elements.favoritesFilterTag) {
            elements.favoritesFilterTag.classList.add('hidden');
        }

        // Show/hide active filters container
        if (hasActiveFilters) {
            elements.activeFiltersContainer.classList.remove('hidden');
        } else {
            elements.activeFiltersContainer.classList.add('hidden');
        }

        // Show/hide no results state
        if (elements.noResultsDiv) {
            if (resultCount === 0) {
                const btn = elements.noResultsDiv.querySelector('#clear-search-btn');
                if (btn) {
                    btn.textContent = (showCommonOnly && !currentSearchTerm) ? 'Show all substances' : 'Clear filters';
                }
                elements.noResultsDiv.classList.remove('hidden');
                if (elements.substanceSelector) {
                    elements.substanceSelector.style.display = 'none';
                }
            } else {
                elements.noResultsDiv.classList.add('hidden');
                if (elements.substanceSelector) {
                    elements.substanceSelector.style.display = 'block';
                }
            }
        }
    }

    /**
     * Update favorites button states
     * @private
     */
    function updateFavoritesButtons() {
        if (elements.showAllButton) {
            elements.showAllButton.classList.toggle('active', !showFavoritesOnly);
            elements.showAllButton.setAttribute('aria-pressed', String(!showFavoritesOnly));
        }
        if (elements.showFavoritesButton) {
            elements.showFavoritesButton.classList.toggle('active', showFavoritesOnly);
            elements.showFavoritesButton.setAttribute('aria-pressed', String(showFavoritesOnly));
        }
        if (elements.showCommonButton) {
            elements.showCommonButton.classList.toggle('active', showCommonOnly);
            elements.showCommonButton.setAttribute('aria-pressed', String(showCommonOnly));
            // Dim the chip while a search bypasses it
            elements.showCommonButton.classList.toggle('bypassed', showCommonOnly && !!currentSearchTerm);
        }
    }

    /**
     * Mirror the (visually hidden) category <select> onto the chip row
     * @private
     */
    function syncCategoryChips() {
        if (!elements.categoryChips || elements.categoryChips.length === 0) return;
        elements.categoryChips.forEach(chip => {
            const isActive = chip.dataset.category === currentCategory;
            chip.classList.toggle('active', isActive);
            chip.setAttribute('aria-pressed', String(isActive));
        });
    }

    /**
     * Check if current selection is still valid after filtering
     * @private
     */
    function checkCurrentSelection() {
        if (!elements.substanceSelect) return;

        // populateSubstanceSelector() already restored the value if the
        // substance is still in the filtered list; an empty value here means
        // the previous selection was filtered out.
        if (elements.substanceSelect.value || !lastSelectedId) return;

        lastSelectedId = null;
        if (typeof onSelectionInvalid === 'function') {
            onSelectionInvalid();
        }
    }

    return {
        /**
         * Initialize the filter manager
         * @param {Array} library - The FTIR library data
         * @param {Object} [hooks]
         * @param {Function} [hooks.onSelectionInvalid] - Called after the
         *   selected substance was filtered out and the select was reset
         */
        init(library, { onSelectionInvalid: onInvalid } = {}) {
            libraryData = library;
            onSelectionInvalid = onInvalid || null;
            cacheElements();
            this.setupListeners();
            populateSubstanceSelector();
        },

        /**
         * Set up filter event listeners
         */
        setupListeners() {
            // Search input
            if (elements.searchInput) {
                elements.searchInput.addEventListener('input', () => {
                    this.handleSearch();
                });
            }

            // Category select
            if (elements.categorySelect) {
                elements.categorySelect.addEventListener('change', () => {
                    this.setCategory(elements.categorySelect.value);
                });
            }

            // Filter remove buttons
            const filterRemoveButtons = document.querySelectorAll('.filter-remove');
            filterRemoveButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const filterType = button.getAttribute('data-filter');
                    this.clearFilter(filterType);
                });
            });

            // Clear all filters button
            const clearAllButton = document.getElementById('clear-all-filters');
            if (clearAllButton) {
                clearAllButton.addEventListener('click', () => this.clearAll());
            }

            // No-results action: widen the Common filter first, otherwise clear everything
            const clearSearchBtn = document.getElementById('clear-search-btn');
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    if (showCommonOnly && !currentSearchTerm) {
                        this.setShowCommonOnly(false);
                    } else {
                        this.clearAll();
                    }
                });
            }

            if (elements.showCommonButton) {
                elements.showCommonButton.addEventListener('click', () => this.setShowCommonOnly(!showCommonOnly));
            }

            // Category chips (the native select stays in the DOM for state/tests)
            if (elements.categoryChips) {
                elements.categoryChips.forEach(chip => {
                    chip.addEventListener('click', () => this.setCategory(chip.dataset.category));
                });
            }

            // Favorites filter buttons. With a show-all partner the favourites
            // button is one half of a pair; on its own it toggles.
            if (elements.showAllButton) {
                elements.showAllButton.addEventListener('click', () => this.setShowFavoritesOnly(false));
            }
            if (elements.showFavoritesButton) {
                elements.showFavoritesButton.addEventListener('click', () => {
                    const next = elements.showAllButton ? true : !showFavoritesOnly;
                    this.setShowFavoritesOnly(next);
                });
            }
        },

        /**
         * Handle search input with debouncing
         */
        handleSearch() {
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
            }

            const debounceDelay = typeof CONFIG !== 'undefined' && CONFIG.ui
                ? CONFIG.ui.DEBOUNCE_DELAY
                : 300;

            searchDebounceTimer = setTimeout(() => {
                currentSearchTerm = elements.searchInput ? elements.searchInput.value.trim() : '';
                populateSubstanceSelector();
                checkCurrentSelection();
            }, debounceDelay);
        },

        /**
         * Set the search term
         * @param {string} term - Search term
         */
        setSearch(term) {
            currentSearchTerm = term;
            if (elements.searchInput) {
                elements.searchInput.value = term;
            }
            populateSubstanceSelector();
            checkCurrentSelection();
        },

        /**
         * Set the category filter
         * @param {string} category - Category value
         */
        setCategory(category) {
            currentCategory = category;
            if (elements.categorySelect) {
                elements.categorySelect.value = category;
            }
            populateSubstanceSelector();
            checkCurrentSelection();
        },

        /**
         * Set whether to show favorites only
         * @param {boolean} value - Show favorites only
         */
        setShowFavoritesOnly(value) {
            showFavoritesOnly = value;
            updateFavoritesButtons();
            populateSubstanceSelector();
            checkCurrentSelection();
        },

        /**
         * Set whether to show only the common/recognisable substances
         * @param {boolean} value
         */
        setShowCommonOnly(value) {
            showCommonOnly = value;
            updateFavoritesButtons();
            populateSubstanceSelector();
            checkCurrentSelection();
        },

        /**
         * Clear a specific filter
         * @param {string} filterType - 'search', 'category', 'favorites' or 'common'
         */
        clearFilter(filterType) {
            switch (filterType) {
                case 'search':
                    this.setSearch('');
                    break;
                case 'category':
                    this.setCategory('all');
                    break;
                case 'favorites':
                    this.setShowFavoritesOnly(false);
                    break;
                case 'common':
                    this.setShowCommonOnly(false);
                    break;
            }
        },

        /**
         * Clear all filters
         */
        clearAll() {
            currentSearchTerm = '';
            currentCategory = 'all';
            showFavoritesOnly = false;
            showCommonOnly = false;

            if (elements.searchInput) elements.searchInput.value = '';
            if (elements.categorySelect) elements.categorySelect.value = 'all';

            updateFavoritesButtons();
            populateSubstanceSelector();

            if (typeof Toast !== 'undefined') {
                Toast.info('All filters cleared');
            }
        },

        /**
         * Get filtered library
         * @returns {Array} Filtered library data
         */
        getFilteredLibrary,


        /**
         * Update library data
         * @param {Array} library - New library data
         */
        setLibrary(library) {
            libraryData = library;
            populateSubstanceSelector();
        },

        /**
         * Get current filter state
         * @returns {Object} Current filter state
         */
        getState() {
            return {
                searchTerm: currentSearchTerm,
                category: currentCategory,
                showFavoritesOnly,
                showCommonOnly,
            };
        },
    };
})();
