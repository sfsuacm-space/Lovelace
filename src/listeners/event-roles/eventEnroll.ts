/**
 * @file OnEventEnroll.ts
 * @description Listener for handling users joining Discord scheduled events.
 * Queues users for role assignment when they join an event.
 */

import { Listener, container } from '@sapphire/framework';
import { Events, GuildScheduledEvent, User } from 'discord.js';
import { yellow, cyan } from 'colorette';

/**
 * Listener that handles users joining Discord scheduled events.
 * Forwards user enrollment to the custom role assignment queue for processing.
 */
export class OnEventEnroll extends Listener {
	/**
	 * Creates a new OnEventEnroll listener
	 * @param context - The loader context
	 * @param options - The listener options
	 */
	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			event: Events.GuildScheduledEventUserAdd,
		});
	}

	/**
	 * Handles a user joining a scheduled event
	 * Adds the user to the custom role assignment queue
	 * @param scheduledEvent - The scheduled event the user joined
	 * @param user - The user who joined the event
	 */
	public override async run(scheduledEvent: GuildScheduledEvent, user: User) {
		// Most of the logic in here has been moved to the custom role assignment queue
		const { client, customRoleQueue } = container;
		if (!scheduledEvent.guild) {
			return client.logger.error(
				`Failed to find guild from scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
				'Cannot proceed with assigning event role.',
			);
		}
		if (!user) {
			return client.logger.error(
				`Failed to find user enrolling into scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
				'Cannot proceed with assigning event role.',
			);
		}

		// Scheduled event author custom role assignment is handled during event creation
		if (scheduledEvent.creator !== user)
			customRoleQueue.queueAssignment(scheduledEvent, user);
	}
}
