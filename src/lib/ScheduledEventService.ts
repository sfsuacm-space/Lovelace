/**
 * @file ScheduleEventsService.ts
 * @description Service for processing Discord scheduled events.
 * Handles creating roles and database entries for scheduled events.
 */

import { container } from '@sapphire/framework';
import { GuildScheduledEvent, Role } from 'discord.js';
import { yellow, cyan } from 'colorette';
import { Timestamp } from '@sapphire/timestamp';
import { reasonableTruncate } from './utils';

/**
 * Service that processes Discord scheduled events.
 * Handles creation of custom roles and database entries for events,
 * as well as batch processing multiple events.
 */
export class ScheduleEventsService {
	/**
	 * Processes a single scheduled event, creating a custom role and database entry.
	 * @param scheduledEvent - The Discord scheduled event to process
	 * @returns A promise that resolves to true if processing was successful, false otherwise
	 */
	public async processEvent(
		scheduledEvent: GuildScheduledEvent,
	): Promise<boolean> {
		const { client, database } = container;
		try {
			if (!scheduledEvent.guild) {
				client.logger.error(
					`Failed to find guild from scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}].`,
					'\nCannot proceed with creating scheduled event role.',
				);
				return false;
			}
			const dbEntry = await database.findScheduledEvent(scheduledEvent.id);
			if (dbEntry) {
				client.logger.info(
					`Scheduled event ${yellow(scheduledEvent.name)} already exists in the database. Skipping processing in scheduled events service.`,
				);
				return true;
			}
			const role = await this.createCustomRole(scheduledEvent);
			if (!role) {
				client.logger.error(
					`Failed to create role associated with swith scheduled event ${yellow(scheduledEvent.name)}.`,
				);
				return false;
			}
			client.logger.info(
				`Created role ${yellow(role.name)} associated with scheduled event ${yellow(scheduledEvent.name)}.`,
			);
			const newDbEntry = await this.createEventDBEntry(scheduledEvent, role.id);
			if (!newDbEntry) {
				client.logger.error(
					`Failed to write scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}] into the database.`,
				);
				return false;
			}
			client.logger.info(
				`Wrote scheduled event ${yellow(scheduledEvent.name)}[${cyan(scheduledEvent.id)}] into the database.`,
				'Marked scheduled event ready for custom role assignment queue.',
			);
			return true;
		} catch (error) {
			client.logger.warn(
				'Failed to process a scheduled event in the scheduled events service.',
			);
			client.logger.error(error);
			return false;
		}
	}

	/**
	 * Processes multiple scheduled events in batch.
	 * @param events - Map of Discord scheduled events to process
	 * @returns A promise that resolves to a map of event IDs to success/failure status
	 */
	public async batchProcessEvents(
		events: Map<string, GuildScheduledEvent>,
	): Promise<Map<string, boolean>> {
		const { client } = container;
		const result = new Map<string, boolean>();
		for (const [id, event] of events) {
			try {
				const response = await this.processEvent(event);
				result.set(id, response);
			} catch (error) {
				client.logger.warn(
					`Failed to process a scheduled event ${yellow(event.name)}[${event.id}] in the scheduled events service.`,
				);
				client.logger.error(error);
				result.set(id, false);
			}
		}
		return result;
	}

	/**
	 * Creates a custom role for a scheduled event.
	 * @param scheduledEvent - The Discord scheduled event to create a role for
	 * @returns A promise that resolves to the created role, or undefined if creation failed
	 */
	private async createCustomRole(
		scheduledEvent: GuildScheduledEvent,
	): Promise<Role | undefined> {
		const startTime = scheduledEvent.scheduledStartTimestamp || new Date(0);
		const timestamp = new Timestamp('MMM-DD HH:mm');
		const role = await scheduledEvent.guild?.roles.create({
			name: `${reasonableTruncate(scheduledEvent.name)} [${timestamp.display(startTime)}]`,
			mentionable: true,
			reason: `Role for the scheduled event ${scheduledEvent.name}.`,
			permissions: [], // Empty permissions array indicates no additional permissions for role
		});
		return role;
	}

	/**
	 * Creates a database entry for a scheduled event and queues the event creator for role assignment.
	 * @param scheduledEvent - The Discord scheduled event to create a database entry for
	 * @param roleId - The ID of the role associated with the event
	 * @returns A promise that resolves to true if the database entry was created successfully, false otherwise
	 */
	private async createEventDBEntry(
		scheduledEvent: GuildScheduledEvent,
		roleId: string,
	): Promise<boolean> {
		const { database, customRoleQueue } = container;
		const response = await database.createScheduledEvent(
			scheduledEvent.id,
			roleId,
		);
		// Once db entry for event is created, mark it as ready in custom role assignment queue
		// for processing, then queue the event author.
		if (response.affectedRows > 0) {
			if (scheduledEvent.creator)
				customRoleQueue.queueAssignment(scheduledEvent, scheduledEvent.creator);
			customRoleQueue.markEventReady();
			return true;
		} else {
			return false;
		}
	}
}
