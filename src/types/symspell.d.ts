declare module 'node-symspell';

interface SymSpell {
    loadDictionary(filePath: string, termIndex: number, countIndex: number, separator?: string): Promise<boolean>;
    lookup(term: string, verbosity: number, maxEditDistance: number, options?: { ignoreToken?: RegExp; transferCasing?: boolean }): Promise<{ term: string; distance: number; count: number }[]>;
}

declare const SymSpell: {
    new (): SymSpell;
};