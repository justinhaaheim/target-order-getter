import {writeFileSync} from 'node:fs';
import path from 'node:path';

import {getDateTimeString} from './DateUtils';

export function writeToJSONFileWithDateTime({
  name,
  data,
  basePath,
}: {
  basePath: string;
  data: unknown;
  name: string;
}): void {
  const fileName = `${getDateTimeString()}__${name}.json`;

  const filePath = path.join(basePath, fileName);

  console.log(`Writing to JSON file: ${fileName}`);
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}
