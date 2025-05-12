import {
    Message,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ButtonInteraction,
    InteractionCollector,
    MessageComponentInteraction,
} from 'discord.js';
import { igdbService } from '../../services/igdbService';
import { log } from '../../utils/logger';

export const name = 'search';
export const description = 'Recherche un jeu et affiche ses détails';

export async function execute(message: Message, args: string[]): Promise<void> {
    if (args.length < 1) {
        await message.reply('Usage : !game search <titre>');
        return;
    }

    const title = args.join(' ');
    try {
        const games = await igdbService.searchGame(title);
        if (!games || games.length === 0) {
            await message.reply(`Aucun jeu trouvé pour "${title}".`);
            return;
        }

        let currentIndex = 0;

        // Fonction pour créer l'embed
        const createEmbed = (game: any) => {
            const releaseDate = game.release_dates?.[0]?.date
                ? new Date(game.release_dates[0].date * 1000).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                  })
                : 'Non disponible';

            const coverUrl = game.cover?.url
                ? `https:${game.cover.url.replace('t_thumb', 't_1080p')}`
                : null;

            const embed = new EmbedBuilder()
                .setTitle(game.name)
                .setColor('#0099ff')
                .addFields(
                    {
                        name: 'Genre',
                        value: game.genres?.length ? game.genres.map((g: any) => g.name).join(', ') : 'Non disponible',
                        inline: true,
                    },
                    { name: 'Date de sortie', value: releaseDate, inline: true },
                    {
                        name: 'Score IGDB',
                        value: game.total_rating ? `${Math.round(game.total_rating)}/100` : 'Non disponible',
                        inline: true,
                    }
                )
                .setTimestamp();

            if (coverUrl) {
                embed.setImage(coverUrl);
            }

            return embed;
        };

        // Créer les boutons
        const prevButton = new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Précédent')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(games.length <= 1);

        const nextButton = new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Suivant')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(games.length <= 1);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

        // Envoyer le premier embed
        const reply = await message.reply({
            embeds: [createEmbed(games[currentIndex])],
            components: games.length > 1 ? [row] : [],
        });

        if (games.length <= 1) return;

        // Créer un collecteur avec typage explicite
        const collector = reply.createMessageComponentCollector({
            filter: (i: MessageComponentInteraction): i is ButtonInteraction => {
                return i.isButton() && i.user.id === message.author.id;
            },
            time: 60000, // 1 minute
        }) as InteractionCollector<ButtonInteraction>;

        collector.on('collect', async (interaction: ButtonInteraction) => {
            if (interaction.customId === 'prev') {
                currentIndex = currentIndex > 0 ? currentIndex - 1 : games.length - 1;
            } else if (interaction.customId === 'next') {
                currentIndex = currentIndex < games.length - 1 ? currentIndex + 1 : 0;
            }

            await interaction.update({
                embeds: [createEmbed(games[currentIndex])],
                components: [row],
            });
        });

        collector.on('end', async () => {
            await reply.edit({ components: [] }); // Désactiver les boutons après timeout
        });
    } catch (error) {
        log(`Erreur lors de la recherche du jeu "${title}" : ${error}`, 'ERROR');
        await message.reply('Erreur lors de la recherche du jeu.');
    }
}