// import {Command} from '@commander-js/extra-typings';

import fileToValidate from '../output/2024-08-23__22-26-20__targetOrderData__2-of-2__invoiceAndOrderData.json';
import {CombinedOutputDataZod} from './TargetAPITypes';

// const program = new Command()
//   .name('validateJson')
//   .requiredOption('-f <string>', 'The filename to validate');

// program.parse();
// const {f: filePath} = program.opts();

// const fileToValidate = await import(filePath);

CombinedOutputDataZod.parse(fileToValidate);
console.log('✅ Parsing complete! No errors found.');
