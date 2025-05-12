import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { config } from '../config/config';
import { log } from '../utils/logger';
import { Game } from '../models/game';

let db: Database;

export async function initDb() {
    try {
        db = await open({
            filename: config.DB_PATH,
            driver: sqlite3.Database,
        });
        
        // Création des tables
        await db.exec(`
      CREATE TABLE IF NOT EXISTS Users (
        userId TEXT PRIMARY KEY,
        username TEXT NOT NULL
      );
            
      CREATE TABLE IF NOT EXISTS Games (
        gameId INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        platform TEXT,
        genre TEXT,
        addedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
            
      CREATE TABLE IF NOT EXISTS UserGames (
        userId TEXT,
        gameId INTEGER,
        rating INTEGER CHECK (rating >= 1 AND rating <= 10),
        review TEXT,
        addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (userId, gameId),
        FOREIGN KEY (userId) REFERENCES Users(userId),
        FOREIGN KEY (gameId) REFERENCES Games(gameId)
      );
            
      CREATE TABLE IF NOT EXISTS Stats (
        userId TEXT PRIMARY KEY,
        totalGames INTEGER DEFAULT 0,
        averageRating REAL,
        favoriteGenre TEXT,
        FOREIGN KEY (userId) REFERENCES Users(userId)
      );
            
      -- Index pour optimiser les requêtes fréquentes
      CREATE INDEX IF NOT EXISTS idx_usergames_userId ON UserGames(userId);
      CREATE INDEX IF NOT EXISTS idx_games_title ON Games(title);
    `);
            
            log('Base de données initialisée avec succès', 'INFO');
        } catch (error) {
            log(`Erreur lors de l'initialisation de la base de données : ${error}`, 'ERROR');
            throw error;
        }
    }
    
    // CRUD pour Users
    export async function addUser(userId: string, username: string) {
        try {
            await db.run('INSERT OR IGNORE INTO Users (userId, username) VALUES (?, ?)', userId, username);
            await db.run('INSERT OR IGNORE INTO Stats (userId, totalGames) VALUES (?, 0)', userId);
            log(`Utilisateur ajouté : ${userId}`, 'INFO');
        } catch (error) {
            log(`Erreur lors de l'ajout de l'utilisateur ${userId} : ${error}`, 'ERROR');
            throw error;
        }
    }
    
    export async function getUser(userId: string) {
        try {
            return await db.get('SELECT * FROM Users WHERE userId = ?', userId);
        } catch (error) {
            log(`Erreur lors de la récupération de l'utilisateur ${userId} : ${error}`, 'ERROR');
            throw error;
        }
    }
    
    // CRUD pour Games (mis à jour pour IGDB)
    export async function addGameFromIgdb(igdbGame: { name: string; platform?: string; genre?: string }) {
        try {
            const existingGame = await getGameByTitle(igdbGame.name);
            if (existingGame) {
                return existingGame.gameId;
            }
            
            const result = await db.run(
                'INSERT INTO Games (title, platform, genre) VALUES (?, ?, ?)',
                igdbGame.name,
                igdbGame.platform || null,
                igdbGame.genre || null
            );
            const gameId = result.lastID;
            log(`Jeu ajouté : ${igdbGame.name} (ID: ${gameId})`, 'INFO');
            return gameId;
        } catch (error) {
            log(`Erreur lors de l'ajout du jeu ${igdbGame.name} : ${error}`, 'ERROR');
            throw error;
        }
    }
    
    export async function getGameByTitle(title: string) {
        try {
            return await db.get('SELECT * FROM Games WHERE title = ?', title);
        } catch (error) {
            log(`Erreur lors de la récupération du jeu ${title} : ${error}`, 'ERROR');
            throw error;
        }
    }
    
    // CRUD pour UserGames
    export async function addUserGame(userId: string, gameId: number, rating?: number, review?: string) {
        try {
            await db.run(
                'INSERT INTO UserGames (userId, gameId, rating, review) VALUES (?, ?, ?, ?)',
                userId,
                gameId,
                rating || null,
                review || null
            );
            // Met à jour les statistiques
            await updateUserStats(userId);
            log(`Lien utilisateur-jeu ajouté : userId=${userId}, gameId=${gameId}`, 'INFO');
        } catch (error) {
            log(`Erreur lors de l'ajout du lien utilisateur-jeu : ${error}`, 'ERROR');
            throw error;
        }
    }
    
    export async function getUserGames(userId: string) {
        try {
            return await db.all(
                `SELECT g.*, ug.rating, ug.review, ug.addedAt AS userAddedAt
       FROM UserGames ug
       JOIN Games g ON ug.gameId = g.gameId
       WHERE ug.userId = ?`,
                userId
            );
        } catch (error) {
            log(`Erreur lors de la récupération des jeux de l'utilisateur ${userId} : ${error}`, 'ERROR');
            throw error;
        }
    }
    
    // Mise à jour des statistiques
    async function updateUserStats(userId: string) {
        try {
            const stats = await db.get(
                `SELECT COUNT(*) as totalGames,
              AVG(rating) as averageRating,
              (SELECT genre
               FROM Games g
               JOIN UserGames ug ON g.gameId = ug.gameId
               WHERE ug.userId = ?
               GROUP BY genre
               ORDER BY COUNT(*) DESC
               LIMIT 1) as favoriteGenre
       FROM UserGames
       WHERE userId = ?`,
                userId,
                userId
            );
            
            await db.run(
                'UPDATE Stats SET totalGames = ?, averageRating = ?, favoriteGenre = ? WHERE userId = ?',
                stats.totalGames,
                stats.averageRating,
                stats.favoriteGenre || null,
                userId
            );
        } catch (error) {
            log(`Erreur lors de la mise à jour des stats de l'utilisateur ${userId} : ${error}`, 'ERROR');
            throw error;
        }
    }
    