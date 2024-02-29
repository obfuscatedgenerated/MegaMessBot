import { IconEmbedBuilder, Icon, ColorTable } from ".";

export class ErrorEmbed extends IconEmbedBuilder {
    constructor(title_text = "Error", add_default_description = true) {
        super(title_text, Icon.ERROR);
        this.setColor(ColorTable.ERROR);

        if (add_default_description) {
            this.setDescription("An error has occurred. Please try again later.");
        }
    }
}

export class ErrorEmbedWithLogging extends ErrorEmbed {
    constructor(error: Error, title_text = "Error") {
        super(title_text);
        console.error(error);
    }
}
