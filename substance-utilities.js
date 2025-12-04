/**
 * Substance Utilities Module
 *
 * Purpose: Provides substance categorization and filtering utilities
 *
 * Dependencies:
 * - None
 *
 * Exports:
 * - categorizeSubstance(item) - Categorizes a substance based on name/formula
 *
 * Usage:
 * ```javascript
 * const category = categorizeSubstance({ name: 'Morphine', formula: 'C17H19NO3' });
 * // Returns: 'opioids'
 * ```
 *
 * Categories:
 * - opioids: Morphine, fentanyl, heroin, etc.
 * - stimulants: Amphetamines, cocaine, caffeine, etc.
 * - benzodiazepines: Diazepam, alprazolam, etc.
 * - psychedelics: LSD, psilocybin, DMT, etc.
 * - cannabinoids: THC, CBD, synthetic cannabinoids
 * - steroids: Testosterone and derivatives
 * - other: Everything else
 *
 * Categorization Method:
 * Uses keyword matching on substance name and chemical formula.
 * Case-insensitive matching with comprehensive keyword lists.
 */

/**
 * Categorize substance based on name and chemical properties
 * @param {Object} item - Substance data object
 * @returns {string} Category name
 */
function categorizeSubstance(item) {
    const name = item.name.toLowerCase();
    const formula = (item.formula || '').toLowerCase();

    // Opioids
    const opioidKeywords = ['morphine', 'heroin', 'codeine', 'fentanyl', 'oxycodone',
        'hydrocodone', 'buprenorphine', 'methadone', 'tramadol',
        'diacetylmorphine', 'acetylmorphine', 'alfentanil', 'sufentanil',
        'remifentanil', 'carfentanil', 'acetylfentanyl', 'furanylfentanyl',
        'acrylfentanyl', 'butyrfentanyl', 'valerylfentanyl'];
    if (opioidKeywords.some(keyword => name.includes(keyword))) {
        return 'opioids';
    }

    // Stimulants
    const stimulantKeywords = ['cocaine', 'amphetamine', 'methamphetamine', 'mdma',
        'mephedrone', 'caffeine', 'methylphenidate', 'cathinone',
        'methcathinone', 'ecstasy', 'speed', 'crystal',
        'ethylone', 'methylone', 'butylone', 'pentedrone',
        'ephedrine', 'pseudoephedrine', 'benzoylecgonine'];
    if (stimulantKeywords.some(keyword => name.includes(keyword))) {
        return 'stimulants';
    }

    // Benzodiazepines
    const benzoKeywords = ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam',
        'temazepam', 'oxazepam', 'nitrazepam', 'flunitrazepam',
        'bromazepam', 'lormetazepam', 'etizolam', 'flubromazolam'];
    if (benzoKeywords.some(keyword => name.includes(keyword))) {
        return 'benzodiazepines';
    }

    // Psychedelics
    const psychedelicKeywords = ['lsd', 'lysergic', 'psilocybin', 'dmt', 'mescaline',
        '2c-b', '2c-i', '2c-e', 'nbome', 'dom', 'doi'];
    if (psychedelicKeywords.some(keyword => name.includes(keyword))) {
        return 'psychedelics';
    }

    // Cannabinoids
    const cannabinoidKeywords = ['thc', 'cbd', 'cannabinol', 'cannabidiol', 'cannabis',
        'jwh', 'am-2201', 'cp-47', 'hu-210'];
    if (cannabinoidKeywords.some(keyword => name.includes(keyword))) {
        return 'cannabinoids';
    }

    // Steroids
    const steroidKeywords = ['testosterone', 'stanozolol', 'nandrolone', 'methandienone',
        'boldenone', 'trenbolone', 'oxandrolone', 'methenolone',
        'drostanolone', 'mesterolone'];
    if (steroidKeywords.some(keyword => name.includes(keyword))) {
        return 'steroids';
    }

    return 'other';
}
