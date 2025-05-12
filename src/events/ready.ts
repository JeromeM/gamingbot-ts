import { Client } from 'discord.js';
import { log } from '../utils/logger';

export const name = 'ready';
export const once = true;

export async function execute(client: Client) {
  log(`Bot connecté en tant que ${client.user?.tag}`);
}