import { z } from 'zod';
const responseSchema = z.object({
  id: z.uuid(),
  status: z.enum(['pending', 'submitted']),
  story: z
    .object({
      id: z.string().regex(/^\d{14}_wish-[a-f0-9-]{36}$/),
      slug: z.string(),
      path: z.string(),
    })
    .nullable(),
});
export type WishResponse = z.infer<typeof responseSchema>;
export async function sendWish(requestId: string, text: string): Promise<WishResponse> {
  const response = await fetch(import.meta.env.VITE_WISH_API_URL || '/api/wishes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, text }),
    signal: AbortSignal.timeout(30000),
  });
  if (![200, 201, 202].includes(response.status))
    throw new Error('Submission was not confirmed. Your text is saved; please retry.');
  const result = responseSchema.parse(await response.json());
  if (
    result.id !== requestId ||
    (result.status === 'submitted') !== Boolean(result.story) ||
    (result.status === 'pending') !== (response.status === 202) ||
    (result.story &&
      (result.story.slug !== `wish-${requestId}` ||
        !result.story.id.endsWith(`_wish-${requestId}`)))
  ) {
    throw new Error('Invalid Wish confirmation');
  }
  return result;
}
