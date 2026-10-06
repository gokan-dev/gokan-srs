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
         * Shared sentence ranking (utils/sentenceRanking.ts): which example sentence
         * a card shows, identically for the grammar review, the production cloze and
         * the meaning-in-context card.
         */
        sentenceSelection: {
            /**
             * A known word stops counting as a target once its PRODUCTION ring
             * (MasteryRing's first loop, 0..100) reaches this value: the word is
             * familiar enough to be plain context, so it no longer holds a sentence
             * in place and the sentence is free to rotate.
             */
            targetRingCeiling: 100,
            /**
             * Weight of one unresolved KATAKANA word (2+ characters, no vocab id) in
             * a sentence's unknown-weight tally. A resolved-but-not-introduced word,
             * or an unresolved word containing kanji, weighs 1 - katakana is lighter
             * because it can at least be sounded out, and is usually a name or
             * loanword rather than genuinely unknown vocabulary.
             */
            unresolvedKatakanaWeight: 0.5,
            /**
             * Sentences are grouped into bands of this many characters
             * (`Math.ceil(length / lengthBand)`) for the ranker's length key, so a
             * 14-character sentence does not automatically beat a 15-character one -
             * only a genuinely shorter band wins, and ties within a band still fall
             * to the learner's own words (targets, then production ring).
             */
            lengthBand: 10,
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

        /**
         * How long a session paused by a visit to a consult page (a word, kanji or
         * grammar point's detail page) stays resumable. Past this, returning to the
         * quiz starts a fresh session: the paused one's committed set was taken long
         * enough ago that picking it back up would be surprising.
         */
        sessionSuspendTtlMinutes: 30,

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
                // Memory strength at which an entry is mastered and retired (the
                // ring's second loop full). t = S * 0.28768 => S = t / 0.28768.
                // For 180 days: 180 / 0.28768 ≈ 626. 180 days is the longest
                // retention horizon the research notes recommend designing for
                // (docs/srs-meta-analysis-summary.txt: 30 / 90 / 180 days). It was
                // 1270 (~1 year), which the research does not support and which,
                // at the formula's per-review growth, took years of reviews beyond
                // the first loop. Lowering it changes the exchange rate of points
                // toward mastery only: one point is still one ring unit.
                maxMemoryStrength: 626,
                // Soft cap for visual mastery loop 1 (User Mastery)
                // For ~60 days: 60 / 0.28768 ≈ 208
                visualSoftCap: 208
            }
        },

        /**
         * Per-quiz-type calibration (services/calibration.ts). Each quiz type keeps
         * its own rolling window of real reviews (retries and a word's first review
         * right after its intro are excluded) and a level that multiplies the gain of
         * a SUCCESSFUL answer. Above target the level rises, so strength grows faster,
         * intervals lengthen and the win rate falls back toward target; below it the
         * level falls. It never touches the interval directly: the interval is always
         * strength x lnTarget x the user's frequency preference.
         *
         * The band is centred on the scheduler's own target (formula.targetRecall,
         * 0.75): it used to be 0.70-0.85, which let a learner sit at 84% uncorrected.
         */
        adaptive: {
            historySize: 50,
            /** No adjustment until this many real reviews are in the window. */
            minHistory: 10,
            targetWinRate: 0.75,
            // Win rate above this: raise the growth level (learner is ahead of the model)
            increaseThreshold: 0.80,
            // Win rate below this: lower it
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
        themeStorageKey: "gokan-theme",
        lastAccessDateKey: "GOKAN_LAST_ACCESS_DATE",
        /** Drive file holding the write-once snapshot taken before the v8 migration wave. */
        driveBackupFileName: "kanji-progress.pre-v8-backup.json",
        /** Keys older builds wrote that nothing reads any more; removed on load (each pre-v8 backup was a full progress copy). */
        obsoleteKeys: ["GOKAN_SRS_PROGRESS_BACKUP_PREV8", "GOKAN_SRS_PROGRESS_BACKUP_PREV8_SETTINGS"],
    },
} as const;
