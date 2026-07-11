/**
 * Browse Manager Module
 *
 * Purpose: Visual library browser — a searchable grid of substance cards,
 * each with a lazily rendered sparkline of its FTIR spectrum. Clicking a
 * card selects the substance in the main UI.
 *
 * Dependencies:
 * - ThumbnailGenerator (visualization-utilities.js) for sparkline canvases
 * - categorizeSubstance (substance-utilities.js) for category chips
 *
 * Sparklines are rendered on demand via IntersectionObserver, so opening
 * the browser with ~1000 substances stays fast: only visible cards pay
 * the canvas rendering cost.
 *
 * Usage:
 * ```javascript
 * BrowseManager.init({
 *     getLibrary: () => libraryData,
 *     onSelect: (substance) => { ... },
 * });
 * ```
 */

/* global ThumbnailGenerator, categorizeSubstance */

const BrowseManager = (function() {
    'use strict';

    let getLibrary = () => [];
    let onSelect = () => {};
    let observer = null;
    let initialized = false;

    let elements = {};

    function cacheElements() {
        elements = {
            modal: document.getElementById('browse-modal'),
            openBtn: document.getElementById('browse-library-btn'),
            closeBtn: document.getElementById('browse-close'),
            search: document.getElementById('browse-search'),
            category: document.getElementById('browse-category'),
            count: document.getElementById('browse-count'),
            grid: document.getElementById('browse-grid'),
        };
    }

    /**
     * Initialize the browser
     * @param {Object} options
     * @param {Function} options.getLibrary - Returns the current library array
     * @param {Function} options.onSelect - Called with the chosen substance
     */
    function init(options) {
        getLibrary = options.getLibrary || getLibrary;
        onSelect = options.onSelect || onSelect;

        cacheElements();
        if (!elements.modal || !elements.grid) return;

        if (!initialized) {
            if (elements.openBtn) {
                elements.openBtn.addEventListener('click', open);
            }
            if (elements.closeBtn) {
                elements.closeBtn.addEventListener('click', close);
            }
            elements.modal.addEventListener('click', (e) => {
                if (e.target === elements.modal) close();
            });
            if (elements.search) {
                let debounce;
                elements.search.addEventListener('input', () => {
                    clearTimeout(debounce);
                    debounce = setTimeout(render, 200);
                });
            }
            if (elements.category) {
                elements.category.addEventListener('change', render);
            }
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !elements.modal.classList.contains('hidden')) {
                    close();
                }
            });
            initialized = true;
        }
    }

    function open() {
        if (!elements.modal) return;
        elements.modal.classList.remove('hidden');
        elements.modal.style.display = 'flex';
        render();
        if (elements.search) elements.search.focus();
    }

    function close() {
        if (!elements.modal) return;
        elements.modal.classList.add('hidden');
        elements.modal.style.display = 'none';
        teardownObserver();
    }

    function teardownObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    /**
     * Filter the library by the browser's own search + category controls
     * @returns {Array}
     */
    function filteredSubstances() {
        const library = getLibrary() || [];
        const term = (elements.search ? elements.search.value : '').toLowerCase().trim();
        const category = elements.category ? elements.category.value : 'all';

        return library.filter(item => {
            const itemCategory = typeof categorizeSubstance === 'function'
                ? categorizeSubstance(item)
                : (item.category || 'other');
            if (category !== 'all' && itemCategory !== category) return false;
            if (!term) return true;
            return item.name.toLowerCase().includes(term)
                || (item.formula || '').toLowerCase().includes(term);
        });
    }

    /**
     * Render the card grid for the current filters
     */
    function render() {
        if (!elements.grid) return;
        teardownObserver();

        const substances = filteredSubstances();
        if (elements.count) {
            elements.count.textContent = `${substances.length} substance${substances.length === 1 ? '' : 's'}`;
        }

        elements.grid.innerHTML = '';

        if (substances.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'browse-empty';
            empty.textContent = 'No substances match your filters.';
            elements.grid.appendChild(empty);
            return;
        }

        // Lazily render sparklines only when cards scroll into view
        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const card = entry.target;
                observer.unobserve(card);
                const substance = substances[Number(card.dataset.index)];
                const holder = card.querySelector('.browse-sparkline');
                if (holder && substance && typeof ThumbnailGenerator !== 'undefined') {
                    holder.appendChild(
                        ThumbnailGenerator.generateSpectrumThumbnail(substance.spectrum, 180, 48)
                    );
                }
            });
        }, { root: elements.grid, rootMargin: '200px' });

        const fragment = document.createDocumentFragment();

        substances.forEach((substance, index) => {
            // A div rather than <button>: global button styling (gradient,
            // touch min-heights) fights the card layout, and Chromium
            // buttons don't size reliably as flex containers.
            const card = document.createElement('div');
            card.className = 'browse-card';
            card.dataset.index = index;
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Select ${substance.name}`);

            const category = typeof categorizeSubstance === 'function'
                ? categorizeSubstance(substance)
                : (substance.category || 'other');

            const name = document.createElement('span');
            name.className = 'browse-card-name';
            name.textContent = substance.name;

            const meta = document.createElement('span');
            meta.className = 'browse-card-meta';
            meta.textContent = [substance.formula, substance.mw ? `MW ${substance.mw}` : null]
                .filter(Boolean).join(' · ');

            const chip = document.createElement('span');
            chip.className = 'browse-card-chip';
            chip.textContent = category;

            const sparkline = document.createElement('span');
            sparkline.className = 'browse-sparkline';

            card.appendChild(name);
            card.appendChild(meta);
            card.appendChild(sparkline);
            card.appendChild(chip);

            const select = () => {
                close();
                onSelect(substance);
            };
            card.addEventListener('click', select);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select();
                }
            });

            fragment.appendChild(card);
            observer.observe(card);
        });

        elements.grid.appendChild(fragment);
    }

    // Public API
    return {
        init,
        open,
        close,
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.BrowseManager = BrowseManager;
}
