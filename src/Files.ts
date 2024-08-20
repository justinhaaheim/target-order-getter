import {writeFileSync} from 'node:fs';
import path from 'node:path';

import {getDateTimeString} from './DateUtils';

export function getOutputDataFilenamePrefix({
  fileNumber,
  totalFiles,
  dataType,
}: {
  dataType: string;
  fileNumber: number;
  totalFiles: number;
}): string {
  return `targetOrderData__${fileNumber}-of-${totalFiles}__${dataType}`;
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
  const fileName = `${getDateTimeString(timestamp)}__${name}.json`;

  const filePath = path.join(basePath, fileName);

  console.log(`Writing to JSON file: ${fileName}`);
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}
