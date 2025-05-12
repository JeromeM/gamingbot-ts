import dotenv from 'dotenv';

dotenv.config();

export const igdbConfig = {
    CLIENT_ID: process.env.IGDB_CLIENT_ID || '',
    CLIENT_SECRET: process.env.IGDB_CLIENT_SECRET || '',
    TOKEN_URL: 'https://id.twitch.tv/oauth2/token',
    API_URL: 'https://api.igdb.com/v4/games',
};