/**
 * Filter Manager Module
 *
 * Purpose: Manages substance filtering (search, category, favorites)
 *
 * Dependencies:
 * - AppState (for state management)
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

const FilterManager = (function() {
    'use strict';

    // Private state
    let libraryData = null;
    let searchDebounceTimer = null;

    // Filter state (mirrors AppState but kept locally for performance)
    let currentSearchTerm = '';
    let currentCategory = 'all';
    let showFavoritesOnly = false;

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
        };
    }

    /**
     * Get filtered library based on current filter state
     * @returns {Array} Filtered library data
     */
    function getFilteredLibrary() {
        if (!libraryData) return [];

        const favoritesList = typeof Favorites !== 'undefined' ? Favorites.getAll() : [];

        return libraryData.filter(item => {
            // Favorites filter
            if (showFavoritesOnly && !favoritesList.includes(item.name)) {
                return false;
            }

            // Category filter
            const itemCategory = typeof categorizeSubstance === 'function'
                ? categorizeSubstance(item)
                : 'other';
            const categoryMatch = currentCategory === 'all' || itemCategory === currentCategory;

            // Search filter
            const searchLower = currentSearchTerm.toLowerCase();
            const nameMatch = item.name.toLowerCase().includes(searchLower);
            const formulaMatch = (item.formula || '').toLowerCase().includes(searchLower);
            const searchMatch = !currentSearchTerm || nameMatch || formulaMatch;

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

        // Clear existing options except the first one
        elements.substanceSelect.innerHTML = '<option value="">-- Select a Substance --</option>';

        // Add filtered substances
        filteredData.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            elements.substanceSelect.appendChild(option);
        });

        // Update results count
        if (elements.resultsCount) {
            elements.resultsCount.textContent = `${filteredData.length} substance${filteredData.length !== 1 ? 's' : ''}`;
        }

        // Update filter status display
        updateFilterStatus(filteredData.length);

        // Sync with AppState
        if (typeof AppState !== 'undefined') {
            AppState.set('searchTerm', currentSearchTerm);
            AppState.set('category', currentCategory);
            AppState.set('showFavoritesOnly', showFavoritesOnly);
        }
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
        if (elements.showAllButton && elements.showFavoritesButton) {
            if (showFavoritesOnly) {
                elements.showAllButton.classList.remove('active');
                elements.showAllButton.setAttribute('aria-pressed', 'false');
                elements.showFavoritesButton.classList.add('active');
                elements.showFavoritesButton.setAttribute('aria-pressed', 'true');
            } else {
                elements.showAllButton.classList.add('active');
                elements.showAllButton.setAttribute('aria-pressed', 'true');
                elements.showFavoritesButton.classList.remove('active');
                elements.showFavoritesButton.setAttribute('aria-pressed', 'false');
            }
        }
    }

    /**
     * Check if current selection is still valid after filtering
     * @private
     */
    function checkCurrentSelection() {
        if (!elements.substanceSelect || !elements.substanceSelect.value) return;

        const filteredData = getFilteredLibrary();
        const stillExists = filteredData.some(item => item.id === elements.substanceSelect.value);

        if (!stillExists) {
            elements.substanceSelect.value = '';
            // Trigger substance change handler if available
            if (typeof handleSubstanceChange === 'function') {
                handleSubstanceChange();
            }
        }
    }

    return {
        /**
         * Initialize the filter manager
         * @param {Array} library - The FTIR library data
         */
        init(library) {
            libraryData = library;
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

            // Clear search button in no results state
            const clearSearchBtn = document.getElementById('clear-search-btn');
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => this.clearAll());
            }

            // Favorites filter buttons
            if (elements.showAllButton) {
                elements.showAllButton.addEventListener('click', () => this.setShowFavoritesOnly(false));
            }
            if (elements.showFavoritesButton) {
                elements.showFavoritesButton.addEventListener('click', () => this.setShowFavoritesOnly(true));
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
         * Clear a specific filter
         * @param {string} filterType - 'search', 'category', or 'favorites'
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
            }
        },

        /**
         * Clear all filters
         */
        clearAll() {
            currentSearchTerm = '';
            currentCategory = 'all';
            showFavoritesOnly = false;

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
         * Refresh the substance selector (after library update)
         */
        refresh() {
            populateSubstanceSelector();
        },

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
            };
        },
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.FilterManager = FilterManager;
}
