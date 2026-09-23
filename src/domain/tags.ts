import { TAG_PALETTE, type SessionRecord, type Tag } from './types'

export const liveTags = (tags: Tag[]): Tag[] => tags.filter(tag => !tag.deletedAt)

/** Case-insensitive duplicate check among live tags. */
export const findDuplicate = (tags: Tag[], name: string, exceptId?: string): Tag | undefined => {
  const wanted = name.trim().toLowerCase()
  return liveTags(tags).find(tag => tag.id !== exceptId && tag.name.trim().toLowerCase() === wanted)
}

export const duplicateMessage = (name: string) => `You already have a tag called “${name.trim()}”`

/** New tags cycle through the palette. */
export const nextTagColor = (tags: Tag[]): string => TAG_PALETTE[liveTags(tags).length % TAG_PALETTE.length]

/** Stored tags from before colours existed get one by position. */
export const withColors = (tags: Tag[]): Tag[] =>
  tags.map((tag, i) => tag.color ? tag : { ...tag, color: TAG_PALETTE[i % TAG_PALETTE.length] })

/** Drop a purged tag's id from a record; its time stays, now untagged. */
export const stripTag = (session: SessionRecord, tagId: string): SessionRecord => ({
  ...session,
  tagIds: session.tagIds.filter(id => id !== tagId),
  segments: (session.segments ?? []).map(seg => ({ ...seg, tagIds: seg.tagIds.filter(id => id !== tagId) })),
})
