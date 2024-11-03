import type {CombinedOutputData} from './TargetAPITypes';

import {Command} from '@commander-js/extra-typings';
import fs from 'fs';
import prettyBytes from 'pretty-bytes';

import {
  formatCompactNumber,
  formatStandardNumber,
  generateUniqueFilePath,
  getFileSize,
} from './GeneralUtils';
import {CombinedOutputDataZod} from './TargetAPITypes';

const program = new Command()
  .name('processCombinedOutputData')
  .requiredOption('-i, --input <file>', 'Input JSON file')
  .option('-p, --prune', 'Prune the data')
  .option(
    '-s, --slice <number>',
    'Slice the invoiceAndOrderData array',
    parseInt,
  )
  .option('-c, --customSuffix <string>', 'Custom suffix for output file')
  .option(
    '-l, --validate',
    'Validate the input file using the CombinedOutputDataZod schema',
  );

program.parse(process.argv);

const {
  input: inputFilePath,
  prune: shouldPrune,
  slice: sliceCount,
  customSuffix,
  validate,
} = program.opts();

if (!fs.existsSync(inputFilePath)) {
  console.error(`Input file ${inputFilePath} does not exist.`);
  process.exit(1);
}

const inputFileSize = getFileSize(inputFilePath);
const inputFileSizeString =
  inputFileSize != null ? prettyBytes(inputFileSize) : 'null';
console.log(`Input file size: ${inputFileSizeString}`);

const inputString = fs.readFileSync(inputFilePath, 'utf-8');
const inputData = JSON.parse(inputString);

let outputData: CombinedOutputData = inputData;
let shouldWriteOutput = false;

const outputPathSuffixes = [];

// Create a space between input logs and output logs
console.log();

if (shouldPrune || validate) {
  const pruneResult = CombinedOutputDataZod.safeParse(outputData);

  if (validate) {
    if (pruneResult.success) {
      console.log('✅ Validation complete! No errors found.');
    } else {
      console.error('❌ Validation failed:', pruneResult.error);
    }
  }

  if (shouldPrune) {
    outputPathSuffixes.push('--pruned');

    if (!pruneResult.success) {
      console.error('❌ Failed to prune data: ', pruneResult.error);
      process.exit(1);
    }
    console.log('✅ Pruning successful');
    outputData = pruneResult.data;
    shouldWriteOutput = true;
  }
}

if (sliceCount != null) {
  outputPathSuffixes.push(`--sliced-${sliceCount}`);

  outputData.invoiceAndOrderData = outputData.invoiceAndOrderData.slice(
    0,
    sliceCount,
  );
  shouldWriteOutput = true;
}

if (shouldWriteOutput) {
  if (customSuffix != null) {
    outputPathSuffixes.push(`--${customSuffix}`);
  }

  const outputFilePath = generateUniqueFilePath(
    inputFilePath,
    outputPathSuffixes.join(''),
  );

  const outputString = JSON.stringify(outputData, null, 2);

  fs.writeFileSync(outputFilePath, outputString);

  console.log();
  console.log(`💾 Output written to ${outputFilePath}`);

  const inputLengthStandard = formatStandardNumber(inputString.length);
  const outputLengthStandard = formatStandardNumber(outputString.length);
  const maxStringLength = Math.max(
    inputLengthStandard.length,
    outputLengthStandard.length,
  );

  console.log('');
  console.log(
    `Input size:  ${inputLengthStandard.padStart(
      maxStringLength,
    )} (${formatCompactNumber(inputString.length)}) characters`,
  );
  console.log(
    `Output size: ${outputLengthStandard.padStart(
      maxStringLength,
    )} (${formatCompactNumber(outputString.length)}) characters`,
  );

  const outputFileSize = getFileSize(outputFilePath);
  const outputFileSizeString =
    outputFileSize != null ? prettyBytes(outputFileSize) : 'null';

  console.log('');
  console.log(`Input size:  ${inputFileSizeString}`);
  console.log(`Output size: ${outputFileSizeString}`);
} else {
  console.log('No changes made to the data. No file output.');
}
