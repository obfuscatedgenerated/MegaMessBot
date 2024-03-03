import type { DiscordCommand } from "../types";
import { Embed, SlashCommandBuilder } from "discord.js";

import { get_spotify_sdk } from "..";
import * as user_cache from "../user_cache";

import Fuse from "fuse.js";

// TODO: could use registration system and just use mentionable as the type
export default {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Gets information about a user collaborating on the playlist.")
        .addStringOption(option => option.setName("user_id")
            .setDescription("The user to get information about.")
            .setRequired(true)
            .setAutocomplete(true)),

    execute: async (interaction) => {
        if (!interaction.isCommand()) {
            return;
        }

        await interaction.deferReply();

        const spotify = get_spotify_sdk();

        await interaction.editReply({ content: `This command is not yet implemented. You passed user ${interaction.options.getString("user_id", true)}.` });
    },

    autocomplete: async (interaction) => {
        // ensure the user value is the focus
        if (interaction.options.getFocused(true).name !== "user_id") {
            return;
        }

        const spotify = get_spotify_sdk();

        if (user_cache.is_analysis_in_progress()) {
            console.warn("Analysis in progress, delaying user info autocomplete.");
            await interaction.respond([{ name: "The playlist is being analysed. Try again in a few seconds.", value: "" }]);
            return;
        }

        if (await user_cache.is_analysis_due(spotify)) {
            console.warn("Analysis due, delaying user info autocomplete.");
            await interaction.respond([{ name: "The playlist needs to be analysed. Try again in a few seconds.", value: "" }]);
            await user_cache.analyse(spotify, true);
            return;
        }

        const input = interaction.options.getString("user_id", true);

        const users = Array.from(user_cache.list());
        const results: { name: string, value: string }[] = [];

        const fuse = new Fuse(users, {
            keys: ["display_name"]
        });

        // TODO: debounce/ratelimit

        const matches = fuse.search(input, { limit: 25 });
        // TODO: skip search if no input to browse all users
        // TODO: show if truncation occurred

        for (const match of matches) {
            const user = match.item;

            // if there is already a matching display name, make it clear that there are multiple
            // do this by adding the user ID to the end of the display name in brackets
            // make sure to do this to the old one as well

            const existing = results.find(m => {
                // TODO: less resource intensive and smarter way to do this (that wont get tricked by brackets in the original name)
                // use regex to match the id in brackets at the end of the name
                const name_without_id = m.name.replace(/\s\((.+)\)$/, "");
                return name_without_id === user.display_name;
            });

            if (existing) {
                existing.name += ` (${user.id})`;
                results.push({ name: user.display_name + ` (${existing.value})`, value: existing.value });
            } else {
                results.push({ name: user.display_name, value: user.id });
            }
        }

        await interaction.respond(results);
    }
} as DiscordCommand;

// TODO: we can reuse this for user filtering in listbrowse! put this in its own module
// TODO: leaderboard of user contributions
