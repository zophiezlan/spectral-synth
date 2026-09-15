/**
 * Common Substances
 *
 * The names most people will recognise, used for the default "Common"
 * filter so a first visit isn't a scroll through 900+ research chemicals.
 * Names must match the library records exactly (case-insensitive); anything
 * not in the library is simply ignored, so this list can be edited freely.
 */

const COMMON_NAMES = [
    // Stimulants
    'MDMA', 'MDMA-HCl', 'MDA', 'Methylone / bk-MDMA',
    'cocaine-HCl', 'Cocaine base',
    'methamphetamine-HCl', 'Methamphetamine base',
    'Amphetamine sulphate', 'Amphetamine',
    'caffeine',
    'Mephedrone HCl', '3-Methylmethcathinone HCl / 3-MMC HCl', '4-Fluoroamphetamine / 4-FA',
    '3,4-Methylenedioxypyrovalerone / MDPV',

    // Dissociatives
    'Ketamine HCl', 'Ketamine', 'DXM HBr monohydrate', 'PCP HCl',

    // Psychedelics
    'LSD base', 'Psilocin', 'Psilocybin base',
    'DMT', '5-MeO-DMT base / 5-MeO-N,N-DMT base', '4-AcO-DMT base',
    'mescaline-HCl', '2C-B HCl', '2C-I base', '25I-NBOMe',

    // Cannabinoids
    'Cannabidiol', 'Hexahydrocannabinol / HHC',

    // Opioids
    'Heroin HCl', 'Heroin base', 'morphine-HCl', 'Morphine base',
    'Fentanyl HCl', 'Codeine base', 'methadone-HCl', 'Buprenorphine base',

    // Benzodiazepines & depressants
    'Diazepam', 'alprazolam', 'Clonazepam', 'Etizolam', 'flunitrazepam', 'GHB',

    // Other
    'Testosterone',
];

const COMMON_SET = new Set(COMMON_NAMES.map(n => n.toLowerCase()));

/**
 * @param {{name: string}} substance - Library record
 * @returns {boolean} True if the substance is on the common list
 */
export function isCommonSubstance(substance) {
    return COMMON_SET.has(String(substance?.name || '').toLowerCase());
}
