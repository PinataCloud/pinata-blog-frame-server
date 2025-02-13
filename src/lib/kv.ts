import { FrameNotificationDetails } from "@farcaster/frame-sdk";
import { Context } from "hono";

function getUserNotificationDetailsKey(fid: number): string {
  return `pinata-blog-frame:user:${fid}`;
}

export async function getUserNotificationDetails(
  c: Context,
  fid: number
): Promise<FrameNotificationDetails | null> {
  const data = await c.env.EVENT_STORE.get(
    getUserNotificationDetailsKey(fid),
    { type: 'json' }
  );
  return data as FrameNotificationDetails | null
}

export async function setUserNotificationDetails(
  c: Context, // Add context parameter
  fid: number,
  notificationDetails: FrameNotificationDetails
): Promise<void> {
  await c.env.EVENT_STORE.put(
    getUserNotificationDetailsKey(fid),
    JSON.stringify(notificationDetails) // Convert to string for storage
  );
}

export async function deleteUserNotificationDetails(
  c: Context, // Add context parameter
  fid: number
): Promise<void> {
  await c.env.EVENT_STORE.delete(getUserNotificationDetailsKey(fid));
}
