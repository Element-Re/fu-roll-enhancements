const thumbnailCache = new Map();
const THUMBNAIL_SIZE = 24;

/**
 * @param token Token
 */
export async function getTokenThumbnail(token) {
    if (!token.document) return;

    if (foundry.helpers.media.VideoHelper.hasVideoExtension(token.document.texture.src)) {
        let thumbnail = thumbnailCache.get(token.document.texture.src);
        if (!thumbnail) {
            thumbnail = await game.video.createThumbnail(token.document.texture.src, {width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE});
            thumbnailCache.set(token.document.texture.src, thumbnail);
        }
        return thumbnail;
    } else return token.document.texture.src;
}