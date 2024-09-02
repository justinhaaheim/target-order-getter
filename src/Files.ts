import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import {getDateTimeString} from './DateUtils';

export function getOutputDataFilenamePrefix({
  fileNumber,
  totalFiles,
  dataType,
  params,
}: {
  dataType: string;
  fileNumber: number;
  params: string;
  totalFiles: number;
}): string {
  return `targetOrderData__${fileNumber}-of-${totalFiles}__${dataType}__${params}`;
}

export function writeToJSONFileWithDateTime({
  name,
  data,
  timestamp,
  basePath,
}: {
  basePath: string;
  data: unknown;
  name: string;
  timestamp: Date;
}): void {
  // Create the dir if it doesn't exist
  mkdirSync(basePath, {recursive: true});

  const fileName = `${getDateTimeString(timestamp)}__${name}.json`;

  const filePath = path.join(basePath, fileName);

  console.log(`Writing to JSON file: ${fileName}`);
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}
