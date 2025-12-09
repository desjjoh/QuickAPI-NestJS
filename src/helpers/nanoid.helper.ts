import { customAlphabet } from 'nanoid';

const CUSTOM_ALPHABET_REQUEST_ID = '0123456789abcdef';
const CUSTOM_ALPHABET_ENTITIY_ID =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const generateRequestId = customAlphabet(CUSTOM_ALPHABET_REQUEST_ID, 8);
export const generatePrimaryId = customAlphabet(CUSTOM_ALPHABET_ENTITIY_ID, 16);
