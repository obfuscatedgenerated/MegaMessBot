import { RateLimiter } from "limiter";

export class DiscordRateLimit {
    #users: Map<string, RateLimiter>;

    #count: number;
    #interval: number;

    constructor(count: number, interval: number) {
        this.#users = new Map<string, RateLimiter>();
        this.#count = count;
        this.#interval = interval;
    }

    check(id: string): boolean {
        if (!this.#users.has(id)) {
            this.#users.set(id, new RateLimiter({ tokensPerInterval: this.#count, interval: this.#interval }));
        }
        return this.#users.get(id).tryRemoveTokens(1);
    }
}