import type {
	ChatInputCommandSuccessPayload,
	Command,
	ContextMenuCommandSuccessPayload,
	MessageCommandSuccessPayload,
} from '@sapphire/framework';
import type {
	Collection,
	NonThreadGuildBasedChannel,
	Channel,
} from 'discord.js';
import { container } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { cyan } from 'colorette';
import { EmbedBuilder, Guild, Message, User, type APIUser } from 'discord.js';
import { RandomLoadingMessage } from './constants';

/**
 * Truncates a string to either the end of a specified number of words or a maximum length,
 * whichever comes first.
 *
 * @param text - The string to truncate
 * @param maxWords - The maximum number of words to include (default: 2)
 * @param maxLength - The maximum allowed length (default: 15, minimum: 1)
 * @returns The truncated string
 *
 * @example
 * // Returns "Hello World"
 * truncateToWordsOrMaxLength("Hello World Event Name");
 *
 * @example
 * // Returns "Hello World Event"
 * truncateToWordsOrMaxLength("Hello World Event Name", 3);
 *
 * @example
 * // Returns "SingleLongWord"
 * truncateToWordsOrMaxLength("SingleLongWordWithoutSpaces", 2, 15);
 *
 * @example
 * // Returns "Hello"
 * truncateToWordsOrMaxLength("Hello", 2, 15);
 */
export function reasonableTruncate(
	text: string,
	maxWords: number = 2,
	maxLength: number = 15,
): string {
	if (!text) return '';

	// If maxWords is less than 1, default to 1
	maxWords = Math.max(1, maxWords);

	const words = text.split(' ');

	// If there are fewer words than maxWords, just cap at maxLength
	if (words.length <= maxWords) {
		return text.length <= maxLength ? text : text.slice(0, maxLength);
	}

	// Find the position of the nth space
	let currentWordCount = 0;
	let currentPosition = -1;

	for (let i = 0; i < maxWords; i++) {
		currentPosition = text.indexOf(' ', currentPosition + 1);
		if (currentPosition === -1) break;
		currentWordCount++;
	}

	// If we didn't find enough spaces, cap at maxLength
	if (currentWordCount < maxWords - 1) {
		return text.length <= maxLength ? text : text.slice(0, maxLength);
	}

	// If the position of the last space exceeds maxLength, cap at maxLength
	if (currentPosition >= maxLength) {
		return text.slice(0, maxLength);
	}

	// Otherwise, truncate at the specified word count
	return text.slice(0, currentPosition);
}

/**
 * Finds a text channel based on a channel ID
 *
 * @param channelId Text channel ID
 */
export async function findTextChannel(
	channelId: string,
): Promise<Channel | null>;

/**
 * Finds text channels in a guild with a given name
 *
 * @param guild - The guild object to search through
 * @param channelName - The name of the channel to look for
 */
export async function findTextChannel(
	guild: Guild,
	channelName: string,
): Promise<Collection<string, NonThreadGuildBasedChannel | null>>;

export async function findTextChannel(
	guildOrId: Guild | string,
	channelName?: string,
): Promise<
	Channel | null | Collection<string, NonThreadGuildBasedChannel | null>
> {
	if (typeof guildOrId === 'string') {
		// First overload: Find by channel ID
		return container.client.channels.fetch(guildOrId);
	} else {
		// Second overload: Find by name in guild
		const channelManager = guildOrId.channels;
		const channels = await channelManager.fetch();
		return channels.filter((channel) => channel?.name === channelName);
	}
}

/**
 * Picks a random item from an array
 * @param array The array to pick a random item from
 * @example
 * // Returns 1
 * const randomEntry = pickRandom([1, 2, 3, 4])
 */
export function pickRandom<T>(array: readonly T[]): T {
	const { length } = array;
	return array[Math.floor(Math.random() * length)];
}

/**
 * Provides a random loading message
 * @returns A random loading message
 */
export function getLoadingMessage(): string {
	return pickRandom(RandomLoadingMessage);
}

/**
 * Sends a loading message to the current channel
 * @param message The message data for which to send the loading message
 */
export function sendLoadingMessage(message: Message): Promise<typeof message> {
	return send(message, {
		embeds: [
			new EmbedBuilder()
				.setDescription(pickRandom(RandomLoadingMessage))
				.setColor('#FF0000'),
		],
	});
}

export function logSuccessCommand(
	payload:
		| ContextMenuCommandSuccessPayload
		| ChatInputCommandSuccessPayload
		| MessageCommandSuccessPayload,
): void {
	let successLoggerData: ReturnType<typeof getSuccessLoggerData>;

	if ('interaction' in payload) {
		successLoggerData = getSuccessLoggerData(
			payload.interaction.guild,
			payload.interaction.user,
			payload.command,
		);
	} else {
		successLoggerData = getSuccessLoggerData(
			payload.message.guild,
			payload.message.author,
			payload.command,
		);
	}

	container.logger.debug(
		`${successLoggerData.shard} - ${successLoggerData.commandName} ${successLoggerData.author} ${successLoggerData.sentAt}`,
	);
}

export function getSuccessLoggerData(
	guild: Guild | null,
	user: User,
	command: Command,
) {
	const shard = getShardInfo(guild?.shardId ?? 0);
	const commandName = getCommandInfo(command);
	const author = getAuthorInfo(user);
	const sentAt = getGuildInfo(guild);

	return { shard, commandName, author, sentAt };
}

function getShardInfo(id: number) {
	return `[${cyan(id.toString())}]`;
}

function getCommandInfo(command: Command) {
	return cyan(command.name);
}

function getAuthorInfo(author: User | APIUser) {
	return `${author.username}[${cyan(author.id)}]`;
}

function getGuildInfo(guild: Guild | null) {
	if (guild === null) return 'Direct Messages';
	return `${guild.name}[${cyan(guild.id)}]`;
}
