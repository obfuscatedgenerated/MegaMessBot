import type { DiscordCommand } from "../types";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Embed, Interaction, SlashCommandBuilder } from "discord.js";

import { DiscordRateLimit } from "../rate_limit";
import { RateLimitEmbed } from "../embeds/deny";

import { get_spotify_sdk } from "..";

// additional rate limit for this command, only 3 requests every 2 seconds
const rate_limit = new DiscordRateLimit(3, 2000);

interface Session {
    current_page: number;
    per_page: number;
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
        "items(added_by.id,added_at,track(name,artists(name,external_urls.spotify),album(name),album(images(url)),album(external_urls.spotify),album(release_date),external_urls.spotify))",
        /* @ts-expect-error per_page is within range, but no way to prove it, even using bound check */
        session.per_page,
        (session.current_page - 1) * session.per_page
    );

    // TODO: cache song data if track count is the same

    // build embed for the page
    const embed: Partial<Embed> = {
        title: "Playlist",
        description: `Page ${session.current_page} of ${total_pages}`,
        color: 0x1DB954,
        fields: []
    };

    for (const item of tracks.items) {
        const added_at = new Date(item.added_at).valueOf();
        const release_date = new Date(item.track.album.release_date).valueOf();

        const profile = await spotify.users.profile(item.added_by.id);
        // TODO: cache profiles

        embed.fields?.push({
            name: `${item.track.name} by ${item.track.artists[0].name}`,
            value: `On [${item.track.album.name}](${item.track.album.external_urls.spotify})\nAdded by [${profile.display_name}](${profile.external_urls.spotify}) at <t:${added_at / 1000}:F>\nReleased on <t:${release_date / 1000}:D>`
        });
    }

    return embed;
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
            .setDescription("The initial page to start browsing from. This will be ignored if out of range. Default: 1.")
            .setRequired(false)
            .setMinValue(1)),

    execute: async (interaction) => {
        if (!rate_limit.check(interaction.user.id)) {
            interaction.reply({ embeds: [new RateLimitEmbed()] });
            return;
        }

        const spotify = get_spotify_sdk();

        // create a new session if it doesn't exist and this is a command
        if (!sessions.has(interaction.user.id) && interaction.isCommand()) {
            const per_page = interaction.options.getInteger("per_page") ?? 5;
            const initial_page = interaction.options.getInteger("initial_page") ?? 1;

            sessions.set(interaction.user.id, {
                current_page: initial_page,
                per_page
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

            // freeze the embed by removing the buttons
            collector.on("end", async () => {
                await interaction.editReply({ embeds: [await make_embed(spotify, session)] });
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
