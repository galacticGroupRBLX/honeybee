import { REST, Routes } from 'discord.js';
import { clientId, guildId, token } from './config.json' assert { type: 'json' };
import fs from 'fs';
import path from 'path';

const commands = [];
const commandFolders = fs.readdirSync('./commands');

for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = await import(`./commands/${folder}/${file}`);
        commands.push(command.data.toJSON());
    }
}

// Add DM commands from the dms folder
const dmCommandFiles = fs.readdirSync('./commands/dms').filter(file => file.endsWith('.js'));
for (const file of dmCommandFiles) {
    const command = await import(`./commands/dms/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
