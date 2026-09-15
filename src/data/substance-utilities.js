/**
 * Substance Utilities
 *
 * categorizeSubstance() is the single source of categorisation for the app
 * and the Node build scripts. Records built from the ENFSI library carry a
 * `category` already (assigned by this function at build time); the pattern
 * matching below is what assigns it, and it also runs for user imports.
 *
 * Patterns are checked against the display name, every alias and the IUPAC
 * name, so a synthetic cannabinoid is caught by "indazole-3-carboxamide" even
 * when its trade name is opaque (e.g. "MEP-FUBINACA").
 */

export const CATEGORIES = [
    'opioids', 'stimulants', 'benzodiazepines', 'psychedelics', 'cannabinoids',
    'dissociatives', 'tryptamines', 'steroids', 'precursors', 'cutting-agents', 'other',
];

// Order matters: earlier entries win. Dissociatives sit before stimulants so
// ketamine's "…cyclohexan-1-one" isn't read as a cathinone, etc.
const RULES = [
    ['opioids', /morphine|heroin|codeine|fentan[iy]l|oxycodone|hydrocodone|hydromorphone|oxymorphone|buprenorphine|methadone|tramadol|tapentadol|pethidine|meperidine|nitazene|\bu-4\d{3,}|ah-7921|mt-45|desomorphine|mitragynine|kratom|naloxone|naltrexone|thebaine|oripavine|etorphine|brorphine|piperidylidene|dihydrocodeine|noroxymorphone|\bo-?desmethyl|(?:propan|butan|pentan)amide.*piperidin/],
    ['benzodiazepines', /zepam\b|zolam\b|benzodiazep|diazepin|clobazam|etizolam|zapizolam|thienotriazolo|thienodiazep/],
    ['cannabinoids', /cannab|\bthc\b|\bthc-|\bcbd\b|\bcbn\b|\bcbg\b|\bcbc\b|\bhhc\b|jwh-|\bam-?\d{3,4}\b|ur-144|xlr-11|cp-?47|cp-?55|hu-210|inaca\b|pinaca|fubinaca|chminaca|\bpica\b|chmica|fubica|butinaca|\bcumyl|\badb-|mdmb-|\bmmb-|\bab-|\bamb-|apinaca|akb-?48|indazole-3-carbox|indole-3-carbox|indol-3-yl.*naphthalen|naphthalen.*indol-3-yl|tetrahydrocannabi|\bedmb|\bnnei|\bthj-|\brcs-|\bbb-22|\bpb-22|\bqupic|\b5f-|\b5cl-|adamant|azaindole|carbazole|\bcp-|nabilone|\bwin-?55|spice|\bmda-19|\bbzo-|oxizid/],
    ['steroids', /testosterone|stanozolol|nandrolone|methandienone|boldenone|trenbolone|oxandrolone|methenolone|drostanolone|mesterolone|androst|estr-4-en|estra-|turinabol|clenbuterol|oxymetholone|dehydroepiandrosterone|\bdhea\b|estradiol|pregn-|gonane|ostarine|ligandrol|cardarine|andarine|\brad-?140|\byk-?11|\bs-?23\b|\bmk-?677|ibutamoren|somatropin|tamoxifen|clomiphene|anastrozole|letrozole/],
    ['dissociatives', /ketamine|\bpcp\b|-pcp\b|\bpce\b|-pce\b|pcpr|pcpy|phenidine|methoxetamine|\bmxe\b|\bmxp\b|\bdck\b|\bdmxe|dextromethorphan|\bdxm\b|tiletamine|cyclohexan(?:one|-1-one).*amino|amino.*cyclohexan-1-one|cyclohexyl.*piperidin|arylcyclohexyl|dizocilpine|memantine|nitrous oxide|diphenidine|ephenidine|fluorexetamine|\bo-pce|\bfxe\b/],
    ['tryptamines', /tryptamin|\bdmt\b|-dmt\b|\bdpt\b|-dpt\b|\bdipt\b|-dipt\b|\bmipt\b|-mipt\b|\bdet\b|-det\b|\bdalt\b|-dalt\b|\bamt\b|-amt\b|\bmet\b|-met\b|-mpt\b|-eipt\b|-nipt\b|-pyr-t\b|\bept\b|psiloc|bufotenin|indol-3-yl\)ethanamin|indol-3-yl\)ethyl\]|indol-3-yl\)-n|baeocystin/],
    ['psychedelics', /\blsd\b|-lsd\b|lysergic|lysergamide|-lad\b|\blsz\b|ald-52|ergine|\blsa\b|mescalin|\b2c-|\b2c\b|nbome|nboh|nbf\b|\bnbmd|\bdo[bcimxef]\b|\bdo[bcimxef]-|trimethoxyphen|dimethoxyphen|dimethoxy-.*phen|allylescaline|escaline|proscaline|benzofuran|\bapb\b|-apb\b|\bbk-2c|-fly\b|salvinorin|ibogaine|\bdmm?da\b|\btma-?\d|\bdmxe|\bdoxx|\bal-lad|\beth-lad|\bpro-lad|\b1p-|\b1cp-|\b1b-|\b1v-|\b1d-/],
    ['stimulants', /cocaine|amphetamin|amfetamin|\bmdma\b|\bmda\b|\bmdea\b|\bmbdb\b|\bmdai\b|mephedrone|caffeine|methylphenidate|\bmph\b|-mph\b|cathinon|(?:eth|meth|but|pent|hex|hept|oct)(?:yl)?(?:one|edrone|ylone)\b|pentedrone|ephedrine|ecgonine|-pvp\b|pyrovalerone|-php\b|pyrrolidino|\bmdpv\b|alpha-p|a-p[a-z]{2}p\b|naphyrone|modafinil|phenmetrazine|phentermine|aminorex|\bfma\b|-fma\b|\bfa\b|-fa\b|\bfea\b|-fea\b|nicotine|khat|prolintane|pipradrol|\bd2pm\b|\bmpa\b|thiopropamine|\bpma\b|\bpmma\b|\bpmea\b|4-mar\b|\bbk-|bupropion|sibutramine|methylamino.*(?:propan|butan|pentan|hexan|heptan)-1-one|(?:ethyl|propyl|dimethyl)amino.*(?:propan|butan|pentan|hexan)-1-one|pyrrolidin-1-yl.*-1-one|phenylpropan-2-amine|phenylbutan-2-amine|benzodioxol.*propan-2-amine/],
    ['precursors', /\bbmk\b|\bpmk\b|glycid|benzaldehyde|nitrostyrene|nitropropene|safrole|isosafrole|phenylacetone|\bp2p\b|\bapaa\b|\bapaan\b|piperonal|helional|phenylacetic|methyl glycidate|norephedrine|phenyl-2-propanol|propan-2-one|piperidone|\bnpp\b|\banpp\b|4-anbp|benzyl cyanide|hypophosph|methylamine|ephedron|1-phenyl-2-nitro|acetic anhydride/],
    // Diluents and adulterants commonly found alongside street drugs
    ['cutting-agents', /lactose|mannitol|inositol|paracetamol|acetaminophen|levamisole|phenacetin|benzocaine|lidocaine|procaine|tetracaine|\bglucose|sucrose|sorbitol|dextrose|creatine|dimethylsulfone|\bmsm\b|boric acid|bicarbonate|starch|cellulose|\btalc\b|diltiazem|hydroxyzine|quinine|xylazine|tetramisole|dipyrone|metamizole|aminopyrine|maltose|fructose|glycine|taurine/],
];

/**
 * Does a substance match a free-text search? Checks the display name, every
 * alias (e.g. "4-MMC" for Mephedrone) and the molecular formula.
 * @param {{name: string, aliases?: string[], formula?: string}} item
 * @param {string} term - Already trimmed; case-insensitive
 * @returns {boolean}
 */
export function matchesSearch(item, term) {
    if (!term) return true;
    const t = term.toLowerCase();
    if (item.name.toLowerCase().includes(t)) return true;
    if ((item.formula || '').toLowerCase().includes(t)) return true;
    return (item.aliases || []).some(a => a.toLowerCase().includes(t));
}

/**
 * One-line description of a record for the mapping table / cards:
 * "C11H15NO · 177.24 g/mol · HCl salt · ATR · one of 12 ENFSI spectra"
 * @param {Object} item - Library record
 * @returns {string}
 */
export function describeSubstance(item) {
    const parts = [];
    if (item.formula) parts.push(item.formula);
    if (item.mw) parts.push(`${item.mw} g/mol`);
    if (item.form) parts.push(item.form === 'base' ? 'free base' : `${item.form} salt`);
    if (item.measurement) parts.push(item.measurement === 'GC-IR' ? 'GC solid-phase IR' : item.measurement);
    if (item.variants > 1) parts.push(`one of ${item.variants} ENFSI spectra`);
    if (item.description && parts.length === 0) return item.description;
    return parts.join(' · ');
}

/**
 * Categorise a substance record.
 * @param {{name: string, aliases?: string[], iupac?: string, category?: string}} item
 * @returns {string} One of CATEGORIES
 */
export function categorizeSubstance(item) {
    // Prefer the category baked into the library data at build time;
    // fall back to pattern matching for user-imported substances.
    if (item.category) {
        return item.category;
    }

    const haystack = [item.name, ...(item.aliases || []), item.iupac || item.casName || '']
        .filter(Boolean)
        .join(' | ')
        .toLowerCase();

    for (const [category, pattern] of RULES) {
        if (pattern.test(haystack)) {
            return category;
        }
    }
    return 'other';
}
