// import {Command} from '@commander-js/extra-typings';

import type {CombinedOutputData} from './TargetAPITypes';

import {Command} from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ParsedJson {
  [key: string]: any;
}

async function readAndParseFile(filePath: string): Promise<ParsedJson> {
  try {
    // Resolve the full path
    const fullPath = path.resolve(filePath);

    // Check if file exists
    await fs.access(fullPath);

    // Read the file
    const fileContent = await fs.readFile(fullPath, 'utf-8');

    // Parse JSON
    const parsedContent = JSON.parse(fileContent);

    return parsedContent;
  } catch (error) {
    if (error instanceof Error) {
      switch (true) {
        case error.message.includes('ENOENT'):
          throw new Error(`File not found: ${filePath}`);
        case error instanceof SyntaxError:
          throw new Error(`Invalid JSON in file: ${filePath}`);
        default:
          throw new Error(`Error processing file: ${error.message}`);
      }
    }
    throw error;
  }
}

async function main() {
  const program = new Command();

  program
    .name('extractCategories')
    .description('Reads and parses a JSON file')
    .version('1.0.0')
    .argument('<filename>', 'path to the JSON file to parse')
    .action(async (filename: string) => {
      try {
        const parsedData = (await readAndParseFile(
          filename,
        )) as CombinedOutputData;
        // console.log(JSON.stringify(parsedData, null, 2));

        const categories = new Set<string>();

        parsedData.invoiceAndOrderData.forEach((iod) => {
          iod.orderAggregationsData.order_lines.forEach((line) => {
            const categoryNullable =
              line.item.product_classification?.product_type_name;
            if (categoryNullable != null) {
              categories.add(categoryNullable);
            }
          });
        });

        console.log('Categories:', categories);
      } catch (error) {
        console.error(
          `Error: ${
            error instanceof Error ? error.message : 'Unknown error occurred'
          }`,
        );
        process.exit(1);
      }
    });

  await program.parseAsync();
}

main();
