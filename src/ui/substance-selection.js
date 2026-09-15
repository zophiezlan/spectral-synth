/**
 * Substance Selection
 *
 * Everything that happens when the selected substance changes: extracting
 * peaks, drawing the spectrum, enabling controls, the favourite star, the
 * "sounds similar" list and the peak-mapping table (plus click-to-audition
 * on its rows).
 */

import { ctx } from '../core/context.js';
import { Logger } from '../core/logger.js';
import { Favorites } from '../core/favorites.js';
import { calculateSpectralSimilarity } from '../data/analysis-utilities.js';
import { describeSubstance } from '../data/substance-utilities.js';
import { updateMIDISendButton } from '../midi/midi-handlers.js';
import { dom } from './dom.js';
import { FilterManager } from './filter-manager.js';
import { Toast } from './ui-utilities.js';

/**
 * Handle substance selection change
 */
export function handleSubstanceChange() {
    const substanceId = dom.substanceSelect.value;

    if (!substanceId) {
        // Clear everything
        ctx.currentSpectrum = null;
        ctx.currentPeaks = null;
        ctx.visualizer.clear();
        ctx.visualizer.clearSelection();
        dom.playButton.disabled = true;
        if (dom.selectAllButton) dom.selectAllButton.disabled = true;
        if (dom.clearSelectionButton) dom.clearSelectionButton.disabled = true;
        ['export-wav', 'export-peaks-csv', 'export-peaks-json', 'export-spectrum-csv'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = true;
        });
        // Hide favorite button
        const favoriteButton = document.getElementById('favorite-toggle');
        if (favoriteButton) {
            favoriteButton.classList.add('hidden');
        }
        dom.selectionCount.textContent = 'Click peaks to isolate them';
        const defaultMessage = '<p>Select a substance to see how infrared frequencies map to audio frequencies.</p>';
        if (dom.mappingInfo) {
            dom.mappingInfo.innerHTML = defaultMessage;
        }
        if (dom.mappingInfoModal) {
            dom.mappingInfoModal.innerHTML = defaultMessage;
        }
        return;
    }

    // Find spectrum in library
    const data = ctx.libraryData.find(item => item.id === substanceId);
    if (!data) {
        Logger.error('Spectrum not found:', substanceId);
        return;
    }

    ctx.currentSpectrum = data.spectrum;

    // Extract peaks for sonification
    ctx.currentPeaks = ctx.frequencyMapper.extractPeaks(ctx.currentSpectrum);

    Logger.log(`Loaded ${data.name}:`, ctx.currentPeaks.length, 'peaks detected');

    // Clear any previous selection
    ctx.visualizer.clearSelection();

    // Update visualizations
    ctx.visualizer.drawFTIRSpectrum(ctx.currentSpectrum, ctx.currentPeaks);

    // Show peak selection hint for first-time users
    showPeakSelectionHint();

    // Update mapping info with annotations
    updateMappingInfo(data, ctx.currentPeaks);

    // Enable playback and selection controls
    dom.playButton.disabled = false;
    if (dom.selectAllButton) dom.selectAllButton.disabled = false;
    if (dom.clearSelectionButton) dom.clearSelectionButton.disabled = false;

    // Enable export buttons
    const exportMP3 = document.getElementById('export-mp3');
    if (exportMP3) {
        exportMP3.disabled = false;
    }
    ['export-wav', 'export-peaks-csv', 'export-peaks-json', 'export-spectrum-csv'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
    });

    // Update MIDI send button
    updateMIDISendButton();

    // Update favorite button
    const favoriteButton = document.getElementById('favorite-toggle');
    if (favoriteButton) {
        favoriteButton.classList.remove('hidden');
        const isFavorite = Favorites.isFavorite(data.name);
        updateFavoriteButton(isFavorite);
    }

    // Show smart suggestions
    showSmartSuggestions(data);
}

/**
 * Update mapping information display
 */
function updateMappingInfo(data, peaks) {
    if (!peaks || peaks.length === 0) {
        const noPeaksMessage = '<p>No significant peaks detected.</p>';
        if (dom.mappingInfo) {
            dom.mappingInfo.innerHTML = noPeaksMessage;
        }
        if (dom.mappingInfoModal) {
            dom.mappingInfoModal.innerHTML = noPeaksMessage;
        }
        return;
    }

    let html = `<p><strong>${data.name}</strong>`;
    if (data.aliases && data.aliases.length) {
        html += ` <span class="mapping-note">also known as ${data.aliases.slice(0, 3).join(', ')}</span>`;
    }
    html += '</p>';
    const meta = describeSubstance(data);
    if (meta) html += `<p class="mapping-note">${meta}</p>`;
    if (data.iupac) html += `<p class="mapping-note">${data.iupac}</p>`;
    html += `<p>${peaks.length} significant absorption peaks <span class="mapping-note">(click a row to hear that peak)</span></p>`;
    html += '<table class="peak-table"><thead><tr>';
    html += '<th>IR (cm⁻¹)</th>';
    html += '<th>Audio (Hz)</th>';
    html += '<th>Intensity</th>';
    html += '<th>Width</th>';
    html += '<th>Functional group</th>';
    html += '</tr></thead><tbody>';

    peaks.slice(0, 10).forEach((peak, idx) => {
        const wavenumberStr = peak.wavenumber.toFixed(0);
        const audioFreqStr = peak.audioFreq.toFixed(1);
        const intensityPercent = (peak.absorbance * 100).toFixed(0);
        const widthStr = peak.width !== undefined ? peak.width.toFixed(0) : '—';
        const functionalGroup = ctx.frequencyMapper.getFunctionalGroup(peak.wavenumber);

        html += `<tr class="peak-row" data-peak-idx="${idx}" title="Click to audition this peak">`;
        html += `<td>${wavenumberStr}</td>`;
        html += `<td>${audioFreqStr}</td>`;
        html += `<td>${intensityPercent}%</td>`;
        html += `<td>${widthStr}</td>`;
        html += `<td class="peak-group">${functionalGroup}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';

    if (peaks.length > 10) {
        html += `<p class="mapping-note">… and ${peaks.length - 10} more peaks</p>`;
    }

    html += '<p class="mapping-note">';
    html += `Mapping: ${ctx.frequencyMapper.IR_MIN}–${ctx.frequencyMapper.IR_MAX} cm⁻¹ → `;
    html += `${ctx.frequencyMapper.AUDIO_MIN}–${ctx.frequencyMapper.AUDIO_MAX} Hz (logarithmic)`;
    html += '</p>';

    if (dom.mappingInfo) {
        dom.mappingInfo.innerHTML = html;
    }
    if (dom.mappingInfoModal) {
        dom.mappingInfoModal.innerHTML = html;
    }
}

/**
 * Navigate to next/previous substance
 * @param {number} direction - -1 for previous, 1 for next
 */
export function navigateSubstance(direction) {
    const options = Array.from(dom.substanceSelect.options);
    const currentIndex = options.findIndex(opt => opt.value === dom.substanceSelect.value);

    // Find next valid option (skip the first placeholder option)
    let newIndex = currentIndex + direction;
    if (newIndex < 1) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 1;

    if (newIndex >= 1 && newIndex < options.length) {
        dom.substanceSelect.value = options[newIndex].value;
        handleSubstanceChange();
    }
}

/**
 * Select substance by name (partial match)
 * @param {string} searchTerm - Substance name to search for
 */
export function selectSubstanceByName(searchTerm) {
    if (!ctx.libraryData) return;

    const term = searchTerm.toLowerCase();
    // Exact name, then exact alias, then substring — so "mdma" is MDMA, not 6-Bromo-MDMA
    const substance = ctx.libraryData.find(item => item.name.toLowerCase() === term)
        || ctx.libraryData.find(item => (item.aliases || []).some(a => a.toLowerCase() === term))
        || ctx.libraryData.find(item => item.name.toLowerCase().includes(term));

    if (substance) {
        dom.substanceSelect.value = substance.id;
        if (dom.substanceSelect.value !== substance.id) {
            // Hidden by the current filters (e.g. Common) — clear them and retry
            FilterManager.clearAll();
            dom.substanceSelect.value = substance.id;
        }
        handleSubstanceChange();
        // Scroll to substance selector
        dom.substanceSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Handle favorite toggle button
 */
export function handleFavoriteToggle() {
    const substanceId = dom.substanceSelect.value;
    if (!substanceId) return;

    const substance = ctx.libraryData.find(item => item.id === substanceId);
    if (!substance) return;

    const isFavorite = Favorites.toggle(substance.name);
    updateFavoriteButton(isFavorite);
}

/**
 * Update favorite button state
 * @param {boolean} isFavorite - Whether substance is favorited
 */
function updateFavoriteButton(isFavorite) {
    const favoriteButton = document.getElementById('favorite-toggle');
    if (favoriteButton) {
        favoriteButton.textContent = isFavorite ? '★' : '☆';
        favoriteButton.classList.toggle('active', isFavorite);
    }
}

/**
 * Show smart substance suggestions
 * @param {Object} currentSubstance - Currently selected substance
 */
function showSmartSuggestions(currentSubstance) {
    const suggestionsContainer = document.getElementById('smart-suggestions');
    const suggestionsList = document.getElementById('suggestions-list');

    if (!ctx.libraryData || ctx.libraryData.length < 2) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    // Calculate similarity scores for all substances
    const similarities = ctx.libraryData
        .filter(item => item.id !== currentSubstance.id)
        .map(item => ({
            substance: item,
            similarity: calculateSpectralSimilarity(currentSubstance.spectrum, item.spectrum)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5); // Top 5 similar substances

    // Clear previous suggestions
    suggestionsList.innerHTML = '';

    // Add suggestion items
    similarities.forEach(({ substance, similarity }) => {
        const item = document.createElement('button');
        item.className = 'suggestion-item';
        item.innerHTML = `
            <span class="suggestion-name">${substance.name}</span>
            <span class="similarity-score">${(similarity * 100).toFixed(0)}% similar</span>
        `;
        item.addEventListener('click', () => {
            dom.substanceSelect.value = substance.id;
            handleSubstanceChange();
            // Scroll to top
            // Desktop scrolls inside <main>; mobile scrolls the page
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        suggestionsList.appendChild(item);
    });

    // .hidden is display:none !important, so inline display can't override it
    suggestionsContainer.classList.remove('hidden');
}

/**
 * Show peak selection hint for first-time users
 */
function showPeakSelectionHint() {
    const hasSeenHint = localStorage.getItem('peak-selection-hint-seen');

    if (!hasSeenHint) {
        // Wait 2 seconds before showing hint
        setTimeout(() => {
            // Add pulse animation to FTIR canvas
            const ftirCanvas = dom.ftirCanvas;
            if (ftirCanvas) {
                ftirCanvas.classList.add('peak-hint-pulse');

                // Remove pulse after 3 seconds
                setTimeout(() => {
                    ftirCanvas.classList.remove('peak-hint-pulse');
                }, 3000);
            }

            // Show informative toast
            Toast.info('💡 Tip: Click on peaks in the FTIR spectrum to select specific frequencies!', 5000);

            // Mark as seen
            localStorage.setItem('peak-selection-hint-seen', 'true');
        }, 2000);
    }
}

/**
 * Set up click-to-audition on the peak table rows.
 * Rows in the mapping info tables carry data-peak-idx into ctx.currentPeaks.
 */
export function setupPeakAudition() {
    [dom.mappingInfo, dom.mappingInfoModal].forEach(container => {
        if (!container) return;
        container.addEventListener('click', async (e) => {
            const row = e.target.closest('tr[data-peak-idx]');
            if (!row || !ctx.currentPeaks) return;
            const peak = ctx.currentPeaks[Number(row.dataset.peakIdx)];
            if (!peak) return;

            try {
                await ctx.audioEngine.init();
                // Single-peak voice, boosted since one oscillator carries the sound
                const voice = ctx.audioEngine.startVoice([peak], { gainScale: 1.5 });
                if (voice) {
                    ctx.visualizer?.startNoteGlow();
                    setTimeout(() => voice.release(), 700);
                }
            } catch (error) {
                Logger.debug('Peak audition failed:', error.message);
            }
        });
    });
}
