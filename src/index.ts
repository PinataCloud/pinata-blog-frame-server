import { Hono } from 'hono'
import {
  ParseWebhookEvent,
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/frame-node";
import {
  deleteUserNotificationDetails,
  setUserNotificationDetails,
} from './lib/kv'
import { sendFrameNotification } from './lib/notifs'

type Bindings = {
  EVENT_STORE: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.post('/webhook', async (c) => {
  const requestJson = await c.req.json();

  let data;
  try {
    data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
  } catch (e: unknown) {
    const error = e as ParseWebhookEvent.ErrorType;

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
          title: "Welcome to Frames v2",
          body: "Frame is now added to your client",
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
        title: "Ding ding ding",
        body: "Notifications are now enabled",
      });
      break;

    case "notifications_disabled":
      await deleteUserNotificationDetails(c, fid);
      break;
  }

  return c.json({ success: true });
})

export default app
