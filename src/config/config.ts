import dotenv from 'dotenv';

dotenv.config();

export const config = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  IGDB_CLIENT_ID: process.env.IGDB_CLIENT_ID || '', // Ajout pour compatibilité
  IGDB_CLIENT_SECRET: process.env.IGDB_CLIENT_SECRET || '', // Ajout pour compatibilité
  DB_PATH: process.env.DB_PATH || './database.sqlite',
  PREFIX: '!game',
};