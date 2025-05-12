import { igdbService } from '../services/igdbService';
import { initDb, addGameFromIgdb } from '../services/dbService';

(async () => {
  try {
    await initDb();
    // Tester plusieurs cas
    const testQueries = ['zedla'];
    for (const query of testQueries) {
      console.log(`\nTest de la requête : ${query}`);
      const game = await igdbService.searchGame(query);
      if (game) {
        console.log(`Jeu trouvé : ${game.name}`);
        const gameId = await addGameFromIgdb({
          name: game.name,
          platform: game.platforms?.[0]?.name,
          genre: game.genres?.[0]?.name,
        });
        console.log(`Jeu ajouté à la DB : ID ${gameId}`);
      } else {
        console.log('Aucun jeu trouvé');
      }
    }
  } catch (error) {
    console.error(`Erreur lors du test IGDB : ${error}`);
  }
})();