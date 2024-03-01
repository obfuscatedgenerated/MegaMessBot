import type { DiscordCommand } from "../types";
import { Embed, SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

import { get_spotify_sdk } from "..";

import { OutOfRangeEmbed } from "../embeds/error";

export const make_track_info_embed = async (effective_index: number, total_tracks: number, spotify: ReturnType<typeof get_spotify_sdk>) => {
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
            url: item.track.album.images[0]?.url
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
            iconURL: profile.images[0]?.url
        },
        footer: {
            text: `Track ${effective_index + 1}/${total_tracks}`
        }
    };

    return embed;
};

const index_subcommand_data = new SlashCommandSubcommandBuilder()
    .setName("index")
    .setDescription("Gets info about a song in the playlist at a specific index.")
    .addIntegerOption(option => option.setName("index")
        .setDescription("The index of the track in the playlist, starting from 1.")
        .setRequired(true)
        .setMinValue(1))
    .addBooleanOption(option => option.setName("reverse")
        .setDescription("Whether to reverse the playlist index, so 1 is the last song. Default: false.")
        .setRequired(false));

const random_subcommand_data = new SlashCommandSubcommandBuilder()
    .setName("random")
    .setDescription("Gets info about a random song in the playlist.");

// not using subcommand interface as behaviours are incredibly similar

export default {
    data: new SlashCommandBuilder()
        .setName("trackinfo")
        .setDescription("Gets info about a song in the playlist, either at a specific index or a random one.")
        .addSubcommand(index_subcommand_data)
        .addSubcommand(random_subcommand_data),

    execute: async (interaction) => {
        if (!interaction.isCommand()) {
            return;
        }

        await interaction.deferReply();

        const spotify = get_spotify_sdk();

        const total_tracks = (await spotify.playlists.getPlaylist(process.env.SPOTIFY_PLAYLIST_ID, null, "tracks(total)")).tracks.total;

        let effective_index: number;

        if (interaction.options.getSubcommand() === "index") {
            const index = interaction.options.getInteger("index", true);
            const reverse = interaction.options.getBoolean("reverse");

            if (index < 1 || index > total_tracks) {
                await interaction.editReply({ embeds: [new OutOfRangeEmbed("Index", 1, total_tracks)] });
                return;
            }

            if (reverse) {
                effective_index = total_tracks - index;
            } else {
                effective_index = index - 1;
            }
        } else {
            effective_index = Math.floor(Math.random() * total_tracks);
        }

        await interaction.editReply({ embeds: [await make_track_info_embed(effective_index, total_tracks, spotify)] });
    }
} as DiscordCommand;

// TODO: filters e.g. artist, who added, release date range, etc.
