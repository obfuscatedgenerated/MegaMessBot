import type { DiscordCommand } from "../types";
import { Embed, SlashCommandBuilder } from "discord.js";

import { get_spotify_sdk } from "..";

// TODO: could use registration system and just use mentionable as the type
export default {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Gets information about a user collaborating on the playlist.")
        .addStringOption(option => option.setName("user")
            .setDescription("The user to get information about.")
            .setRequired(true)),

    execute: async (interaction) => {
        await interaction.deferReply();

        const spotify = get_spotify_sdk();
        const playlist = await spotify.playlists.getPlaylist(process.env.SPOTIFY_PLAYLIST_ID,
            null,
            "name,description,images(url),primary_color,external_urls.spotify,followers.total,owner.display_name,owner.external_urls.spotify,tracks.total"
        );

        const embed: Partial<Embed> = {
            title: playlist.name,
            description: playlist.description || "`No description.`",
            color: playlist.primary_color ? parseInt(playlist.primary_color, 16) : 0x1DB954,
            url: playlist.external_urls.spotify,
            image: {
                url: playlist.images[0]?.url,
            },
            fields: [
                {
                    name: "Tracks",
                    value: playlist.tracks.total.toString()
                },
                {
                    name: "Followers",
                    value: playlist.followers.total.toString()
                },
                {
                    name: "Owner",
                    value: `[${playlist.owner.display_name}](${playlist.owner.external_urls.spotify})`
                }
            ],
            footer: {
                text: "Data courtesy of Spotify",
                iconURL: "https://cdn.discordapp.com/emojis/1213623581490290688.webp"
            }
        };

        await interaction.editReply({ embeds: [embed] });
    }
} as DiscordCommand;
