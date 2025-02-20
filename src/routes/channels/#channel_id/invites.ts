import { Router, Request, Response } from "express";
import { HTTPError } from "lambert-server";

import { check } from "../../../util/instanceOf";
import { random } from "../../../util/RandomInviteID";
import { emitEvent } from "../../../util/Event";

import { InviteCreateSchema } from "../../../schema/Invite";

import { getPermission, ChannelModel, InviteModel, InviteCreateEvent } from "fosscord-server-util";

const router: Router = Router();

router.post("/", check(InviteCreateSchema), async (req: Request, res: Response) => {
	const usID = req.user_id;
	const chID = req.params.channel_id;
	const channel = await ChannelModel.findOne({ id: chID }).exec();

	if (!channel || !channel.guild_id) {
		throw new HTTPError("This channel doesn't exist", 404);
	}
	const { guild_id: guID } = channel;

	const permission = await getPermission(usID, guID);

	if (!permission.has("CREATE_INSTANT_INVITE")) {
		throw new HTTPError("You aren't authorised to access this endpoint", 401);
	}

	const invite = {
		code: random(),
		temporary: req.body.temporary,
		uses: 0,
		max_uses: req.body.max_uses,
		max_age: req.body.max_age,
		created_at: new Date(),
		guild_id: guID,
		channel_id: chID,
		inviter_id: usID,
	};

	await new InviteModel(invite).save();

	await emitEvent({ event: "INVITE_CREATE", data: invite } as InviteCreateEvent);
	res.status(201).send(invite);
});

router.get("/", async (req: Request, res: Response) => {
	const usID = req.user_id;
	const chID = req.params.channel_id;
	const channel = await ChannelModel.findOne({ id: chID }).exec();

	if (!channel || !channel.guild_id) {
		throw new HTTPError("This channel doesn't exist", 404);
	}
	const { guild_id: guID } = channel;
	const permission = await getPermission(usID, guID);

	if (!permission.has("MANAGE_CHANNELS")) {
		throw new HTTPError("You aren't authorised to access this endpoint", 401);
	}

	const invites = await InviteModel.find({ guild_id: guID }).lean().exec();
	res.status(200).send(invites);
});

export default router;
