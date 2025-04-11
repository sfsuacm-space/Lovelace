/**
 * @file OnEventCreate.ts
 * @description Listener for handling Discord scheduled event creation.
 * Creates associated roles and database entries for scheduled events.
 */

import { Listener, container } from '@sapphire/framework';
import { Events, GuildScheduledEvent } from 'discord.js';

/**
 * Listener that handles the creation of Discord scheduled events.
 * Performs setup tasks including:
 * - Creating an custom role associated with the event
 * - Creating a database entry to track the event and custom role
 * - Queue event author to get the custom role
 */
export class OnEventCreate extends Listener {
	/**
	 * Creates a new OnEventCreate listener
	 * @param context - The loader context
	 * @param options - The listener options
	 */
	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			event: Events.GuildScheduledEventCreate,
		});
	}

	/**
	 * Handles the scheduled event creation
	 * Creates a role for the event, records it in the database, and queues the event creator for enrollment
	 * @param scheduledEvent - The newly created scheduled event
	 */
	public override async run(scheduledEvent: GuildScheduledEvent) {
		const { client, scheduledEventsService } = container;

		client.logger.info(`New scheduled event created ${scheduledEvent.name}.`);
		return await scheduledEventsService.processEvent(scheduledEvent);
	}
}
