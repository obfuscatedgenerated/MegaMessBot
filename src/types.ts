import type { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder, SlashCommandSubcommandBuilder, ButtonInteraction } from "discord.js";

export interface DiscordCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction | ButtonInteraction) => Promise<void>;
    autocomplete?: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface DiscordSubcommand {
    data: SlashCommandSubcommandBuilder;
    execute: (interaction: ChatInputCommandInteraction | ButtonInteraction) => Promise<void>;
    autocomplete?: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
