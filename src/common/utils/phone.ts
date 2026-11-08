/**
 * Phone Number Normalization Utility for Bangladesh (BD)
 * 
 * Rules:
 * 1. Convert Bangla numerals (০-৯) to English digits (0-9).
 * 2. Strip spaces, hyphens, parentheses, and any non-digit characters.
 * 3. Normalize international prefixes (+880, 880) to 11-digit local format: 01XXXXXXXXX.
 * 4. Strictly validate that the number starts with valid BD operator codes (013-019) and has exactly 11 digits.
 */

const banglaToEnglishMap: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/**
 * Normalizes any Bangladeshi phone input into a standard 11-digit string (e.g., 01712345678).
 * Throws an Error if the phone number format is invalid.
 */
export function normalizeBdPhone(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('মোবাইল নাম্বার প্রদান করা আবশ্যক (Phone number is required)');
  }

  // 1. Convert any Bangla digits to English
  let cleaned = rawPhone
    .split('')
    .map((char) => banglaToEnglishMap[char] ?? char)
    .join('');

  // 2. Remove all non-digit characters (spaces, +, -, parentheses)
  cleaned = cleaned.replace(/\D/g, '');

  // 3. Strip country code '880' if present at the start of a 13-digit number
  if (cleaned.startsWith('8801') && cleaned.length === 13) {
    cleaned = cleaned.slice(2);
  }

  // 4. Validate standard 11-digit Bangladeshi mobile format (013-019 prefix followed by 8 digits)
  const bdPhoneRegex = /^01[3-9]\d{8}$/;
  if (!bdPhoneRegex.test(cleaned)) {
    throw new Error('সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন (যেমন: 017XXXXXXXX)');
  }

  return cleaned;
}

