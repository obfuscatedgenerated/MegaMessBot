import type { DiscordCommand } from "../types";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Embed, Interaction, SlashCommandBuilder } from "discord.js";

import { DiscordRateLimit } from "../rate_limit";
import { RateLimitEmbed } from "../embeds/deny";

import { get_spotify_sdk } from "..";
import { OutOfRangeEmbed } from "../embeds/error";

// additional rate limit for this command, only 3 requests every 2 seconds
const rate_limit = new DiscordRateLimit(3, 2000);

interface Session {
    current_page: number;
    per_page: number;
    original_interaction: ChatInputCommandInteraction; // used solely to delete old interactions
}

const sessions = new Map<string, Session>(); // user id -> Session

const EXPIRE_TIME = 60000; // 1 minute
const RENEW_ON_USE = true;

const make_buttons = (user_id: string, total_pages: number) => {
    const session = sessions.get(user_id);

    if (!session) {
        throw new Error("Session not found.");
    }

    if (session.current_page > total_pages) {
        session.current_page = 1;
    }

    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("first")
                .setLabel("⏮")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(session.current_page === 1),
            new ButtonBuilder()
                .setCustomId("prev")
                .setLabel("⬅️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(session.current_page === 1),
            new ButtonBuilder()
                .setCustomId("next")
                .setLabel("➡️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(session.current_page === total_pages),
            new ButtonBuilder()
                .setCustomId("last")
                .setLabel("⏭")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(session.current_page === total_pages)
        );
};

const make_embed = async (spotify: ReturnType<typeof get_spotify_sdk>, session: Session) => {
    const total_tracks = (await spotify.playlists.getPlaylist(process.env.SPOTIFY_PLAYLIST_ID, null, "tracks(total)")).tracks.total;
    const total_pages = Math.ceil(total_tracks / session.per_page);

    const tracks = await spotify.playlists.getPlaylistItems(
        process.env.SPOTIFY_PLAYLIST_ID, null,
        "items(added_by.id,added_at,track(name,artists(name,external_urls.spotify),album(name),album(external_urls.spotify),external_urls.spotify))",
        /* @ts-expect-error per_page is within range, but no way to prove it, even using bound check */
        session.per_page,
        (session.current_page - 1) * session.per_page
    );

    // TODO: cache song data if track count is the same

    // build embed for the page
    const embed: Partial<Embed> = {
        title: "Browsing playlist",
        color: 0x1DB954,
        fields: [],
        footer: {
            text: `Page ${session.current_page}/${total_pages} | Data courtesy of Spotify`
        }
    };

    for (let idx = 0; idx < tracks.items.length; idx++) {
        const item = tracks.items[idx];
        const absolute_index = (session.current_page - 1) * session.per_page + idx + 1;

        const added_at = new Date(item.added_at).valueOf();
        const profile = await spotify.users.profile(item.added_by.id);
        // TODO: cache profiles

        embed.fields?.push({
            name: `${absolute_index}`,
            value: `**[${item.track.name}](${item.track.external_urls.spotify}) by ${item.track.artists.map(artist => `[${artist.name}](${artist.external_urls.spotify})`).join(", ")}\n[${item.track.album.name}](${item.track.album.external_urls.spotify})**\n*Added by [${profile.display_name}](${profile.external_urls.spotify}) at <t:${added_at / 1000}:F>*`
        });
    }

    return embed;
};

const freeze_interaction = async (interaction: ChatInputCommandInteraction) => {
    await interaction.editReply({ components: []});
};

export default {
    data: new SlashCommandBuilder()
        .setName("listbrowse")
        .setDescription("Browse the playlist in pages.")
        .addIntegerOption(option => option.setName("per_page")
            .setDescription("The number of items per page (1-25). Default: 5.")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25))
        .addIntegerOption(option => option.setName("initial_page")
            .setDescription("The initial page to start browsing from. This will be ignored if too high. Default: 1.")
            .setRequired(false)
            .setMinValue(1)),

    execute: async (interaction) => {
        if (!rate_limit.check(interaction.user.id)) {
            interaction.reply({ embeds: [new RateLimitEmbed()] });
            return;
        }

        const spotify = get_spotify_sdk();

        // create a new session every time the command is used
        if (interaction.isCommand()) {
            // if there is an old session, delete it, and freeze the old embed
            const old_session = sessions.get(interaction.user.id);

            if (old_session) {
                await freeze_interaction(old_session.original_interaction);
                sessions.delete(interaction.user.id);
            }

            const per_page = interaction.options.getInteger("per_page") ?? 5;
            const initial_page = interaction.options.getInteger("initial_page") ?? 1;

            if (per_page < 1 || per_page > 25) {
                await interaction.editReply({ embeds: [new OutOfRangeEmbed("Per page", 1, 25)] });
            }

            if (initial_page < 1) {
                await interaction.editReply({ embeds: [new OutOfRangeEmbed("Initial page", 1)] });
            }

            sessions.set(interaction.user.id, {
                current_page: initial_page,
                per_page,
                original_interaction: interaction
            });
        }

        const session = sessions.get(interaction.user.id);

        if (!session) {
            throw new Error("Session not found.");
        }

        if (interaction.isCommand()) {
            const reply = await interaction.deferReply();

            // create interaction collector
            const collector = reply.createMessageComponentCollector({
                filter: (i: Interaction) => i.isButton() && i.user.id === interaction.user.id,
                time: EXPIRE_TIME,
                dispose: true
            });

            collector.on("collect", async (i: ButtonInteraction) => {
                // compute each time in case the playlist changes
                const total_tracks = (await spotify.playlists.getPlaylist(process.env.SPOTIFY_PLAYLIST_ID, null, "tracks(total)")).tracks.total;
                const total_pages = Math.ceil(total_tracks / session.per_page);

                if (RENEW_ON_USE) {
                    collector.resetTimer();
                }

                if (i.customId === "first") {
                    session.current_page = 1;
                } else if (i.customId === "prev") {
                    session.current_page--;
                } else if (i.customId === "next") {
                    session.current_page++;
                } else if (i.customId === "last") {
                    session.current_page = total_pages;
                }

                await interaction.editReply({ embeds: [await make_embed(spotify, session)], components: [make_buttons(i.user.id, total_pages)] });
            });

            // freeze the embed after the time is up
            collector.on("end", async () => {
                await freeze_interaction(interaction);
            });

            // send the initial embed
            const total_tracks = (await spotify.playlists.getPlaylist(process.env.SPOTIFY_PLAYLIST_ID, null, "tracks(total)")).tracks.total;
            const total_pages = Math.ceil(total_tracks / session.per_page);

            await interaction.editReply({ embeds: [await make_embed(spotify, session)], components: [make_buttons(interaction.user.id, total_pages)] });
        } else if (interaction.isButton()) {
            interaction.deferUpdate();
        }
    }
} as DiscordCommand;

// TODO test how it deals with deletion of songs

// TODO: filter by artist, album, who added, year range, etc

// TODO: jump to page button (rather than just command)
