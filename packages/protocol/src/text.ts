import { MAX_CHAT_GRAPHEMES, MAX_DISPLAY_NAME_GRAPHEMES, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants.ts';

const UNSAFE_TEXT = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
const MARKUP_OR_LINK = /[<>]|\b(?:https?:\/\/|www\.)|\[[^\]]*\]\([^)]*\)/iu;

function segments(value: string): string[] {
  const Segmenter = Intl.Segmenter;
  return Segmenter ? Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(value), segment => segment.segment) : Array.from(value);
}

export function countGraphemes(value: string): number {
  return segments(value).length;
}

export function sanitizePlainText(value: string, maximum = MAX_CHAT_GRAPHEMES): string {
  const text = value.trim().replace(/\s+/gu, ' ');
  if (!text) throw new Error('Text is required');
  if (UNSAFE_TEXT.test(text)) throw new Error('Text contains unsupported control characters');
  if (MARKUP_OR_LINK.test(text)) throw new Error('Text may not contain markup or links');
  if (countGraphemes(text) > maximum) throw new Error(`Text must be ${maximum} graphemes or fewer`);
  return text;
}

export function sanitizeDisplayName(value: string): string {
  return sanitizePlainText(value, MAX_DISPLAY_NAME_GRAPHEMES);
}

export function normalizeRoomCode(value: string): string {
  const normalized = value.trim().replace(/[\s-]+/gu, '').toUpperCase();
  if (normalized.length !== ROOM_CODE_LENGTH) throw new Error('Room code must contain exactly eight characters');
  if (![...normalized].every(character => ROOM_CODE_ALPHABET.includes(character))) throw new Error('Room code contains an ambiguous or unsupported character');
  return normalized;
}

export function createRoomCode(random: () => number = Math.random): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => {
    const index = Math.floor(random() * ROOM_CODE_ALPHABET.length);
    if (!Number.isInteger(index) || index < 0 || index >= ROOM_CODE_ALPHABET.length) throw new Error('Room-code random source returned an invalid value');
    return ROOM_CODE_ALPHABET[index];
  }).join('');
}
