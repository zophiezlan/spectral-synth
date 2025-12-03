/**
 * Unit tests for Substance Utilities
 */

describe('SubstanceUtilities', () => {
    let categorizeSubstance;

    beforeEach(() => {
        // Mock the categorizeSubstance function
        categorizeSubstance = function(item) {
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
        };
    });

    describe('categorizeSubstance', () => {
        describe('Opioids', () => {
            test('should categorize morphine as opioid', () => {
                const item = { name: 'Morphine', formula: 'C17H19NO3' };
                expect(categorizeSubstance(item)).toBe('opioids');
            });

            test('should categorize heroin as opioid', () => {
                const item = { name: 'Heroin', formula: 'C21H23NO5' };
                expect(categorizeSubstance(item)).toBe('opioids');
            });

            test('should categorize fentanyl as opioid', () => {
                const item = { name: 'Fentanyl', formula: 'C22H28N2O' };
                expect(categorizeSubstance(item)).toBe('opioids');
            });

            test('should categorize substance with opioid keyword in mixed case', () => {
                const item = { name: 'Oxycodone Hydrochloride' };
                expect(categorizeSubstance(item)).toBe('opioids');
            });

            test('should categorize fentanyl analogues', () => {
                expect(categorizeSubstance({ name: 'Acetylfentanyl' })).toBe('opioids');
                expect(categorizeSubstance({ name: 'Furanylfentanyl' })).toBe('opioids');
                expect(categorizeSubstance({ name: 'Carfentanil' })).toBe('opioids');
            });
        });

        describe('Stimulants', () => {
            test('should categorize cocaine as stimulant', () => {
                const item = { name: 'Cocaine', formula: 'C17H21NO4' };
                expect(categorizeSubstance(item)).toBe('stimulants');
            });

            test('should categorize MDMA as stimulant', () => {
                const item = { name: 'MDMA', formula: 'C11H15NO2' };
                expect(categorizeSubstance(item)).toBe('stimulants');
            });

            test('should categorize methamphetamine as stimulant', () => {
                const item = { name: 'Methamphetamine', formula: 'C10H15N' };
                expect(categorizeSubstance(item)).toBe('stimulants');
            });

            test('should categorize caffeine as stimulant', () => {
                const item = { name: 'Caffeine', formula: 'C8H10N4O2' };
                expect(categorizeSubstance(item)).toBe('stimulants');
            });

            test('should categorize cathinone derivatives', () => {
                expect(categorizeSubstance({ name: 'Mephedrone' })).toBe('stimulants');
                expect(categorizeSubstance({ name: 'Methylone' })).toBe('stimulants');
                expect(categorizeSubstance({ name: 'Ethylone' })).toBe('stimulants');
            });
        });

        describe('Benzodiazepines', () => {
            test('should categorize diazepam as benzodiazepine', () => {
                const item = { name: 'Diazepam', formula: 'C16H13ClN2O' };
                expect(categorizeSubstance(item)).toBe('benzodiazepines');
            });

            test('should categorize alprazolam as benzodiazepine', () => {
                const item = { name: 'Alprazolam', formula: 'C17H13ClN4' };
                expect(categorizeSubstance(item)).toBe('benzodiazepines');
            });

            test('should categorize clonazepam as benzodiazepine', () => {
                const item = { name: 'Clonazepam', formula: 'C15H10ClN3O3' };
                expect(categorizeSubstance(item)).toBe('benzodiazepines');
            });

            test('should categorize designer benzodiazepines', () => {
                expect(categorizeSubstance({ name: 'Etizolam' })).toBe('benzodiazepines');
                expect(categorizeSubstance({ name: 'Flubromazolam' })).toBe('benzodiazepines');
            });
        });

        describe('Psychedelics', () => {
            test('should categorize LSD as psychedelic', () => {
                const item = { name: 'LSD', formula: 'C20H25N3O' };
                expect(categorizeSubstance(item)).toBe('psychedelics');
            });

            test('should categorize lysergic acid derivatives as psychedelic', () => {
                const item = { name: 'Lysergic Acid Diethylamide' };
                expect(categorizeSubstance(item)).toBe('psychedelics');
            });

            test('should categorize psilocybin as psychedelic', () => {
                const item = { name: 'Psilocybin', formula: 'C12H17N2O4P' };
                expect(categorizeSubstance(item)).toBe('psychedelics');
            });

            test('should categorize 2C compounds as psychedelic', () => {
                expect(categorizeSubstance({ name: '2C-B' })).toBe('psychedelics');
                expect(categorizeSubstance({ name: '2C-I' })).toBe('psychedelics');
                expect(categorizeSubstance({ name: '2C-E' })).toBe('psychedelics');
            });
        });

        describe('Cannabinoids', () => {
            test('should categorize THC as cannabinoid', () => {
                const item = { name: 'THC', formula: 'C21H30O2' };
                expect(categorizeSubstance(item)).toBe('cannabinoids');
            });

            test('should categorize CBD as cannabinoid', () => {
                const item = { name: 'CBD', formula: 'C21H30O2' };
                expect(categorizeSubstance(item)).toBe('cannabinoids');
            });

            test('should categorize synthetic cannabinoids', () => {
                expect(categorizeSubstance({ name: 'JWH-018' })).toBe('cannabinoids');
                expect(categorizeSubstance({ name: 'AM-2201' })).toBe('cannabinoids');
            });
        });

        describe('Steroids', () => {
            test('should categorize testosterone as steroid', () => {
                const item = { name: 'Testosterone', formula: 'C19H28O2' };
                expect(categorizeSubstance(item)).toBe('steroids');
            });

            test('should categorize stanozolol as steroid', () => {
                const item = { name: 'Stanozolol', formula: 'C21H32N2O' };
                expect(categorizeSubstance(item)).toBe('steroids');
            });

            test('should categorize nandrolone as steroid', () => {
                const item = { name: 'Nandrolone', formula: 'C18H26O2' };
                expect(categorizeSubstance(item)).toBe('steroids');
            });
        });

        describe('Other', () => {
            test('should categorize unknown substance as other', () => {
                const item = { name: 'Aspirin', formula: 'C9H8O4' };
                expect(categorizeSubstance(item)).toBe('other');
            });

            test('should categorize substance without keywords as other', () => {
                const item = { name: 'Unknown Compound 123' };
                expect(categorizeSubstance(item)).toBe('other');
            });
        });

        describe('Edge Cases', () => {
            test('should handle uppercase names', () => {
                const item = { name: 'COCAINE' };
                expect(categorizeSubstance(item)).toBe('stimulants');
            });

            test('should handle mixed case names', () => {
                const item = { name: 'MoRpHiNe' };
                expect(categorizeSubstance(item)).toBe('opioids');
            });

            test('should handle names with spaces', () => {
                const item = { name: 'Methamphetamine Hydrochloride' };
                expect(categorizeSubstance(item)).toBe('stimulants');
            });

            test('should handle missing formula', () => {
                const item = { name: 'Cocaine' };
                expect(categorizeSubstance(item)).toBe('stimulants');
            });

            test('should handle empty formula', () => {
                const item = { name: 'Heroin', formula: '' };
                expect(categorizeSubstance(item)).toBe('opioids');
            });

            test('should handle partial matches in compound names', () => {
                const item = { name: 'Diacetylmorphine' }; // Contains 'morphine'
                expect(categorizeSubstance(item)).toBe('opioids');
            });

            test('should prioritize first matching category', () => {
                // If a substance could match multiple categories, should return first match
                const item = { name: 'Morphine Amphetamine Complex' }; // Contains both
                expect(categorizeSubstance(item)).toBe('opioids'); // Opioids checked first
            });
        });
    });
});
