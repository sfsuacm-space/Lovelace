/**
 * @file CustomRoleQueue.ts
 * @description Queue system for processing custom role assignments for Discord scheduled event.
 * Prevents race conditions with the database by handling role assignments asynchronously.
 */

import { container } from '@sapphire/framework';
import { cyan, yellow } from 'colorette';
import { GuildScheduledEvent, User } from 'discord.js';

/**
 * Properties for items in the event queue
 */
type customRoleQueuesProp = {
	scheduledEvent: GuildScheduledEvent;
	user: User;
	attempts: number;
	maxAttempts: number;
};

/**
 * This queue processes the assignment of custom roles to people
 * that enrolled into a Discord scheduled event. We use this queue
 * to prevent race conditions with the database by handling role
 * assignments asynchronously.
 */
export class CustomRoleQueue {
	/**
	 * Map of event queues, keyed by event ID
	 */
	private eventQueues: Map<string, customRoleQueuesProp[]> = new Map();

	/**
	 * Flag indicating whether queue processing is currently active
	 */
	private processing: boolean = false;

	/**
	 * Interval in milliseconds between queue processing attempts
	 */
	private readonly processInterval: number = 10000;

	/**
	 * Creates a new custom role assignment queue and starts the processing interval
	 * @constructor
	 */
	constructor() {
		setInterval(() => this.processQueues(), this.processInterval);
	}

	/**
	 * Adds a user to the role assignment queue
	 * @param scheduledEvent - The Discord scheduled event
	 * @param user - The user to be assigned a role
	 */
	public queueAssignment(scheduledEvent: GuildScheduledEvent, user: User) {
		const eventId = scheduledEvent.id;
		if (!this.eventQueues.has(eventId)) {
			this.eventQueues.set(eventId, []);
		}

		this.eventQueues.get(eventId)?.push({
			scheduledEvent,
			user,
			attempts: 0,
			maxAttempts: 5,
		});
		container.client.logger.info(
			`Queued enrollment for user ${yellow(user.username)}[${cyan(user.id)}] for scheduled event ${yellow(scheduledEvent.name)}[${cyan(eventId)}]`,
		);
	}

	/**
	 * Manually triggers the role assignment queue process if one isn't
	 * already running.
	 */
	public markEventReady() {
		this.processQueues();
	}

	/**
	 * Removes a user from the role assignment queue
	 * @param scheduledEvent - The Discord scheduled event
	 * @param user - The user to be removed from the queue
	 */
	public removeAssignment(scheduledEvent: GuildScheduledEvent, user: User) {
		if (!this.eventQueues.has(scheduledEvent.id)) return;

		const queue = this.eventQueues.get(scheduledEvent.id);
		if (!queue) return;

		const index = queue.findIndex((item) => item.user.id === user.id);
		if (index !== -1) {
			queue.slice(index, 1);
			container.client.logger.info(
				`Removed pending user ${yellow(user.username)}[${cyan(user.id)}] from the role assignment queue for scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}]`,
			);
			// Delete the event from queue if no one else needs a role
			if (queue.length === 0) {
				this.eventQueues.delete(scheduledEvent.id);
			}
		}
	}

	/**
	 * Clears all pending users for a specific event in the role assignment queue
	 * @param scheduledEvent - The Discord scheduled event to clear role assignments for
	 */
	public clearEventQueue(scheduledEvent: GuildScheduledEvent) {
		if (this.eventQueues.has(scheduledEvent.id)) {
			const count = this.eventQueues.get(scheduledEvent.id)?.length || 0;
			this.eventQueues.delete(scheduledEvent.id);
			container.logger.info(
				`Cleared ${count} pending enrollments for scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}]`,
			);
		} else {
			// processQueues() deletes empty queues, so a queue may not exist for a scheduled
			// event until someone is queued up for a role
			container.logger.info(
				`There wasn't an custom role assignment queue for scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}]`,
			);
		}
	}

	/**
	 * Processes all queued enrollments
	 * @private
	 * @async
	 */
	private async processQueues() {
		if (this.processing) return;
		this.processing = true;
		try {
			const { database, client } = container;
			for (const [eventId, queue] of this.eventQueues.entries()) {
				// delete empty queues
				if (queue.length === 0) {
					this.eventQueues.delete(eventId);
					continue;
				}
				const dbEvent = await database.findScheduledEvent(eventId);
				// DB entry for event not ready, log attempt and try again
				if (!dbEvent) {
					// Increment attempt and then skip the entry
					for (const item of queue) {
						item.attempts++;
						// Once max attempts is hit, log failure and remove from queue
						// TODO: Not the perfect solution, but removing from queue after hitting
						// max attempts will prevent contiuous queries to the database. However, we
						// need to record somewhere, other than the logs, who didn't get processed
						// for a role. At this current point, removing them from the queue
						// means they just never get the role.
						if (item.attempts >= item.maxAttempts) {
							client.logger.error(
								`Failed to assign a custom role to user ${yellow(item.user.username)}[${cyan(item.user.id)}] for scheduled event ${yellow(item.scheduledEvent.name)}[${cyan(item.scheduledEvent.id)}]`,
								`\nRemoving ${yellow(item.user.username)}[${cyan(item.user.id)}] from custom role assignment queue`,
							);
							const index = queue.indexOf(item);
							if (index > -1) queue.splice(index, 1);
						}
					}
					continue;
				}

				// Errors in finding the guild, role, or member does not increment
				// the attempts count.
				for (const item of queue) {
					const { scheduledEvent, user } = item;
					try {
						if (!scheduledEvent.guild) {
							client.logger.error(
								`Failed to find guild from scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
								'\nCannot proceed with custom role assignment for member.',
							);
							continue; // Skip item since it failed to find a guild
						}

						const role = await scheduledEvent.guild.roles.fetch(dbEvent.roleId);
						if (!role) {
							client.logger.error(
								`Failed to find role associated with scheduled event ${yellow(scheduledEvent.name)} \(${yellow(scheduledEvent.id)}\).`,
								'\nCannot proceed with custom role assignment for member.',
							);
							continue; // skip item since it failed to find role
						}

						const member = await scheduledEvent.guild.members.fetch(user.id);
						if (!member) {
							client.logger.error(
								`Failed to find member in guild (${yellow(scheduledEvent.guild.name)})[${cyan(scheduledEvent.guild.id)}] from user ${yellow(user.username)}[${cyan(user.id)}]`,
								'\nCannot proceed with custom role assignment for member.',
							);
							continue; // skip item since it failed to find member
						}

						await member.roles.add(role);
						client.logger.info(
							`Assigned role ${yellow(role.name)} to guild member ${yellow(member.displayName)}[${cyan(member.id)}].`,
							'Removing them from the custom role assignment queue.',
						);
						const index = queue.indexOf(item);
						if (index > -1) queue.splice(index, 1);
					} catch (error) {
						client.logger.error(error);
					}
				}
			}
		} catch (error) {
			container.client.logger.warn(
				'Failed to process a scheduled event in the custom role assignment queue.',
			);
			container.client.logger.error(error);
		} finally {
			this.processing = false;
		}
	}
}
