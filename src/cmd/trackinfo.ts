import type { DiscordCommand } from "../types";
import { Embed, SlashCommandBuilder } from "discord.js";

import { get_spotify_sdk } from "..";

export default {
    data: new SlashCommandBuilder()
        .setName("trackinfo")
        .setDescription("Gets info about a song in the playlist.")
        .addIntegerOption(option => option.setName("index")
            .setDescription("The index of the track in the playlist, starting from 1. If omitted, a random song will be selected.")
            .setRequired(false))
        .addBooleanOption(option => option.setName("reverse")
            .setDescription("Whether to reverse the playlist index, so 1 is the last song.")
            .setRequired(false)),

    execute: async (interaction) => {
        await interaction.deferReply();

        const spotify = get_spotify_sdk();

        const total_tracks = (await spotify.playlists.getPlaylist(process.env.SPOTIFY_PLAYLIST_ID, null, "tracks(total)")).tracks.total;

        let effective_index = 0;

        // if no index is provided, select a random track
        if (interaction.options.getInteger("index")) {
            effective_index = interaction.options.getInteger("index") - 1;

            // if reverse is true, reverse the index using the total number of tracks
            if (interaction.options.getBoolean("reverse")) {
                effective_index = total_tracks - effective_index - 1;
            }
        } else {
            effective_index = Math.floor(Math.random() * total_tracks);
        }

        const tracks = await spotify.playlists.getPlaylistItems(
            process.env.SPOTIFY_PLAYLIST_ID, null,
            "items(added_by.id,added_at,track(name,artists(name,external_urls.spotify),album(name),album(images(url)),album(external_urls.spotify),album(release_date),external_urls.spotify))",
            1,
            effective_index
        );

        const item = tracks.items[0];

        // get profile of user who added the track
        const profile = await spotify.users.profile(item.added_by.id);

        // convert datetimes to unix timestamps
        const added_at = new Date(item.added_at).valueOf();
        const release_date = new Date(item.track.album.release_date).valueOf();

        const embed: Partial<Embed> = {
            title: item.track.name,
            description: `**[${item.track.album.name}](${item.track.album.external_urls.spotify})**`,
            color: 0x1DB954,
            url: item.track.external_urls.spotify,
            image: {
                url: item.track.album.images[0].url
            },
            fields: [
                {
                    name: "Artists",
                    value: item.track.artists.map(artist => `[${artist.name}](${artist.external_urls.spotify})`).join(", ")
                },
                {
                    name: "Release date",
                    value: `<t:${Math.floor(release_date / 1000)}:D>`
                },
                {
                    name: "Added at",
                    value: `<t:${Math.floor(added_at / 1000)}:F>`
                }
            ],
            author: {
                name: `Added by ${profile.display_name}`,
                url: profile.external_urls.spotify,
                iconURL: profile.images[0].url
            },
            footer: {
                text: `Track ${effective_index + 1}/${total_tracks}`
            }
        };

        await interaction.editReply({ embeds: [embed] });
    }
} as DiscordCommand;

// TODO: filters e.g. artist, who added, release date range, etc.
