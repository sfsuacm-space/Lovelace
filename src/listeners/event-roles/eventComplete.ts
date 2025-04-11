/**
 * @file OnEventComplete.ts
 * @description Listener for handling Discord scheduled events when they complete.
 * Manages cleanup of related roles and database entries.
 */

import { Listener, container } from '@sapphire/framework';
import { Events, GuildScheduledEvent } from 'discord.js';
import { yellow, cyan } from 'colorette';

/**
 * Listener that handles the completion of Discord scheduled events.
 * Performs cleanup tasks including:
 * - Clearing the custom role assignment queue
 * - Deleting the associated role
 * - Removing the database entry
 */
export class OnEventComplete extends Listener {
	/**
	 * Creates a new OnEventComplete listener
	 * @param context - The loader context
	 * @param options - The listener options
	 */
	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			event: Events.GuildScheduledEventUpdate,
		});
	}

	/**
	 * Handles the scheduled event update
	 * Only triggers cleanup actions when an event transitions to completed status
	 * @param _oldScheduleEvent - The previous state of the scheduled event
	 * @param newScheduledEvent - The current state of the scheduled event
	 */
	public override async run(
		_oldScheduleEvent: GuildScheduledEvent,
		newScheduledEvent: GuildScheduledEvent,
	) {
		if (!newScheduledEvent.isCompleted()) return;

		const { client, database, customRoleQueue } = container;

		try {
			if (!newScheduledEvent.guild) {
				return client.logger.error(
					`Failed to find guild from scheduled event ${yellow(newScheduledEvent.name)}[${cyan(newScheduledEvent.id)}].`,
					'\nCannot proceed with deleting event role nor database entry.',
				);
			}

			customRoleQueue.clearEventQueue(newScheduledEvent);
			const dbEvent = await database.findScheduledEvent(newScheduledEvent.id);
			if (!dbEvent) {
				client.logger.error(
					`Failed to find a database entry for ${yellow(newScheduledEvent.name)}[${cyan(newScheduledEvent.id)}\]`,
				);
			}
			const role = await newScheduledEvent.guild.roles.fetch(dbEvent.roleId);

			if (!role) {
				client.logger.error(
					`Failed to find role associated with scheduled event ${yellow(newScheduledEvent.name)}[${cyan(newScheduledEvent.id)}\]. Attempting to delete corresponding database entry.`,
				);
			} else {
				client.logger.info(
					`Deleted role ${yellow(role.name)} associated with ${yellow(newScheduledEvent.name)}`,
				);
				await role.delete(
					`Deleted role associated with scheduled event ${newScheduledEvent.name} that has ended.`,
				);
			}

			const deleteResult = await database.deleteScheduledEvent(
				newScheduledEvent.id,
			);
			// Schema eventId row contains unique values only, so deleting should affect
			// only 1 or 0 rows
			if (deleteResult.affectedRows > 0) {
				client.logger.info(
					`Deleted database entry for ${yellow(newScheduledEvent.name)}`,
				);
			} else {
				client.logger.warn(
					`Failed to delete database entry for ${yellow(newScheduledEvent.name)}[${cyan(newScheduledEvent.id)}\]`,
				);
			}
		} catch (error) {
			return client.logger.error(error);
		}
	}
}
