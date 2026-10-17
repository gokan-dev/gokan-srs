#!/usr/bin/env bun
// Prints `true` when any changed path read from stdin (one per line, as `git diff --name-only`
// writes them) can change what a deploy ships, `false` otherwise. See src/deploymentPaths.ts.
//
// Usage: git diff --name-only <base> <head> | bun packages/deploy/scripts/ships-in-deployment.ts

import fs from 'node:fs';

import { anyShipsInDeployment } from '../src/deploymentPaths';

const paths = fs.readFileSync(0, 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
console.log(anyShipsInDeployment(paths) ? 'true' : 'false');
