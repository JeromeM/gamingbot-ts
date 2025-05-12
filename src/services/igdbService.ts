import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import { igdbConfig } from '../config/igdb';
import { log } from '../utils/logger';
import { fuzzySearch } from '../utils/fuzzySearch';
import SymSpell from 'node-symspell';
import { join } from 'path';
import { readFileSync } from 'fs';

const cache = new NodeCache({ stdTTL: 3600 }); // Cache pendant 1 heure

// Initialiser SymSpell
const symSpell = new SymSpell();
const dictionaryPath = join(__dirname, '../../games-dictionary.txt');
let isDictionaryLoaded = false;

interface IgdbGame {
    id: number;
    name: string;
    platforms?: { name: string }[];
    genres?: { name: string }[];
    release_dates?: { date: number }[];
    cover?: { id: number; url: string };
    total_rating?: number;
}

interface IgdbToken {
    access_token: string;
    expires_in: number;
}

export class IgdbService {
    private client: AxiosInstance;
    private token: string | null = null;
    private tokenExpiry: number = 0;

    constructor() {
        this.client = axios.create({
            baseURL: igdbConfig.API_URL,
            headers: { 'Accept': 'application/json' },
        });
        this.loadDictionary().catch(error => {
            log(`Erreur lors du chargement initial du dictionnaire SymSpell : ${error}`, 'ERROR');
        });
    }

    private async loadDictionary(): Promise<void> {
        if (isDictionaryLoaded) return;
        try {
            await symSpell.loadDictionary(dictionaryPath, 0, 1, ' ');
            isDictionaryLoaded = true;
            log('Dictionnaire SymSpell chargé avec succès', 'INFO');
        } catch (error) {
            log(`Erreur lors du chargement du dictionnaire SymSpell : ${error}`, 'ERROR');
            throw error;
        }
    }

    private async getToken(): Promise<IgdbToken> {
        const cachedToken = cache.get<IgdbToken>('igdb_token');
        if (cachedToken && Date.now() < this.tokenExpiry) {
            return cachedToken;
        }

        try {
            const response = await axios.post<IgdbToken>(igdbConfig.TOKEN_URL, null, {
                params: {
                    client_id: igdbConfig.CLIENT_ID,
                    client_secret: igdbConfig.CLIENT_SECRET,
                    grant_type: 'client_credentials',
                },
            });

            this.token = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
            cache.set('igdb_token', response.data);
            log('Token IGDB obtenu avec succès', 'INFO');
            return response.data;
        } catch (error) {
            log(`Erreur lors de l'obtention du token IGDB : ${error}`, 'ERROR');
            throw error;
        }
    }

    private async cleanQuery(query: string): Promise<string> {
        await this.loadDictionary();

        let cleaned = query
            .toLowerCase()
            .replace(/^(the|a|an)\s+/i, '')
            .replace(/[^a-z0-9\s]/g, '')
            .trim();

        try {
            const suggestions = await symSpell.lookup(cleaned, 0, 2);
            if (suggestions.length > 0 && suggestions[0].term) {
                log(`Correction SymSpell : "${cleaned}" → "${suggestions[0].term}"`, 'INFO');
                cleaned = suggestions[0].term;
            }
        } catch (error) {
            log(`Erreur SymSpell lors de la correction de "${cleaned}" : ${error}`, 'ERROR');
        }

        const corrections: { [key: string]: string } = {
            wichr: 'witcher',
            zedla: 'zelda',
        };
        const words = cleaned.split(/\s+/);
        cleaned = words.map(word => corrections[word] || word).join(' ');

        log(`Requête nettoyée : "${query}" → "${cleaned}"`, 'INFO');
        return cleaned;
    }

    async searchGame(query: string): Promise<IgdbGame[]> {
        const cacheKey = `game_${query.toLowerCase()}`;
        const cachedGames = cache.get<IgdbGame[]>(cacheKey);
        if (cachedGames) {
            log(`Jeux récupérés du cache pour : ${query}`, 'INFO');
            return cachedGames;
        }

        try {
            if (!this.token) {
                await this.getToken();
            }

            const cleanedQuery = await this.cleanQuery(query);
            if (!cleanedQuery || typeof cleanedQuery !== 'string') {
                log(`Requête nettoyée invalide pour "${query}"`, 'ERROR');
                return [];
            }

            const apicalypseQuery = `
                fields id,name,platforms.name,genres.name,release_dates.date,cover.url,total_rating;
                search "${cleanedQuery}";
                limit 10;
            `;
            const headers = {
                'Client-ID': igdbConfig.CLIENT_ID,
                'Authorization': `Bearer ${this.token}`,
            };

            log(`Envoi de la requête IGDB : ${cleanedQuery}`, 'INFO');

            const response = await this.client.post<IgdbGame[]>('', apicalypseQuery, { headers });

            const gameNames = response.data.map(game => game.name);
            log(`Jeux trouvés pour "${query}" : ${gameNames.join(', ')}`, 'INFO');

            if (!response.data || response.data.length === 0) {
                log(`Aucun jeu trouvé pour la requête : ${query} (nettoyée : ${cleanedQuery})`, 'WARN');
                const words = cleanedQuery.split(/\s+/);
                const primaryWord = words[0] || cleanedQuery;
                if (cleanedQuery !== primaryWord) {
                    const fallbackQuery = `
                        fields id,name,platforms.name,genres.name,release_dates.date,cover.url,total_rating;
                        search "${primaryWord}";
                        limit 10;
                    `;
                    log(`Tentative de fallback : ${primaryWord}`, 'INFO');
                    const fallbackResponse = await this.client.post<IgdbGame[]>('', fallbackQuery, { headers });
                    log(`Jeux trouvés (fallback) : ${fallbackResponse.data.map(g => g.name).join(', ')}`, 'INFO');
                    if (fallbackResponse.data && fallbackResponse.data.length > 0) {
                        response.data = fallbackResponse.data;
                    }
                }
                if (!response.data || response.data.length === 0) {
                    return [];
                }
            }

            // Trier les jeux : d'abord fuzzySearch, puis total_rating, puis longueur du titre
            const queryWords = cleanedQuery.toLowerCase().split(/\s+/);
            const bestMatch = fuzzySearch(cleanedQuery, gameNames);
            let sortedGames = response.data;

            if (bestMatch) {
                // Prioriser le meilleur match
                sortedGames = [
                    response.data.find(game => game.name === bestMatch)!,
                    ...response.data.filter(game => game.name !== bestMatch)
                ];
            } else {
                // Si fuzzySearch échoue, prioriser les jeux contenant tous les mots
                const matchingGames = response.data.filter(game =>
                    queryWords.every(word => game.name.toLowerCase().includes(word))
                );
                if (matchingGames.length > 0) {
                    // Trier par total_rating (descendant), puis longueur du titre
                    sortedGames = matchingGames.sort((a, b) => {
                        const ratingA = a.total_rating || 0;
                        const ratingB = b.total_rating || 0;
                        if (ratingB !== ratingA) return ratingB - ratingA;
                        return a.name.length - b.name.length;
                    });
                } else {
                    // Sinon, trier par total_rating global
                    sortedGames = response.data.sort((a, b) => {
                        const ratingA = a.total_rating || 0;
                        const ratingB = b.total_rating || 0;
                        return ratingB - ratingA;
                    });
                }
            }

            cache.set(cacheKey, sortedGames);
            log(`Jeux triés pour "${query}" : ${sortedGames.map(g => g.name).join(', ')}`, 'INFO');
            return sortedGames;
        } catch (error: any) {
            log(`Erreur lors de la recherche du jeu "${query}" : ${error.message}`, 'ERROR');
            if (error.response) {
                log(`Détails de l'erreur IGDB : ${JSON.stringify(error.response.data)}`, 'ERROR');
            }
            throw error;
        }
    }
}

export const igdbService = new IgdbService();