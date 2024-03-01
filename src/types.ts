import type { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandSubcommandsOnlyBuilder, SlashCommandSubcommandBuilder, ButtonInteraction } from "discord.js";

export interface DiscordCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction | ButtonInteraction) => Promise<void>;
}

export interface DiscordPureSubcommand {
    data: SlashCommandSubcommandBuilder;
    execute: (interaction: ChatInputCommandInteraction | ButtonInteraction) => Promise<void>;
}
