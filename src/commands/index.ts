import { Client, Collection, Message } from 'discord.js';
import * as ping from './misc/ping';
import * as search from './game/search';

interface Command {
  name: string;
  description: string;
  execute: (message: Message, args: string[]) => Promise<void>;
}

export async function registerCommands(client: Client & { commands: Collection<string, Command> }) {
  const commands = [ping, search];

  for (const command of commands) {
    client.commands.set(command.name, command);
  }

  console.log(`Commandes enregistrées : ${commands.map(c => c.name).join(', ')}`);
}