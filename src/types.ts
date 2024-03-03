import type { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder, SlashCommandSubcommandBuilder, ButtonInteraction, AutocompleteInteraction } from "discord.js";

export type ExecutableInteraction = ChatInputCommandInteraction | ButtonInteraction;

export interface DiscordCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ExecutableInteraction) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface DiscordSubcommand {
    data: SlashCommandSubcommandBuilder;
    execute: (interaction: ExecutableInteraction) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
