/**
 * @file eventInit.ts
 * @description Listener for processing scheduled events are not already in the database.
 * This is mostly scheduled events made while the bot was offline.
 * Initializes scheduled events processing on bot startup.
 */

import { Listener, container } from '@sapphire/framework';
import { Events } from 'discord.js';

/**
 * Listener that handles the Discord client ready event.
 * When the bot starts up, this fetches all scheduled events for the configured guild
 * and processes them through the scheduledEventsService.
 */
export class OnClientReady extends Listener {
	/**
	 * Creates a new OnClientReady listener
	 * @param context - The loader context
	 * @param options - The listener options
	 */
	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			event: Events.ClientReady,
		});
	}

	/**
	 * Handles the client ready event
	 * Fetches all scheduled events from the configured guild and processes them in batch
	 */
	public override async run() {
		const { client, scheduledEventsService } = container;
		// TODO: This is one of the rare occasions where we hard code the bot to
		// only work for the ACM blue Discord server. Ideally we'd make this more
		// dynamic but that requires more planning than I'm willing to do alone
		// right now.
		const acmguild = await client.guilds.fetch(`${process.env.GUILD}`);
		const events = await acmguild.scheduledEvents.fetch();
		await scheduledEventsService.batchProcessEvents(events);
	}
}
