import type { get_spotify_sdk } from "..";
import type { PlaylistedTrack, User } from "@spotify/web-api-ts-sdk";

//const CACHE_EXPIRY = 60000; // 1 minute
const TRACK_FETCH_LIMIT = 50;

export interface UserAnalysis {
    added_tracks: PlaylistedTrack[];
}

export interface CachedUser extends User {
    //last_updated: number;
    analysis?: UserAnalysis;
}

const user_cache = new Map<string, CachedUser>();

///**
// * Purges the cache of users who haven't been updated in a while.
// */
//export const purge = () => {
//    const now = Date.now();
//
//    for (const [user_id, user] of user_cache) {
//        if (now - user.last_updated > CACHE_EXPIRY) {
//            user_cache.delete(user_id);
//        }
//    }
//};

// TODO: reintroduce purging for only specific properties (e.g. display_name, images, etc.)
// TODO: could also be automatically expiring with timeouts

/**
 * Gets a user, either from the cache or from the Spotify API.
 * 
 * @param spotify The Spotify SDK instance.
 * @param user_id The ID of the user to get.
 * @returns The user.
 */
export const get = async (spotify: ReturnType<typeof get_spotify_sdk>, user_id: string): Promise<CachedUser> => {
    const cached_user = user_cache.get(user_id);

    //if (cached_user && Date.now() - cached_user.last_updated < CACHE_EXPIRY) {
    if (cached_user) {
        return cached_user;
    }

    const user = await spotify.users.profile(user_id);
    //user.last_updated = Date.now();
    user_cache.set(user_id, user);

    console.warn(`CACHE MISS: ${user_id} (${user.display_name})`);

    return user;
};

/**
 * Lists all known users.<br>
 * This is not guaranteed to be complete, unless all users have been looked up at least once.<br>
 * The analysis command will build the full cache.
 * 
 * @returns The users.
 */
export const list = () => {
    return user_cache.values();
};

let analysis_snapshot: string;
let analysis_in_progress = false;

export const is_analysis_in_progress = () => analysis_in_progress;

export const is_analysis_due = async (spotify: ReturnType<typeof get_spotify_sdk>) => {
    const snapshot = (await spotify.playlists.getPlaylist(process.env.SPOTIFY_PLAYLIST_ID, null, "snapshot_id")).snapshot_id;

    if (snapshot === analysis_snapshot) {
        return false;
    }

    analysis_snapshot = snapshot;
    return true;
};

let analysis_start_time: number;

/**
 * Analyses the playlist to add and get information about all collaborating users.<br>
 * This will add the analysis field to all users in the cache.<br>
 * This function is expensive if the playlist has changed and should be used sparingly.<br>
 * If the playlist hasn't changed since the last analysis, this function will do nothing.
 * 
 * @param spotify The Spotify SDK instance.
 */
export const analyse = async (spotify: ReturnType<typeof get_spotify_sdk>, skip_check = false) => {
    if (analysis_in_progress) {
        return;
    }

    // ensure playlist has changed before re-analysing
    if (!skip_check && !is_analysis_due(spotify)) {
        return;
    }
    
    analysis_in_progress = true;

    console.warn("Re-analysing playlist...");
    analysis_start_time = Date.now();

    // TODO: some form of heuristic so that the whole playlist doesn't have to be re-analysed every time
    // as in a way to only analyse the difference, removing old tracks and adding new ones

    // TODO: purge users not found at least once

    let offset = 0;

    // iterate over all tracks in the playlist using pagination
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
        const tracks = await spotify.playlists.getPlaylistItems(
            process.env.SPOTIFY_PLAYLIST_ID,
            null,
            "items", // TODO: fetch reduced data, excluding irrelevant stuff. perhaps design cache around what caller requests
            TRACK_FETCH_LIMIT,
            offset
        );

        // push the tracks to the user's analysis, creating the user in the cache if necessary
        for (const item of tracks.items) {
            const user_id = item.added_by.id;
            const user = await get(spotify, user_id);

            if (user) {
                user.analysis ??= { added_tracks: [] };
                user.analysis.added_tracks.push(item);
            }
        }

        if (tracks.items.length < TRACK_FETCH_LIMIT) {
            break;
        }

        offset += TRACK_FETCH_LIMIT;
    }

    console.warn(`Playlist analysis took ${Date.now() - analysis_start_time}ms`);
    analysis_in_progress = false;
};

// TODO: embed to show when analysis is running
// TODO: additionally cache playlist tracks to speed up listbrowse and trackinfo commands
// TODO: persist cache to disk?
// TODO: set spotify instance at init and then dont bother passing it around
