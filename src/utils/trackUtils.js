/**
 * Create a clickable title with URL
 * @param {Object} track - Track object
 * @param {number} maxLength - Maximum title length (default 50)
 * @returns {string} Clickable markdown title
 */
function createClickableTitle(track, maxLength = 50) {
    if (!track) return 'Unknown';
    
    const title = track.title || 'Unknown';
    const truncatedTitle = title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
    
    const url = track.uri || track.url || (track.identifier ? `https://www.youtube.com/watch?v=${track.identifier}` : '');
    
    return url ? `[${truncatedTitle}](${url})` : truncatedTitle;
}

/**
 * Get track URL
 * @param {Object} track - Track object
 * @returns {string} Track URL
 */
function getTrackUrl(track) {
    if (!track) return '';
    return track.uri || track.url || (track.identifier ? `https://www.youtube.com/watch?v=${track.identifier}` : '');
}

module.exports = {
    createClickableTitle,
    getTrackUrl
};
