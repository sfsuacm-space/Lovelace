import { Listener } from "@sapphire/framework";
import {GuildMember, TextChannel } from "discord.js";


export class GuildMemberAddGreeting extends Listener {
    public constructor(context: Listener.Context, options: Listener.Options) {
        super(context, {
            ...options,
            event: 'guildMemberAdd',  
            once: false
        });
    }

    public override async run(member: GuildMember) {
        //Only server ID needs to be changed when moving to ACM server
        await this.container.client.guilds.cache.get('1115435349171253360')!.systemChannel!.send(`Hi ${member.user}. Welcome to the ACM Discord Server!`);
    }
}


