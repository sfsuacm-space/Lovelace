/**
 * @file OnEventDrop.ts
 * @description Listener for handling users leaving Discord scheduled events.
 * Removes event-specific roles from users who leave an event.
 */

import { Listener, container } from '@sapphire/framework';
import { Events, GuildScheduledEvent, User } from 'discord.js';
import { yellow, cyan } from 'colorette';

/**
 * Listener that handles users leaving Discord scheduled events.
 * Performs cleanup tasks including:
 * - Removing the user from the custom role assignment queue
 * - Removing the event-specific role from the user
 */
export class OnEventDrop extends Listener {
	/**
	 * Creates a new OnEventDrop listener
	 * @param context - The loader context
	 * @param options - The listener options
	 */
	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			event: Events.GuildScheduledEventUserRemove,
		});
	}

	/**
	 * Handles a user leaving a scheduled event
	 * Removes the event role from the user and cleans up pending custom role assignments
	 * @param scheduledEvent - The scheduled event the user left
	 * @param user - The user who left the event
	 */
	public override async run(scheduledEvent: GuildScheduledEvent, user: User) {
		const { client, database, customRoleQueue } = container;
		try {
			if (!scheduledEvent.guild) {
				return client.logger.error(
					`Failed to find guild from scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
					'\nCannot proceed with removing event role from member.',
				);
			}

			if (!user) {
				return client.logger.error(
					`Failed to find user enrolling into scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
					'Cannot proceed with removing event role from member.',
				);
			}

			customRoleQueue.removeAssignment(scheduledEvent, user);
			const dbEvent = await database.findScheduledEvent(scheduledEvent.id);
			const role = await scheduledEvent.guild.roles.fetch(dbEvent.roleId);
			if (!role) {
				return client.logger.error(
					`Failed to find role associated with scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
					'\nCannot proceed with removing event role from member.',
				);
			}

			const member = await scheduledEvent.guild.members.fetch(user.id);
			if (!member) {
				return client.logger.error(
					`Failed to find user ${yellow(user.username)}[${cyan(user.id)}] as a member in guild ${yellow(scheduledEvent.guild.name)}[${cyan(scheduledEvent.guild.id)}].`,
					'\nCannot proceed with removing event role from member.',
				);
			}
			// Attempts to remove the role whether the member has it or not, no error regardless.
			// No use in checking first if no error is thrown, because that'd just be an additional call to Discord.
			await member.roles.remove(role);
			client.logger.info(
				`Removed role ${yellow(role.name)} from guild member ${yellow(member.displayName)}[${cyan(member.id)}]`,
			);
		} catch (error) {
			client.logger.error(error);
		}
	}
}
