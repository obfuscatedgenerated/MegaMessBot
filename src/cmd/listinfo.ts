import type { DiscordCommand } from "../types";
import { Embed, SlashCommandBuilder } from "discord.js";

import { get_spotify_sdk } from "..";

export default {
    data: new SlashCommandBuilder()
        .setName("listinfo")
        .setDescription("Gets information about the playlist."),

    execute: async (interaction) => {
        await interaction.deferReply();

        const spotify = get_spotify_sdk();
        const playlist = await spotify.playlists.getPlaylist(process.env.SPOTIFY_PLAYLIST_ID, null, "name,description,images(url),primary_color,external_urls.spotify,followers.total,owner.display_name,owner.external_urls.spotify");

        const embed: Partial<Embed> = {
            title: playlist.name,
            description: playlist.description || "`No description.`",
            color: playlist.primary_color ? parseInt(playlist.primary_color, 16) : 0x1DB954,
            url: playlist.external_urls.spotify,
            image: {
                url: playlist.images[0].url
            },
            fields: [
                {
                    name: "Followers",
                    value: playlist.followers.total.toString()
                },
                {
                    name: "Owner",
                    value: `[${playlist.owner.display_name}](${playlist.owner.external_urls.spotify})`
                }
            ]
        };

        await interaction.editReply({ embeds: [embed] });
    }
} as DiscordCommand;
