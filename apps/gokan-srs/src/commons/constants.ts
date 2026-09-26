export const CONSTANTS = {
    setup: {
        defaultKanjiCount: "10",
        defaultKanjiLearningMethod: 'kklc',
        minimumKanjiCount: 0,
        maximumKanjiCount: 2300,
        /** Default increment for the known-kanji count stepper (UserSettings.kanjiCountStep). */
        defaultKanjiCountStep: 10,
        /** Upper bound for that increment, so a typo cannot jump hundreds of kanji at once. */
        maximumKanjiCountStep: 100,
    },

    quiz: {
        hiraganaAnswerPlaceholder: "ひらがな",
        correctAnswerAutoAdvanceDelay: 1800,
        incorrectAnswerRevealDelay: 400,
    },

    srs: {
        /** Maximum number of new vocab introduced per day (Limit removed) */
        dailyNewLimit: 999999,
        newVocabBatchSize: 3,

        /** Maximum number of reviews per day (Limit removed) */
        maxReviewsPerDay: 999999,

        grammar: {
            /**
             * Ceiling on how many new grammar points one advance introduces - NOT
             * a fixed count like newVocabBatchSize, since GrammarSRSService.getNextCandidates
             * also stops at the current chapter's boundary. A chapter with fewer
             * teachable points remaining than this yields only that remainder.
             */
            newBatchSize: 3,
        },

        /**
         * Maximum number of quiz tasks one study session commits to. Unlike the
         * per-day limits above (both effectively disabled), this one is real: it
         * bounds a single sitting, not the day, so a user with a large backlog can
         * clear it across several sessions instead of facing all of it at once.
         *
         * Work that is due but does not fit surfaces as "waiting" (see
         * selectSessionStats) and is picked up by the next session.
         */
        sessionQuizCap: 200,

        production: {
            /**
             * Fraction of a word's meaning strength that its production entry starts
             * from when first activated. Recognising a word's meaning does not mean
             * you can produce it from English, so this is well under parity, but
             * starting a half-known word from zero would make the rollout a full
             * re-learn of the entire queue instead of a new direction on top of it.
             */
            seedStrengthRatio: 0.4,
            /**
             * Hours after activation before the first production review is due.
             * Keeps it out of the session that triggered it (reading is due now and
             * meaning is staggered +12h, so this sits one step further out).
             */
            seedDelayHours: 24,
            /**
             * Fraction of a normal production gain that a grammar answer's vocab
             * reinforcement earns. Filling a blank IS production (English sentence in,
             * Japanese out), which is why the credit goes to that entry rather than
             * reading, but it is production with heavy scaffolding: the English
             * sentence, the surrounding Japanese and the particles bracketing the gap
             * narrow the candidates far more than a production card's bare glosses,
             * and kanji is accepted where that card wants the reading. Right direction,
             * easier conditions, so less than full credit.
             */
            reinforcementStrengthRatio: 0.5,
        },

        frequencyMultipliers: {
            high: 1.0,
            medium: 1.5,
            low: 2.0
        },

        quizProperties: {
            reading: { expectedLatency: 10000 },
            meaning_base: { expectedLatency: 10000 },
            meaning_context: { expectedLatency: 15000 },
            // Production (English prompt, Japanese answer) is recall without any
            // Japanese on screen to work from, so it is slower than reading the
            // word and saying it back.
            production: { expectedLatency: 15000 },
            // Multiple discrete blanks per sentence - more typing than a single vocab answer.
            grammar: { expectedLatency: 20000 }
        },

        /** Mastery % thresholds for switching meaning quizzes to sentence/context mode */
        meaningContextThresholds: {
            early: 30,
            normal: 50,
            late: 70,
        },

        /** Formula Constants */
        formula: {
            targetRecall: 0.75,
            lnTarget: 0.28768,
            expectedLatency: 10000, // ms (10s for typing-based answers)
            minInterval: 0.2, // ~5 hours
            maxInterval: 3650, // 10 years
            minMemoryStrength: 1, // days

            // Strategy D: Start with higher confidence
            initialDifficulty: 0.5,

            // Post-processing overrides
            minIntervalAfterWrong: 0.5, // 12 hours minimum penalty for wrong answers
            // Strategy A: Prevent same-day reviews for known items
            minIntervalAfterSuccess: 1.0, // 1 day minimum for correct/minor_error

            // Dynamic Difficulty
            winRateTarget: 0.75, // Target win rate for tuning default difficulty

            resultFactors: {
                correct: 0.25,
                minor_error: 0.10,
                wrong: -0.40,
                pass: -0.15
            },

            // Difficulty = 0.6 + 0.8 * d (d is 0-1, where 1=easy)
            difficulty: {
                base: 0.6,
                slope: 0.8
            },

            // Latency Clamp: [0.5, 1.5]
            latency: {
                min: 0.5,
                max: 1.5
            },

            fuzzFactor: 0.05,

            postProcessIntervalMultipliers: {
                wrong: 0.3,
                minor_error: 0.7
            },

            mastery: {
                // Target memory strength for ~1 year interval (100% mastery visually)
                // t = S * 0.28768  => S = t / 0.28768
                // For 365 days: 365 / 0.28768 ≈ 1269
                maxMemoryStrength: 1270,
                // Soft cap for visual mastery loop 1 (User Mastery)
                // For ~60 days: 60 / 0.28768 ≈ 208
                visualSoftCap: 208
            }
        },

        adaptive: {
            historySize: 50,
            targetWinRate: 0.75,
            // If win rate > 0.85, increase level (harder)
            increaseThreshold: 0.85,
            // If win rate < 0.70, decrease level (easier)
            decreaseThreshold: 0.70,
            levelStep: 0.05,
            minLevel: 0.5,
            maxLevel: 3.0
        }
    },

    storage: {
        progressStorageKey: "GOKAN_SRS_PROGRESS",
        settingsStorageKey: "GOKAN_SRS_SETTINGS",
        googleDriveFileName: "kanji-progress.json",
        googleDriveFolderName: "KanjiApp",
        googleDriveTokenKey: "GOKAN_SRS_GOOGLE_TOKEN",
    },
} as const;
