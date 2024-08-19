import type {BrowserContextOptions} from 'playwright';

import path from 'node:path';

// This is an absolute path to the auth file.
export const playwrightAuthFilePath = path.join(
  // requires node ~20.11.0 (ie greater than or equal to 20.11.??)
  import.meta.dirname,
  '..',
  'playwright/.auth/user-2.json',
);

export const playwrightAuthContextOptions: BrowserContextOptions = {
  storageState: playwrightAuthFilePath,
};

// const COOKIE_TO_CHECK_FOR_EXPIRATION = 'accessToken';
const COOKIE_TO_CHECK_FOR_EXPIRATION = 'refreshToken';

export function getJsDateFromCookieTimestamp(cookieTimestamp: number): Date {
  return new Date(cookieTimestamp * 1000);
}

export async function getStoredAuthStateObject(
  authFilePath: string,
): Promise<{data: unknown; fileExists: boolean}> {
  let authUserJson;
  try {
    authUserJson = await import(authFilePath, {
      assert: {type: 'json'},
    });
    console.log('Auth file loaded:', authUserJson);
  } catch (error) {
    console.error('Error requiring auth file:', error);
    return {data: null, fileExists: false};
  }

  return {data: authUserJson, fileExists: true};
}

/**
 * This function may not be that useful, as there are session cookies that expire within hours. Probably what we want
 * to do is just figure out which cookie expiration actually correlates with failed requests/auth, and then directly target that.
 */
export async function getStoredAuthStateSoonestExpiration(
  authFilePath: string,
): Promise<Date | null> {
  const {data} = await getStoredAuthStateObject(authFilePath);
  const authUserJson = data as {[key: string]: unknown};

  if (authUserJson == null) {
    console.log('Auth file not found:', authFilePath);
    return null;
  }

  if (
    // Object.prototype.hasOwnProperty.call(authUserJson, 'cookies') &&
    !Array.isArray(authUserJson['cookies'])
  ) {
    console.log(
      'Auth file is in unexpected format, does not contain cookies',
      authUserJson,
    );
    return null;
  }

  const cookiesWithJsExpireDate = (
    !Array.isArray(authUserJson['cookies']) ? [] : authUserJson['cookies']
  ).map((cookie) => {
    if (cookie.expires > 0) {
      return {...cookie, expiresJsDate: new Date(cookie.expires * 1000)};
    }
    return {...cookie, expiresJsDate: null};
  });

  const cookiesSorted = cookiesWithJsExpireDate.slice().sort((a, b) => {
    if (a.expiresJsDate == null && b.expiresJsDate == null) {
      return 0;
    }

    /**
     * From MDN re Array.sort: It should return a number where:
     * A negative value indicates that a should come before b.
     * A positive value indicates that a should come after b.
     * Zero or NaN indicates that a and b are considered equal.
     */
    if (a.expiresJsDate == null) {
      // Null values should be last
      return 1;
    }
    if (b.expiresJsDate == null) {
      return -1;
    }

    return a.expiresJsDate - b.expiresJsDate;
  });

  console.log('Cookies sorted:', cookiesSorted);

  console.log('Cookie with soonest expiration:', cookiesSorted[0]);

  return cookiesSorted[0]?.expiresJsDate ?? null;
}

export async function getStoredAuthStateCookieExpirationByCookieName(
  authFilePath: string,
  cookieName: string,
): Promise<{expiresDate: Date | null; fileExists: boolean}> {
  const authUserJsonResult = await getStoredAuthStateObject(authFilePath);
  const authUserJson = authUserJsonResult.data as {[key: string]: unknown};

  if (authUserJsonResult.fileExists === false) {
    console.log('Auth file not found:', authFilePath);
    return {expiresDate: null, fileExists: false};
  }

  if (authUserJson == null) {
    console.log('Auth file exists, but data is nullish', authFilePath);
    throw new Error('Auth file exists, but data is nullish');
  }

  if (!Array.isArray(authUserJson['cookies'])) {
    console.log(
      'Auth file is in unexpected format, does not contain cookies',
      authUserJson,
    );
    throw new Error(
      'Auth file is in unexpected format, does not contain cookies property',
    );
  }

  const matchingCookies =
    authUserJson['cookies']?.filter((cookie) => cookie.name === cookieName) ??
    [];

  if (matchingCookies.length === 0) {
    console.log('No matching cookie found:', cookieName);
    throw new Error(`No matching cookie found for coookie name ${cookieName}`);
  }

  if (matchingCookies.length > 1) {
    console.warn('Multiple matching cookies found:', {
      cookieName,
      matchingCookies,
    });
  }

  const firstMatchingCookieExpires = matchingCookies[0]?.['expires'];

  if (firstMatchingCookieExpires == null) {
    console.log('No expiration found for:', {
      cookieName,
      matchingCookies,
    });
    throw new Error(`No expiration found for cookie name: ${cookieName}`);
  }

  if (typeof firstMatchingCookieExpires !== 'number') {
    console.log('First matching cookie expire property is not a number', {
      cookieName,
      matchingCookies,
    });
    throw new Error(
      `First matching cookie expire property is not a number for cookie name: ${cookieName}`,
    );
  }

  const firstMatchingCookieExpiresJsDate =
    firstMatchingCookieExpires > 0
      ? getJsDateFromCookieTimestamp(firstMatchingCookieExpires)
      : null;

  console.log('First matching cookie expiration:', {
    firstMatchingCookieExpiresJsDate,
    matchingCookies,
  });

  return {expiresDate: firstMatchingCookieExpiresJsDate, fileExists: true};
}

export async function getIsAuthFileCookieStillValid(
  authFilePath: string,
): Promise<boolean> {
  const {fileExists, expiresDate} =
    await getStoredAuthStateCookieExpirationByCookieName(
      authFilePath,
      COOKIE_TO_CHECK_FOR_EXPIRATION,
    );

  if (fileExists === false) {
    console.log('No auth file found');
    return false;
  }

  if (expiresDate == null || isNaN(expiresDate.valueOf())) {
    console.log('No expiration date found');
    return false;
  }

  const now = new Date();

  console.log('Now:', now.toLocaleString());
  console.log('Cookie expiration:', expiresDate.toLocaleString());

  return now < expiresDate;
}
