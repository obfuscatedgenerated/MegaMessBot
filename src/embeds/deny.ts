import { IconEmbedBuilder, Icon, ColorTable } from ".";

export class DenyEmbed extends IconEmbedBuilder {
    constructor(title_text = "Access Denied") {
        super(title_text, Icon.DENIED);
        this.setColor(ColorTable.DENIED);
    }
}

export class RateLimitEmbed extends DenyEmbed {
    constructor() {
        super("Rate Limit Exceeded");
        this.setDescription("You are being rate limited. Please try again shortly.");
    }
}
