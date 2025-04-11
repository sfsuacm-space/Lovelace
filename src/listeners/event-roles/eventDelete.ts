/**
 * @file OnEventDelete.ts
 * @description Listener for handling Discord scheduled event deletion.
 * Performs cleanup for deleted events including role removal and database cleanup.
 */

import { Listener, container } from '@sapphire/framework';
import { Events, GuildScheduledEvent } from 'discord.js';
import { yellow, cyan } from 'colorette';

/**
 * Listener that handles the deletion of Discord scheduled events.
 * Performs cleanup tasks including:
 * - Clearing the enrollment queue for the event
 * - Deleting the associated role
 * - Removing the database entry
 */
export class OnEventDelete extends Listener {
	/**
	 * Creates a new OnEventDelete listener
	 * @param context - The loader context
	 * @param options - The listener options
	 */
	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			event: Events.GuildScheduledEventDelete,
		});
	}

	/**
	 * Handles the scheduled event deletion
	 * Cleans up resources associated with the deleted event
	 * @param scheduledEvent - The deleted scheduled event
	 */
	public override async run(scheduledEvent: GuildScheduledEvent) {
		const { client, database, customRoleQueue } = container;
		try {
			if (!scheduledEvent.guild) {
				return client.logger.error(
					`Failed to find guild from scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
					'\nCannot proceed with deleting event role',
				);
			}
			customRoleQueue.clearEventQueue(scheduledEvent);
			const dbEvent = await database.findScheduledEvent(scheduledEvent.id);
			if (!dbEvent) {
				return client.logger.error(
					`Failed to find a database entry for ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}]`,
					'\nCannot proceed with deleting the associated role and database entry.',
				);
			}
			const role = await scheduledEvent.guild.roles.fetch(dbEvent.roleId);
			// A role may not exist prior to the bot deleting the event (role was manually deleted)
			// Delete the role if found, otherwise log that the role is missing and proceed to
			// delete the database entry
			if (!role) {
				client.logger.error(
					`Failed to find role associated with scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}]. Attempting to delete corresponding database entry.`,
				);
			} else {
				await role
					.delete(
						`Deleted role associated with scheduled event ${scheduledEvent.name} that has ended.`,
					)
					.then((role) =>
						client.logger.info(
							`Deleted role ${yellow(role.name)} associated with scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
						),
					)
					.catch((error) =>
						client.logger.error(
							`Failed to delete role ${yellow(role.name)} associated with scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
							error,
						),
					);
			}
			const deleteResult = await database.deleteScheduledEvent(
				scheduledEvent.id,
			);
			// Schema eventId column contains unique values only, so deleting should affect
			// only 1 or 0 rows
			if (deleteResult.affectedRows > 0) {
				client.logger.info(
					`Deleted database entry for scheduled event ${yellow(scheduledEvent.name)}`,
				);
			} else {
				client.logger.error(
					`Failed to find a database entry for scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}]`,
				);
			}
		} catch (error) {
			return client.logger.error(error);
		}
	}
}
