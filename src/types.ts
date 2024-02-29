import type { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder, SlashCommandSubcommandBuilder } from "discord.js";

export interface DiscordCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface DiscordSubcommand {
    data: SlashCommandSubcommandBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}