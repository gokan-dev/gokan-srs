import { describe, it, expect } from 'vitest';
import { anyShipsInDeployment, shipsInDeployment } from './deploymentPaths';

describe('shipsInDeployment', () => {
    it('ships app source, the dataset pointer, packages and the lockfile', () => {
        expect(shipsInDeployment('apps/gokan-srs/src/pages/HubScreen.tsx')).toBe(true);
        expect(shipsInDeployment('apps/gokan-dictionary/src/styles/app.scss')).toBe(true);
        expect(shipsInDeployment('apps/gokan-srs/dataset')).toBe(true);
        expect(shipsInDeployment('apps/gokan-srs/scripts/sync-dataset.ts')).toBe(true);
        expect(shipsInDeployment('packages/dataset-schema/src/headword.ts')).toBe(true);
        expect(shipsInDeployment('bun.lock')).toBe(true);
        expect(shipsInDeployment('package.json')).toBe(true);
    });

    it('ships the deploy workflows, which a tag push runs from the tagged commit', () => {
        expect(shipsInDeployment('.github/workflows/deploy-site.yml')).toBe(true);
        expect(shipsInDeployment('.github/workflows/deploy-staging.yml')).toBe(true);
    });

    it('does not ship CI, docs, tests, check scripts or infrastructure', () => {
        expect(shipsInDeployment('.github/workflows/claude-triage.yml')).toBe(false);
        expect(shipsInDeployment('docs/ARCHITECTURE.md')).toBe(false);
        expect(shipsInDeployment('AGENTS.md')).toBe(false);
        expect(shipsInDeployment('apps/gokan-srs/README.md')).toBe(false);
        expect(shipsInDeployment('scripts/check-conventions.ts')).toBe(false);
        expect(shipsInDeployment('apps/gokan-srs/src/utils/time.utils.test.ts')).toBe(false);
        expect(shipsInDeployment('apps/gokan-srs/src/components/Page.test.tsx')).toBe(false);
        expect(shipsInDeployment('apps/gokan-srs/src/test/fixtures.ts')).toBe(false);
        expect(shipsInDeployment('apps/gokan-srs/terraform/main.tf')).toBe(false);
        expect(shipsInDeployment('eslint.config.ts')).toBe(false);
    });
});

describe('anyShipsInDeployment', () => {
    it('is true when one path ships', () => {
        expect(anyShipsInDeployment(['docs/ARCHITECTURE.md', 'apps/gokan-srs/src/main.tsx'])).toBe(true);
    });

    it('is false for a change that ships nothing, and for no change', () => {
        expect(anyShipsInDeployment(['.github/workflows/claude-review.yml', 'docs/ARCHITECTURE.md'])).toBe(false);
        expect(anyShipsInDeployment([])).toBe(false);
    });
});
