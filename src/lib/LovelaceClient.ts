import { SapphireClient, container } from '@sapphire/framework';
import { ClientOptions } from 'discord.js';
import { LovelaceDB } from './LovelaceDB';
import { CustomRoleQueue } from './CustomRoleQueue';
import { ScheduleEventsService } from './ScheduledEventService';

/**
 * The base client for Lovelace that extends SapphireClient. The database connection is initialize and destroyed
 * with the client.
 */
export class LovelaceClient extends SapphireClient {
	/**
	 * Constructor to initialize a new instance of LovelaceClient
	 * @param {ClientOptions} options - the defined options for the Discord client, required by SapphireClient.
	 */
	constructor(options: ClientOptions) {
		super(options);
	}

	/**
	 * Establishes new websocket connection with Discord and creates a new database connection.
	 * Overrides the login function from SapphireClient.
	 * @param {string} [token] - the bot token.
	 * @returns {Promise<string>} - the token used to log in with.
	 */
	public override async login(token?: string): Promise<string> {
		container.database = await LovelaceDB.getInstance();
		container.customRoleQueue = new CustomRoleQueue();
		container.scheduledEventsService = new ScheduleEventsService();
		return super.login(token);
	}

	/**
	 * Logs out and terminates the connection to Discord and destroys the client.
	 * Overides SapphireClient's destroy function.
	 */
	public override async destroy(): Promise<void> {
		await LovelaceDB.destroy();
		return super.destroy();
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		database: LovelaceDB;
		customRoleQueue: CustomRoleQueue;
		scheduledEventsService: ScheduleEventsService;
	}
}
