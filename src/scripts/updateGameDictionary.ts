import axios from 'axios';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { igdbConfig } from '../config/igdb';
import { log } from '../utils/logger';
import cron from 'node-cron';

const DICTIONARY_PATH = join(__dirname, '../../games-dictionary.txt');

interface IgdbGame {
    id: number;
    name: string;
}

async function getAccessToken(): Promise<string> {
    try {
        log(`Tentative d'obtention du token via ${igdbConfig.TOKEN_URL}`, 'INFO');
        const response = await axios.post(
            igdbConfig.TOKEN_URL,
            null,
            {
                params: {
                    client_id: igdbConfig.CLIENT_ID,
                    client_secret: igdbConfig.CLIENT_SECRET,
                    grant_type: 'client_credentials',
                },
            }
        );
        log('Token IGDB obtenu avec succès', 'INFO');
        return response.data.access_token;
    } catch (error: any) {
        log(`Erreur lors de l'obtention du token IGDB : ${error.message}`, 'ERROR');
        if (error.response) {
            log(`Détails de l'erreur : ${JSON.stringify(error.response.data)}`, 'ERROR');
        }
        throw error;
    }
}

async function updateGameDictionary() {
    try {
        const token = await getAccessToken();
        const headers = {
            'Client-ID': igdbConfig.CLIENT_ID,
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json',
        };

        const games: IgdbGame[] = [];
        let offset = 0;
        const limit = 500; // Max par requête

        // Récupérer les jeux par lots
        while (true) {
            const query = `
                fields name;
                limit ${limit};
                offset ${offset};
            `;
            log(`Envoi de la requête IGDB : ${igdbConfig.API_URL}, offset=${offset}, limit=${limit}`, 'INFO');
            const response = await axios.post<IgdbGame[]>(igdbConfig.API_URL, query, { headers });
            if (!response.data.length) {
                log('Aucun jeu supplémentaire trouvé, fin de la récupération', 'INFO');
                break;
            }

            games.push(...response.data);
            offset += limit;
            log(`Récupéré ${games.length} jeux`, 'INFO');
        }

        // Nettoyer et filtrer les noms de jeux
        const cleanedGames = games
            .map(game => ({
                ...game,
                name: game.name
                    .replace(/[^a-zA-Z0-9\s:]/g, '') // Supprime les caractères spéciaux
                    .trim()
            }))
            .filter(game => game.name && game.name.length > 2); // Exclure les noms vides ou trop courts

        // Générer le dictionnaire
        const dictionaryContent = cleanedGames
            .map(game => `${game.name} 1`) // Fréquence fixée à 1
            .join('\n');
        writeFileSync(DICTIONARY_PATH, dictionaryContent, 'utf-8');
        log(`Dictionnaire mis à jour avec ${cleanedGames.length} jeux`, 'INFO');
    } catch (error: any) {
        log(`Erreur lors de la mise à jour du dictionnaire : ${error.message}`, 'ERROR');
        if (error.response) {
            log(`Détails de l'erreur : ${JSON.stringify(error.response.data)}`, 'ERROR');
        }
    }
}

// Exécuter immédiatement au démarrage
updateGameDictionary();

// Planifier la mise à jour hebdomadaire (lundi à 2h00)
cron.schedule('0 2 * * 1', () => {
    log('Lancement de la mise à jour automatique du dictionnaire', 'INFO');
    updateGameDictionary();
});