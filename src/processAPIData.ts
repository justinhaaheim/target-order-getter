import type {CombinedOutputData} from './TargetAPITypes';

import {Command} from '@commander-js/extra-typings';
import fs from 'fs';
import path from 'path';

import {CombinedOutputDataZod} from './TargetAPITypes';

function generateUniqueFilePath(baseFilePath: string, suffix: string): string {
  const dir = path.dirname(baseFilePath);
  const ext = path.extname(baseFilePath);
  const baseName = path.basename(baseFilePath, ext);
  let newFilePath = path.join(dir, `${baseName}${suffix}${ext}`);
  let counter = 1;

  while (fs.existsSync(newFilePath)) {
    newFilePath = path.join(dir, `${baseName}${suffix}-${counter}${ext}`);
    counter++;
  }

  return newFilePath;
}

const program = new Command()
  .name('processCombinedOutputData')
  .requiredOption('-i, --input <file>', 'Input JSON file')
  .option('-p, --prune', 'Prune the data')
  .option(
    '-s, --slice <number>',
    'Slice the invoiceAndOrderData array',
    parseInt,
  );

program.parse(process.argv);
const options = program.opts();

const inputFilePath = options.input;
const shouldPrune = options.prune;
const sliceCount = options.slice;

if (!fs.existsSync(inputFilePath)) {
  console.error(`Input file ${inputFilePath} does not exist.`);
  process.exit(1);
}

const inputData = JSON.parse(fs.readFileSync(inputFilePath, 'utf-8'));

let outputData: CombinedOutputData = inputData;

const outputPathSuffixes = [];

if (shouldPrune) {
  outputPathSuffixes.push('--pruned');

  const pruneResult = CombinedOutputDataZod.safeParse(outputData);
  if (!pruneResult.success) {
    console.error('Failed to prune data:', pruneResult.error);
    process.exit(1);
  }
  outputData = pruneResult.data;
}

if (sliceCount != null) {
  outputPathSuffixes.push(`--sliced-${sliceCount}`);

  outputData.invoiceAndOrderData = outputData.invoiceAndOrderData.slice(
    0,
    sliceCount,
  );
}

const outputFilePath = generateUniqueFilePath(
  inputFilePath,
  outputPathSuffixes.join(''),
);

fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2));
console.log(`Output written to ${outputFilePath}`);
