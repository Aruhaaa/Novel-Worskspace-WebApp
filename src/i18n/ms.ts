/**
 * Bahasa Melayu (Malaysia). The key is the English sentence used in the code; the value is its translation.
 * A sentence missing here shows in English. Run `npm run i18n:check` to see what is used in the code but not yet here.
 * The sentences are kept in a few files so no one file is very long; this joins them.
 */
import part1 from './ms-1.ts';
import part2 from './ms-2.ts';
import part3 from './ms-3.ts';
import part4 from './ms-4.ts';
import part5 from './ms-5.ts';
import part6 from './ms-6.ts';
import part7 from './ms-7.ts';
import part8 from './ms-8.ts';
import part9 from './ms-9.ts';
import part10 from './ms-10.ts';
import part11 from './ms-11.ts';

const ms: Record<string, string> = { ...part1, ...part2, ...part3, ...part4, ...part5, ...part6, ...part7, ...part8, ...part9, ...part10, ...part11 };

export default ms;
