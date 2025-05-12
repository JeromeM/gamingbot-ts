import { Client, Message } from 'discord.js';
import { config } from '../config/config';
import { log } from '../utils/logger';

export const name = 'messageCreate';
export const once = false;

export async function execute(message: Message, client: Client & { commands: any }) {
  if (message.author.bot || !message.content.startsWith(config.PREFIX)) return;

  const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const command = client.commands.get(commandName);

  if (!command) {
    log(`Commande inconnue : ${commandName}`, 'WARN');
    return;
  }

  try {
    await command.execute(message, args);
    log(`Commande exécutée : ${commandName}`);
  } catch (error) {
    log(`Erreur lors de l'exécution de ${commandName} : ${error}`, 'ERROR');
    await message.reply('Erreur lors de l’exécution de la commande.');
  }
}