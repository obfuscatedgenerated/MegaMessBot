import "source-map-support/register";
import "dotenv/config";

import { Client, Collection, Interaction, Partials, Routes } from "discord.js";
import { DiscordRateLimit } from "./rate_limit";

import { DiscordCommand } from "./types";

import { ErrorEmbedWithLogging } from "./embeds/error";
import { RateLimitEmbed } from "./embeds/deny";

import { SpotifyApi } from "@spotify/web-api-ts-sdk";

import { join as path_join } from "path";
import * as fs from "fs";

const default_rate_limit = new DiscordRateLimit(6, 5000); // 6 per 5 seconds

if (!process.env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN not set");
}

console.log("Loading commands...");

const command_dir = path_join(__dirname, "cmd");
const command_files = fs.readdirSync(command_dir).filter(file => file.endsWith(".js"));

const commands = new Collection<string, DiscordCommand>();

for (const file of command_files) {
    console.log(`Loading command ${file}...`);

    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const command = require(path_join(command_dir, file)).default;

    if (!command) {
        throw new Error(`Command ${file} does not export a default export.`);
    }

    if (!command.data) {
        throw new Error(`Command ${file} does not have a data field.`);
    }

    if (!command.execute) {
        throw new Error(`Command ${file} does not have an execute function.`);
    }

    if (commands.has(command.data.name)) {
        throw new Error(`Command ${file} has a duplicate name.`);
    }

    commands.set(command.data.name, command);
}

console.log("Commands loaded.");


console.log("Initialising Spotify API client...");

const spotify = SpotifyApi.withClientCredentials(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET);

export const get_spotify_sdk = () => {
    if (!spotify) {
        throw new Error("Spotify API client is not initialised");
    }

    return spotify;
};

console.log("Spotify API client initialised.");

console.log("Initialising Discord client...");

const client = new Client({ intents: [], partials: [ Partials.Channel ] });

// must only be called when the client is ready
export const get_client = () => {
    if (!client) {
        throw new Error("Discord client is not initialised");
    }

    if (!client.isReady()) {
        throw new Error("Discord client is not ready");
    }

    return client;
};


// commented out as it will be an integration, not a bot
// uncomment if bot is required later on
// TODO: look at converting to http interaction endpoint as server
//const update_activity = () => {
//    client.user.setActivity("your musical mess!", { type: ActivityType.Listening });
//};

client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    //    update_activity();
    //    setInterval(update_activity, 15000);
});

client.on("interactionCreate", async (interaction: Interaction) => {
    // TODO: component specific rate limit
    if (interaction.isButton()) {
        // assumes original reply is being edited. new replies each time will break it.
        // could also use string splitting from custom id but thats a bit hacky
        const command = commands.get(interaction.message.interaction?.commandName);

        if (!command) {
            throw new Error(`Command ${interaction.message.interaction?.commandName} not found from interaction.`);
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            const reply_content = { embeds: [new ErrorEmbedWithLogging(error)] };

            if (!interaction.deferred && !interaction.replied) {
                interaction.reply(reply_content);
            } else {
                interaction.editReply(reply_content);
            }
        }
    } else if (interaction.isChatInputCommand()) {
        const command = commands.get(interaction.commandName);

        if (!command) {
            return;
        }

        if (!default_rate_limit.check(interaction.user.id)) {
            interaction.reply({ embeds: [new RateLimitEmbed()] });
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            const reply_content = { embeds: [new ErrorEmbedWithLogging(error)] };

            if (!interaction.deferred && !interaction.replied) {
                interaction.reply(reply_content);
            } else {
                interaction.editReply(reply_content);
            }
        }
    }
});


interface RegisteredCommand {
    name: string;
    description: string;
    options?: {
        name: string;
        description: string;
        type: number;
        required?: boolean;
        choices?: { name: string; value: string }[];
    }[];
    id: string;
}

client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log("Discord client initialised.");

    console.log("Deploying commands...");

    const deploy_cmds = async () => {
        // detect changed commands
        const uploaded_commands = await client.rest.get(Routes.applicationCommands(client.user.id)) as RegisteredCommand[];
        const uploaded_command_names = uploaded_commands.map(command => command.name);

        const local_command_names = commands.map(command => command.data.name);

        console.log(`Uploaded commands: ${uploaded_command_names}`);
        console.log(`Local commands: ${local_command_names}`);

        const command_ids_to_delete: string[] = [];
        const commands_to_update: DiscordCommand[] = [];
        const commands_to_create: DiscordCommand[] = [];

        for (const command of uploaded_commands) {
            // delete any commands that no longer exist locally
            if (!local_command_names.includes(command.name)) {
                command_ids_to_delete.push(command.id);
            }
        }

        for (const command_name of local_command_names) {
            const command = commands.get(command_name);

            // replace existing commands with updated versions, or create new commands
            if (uploaded_command_names.includes(command_name)) {
                commands_to_update.push(command);
            } else {
                commands_to_create.push(command);
            }
        }

        if (command_ids_to_delete.length > 0) {
            console.log(`Deleting ${command_ids_to_delete.length} commands...`);

            for (const command of command_ids_to_delete) {
                console.log(`Deleting command with id ${command}...`);
                await client.rest.delete(Routes.applicationCommand(client.user.id, command));
            }

            console.log("Commands deleted.");
        }

        if (commands_to_update.length > 0) {
            console.log(`Updating ${commands_to_update.length} commands...`);

            for (const command of commands_to_update.values()) {
                console.log(`Updating command ${command.data.name}...`);
                await client.rest.patch(Routes.applicationCommand(client.user.id, uploaded_commands.find(uploaded_command => uploaded_command.name === command.data.name).id), { body: command.data.toJSON() });
            }

            console.log("Commands updated.");
        }

        if (commands_to_create.length > 0) {
            console.log(`Creating ${commands_to_create.length} commands...`);

            for (const command of commands_to_create.values()) {
                console.log(`Creating command ${command.data.name}...`);
                await client.rest.post(Routes.applicationCommands(client.user.id), { body: command.data.toJSON() });
            }

            console.log("Commands created.");
        }
    };

    deploy_cmds().then(() => {
        console.log("Commands deployed.");
    }).catch((e) => {
        console.error("Failed to deploy commands.");
        console.error(e);
    });
}).catch((e) => {
    console.error("Failed to initialise Discord client.");
    console.error(e);
});


//let exiting = false;
//const exit_handler = () => {
//    if (exiting) {
//        return;
//    }
//
//    exiting = true;
//
//    console.log("Logging out of Discord client...");
//    client.destroy();
//    console.log("Logged out of Discord client.");
//
//    console.log("Exiting...");
//    process.exit();
//};
//
//process.on("exit", exit_handler);
//process.on("SIGINT", exit_handler);
//process.on("SIGTERM", exit_handler);
//process.on("SIGTERM", exit_handler);
//process.on("SIGUSR1", exit_handler);
//process.on("SIGUSR2", exit_handler);
//process.on("uncaughtException", exit_handler);
//process.on("unhandledRejection", exit_handler);
//
//process.on("message", (message) => {
//    if (message === "shutdown") {
//        exit_handler();
//    }
//});
// not working currently, and disrupting error logging. disable for now.

// TODO: separate command registration, client setup, etc into separate files
// TODO: support deploying "debug mode" commands to only the test server

// this was copied from virtualstockexchange as a starter template, might be bit outdated!

// TODO music quiz from spotify preview, make it a bot mode
// TODO minimal music quiz using song info only
