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
import { verifyGhostSignature } from './lib/verify';

type Bindings = {
  EVENT_STORE: KVNamespace;
  NEYNAR_API_KEY: string;
  PINATA_JWT: string;
  GHOST_WEBHOOK_SECRET: string;
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
          title: "Welcome to the Pinata Blog!",
          body: "You are now subscribed for notifications when new posts are published!",
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

app.post('/new_post', async (c) => {
  try {
    const rawBody = await c.req.text();
    const signature = c.req.header('X-Ghost-Signature');

    if (!verifyGhostSignature(c, rawBody, signature)) {
      return c.json({ success: false, error: 'Invalid signature' }, 401);
    }

    const body = await c.req.json()
    const keysList = await c.env.EVENT_STORE.list()
    const fids = keysList.keys
      .map(key => {
        const match = key.name.match(/pinata-blog-frame:user:(\d+)/)
        return match ? parseInt(match[1]) : null
      })
      .filter((fid): fid is number => fid !== null)

    const notificationPromises = fids.map(fid =>
      sendFrameNotification({
        c,
        fid,
        title: `New Post: ${body.post.current.title}`,
        body: body.post.current.excerpt.length > 200
          ? body.post.current.excerpt.slice(0, 200) + '...'
          : body.post.current.excerpt,
        slug: body.post.current.slug
      })
    )

    await Promise.all(notificationPromises)

    return c.json({ success: true, notifiedUsers: fids.length })
  } catch (error) {
    console.error('Error in /new_post:', error)
    return c.json({ success: false, error: String(error) }, 500)
  }
})

export default app
