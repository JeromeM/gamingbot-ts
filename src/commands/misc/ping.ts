import { Message } from 'discord.js';

export const name = 'ping';
export const description = 'Vérifie si le bot est en ligne';

export async function execute(message: Message, args: string[]) {
  await message.reply('Pong !');
}