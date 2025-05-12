import { Client } from 'discord.js';
import * as ready from './ready';
import * as messageCreate from './messageCreate';

// Interface pour typer les événements
interface Event {
  name: string;
  once: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

export async function registerEvents(client: Client & { commands: any }) {
  const events: Event[] = [ready, messageCreate];

  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client)); // Passe client explicitement
    }
  }
}