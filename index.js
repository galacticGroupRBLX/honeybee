const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Collection to store commands
client.commands = new Collection();
const commands = [];
const commandFolders = fs.readdirSync('./commands');

// Load commands from subfolders
for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${folder}/${file}`);
        // Add command to the collection
        client.commands.set(command.data.name, command);
        // Push the command's JSON data for deployment
        commands.push(command.data.toJSON());
    }
}

// Deploy commands to Discord
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        if (process.env.GUILD_ID) {
            // For a specific guild (for testing/development)
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`Successfully reloaded guild-specific commands for guild ID: ${process.env.GUILD_ID}.`);
        } else {
            // For global commands
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log('Successfully reloaded global commands.');
        }
    } catch (error) {
        console.error(error);
    }
})();

// When the client is ready, run this code
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Handle interactions
client.on('interactionCreate', async interaction => {
    // Check if the interaction is a command
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        // Check if commands are locked
        if (client.lockData?.locked) {
            // Check if the user is the allowed user
            if (interaction.user.id !== client.lockData.allowedUserId) {
                return interaction.reply({
                    content: 'Commands are currently locked. You do not have permission to use commands.',
                    ephemeral: true
                });
            }
        }

        try {
            // Check for permissions or specific conditions before executing commands
            if (interaction.commandName === 'ban' || interaction.commandName === 'banhack' || interaction.commandName === 'searchban') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                    return interaction.reply({
                        content: 'You do not have permission to use this command.',
                        ephemeral: true
                    });
                }
            } else if (interaction.commandName === 'kick') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
                    return interaction.reply({
                        content: 'You do not have permission to use this command.',
                        ephemeral: true
                    });
                }
            }

            await command.execute(interaction);
        } catch (error) {
            console.error('Error executing command:', error);
            await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
        }
    } else if (interaction.isStringSelectMenu()) {
        // Handle select menu interactions
        if (interaction.customId === 'select_ban') {
            const { handleSelectMenu } = require('./commands/moderation/searchban.js');
            await handleSelectMenu(interaction);
        } else if (interaction.customId === 'invite_reason') {
            const { handleSelectMenu } = require('./commands/utility/guildinvite.js');
            await handleSelectMenu(interaction);
        }
    } else if (interaction.isModalSubmit()) {
        // Handle modal submit interactions
        if (interaction.customId === 'feedback_modal') {
            const { handleModalSubmit } = require('./commands/management/feedback.js');
            await handleModalSubmit(interaction);
        } else if (interaction.customId === 'invite_duration_modal') {
            const { handleModalSubmit } = require('./commands/utility/guildinvite.js');
            await handleModalSubmit(interaction);
    }
}
});

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Login to Discord with your app's token
client.login(process.env.TOKEN);
