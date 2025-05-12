import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config/config';
import { registerCommands } from './commands';
import { registerEvents } from './events';
import { initDb } from './services/dbService';

// Ajoute une collection pour stocker les commandes
interface CustomClient extends Client {
    commands: Collection<string, any>;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
}) as CustomClient;

client.commands = new Collection();

(async () => {
    await initDb(); // Initialise la base de données
    await registerCommands(client);
    await registerEvents(client);
    await client.login(config.DISCORD_TOKEN);
})();