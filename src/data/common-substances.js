/**
 * Common Substances
 *
 * The compounds most people will recognise, used for the default "Common"
 * filter so a first visit isn't a scroll through 1,300+ research chemicals.
 *
 * Matched on the InChIKey connectivity block (first 14 characters of the
 * key on each library record), so renaming a compound in the library data
 * doesn't break the list. Names are kept alongside for readability and as
 * a fallback for records without a key (user imports).
 */

const COMMON = [
    // Stimulants
    ['SHXWCVYOXRDMCX', 'MDMA'],
    ['NGBBVGZWCFBOGO', 'MDA'],
    ['VKEQBMCRQDSRET', 'Methylone'],
    ['ZPUCINDJVBIVPJ', 'Cocaine'],
    ['MYWUZJCMWCOHBA', 'Methamphetamine'],
    ['KWTSXDURSIMDCE', 'Amphetamine'],
    ['RYYVLZVUVIJVGH', 'Caffeine'],
    ['YELGFTGWJGBAQU', 'Mephedrone'],
    ['QDNXSIYWHYGMCD', '3-MMC'],
    ['DGXWNDGLEOIEGT', '4-FA'],
    ['SYHGEUNFJIGTRX', 'MDPV'],
    ['YDIIDRWHPFMLGR', 'alpha-PVP'],
    ['DUGOZIWVEXMGBE', 'Methylphenidate'],
    ['YFGHCGITMMYXAQ', 'Modafinil'],

    // Dissociatives
    ['YQEZLKZALYSWHR', 'Ketamine'],
    ['MKXZASYAUGDDCJ', 'DXM'],
    ['JTJMJGYZQZDUJJ', 'PCP'],

    // Psychedelics & tryptamines
    ['VAYOSLLFUXYJDT', 'LSD'],
    ['SPCIYGNTAMCTRO', 'Psilocin'],
    ['QVDSEJDULKLHCG', 'Psilocybin'],
    ['DMULVCHRPCFFGV', 'DMT'],
    ['ZSTKHSQDNIGFLM', '5-MeO-DMT'],
    ['QIJLOAPCCJQEEZ', '4-AcO-DMT'],
    ['RHCSKNNOAZULRK', 'Mescaline'],
    ['YMHOBZXQZVXHBM', '2C-B'],
    ['PQHQBRJAAZQXHL', '2C-I'],
    ['ZFUOLNAKPBFDIJ', '25I-NBOMe'],

    // Cannabinoids
    ['ZTGXAWYVTLUPDT', 'Cannabidiol'],
    ['XKRHRBJLCLXSGE', 'Hexahydrocannabinol'],

    // Opioids
    ['GVGLGOZIDCSQPN', 'Heroin'],
    ['BQJCRHHNABKAKU', 'Morphine'],
    ['PJMPHNIQZUBGLI', 'Fentanyl'],
    ['OROGSEYTTFOCAN', 'Codeine'],
    ['USSIQXCVUWKGNF', 'Methadone'],
    ['NBCQXGKYRFJDHM', 'Buprenorphine'],

    // Benzodiazepines & depressants
    ['AAOVKJBEBIDNHE', 'Diazepam'],
    ['VREFGVBLTWBCJP', 'Alprazolam'],
    ['DGBIGWXXNGSACT', 'Clonazepam'],
    ['VMZUTJCNQWMAGF', 'Etizolam'],
    ['PPTYJKAXVCCBDU', 'Flunitrazepam'],
    ['SJZRECIVHVDYJC', 'GHB'],
    ['AYXYPKUFHZROOJ', 'Pregabalin'],

    // Other
    ['OKJCFMUGMSVJBG', 'Testosterone'],
    ['BPICBUSOMSTKRF', 'Xylazine'],
];

const COMMON_KEYS = new Set(COMMON.map(([key]) => key));
const COMMON_NAMES = new Set(COMMON.map(([, name]) => name.toLowerCase()));

/**
 * @param {{inchikey?: string, name?: string}} substance - Library record
 * @returns {boolean} True if the substance is on the common list
 */
export function isCommonSubstance(substance) {
    if (!substance) return false;
    if (substance.inchikey) {
        return COMMON_KEYS.has(substance.inchikey.slice(0, 14));
    }
    return COMMON_NAMES.has(String(substance.name || '').toLowerCase());
}
