import { Hono } from 'hono'
import {
  createVerifyAppKeyWithHub,
  ParseWebhookEvent,
  parseWebhookEvent,
} from "@farcaster/frame-node";
import {
  deleteUserNotificationDetails,
  setUserNotificationDetails,
} from './lib/kv'
import { sendFrameNotification } from './lib/notifs'

type Bindings = {
  EVENT_STORE: KVNamespace;
  NEYNAR_API_KEY: string;
}

const app = new Hono<{ Bindings: Bindings }>()

app.post('/webhook', async (c) => {
  const requestJson = await c.req.json();

  let data;
  try {
    const verifier = createVerifyAppKeyWithHub('https://hub-api.neynar.com', {
      headers: {
        'x-api-key': c.env.NEYNAR_API_KEY,
      },
    })
    data = await parseWebhookEvent(requestJson, verifier);
    console.log(data)
  } catch (e: unknown) {
    const error = e as ParseWebhookEvent.ErrorType;
    console.log(error)

    switch (error.name) {
      case "VerifyJsonFarcasterSignature.InvalidDataError":
      case "VerifyJsonFarcasterSignature.InvalidEventDataError":
        return c.json(
          { success: false, error: error.message },
          400
        );
      case "VerifyJsonFarcasterSignature.InvalidAppKeyError":
        return c.json(
          { success: false, error: error.message },
          401
        );
      case "VerifyJsonFarcasterSignature.VerifyAppKeyError":
        return c.json(
          { success: false, error: error.message },
          500
        );
    }
  }

  const fid = data.fid;
  const event = data.event;

  switch (event.event) {
    case "frame_added":
      if (event.notificationDetails) {
        await setUserNotificationDetails(c, fid, event.notificationDetails);
        await sendFrameNotification({
          c,
          fid,
          title: "Pinata Blog",
          body: "You are now subscribed for notifications!",
          slug: "the-gdp-of-ipfs-measuring-the-economic-impact-of-decentralized-storage"
        });
      } else {
        await deleteUserNotificationDetails(c, fid);
      }
      break;

    case "frame_removed":
      await deleteUserNotificationDetails(c, fid);
      break;

    case "notifications_enabled":
      await setUserNotificationDetails(c, fid, event.notificationDetails);
      await sendFrameNotification({
        c,
        fid,
        title: "Pinata Blog",
        body: "Notifications are now enabled!",
      });
      break;

    case "notifications_disabled":
      await deleteUserNotificationDetails(c, fid);
      break;
  }

  return c.json({ success: true });
})

export default app
